(function exposeUmaLogProfitEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UmaLogProfitEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createProfitEngine() {
  'use strict';

  const ENGINE_VERSION = '5.0.0-multi-market-audit-locked';
  const CONFIG = Object.freeze({
    placementStrengthGamma: 0.8,
    decisionOddsHaircut: 0.1,
    minimumReferenceEv: 0.05,
    minimumLowerBoundEv: 0.05,
    validationStakeYen: 100,
    productionBuyEnabled: false,
    productionFractionalKelly: 0.125,
    maxBankrollFractionPerRace: 0.0025,
    maxBankrollFractionPerDay: 0.01,
    minimumTicketYen: 100,
    minimumRunners: 5,
    snapshotMinimumMinutesBeforePost: 1,
    snapshotMaximumMinutesBeforePost: 10,
    maximumSnapshotAgeMinutes: 2,
    probabilityBoundVersion: 'v5-win-bound-2019-fixed-bins-1'
  });

  // Win-only one-sided 90% calibration multipliers, frozen on 2019.
  const CALIBRATION_BINS = Object.freeze([
    [0, .01, .6272412708959415],
    [.01, .02, .6801091332631363],
    [.02, .03, 1],
    [.03, .04, 1],
    [.04, .05, .8162004243686676],
    [.05, .06, .8995772005882867],
    [.06, .08, 1],
    [.08, .1, .9199874145578668],
    [.1, .125, .8962041248470171],
    [.125, .15, .9329780646164743],
    [.15, .2, .9842140672190752],
    [.2, .25, .8635477440923478],
    [.25, .3, .9316015028441317],
    [.3, .4, .9202046008365709],
    [.4, .5, .8500247617138794],
    [.5, .65, .9710548533640603],
    [.65, 1.000000001, .9777643948512338]
  ]);

  function numeric(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round(value, digits = 6) {
    if (!Number.isFinite(Number(value))) return null;
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function normalize(values) {
    const usable = values.map(Number);
    if (!usable.length || usable.some(value => !Number.isFinite(value) || value <= 0)) {
      throw new Error('確率の正規化に使える正の値が必要です');
    }
    const total = usable.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new Error('確率の合計が0です');
    return usable.map(value => value / total);
  }

  function explicitProbability(runner) {
    return numeric(runner?.v5WinProbability
      ?? runner?.v5_win_probability
      ?? runner?.v3WinProbability
      ?? runner?.v3_win_probability
      ?? runner?.v3Probability
      ?? runner?.modelProbability);
  }

  function modelProbabilities(prediction) {
    const runners = prediction?.runners || [];
    const explicit = runners.map(explicitProbability);
    const supplied = explicit.filter(value => value !== null).length;
    if (supplied && supplied !== runners.length) {
      throw new Error('最終勝率は全出走馬分を揃える必要があります');
    }
    if (supplied === runners.length) {
      if (explicit.some(value => !(value > 0 && value < 1))) throw new Error('最終勝率が不正です');
      const total = explicit.reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 1) > 1e-4) throw new Error('最終勝率のレース内合計が1ではありません');
      const probabilityModel = prediction?.probabilityModel || {};
      const version = String(probabilityModel.version || '');
      const finalOutput = probabilityModel.output === 'final-win-probability';
      const trustedVersion = /^(?:3|5)(?:\.|$)|^v(?:3|5)/i.test(version);
      const trusted = probabilityModel.frozenBeforePost === true && trustedVersion;
      return {
        values: explicit,
        source: trusted
          ? (/5/.test(version) ? 'frozen-v5' : 'frozen-v3')
          : finalOutput ? 'published-final-probability' : 'unverified-model',
        trusted,
        finalOutput,
        note: trusted
          ? '発走前に固定された校正済み最終勝率'
          : finalOutput
            ? '当日公開モデルの最終勝率（v5では参考再計算のみ）'
            : '最終勝率の発走前固定保証がありません'
      };
    }

    if (!runners.length) throw new Error('出走馬がありません');
    const scores = runners.map(runner => numeric(runner.scoreRaw ?? runner.score));
    if (scores.some(value => value === null)) throw new Error('基礎能力点が不足しています');
    const maximum = Math.max(...scores);
    const temperature = 7.5;
    return {
      values: normalize(scores.map(score => Math.exp((score - maximum) / temperature))),
      source: 'browser-score-proxy',
      trusted: false,
      finalOutput: false,
      note: '100点評価を勝率へ変換した参考値（v5校正外）'
    };
  }

  function winOddsFor(runner) {
    return numeric(runner?.capturedOdds ?? runner?.winOddsSnapshot ?? runner?.odds);
  }

  function marketProbabilities(runners) {
    const odds = runners.map(winOddsFor);
    if (odds.some(value => value === null || value <= 1)) throw new Error('全出走馬の単勝オッズが必要です');
    return { odds, values: normalize(odds.map(value => 1 / value)) };
  }

  function calibratedLowerBound(probability) {
    const value = numeric(probability);
    if (!(value > 0 && value < 1)) throw new Error('勝率が不正です');
    const bin = CALIBRATION_BINS.find(([lower, upper]) => lower <= value && value < upper);
    if (!bin) throw new Error('勝率に対応する校正区間がありません');
    return Math.min(value, Math.max(0, value * bin[2]));
  }

  function placeCountFor(fieldSize) {
    const count = Math.max(0, Number(fieldSize) || 0);
    return count >= 8 ? 3 : count >= 5 ? 2 : 0;
  }

  function wideCountFor(fieldSize) {
    const count = Math.max(0, Number(fieldSize) || 0);
    return count >= 8 ? 3 : count >= 4 ? 2 : 0;
  }

  function pairKey(first, second) {
    return [Number(first), Number(second)].sort((a, b) => a - b).join('-');
  }

  function rankingMarginals(probabilities, paidPlaces, gamma = CONFIG.placementStrengthGamma) {
    const source = normalize(probabilities);
    const strength = normalize(source.map(value => value ** gamma));
    const count = strength.length;
    const places = Math.max(0, Math.min(3, Number(paidPlaces) || 0));
    const place = Array(count).fill(0);
    const pair = new Map();
    if (places < 2 || count < 2) return { strength, place, pair };

    if (places === 2) {
      for (let first = 0; first < count; first += 1) {
        const remaining = 1 - strength[first];
        for (let second = 0; second < count; second += 1) {
          if (second === first) continue;
          const probability = strength[first] * strength[second] / remaining;
          place[first] += probability;
          place[second] += probability;
          const key = pairKey(first, second);
          pair.set(key, (pair.get(key) || 0) + probability);
        }
      }
      return { strength, place, pair };
    }

    for (let first = 0; first < count; first += 1) {
      const afterFirst = 1 - strength[first];
      for (let second = 0; second < count; second += 1) {
        if (second === first) continue;
        const firstTwo = strength[first] * strength[second] / afterFirst;
        const afterSecond = afterFirst - strength[second];
        for (let third = 0; third < count; third += 1) {
          if (third === first || third === second) continue;
          const probability = firstTwo * strength[third] / afterSecond;
          place[first] += probability;
          place[second] += probability;
          place[third] += probability;
          [[first, second], [first, third], [second, third]].forEach(([a, b]) => {
            const key = pairKey(a, b);
            pair.set(key, (pair.get(key) || 0) + probability);
          });
        }
      }
    }
    return { strength, place, pair };
  }

  function oddsRange(value, fallbackUpper = null) {
    if (Array.isArray(value)) {
      const lower = numeric(value[0]);
      const upper = numeric(value[1] ?? value[0]);
      return lower !== null && lower > 1 && upper !== null && upper >= lower ? { lower, upper } : null;
    }
    if (value && typeof value === 'object') {
      const lower = numeric(value.lower ?? value.min ?? value.from ?? value.oddsLower);
      const upper = numeric(value.upper ?? value.max ?? value.to ?? value.oddsUpper ?? lower);
      return lower !== null && lower > 1 && upper !== null && upper >= lower ? { lower, upper } : null;
    }
    const lower = numeric(value);
    const upper = numeric(fallbackUpper ?? value);
    return lower !== null && lower > 1 && upper !== null && upper >= lower ? { lower, upper } : null;
  }

  function placeOddsFor(runner) {
    return oddsRange(
      runner?.capturedPlaceOdds ?? runner?.placeOdds ?? runner?.placeOddsLower,
      runner?.placeOddsUpper
    );
  }

  function wideOddsMap(prediction, race, explicit) {
    const source = explicit ?? prediction?.wideOdds ?? race?.wideOdds ?? [];
    const output = new Map();
    if (Array.isArray(source)) {
      source.forEach(item => {
        if (!item || !Array.isArray(item.numbers) || item.numbers.length !== 2) return;
        const range = oddsRange(item.odds ?? item, item.upper);
        if (range) output.set(pairKey(item.numbers[0], item.numbers[1]), range);
      });
      return output;
    }
    if (source && typeof source === 'object') {
      Object.entries(source).forEach(([key, value]) => {
        const numbers = key.split(/[-_]/).map(Number);
        const range = oddsRange(value);
        if (numbers.length === 2 && numbers.every(Number.isFinite) && range) {
          output.set(pairKey(numbers[0], numbers[1]), range);
        }
      });
    }
    return output;
  }

  function postTimestamp(race) {
    if (race?.scheduledPostAt) {
      const timestamp = Date.parse(race.scheduledPostAt);
      return Number.isFinite(timestamp) ? timestamp : null;
    }
    if (!race?.date || !race?.startTime) return null;
    const timestamp = Date.parse(`${race.date}T${race.startTime}:00+09:00`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function snapshotTiming(snapshotAt, race, evaluatedAt) {
    const snapshot = Date.parse(snapshotAt || '');
    const post = postTimestamp(race);
    if (!Number.isFinite(snapshot) || post === null) {
      return { valid: false, minutesBeforePost: null, snapshotAgeMinutes: null, reason: '発走前オッズの取得時刻を確認できません' };
    }
    const minutes = (post - snapshot) / 60000;
    if (!(minutes >= CONFIG.snapshotMinimumMinutesBeforePost
      && minutes <= CONFIG.snapshotMaximumMinutesBeforePost)) {
      return {
        valid: false,
        minutesBeforePost: minutes,
        snapshotAgeMinutes: null,
        reason: 'オッズ取得時刻が発走1〜10分前ではありません'
      };
    }
    const evaluated = Date.parse(evaluatedAt || '');
    if (!Number.isFinite(evaluated)) {
      return { valid: false, minutesBeforePost: minutes, snapshotAgeMinutes: null, reason: '期待値の計算時刻を確認できません' };
    }
    const age = (evaluated - snapshot) / 60000;
    const valid = age >= 0 && age <= CONFIG.maximumSnapshotAgeMinutes;
    return {
      valid,
      minutesBeforePost: minutes,
      snapshotAgeMinutes: age,
      reason: valid
        ? `発走${round(minutes, 1)}分前・取得後${round(age, 1)}分のオッズ`
        : 'オッズスナップショットが2分より古い、または未来時刻です'
    };
  }

  function productionStake(bankrollYen, lowerBoundEv, effectiveOdds) {
    const bankroll = Math.max(0, Math.floor(Number(bankrollYen) || 0));
    const ev = numeric(lowerBoundEv);
    const odds = numeric(effectiveOdds);
    if (!bankroll || ev === null || odds === null || ev <= 0 || odds <= 1) return 0;
    const fullKelly = ev / (odds - 1);
    const fraction = Math.min(CONFIG.maxBankrollFractionPerRace, CONFIG.productionFractionalKelly * fullKelly);
    const stake = Math.floor(bankroll * Math.max(0, fraction) / 100) * 100;
    return stake >= CONFIG.minimumTicketYen ? stake : 0;
  }

  function candidateRow({ type, numbers, names, probability, odds, probabilityLower90 = null }) {
    const range = oddsRange(odds);
    const effectiveOdds = range ? range.lower * (1 - CONFIG.decisionOddsHaircut) : null;
    const referenceEv = effectiveOdds === null ? null : probability * effectiveOdds - 1;
    const lowerBoundEv = probabilityLower90 === null || effectiveOdds === null
      ? null
      : probabilityLower90 * effectiveOdds - 1;
    return {
      type,
      numbers,
      names,
      number: numbers[0],
      name: names.join(' − '),
      probability,
      v4Probability: probability,
      winProbability: type === '単勝' ? probability : null,
      placeProbability: type === '複勝' ? probability : null,
      wideProbability: type === 'ワイド' ? probability : null,
      probabilityLower90,
      fairOdds: 1 / probability,
      oddsLower: range?.lower ?? null,
      oddsUpper: range?.upper ?? null,
      currentOdds: range?.lower ?? null,
      effectiveOdds,
      rawExpectedMultiplier: range ? probability * range.lower : null,
      stressedExpectedMultiplier: effectiveOdds === null ? null : probability * effectiveOdds,
      referenceEv,
      lowerBoundEv,
      requiredOddsBreakEven: 1 / (probability * (1 - CONFIG.decisionOddsHaircut)),
      requiredOddsAtThreshold: (1 + CONFIG.minimumReferenceEv) / (probability * (1 - CONFIG.decisionOddsHaircut))
    };
  }

  function eligibilityBlockers(prediction, race, timing, rows) {
    const blockers = [];
    if ((race?.raceType || 'flat') === 'jump') blockers.push('障害戦は対象外');
    if (race?.isDebut === true || /新馬/.test(String(race?.name || ''))) blockers.push('新馬戦は対象外');
    if (rows.length < CONFIG.minimumRunners) blockers.push('5頭未満は対象外');
    if (prediction?.runners?.some(runner => runner.scratched === true)) blockers.push('取消・除外反映後の出走馬一覧が必要');
    if (!timing.valid) blockers.push(timing.reason);
    return blockers;
  }

  function analyze(prediction, options = {}) {
    const race = options.race || {};
    const runners = Array.isArray(prediction?.runners) ? prediction.runners : [];
    const gateStatus = String(options.gateStatus || 'LOCKED').toUpperCase();
    let model;
    let market;
    try {
      model = modelProbabilities(prediction);
      market = marketProbabilities(runners);
    } catch (error) {
      return {
        engineVersion: ENGINE_VERSION,
        status: 'SKIP',
        message: `見送り（${error.message}）`,
        blockers: [error.message],
        rows: [],
        candidates: [],
        priceTargets: [],
        candidate: null,
        modelSource: model?.source || 'unavailable',
        modelTrusted: false,
        realStakeYen: 0,
        paperStakeYen: 0,
        gateStatus
      };
    }

    // v5 consumes the calibrated final probability directly.  The old v4
    // market-residual shrinkage is intentionally not applied a second time.
    const win = model.values;
    const fieldSize = Number(prediction?.fieldSize) || runners.length;
    const placeCount = placeCountFor(fieldSize);
    const wideCount = wideCountFor(fieldSize);
    const placeMarginals = rankingMarginals(win, placeCount);
    const wideMarginals = wideCount === placeCount
      ? placeMarginals
      : rankingMarginals(win, wideCount);
    const rows = runners.map((runner, index) => {
      const probabilityLower90 = model.trusted ? calibratedLowerBound(win[index]) : null;
      const effectiveOdds = market.odds[index] * (1 - CONFIG.decisionOddsHaircut);
      return {
        number: Number(runner.number),
        name: String(runner.name || `馬番${runner.number}`),
        rank: Number(runner.rank) || index + 1,
        score: numeric(runner.score),
        modelProbability: model.values[index],
        marketProbability: market.values[index],
        winProbability: win[index],
        v4Probability: win[index],
        placeProbability: placeCount ? placeMarginals.place[index] : null,
        probabilityLower90,
        fairOdds: 1 / win[index],
        currentOdds: market.odds[index],
        effectiveOdds,
        referenceEv: win[index] * effectiveOdds - 1,
        lowerBoundEv: probabilityLower90 === null ? null : probabilityLower90 * effectiveOdds - 1,
        placeOdds: placeOddsFor(runner)
      };
    });
    const candidates = [];
    rows.forEach((row, index) => {
      candidates.push(candidateRow({
        type: '単勝',
        numbers: [row.number],
        names: [row.name],
        probability: row.winProbability,
        odds: market.odds[index],
        probabilityLower90: model.trusted ? calibratedLowerBound(row.winProbability) : null
      }));
      if (placeCount && row.placeOdds) {
        candidates.push(candidateRow({
          type: '複勝',
          numbers: [row.number],
          names: [row.name],
          probability: row.placeProbability,
          odds: row.placeOdds
        }));
      }
    });

    const wideMarket = wideOddsMap(prediction, race, options.wideOdds);
    for (let first = 0; first < runners.length; first += 1) {
      for (let second = first + 1; second < runners.length; second += 1) {
        const firstNumber = Number(runners[first].number);
        const secondNumber = Number(runners[second].number);
        const probability = wideMarginals.pair.get(pairKey(first, second));
        const odds = wideMarket.get(pairKey(firstNumber, secondNumber));
        if (!probability || !odds) continue;
        candidates.push(candidateRow({
          type: 'ワイド',
          numbers: [firstNumber, secondNumber],
          names: [rows[first].name, rows[second].name],
          probability,
          odds
        }));
      }
    }

    const priceTargets = [];
    if (placeCount) {
      rows.filter(row => !row.placeOdds)
        .sort((a, b) => b.placeProbability - a.placeProbability || a.number - b.number)
        .slice(0, 3)
        .forEach(row => priceTargets.push(candidateRow({
          type: '複勝', numbers: [row.number], names: [row.name], probability: row.placeProbability, odds: null
        })));
    }
    const wideTargets = [];
    for (let first = 0; first < runners.length; first += 1) {
      for (let second = first + 1; second < runners.length; second += 1) {
        const firstNumber = Number(runners[first].number);
        const secondNumber = Number(runners[second].number);
        const key = pairKey(firstNumber, secondNumber);
        if (wideMarket.has(key)) continue;
        const probability = wideMarginals.pair.get(pairKey(first, second));
        if (!probability) continue;
        wideTargets.push(candidateRow({
          type: 'ワイド',
          numbers: [firstNumber, secondNumber],
          names: [rows[first].name, rows[second].name],
          probability,
          odds: null
        }));
      }
    }
    wideTargets.sort((a, b) => b.probability - a.probability || a.numbers[0] - b.numbers[0] || a.numbers[1] - b.numbers[1]);
    priceTargets.push(...wideTargets.slice(0, 3));

    candidates.sort((a, b) => (b.referenceEv ?? -Infinity) - (a.referenceEv ?? -Infinity)
      || b.probability - a.probability
      || a.type.localeCompare(b.type, 'ja')
      || a.numbers[0] - b.numbers[0]);
    const candidate = candidates[0] || null;
    const snapshotAt = options.snapshotAt
      || prediction?.oddsCapturedAt
      || prediction?.capturedAt
      || prediction?.generatedAt;
    const evaluatedAt = options.evaluatedAt || prediction?.evaluatedAt || prediction?.generatedAt;
    const timing = snapshotTiming(snapshotAt, race, evaluatedAt);
    const blockers = eligibilityBlockers(prediction, race, timing, rows);
    if (!model.trusted) blockers.push(model.note);

    let status = 'SKIP';
    let message = '見送り（入力条件外）';
    let paperStakeYen = 0;
    let realStakeYen = 0;
    if (!candidate) {
      blockers.push('実オッズ付きの購入候補を計算できません');
    } else if (!model.trusted) {
      status = 'REFERENCE_ONLY';
      message = candidate.referenceEv >= CONFIG.minimumReferenceEv
        ? 'v5参考候補（事後再計算・購入0円）'
        : '参考予測のみ（利益判定には未使用）';
    } else if (blockers.length) {
      message = '見送り（対象・時刻条件外）';
    } else if (candidate.referenceEv < CONFIG.minimumReferenceEv) {
      blockers.push('オッズ10%低下後の期待値が+5%未満');
      message = '見送り（期待値が+5%未満）';
    } else if (gateStatus !== 'VERIFIED' || !CONFIG.productionBuyEnabled || candidate.lowerBoundEv === null) {
      status = 'PAPER_ONLY';
      paperStakeYen = CONFIG.validationStakeYen;
      blockers.push(candidate.lowerBoundEv === null
        ? `${candidate.type}の確率下限と払戻を前向き検証中`
        : '前向き検証ゲートが未承認');
      message = `仮想検証のみ${CONFIG.validationStakeYen}円（実購入0円）`;
    } else if (candidate.lowerBoundEv < CONFIG.minimumLowerBoundEv) {
      blockers.push('90%確率下限の保守EVが+5%未満');
      message = '見送り（保守EVが+5%未満）';
    } else {
      realStakeYen = productionStake(options.bankrollYen, candidate.lowerBoundEv, candidate.effectiveOdds);
      if (realStakeYen > 0) {
        status = 'BUY';
        const numbers = candidate.numbers.join('-');
        message = `${race.venue || ''}${race.raceNumber || ''}R ${candidate.type}${numbers} ${realStakeYen.toLocaleString('ja-JP')}円`;
      } else {
        blockers.push('資金配分が100円未満');
        message = '見送り（資金配分が100円未満）';
      }
    }

    return {
      engineVersion: ENGINE_VERSION,
      probabilityBoundVersion: CONFIG.probabilityBoundVersion,
      status,
      message,
      blockers,
      rows,
      candidates,
      priceTargets,
      candidate,
      placeCount,
      wideCount,
      modelSource: model.source,
      modelSourceNote: model.note,
      modelTrusted: model.trusted,
      timing,
      gateStatus,
      realStakeYen,
      paperStakeYen
    };
  }

  function createPlan(prediction, options = {}) {
    const analysis = analyze(prediction, options);
    const candidate = analysis.candidate;
    const amount = analysis.status === 'BUY' ? analysis.realStakeYen : analysis.paperStakeYen;
    const tickets = amount > 0 && candidate ? [{
      type: candidate.type,
      numbers: candidate.numbers.slice(),
      names: candidate.names.slice(),
      ordered: false,
      amount,
      paperOnly: analysis.status === 'PAPER_ONLY',
      note: analysis.status === 'PAPER_ONLY' ? 'v5多券種・前向き検証' : 'v5保守EV基準'
    }] : [];
    return {
      modelVersion: ENGINE_VERSION,
      mode: analysis.status === 'PAPER_ONLY' ? 'paper' : analysis.status === 'BUY' ? 'production' : 'skip',
      budget: Math.max(0, Math.floor(Number(options.bankrollYen) || 0)),
      allocated: amount,
      realAllocated: analysis.realStakeYen,
      paperAllocated: analysis.paperStakeYen,
      unallocated: Math.max(0, Math.floor(Number(options.bankrollYen) || 0) - analysis.realStakeYen),
      fieldSize: prediction?.fieldSize || prediction?.runners?.length || 0,
      tickets,
      reason: analysis.message,
      recommendation: analysis
    };
  }

  return Object.freeze({
    ENGINE_VERSION,
    CONFIG,
    CALIBRATION_BINS,
    analyze,
    createPlan,
    calibratedLowerBound,
    productionStake,
    placeCountFor,
    wideCountFor,
    rankingMarginals,
    _test: Object.freeze({ normalize, modelProbabilities, marketProbabilities, snapshotTiming, oddsRange, wideOddsMap, pairKey })
  });
}));
