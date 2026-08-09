(function exposeUmaLogProfitEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UmaLogProfitEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createProfitEngine() {
  'use strict';

  const ENGINE_VERSION = '4.0.0-web-audit-locked';
  const CONFIG = Object.freeze({
    residualShrinkageTau: 0.8,
    decisionOddsHaircut: 0.1,
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
    probabilityBoundVersion: 'v4-bound-2019-fixed-bins-1'
  });

  // [lower inclusive, upper exclusive, one-sided 90% calibration multiplier]
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

  function clamp(value, minimum = 0, maximum = 1) {
    const parsed = numeric(value);
    return parsed === null ? minimum : Math.max(minimum, Math.min(maximum, parsed));
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
    return numeric(runner?.v3WinProbability ?? runner?.v3_win_probability ?? runner?.v3Probability ?? runner?.modelProbability);
  }

  function modelProbabilities(prediction) {
    const runners = prediction?.runners || [];
    const explicit = runners.map(explicitProbability);
    const supplied = explicit.filter(value => value !== null).length;
    if (supplied && supplied !== runners.length) {
      throw new Error('v3勝率は全出走馬分を揃える必要があります');
    }
    if (supplied === runners.length) {
      if (explicit.some(value => !(value > 0 && value < 1))) throw new Error('v3勝率が不正です');
      const total = explicit.reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 1) > 1e-4) throw new Error('v3勝率のレース内合計が1ではありません');
      const probabilityModel = prediction?.probabilityModel || {};
      const trusted = probabilityModel.frozenBeforePost === true
        && /^3(?:\.|$)|v3/i.test(String(probabilityModel.version || ''));
      return {
        values: explicit,
        source: trusted ? 'frozen-v3' : 'unverified-v3',
        trusted,
        note: trusted ? '発走前に固定されたv3勝率' : 'v3勝率の発走前固定保証がありません'
      };
    }

    if (!runners.length) throw new Error('出走馬がありません');
    const scores = runners.map(runner => numeric(runner.scoreRaw ?? runner.score));
    if (scores.some(value => value === null)) throw new Error('基礎能力点が不足しています');
    const maximum = Math.max(...scores);
    const temperature = 7.5;
    const proxy = normalize(scores.map(score => Math.exp((score - maximum) / temperature)));
    return {
      values: proxy,
      source: 'browser-score-proxy',
      trusted: false,
      note: '100点評価を勝率へ変換した参考値（v3校正外）'
    };
  }

  function marketProbabilities(runners) {
    const odds = runners.map(runner => numeric(runner.capturedOdds ?? runner.odds));
    if (odds.some(value => value === null || value <= 1)) throw new Error('全出走馬の単勝オッズが必要です');
    return { odds, values: normalize(odds.map(value => 1 / value)) };
  }

  function blendProbabilities(model, market, tau = CONFIG.residualShrinkageTau) {
    if (model.length !== market.length || !model.length) throw new Error('モデル確率と市場確率の頭数が一致しません');
    const weight = model.map((probability, index) => {
      const q = market[index];
      if (!(probability > 0 && probability < 1 && q > 0 && q < 1)) throw new Error('勝率が不正です');
      return q * (probability / q) ** tau;
    });
    return normalize(weight);
  }

  function calibratedLowerBound(probability) {
    const value = numeric(probability);
    if (!(value > 0 && value < 1)) throw new Error('v4勝率が不正です');
    const bin = CALIBRATION_BINS.find(([lower, upper]) => lower <= value && value < upper);
    if (!bin) throw new Error('勝率に対応する校正区間がありません');
    return Math.min(value, Math.max(0, value * bin[2]));
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

  function snapshotTiming(snapshotAt, race, generatedAt) {
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
    const generated = Date.parse(generatedAt || '');
    if (!Number.isFinite(generated)) {
      return {
        valid: false,
        minutesBeforePost: minutes,
        snapshotAgeMinutes: null,
        reason: '予測計算時刻を確認できません'
      };
    }
    const age = (generated - snapshot) / 60000;
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
    const fraction = Math.min(
      CONFIG.maxBankrollFractionPerRace,
      CONFIG.productionFractionalKelly * fullKelly
    );
    const stake = Math.floor(bankroll * Math.max(0, fraction) / 100) * 100;
    return stake >= CONFIG.minimumTicketYen ? stake : 0;
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
        candidate: null,
        modelSource: model?.source || 'unavailable',
        modelTrusted: false,
        realStakeYen: 0,
        paperStakeYen: 0,
        gateStatus
      };
    }

    const blended = blendProbabilities(model.values, market.values);
    const rows = runners.map((runner, index) => {
      const v4Probability = blended[index];
      const probabilityLower90 = model.trusted ? calibratedLowerBound(v4Probability) : null;
      const effectiveOdds = market.odds[index] * (1 - CONFIG.decisionOddsHaircut);
      const lowerBoundEv = probabilityLower90 === null ? null : probabilityLower90 * effectiveOdds - 1;
      return {
        number: Number(runner.number),
        name: String(runner.name || `馬番${runner.number}`),
        rank: Number(runner.rank) || index + 1,
        score: numeric(runner.score),
        modelProbability: model.values[index],
        marketProbability: market.values[index],
        v4Probability,
        probabilityLower90,
        fairOdds: 1 / v4Probability,
        currentOdds: market.odds[index],
        effectiveOdds,
        referenceEv: v4Probability * effectiveOdds - 1,
        lowerBoundEv
      };
    });
    const candidate = rows.slice().sort((a, b) => {
      const evA = a.lowerBoundEv ?? a.referenceEv;
      const evB = b.lowerBoundEv ?? b.referenceEv;
      return evB - evA || b.v4Probability - a.v4Probability || a.number - b.number;
    })[0] || null;
    const snapshotAt = options.snapshotAt || prediction?.capturedAt || prediction?.generatedAt;
    const timing = snapshotTiming(snapshotAt, race, prediction?.generatedAt);
    const blockers = eligibilityBlockers(prediction, race, timing, rows);
    if (!model.trusted) blockers.push(model.note);

    let status = 'SKIP';
    let message = '見送り（入力条件外）';
    let paperStakeYen = 0;
    let realStakeYen = 0;
    if (!candidate) {
      blockers.push('購入候補を計算できません');
    } else if (blockers.length) {
      message = model.trusted ? '見送り（対象・時刻条件外）' : '参考予測のみ（利益判定には未使用）';
      status = model.trusted ? 'SKIP' : 'REFERENCE_ONLY';
    } else if (candidate.lowerBoundEv < CONFIG.minimumLowerBoundEv) {
      blockers.push('保守期待値が購入基準未満');
      message = '見送り（保守EVが+5%未満）';
    } else if (gateStatus !== 'VERIFIED' || !CONFIG.productionBuyEnabled) {
      status = 'PAPER_ONLY';
      paperStakeYen = CONFIG.validationStakeYen;
      blockers.push('前向き検証ゲートが未承認');
      message = '仮想検証のみ100円（実購入0円）';
    } else {
      realStakeYen = productionStake(options.bankrollYen, candidate.lowerBoundEv, candidate.effectiveOdds);
      if (realStakeYen > 0) {
        status = 'BUY';
        message = `${race.venue || ''}${race.raceNumber || ''}R ${candidate.number}番${candidate.name} 単勝${realStakeYen.toLocaleString('ja-JP')}円`;
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
      candidate,
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
      type: '単勝',
      numbers: [candidate.number],
      names: [candidate.name],
      ordered: false,
      amount,
      paperOnly: analysis.status === 'PAPER_ONLY',
      note: analysis.status === 'PAPER_ONLY' ? 'v4前向き検証' : 'v4保守EV基準'
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
    _test: Object.freeze({ normalize, modelProbabilities, marketProbabilities, blendProbabilities, snapshotTiming })
  });
}));
