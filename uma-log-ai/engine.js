(function initUmaLogEngine(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UmaLogEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createEngine() {
  'use strict';

  const ENGINE_VERSION = '1.2.0';

  const CATEGORY_META = [
    { key: 'recentForm', label: '直近5走', short: '近走', weight: 22 },
    { key: 'surface', label: '芝・ダート適性', short: '馬場', weight: 10 },
    { key: 'distance', label: '距離適性', short: '距離', weight: 10 },
    { key: 'course', label: '競馬場・コース適性', short: 'コース', weight: 8 },
    { key: 'going', label: '馬場状態適性', short: '道悪', weight: 7 },
    { key: 'drawPace', label: '枠順・脚質・展開', short: '展開', weight: 12 },
    { key: 'jockey', label: '騎手成績・馬との相性', short: '騎手', weight: 10 },
    { key: 'condition', label: '斤量・馬体重・間隔', short: '状態', weight: 7 },
    { key: 'classLevel', label: 'クラス・相手関係', short: '相手', weight: 9 },
    { key: 'connections', label: '血統・調教師・追い切り', short: '背景', weight: 5 }
  ];
  const DEFAULT_WEIGHTS = Object.freeze(Object.fromEntries(CATEGORY_META.map(item => [item.key, item.weight])));
  const MARKS = ['◎', '○', '▲', '△', '☆'];
  const STYLE_LABELS = { front: '逃げ', stalk: '先行', mid: '差し', close: '追込', unknown: '不明' };
  const GOING_GROUPS = {
    firm: 'dry', good: 'dry', standard: 'dry', yielding: 'wet', soft: 'wet', heavy: 'wet', muddy: 'wet'
  };

  function clamp(value, min = 0, max = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function numeric(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function mean(values) {
    const usable = values.map(numeric).filter(value => value !== null);
    return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
  }

  function weightedMean(items) {
    let numerator = 0;
    let denominator = 0;
    items.forEach(item => {
      const value = numeric(item.value);
      const weight = numeric(item.weight);
      if (value === null || weight === null || weight <= 0) return;
      numerator += value * weight;
      denominator += weight;
    });
    return denominator ? numerator / denominator : null;
  }

  function safeRatio(value, fallback = .5) {
    const number = numeric(value);
    return number === null ? fallback : clamp(number);
  }

  function ratioFromPercent(value, expectedMax = 100) {
    const number = numeric(value);
    if (number === null) return null;
    return clamp(number / expectedMax);
  }

  function metric(ratio, coverage, evidence) {
    return {
      ratio: safeRatio(ratio),
      coverage: clamp(coverage),
      evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [String(evidence || '')].filter(Boolean)
    };
  }

  function normalizeWeights(input) {
    const values = {};
    CATEGORY_META.forEach(item => {
      const candidate = numeric(input?.[item.key]);
      values[item.key] = candidate !== null && candidate >= 0 ? candidate : item.weight;
    });
    const total = Object.values(values).reduce((sum, value) => sum + value, 0);
    if (!total) return { ...DEFAULT_WEIGHTS };
    const units = CATEGORY_META.map((item, index) => {
      const exact = values[item.key] * 10000 / total;
      return { key: item.key, index, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let missing = 10000 - units.reduce((sum, item) => sum + item.value, 0);
    units.slice().sort((a, b) => b.remainder - a.remainder || a.index - b.index).forEach(item => {
      if (missing <= 0) return;
      item.value += 1;
      missing -= 1;
    });
    return Object.fromEntries(units.map(item => [item.key, item.value / 100]));
  }

  function mergeHorseEdition(horse, edition) {
    const base = { ...horse };
    delete base.versions;
    const override = horse?.versions?.[edition] || {};
    return {
      ...base,
      ...override,
      jockeyStats: { ...(horse?.jockeyStats || {}), ...(override?.jockeyStats || {}) },
      trainerStats: { ...(horse?.trainerStats || {}), ...(override?.trainerStats || {}) },
      pedigree: { ...(horse?.pedigree || {}), ...(override?.pedigree || {}) },
      workout: { ...(horse?.workout || {}), ...(override?.workout || {}) },
      recentRuns: Array.isArray(override?.recentRuns) ? override.recentRuns : (Array.isArray(horse?.recentRuns) ? horse.recentRuns : [])
    };
  }

  function mergeRaceEdition(race, edition) {
    const base = { ...race };
    delete base.versions;
    return { ...base, ...(race?.versions?.[edition] || {}), horses: race.horses, result: race.result };
  }

  function runQuality(run) {
    if (!run || typeof run !== 'object') return null;
    const parts = [];
    const finish = numeric(run.finish);
    const fieldSize = numeric(run.fieldSize);
    if (finish !== null && fieldSize !== null && fieldSize > 1) {
      parts.push({ value: clamp(1 - (finish - 1) / (fieldSize - 1)), weight: 3 });
    }
    const margin = numeric(run.margin);
    if (margin !== null) parts.push({ value: clamp(.72 - margin / 7), weight: 1.25 });
    const last3FRank = numeric(run.last3FRank);
    if (last3FRank !== null && fieldSize !== null && fieldSize > 1) {
      parts.push({ value: clamp(1 - (last3FRank - 1) / (fieldSize - 1)), weight: 1.35 });
    }
    const speed = numeric(run.speedRating);
    if (speed !== null) parts.push({ value: clamp((speed - 55) / 65), weight: 1.7 });
    const quality = weightedMean(parts);
    return quality === null ? null : clamp(quality);
  }

  function scoreRecentForm(horse) {
    const runs = horse.recentRuns.slice(0, 5);
    const recency = [1, .86, .73, .62, .52];
    const values = runs.map((run, index) => ({ value: runQuality(run), weight: recency[index] }));
    const ratio = weightedMean(values);
    const usable = values.filter(item => item.value !== null).length;
    const latest = runs[0];
    const evidence = [];
    if (latest?.finish) evidence.push(`前走${latest.finish}着`);
    const recentTop3 = runs.filter(run => numeric(run.finish) !== null && Number(run.finish) <= 3).length;
    if (recentTop3) evidence.push(`近5走で3着内${recentTop3}回`);
    if (numeric(latest?.last3FRank) === 1) evidence.push('前走上がり最速');
    return metric(ratio, usable / 5, evidence.length ? evidence : '近走データ不足');
  }

  function scoreSurface(horse, race) {
    const runs = horse.recentRuns.filter(run => run.surface === race.surface);
    const runScore = mean(runs.map(runQuality));
    const pedigree = ratioFromPercent(horse.pedigree?.[`${race.surface}Score`]);
    const ratio = weightedMean([{ value: runScore, weight: 3 }, { value: pedigree, weight: 1 }]);
    const evidence = [];
    if (runs.length) evidence.push(`同じ${race.surface === 'turf' ? '芝' : 'ダート'}で${runs.length}走`);
    if (pedigree !== null && pedigree >= .7) evidence.push('血統適性が高い');
    return metric(ratio, clamp((runs.length + (pedigree !== null ? 1 : 0)) / 4), evidence.length ? evidence : '同馬場の実績不足');
  }

  function scoreDistance(horse, race) {
    const candidates = horse.recentRuns.map(run => {
      const distance = numeric(run.distance);
      if (distance === null) return { value: null, weight: 0 };
      const closeness = Math.exp(-Math.abs(distance - race.distance) / 520);
      const quality = runQuality(run);
      return { value: quality === null ? closeness * .5 : quality * .74 + closeness * .26, weight: closeness };
    });
    const runScore = weightedMean(candidates);
    const explicit = ratioFromPercent(horse.distanceFit);
    const pedigree = ratioFromPercent(horse.pedigree?.distanceScore);
    const ratio = weightedMean([{ value: runScore, weight: 3 }, { value: explicit, weight: 1.2 }, { value: pedigree, weight: .8 }]);
    const closeRuns = horse.recentRuns.filter(run => numeric(run.distance) !== null && Math.abs(Number(run.distance) - race.distance) <= 200);
    const evidence = closeRuns.length ? [`近い距離で${closeRuns.length}走`] : ['距離実績が少ない'];
    if (explicit !== null && explicit >= .72) evidence.push('距離適性指数が高い');
    return metric(ratio, clamp((closeRuns.length + (explicit !== null ? 1 : 0) + (pedigree !== null ? 1 : 0)) / 4), evidence);
  }

  function scoreCourse(horse, race) {
    const sameVenue = horse.recentRuns.filter(run => run.venue === race.venue);
    const sameDirection = horse.recentRuns.filter(run => run.direction && run.direction === race.direction);
    const venueScore = mean(sameVenue.map(runQuality));
    const directionScore = mean(sameDirection.map(runQuality));
    const explicit = ratioFromPercent(horse.courseFit);
    const ratio = weightedMean([{ value: venueScore, weight: 3 }, { value: directionScore, weight: 1 }, { value: explicit, weight: 1.3 }]);
    const evidence = [];
    if (sameVenue.length) evidence.push(`${race.venue}で${sameVenue.length}走`);
    if (sameVenue.some(run => Number(run.finish) <= 3)) evidence.push('同場で好走歴');
    if (!evidence.length) evidence.push('同コース実績不足');
    return metric(ratio, clamp((sameVenue.length + sameDirection.length * .35 + (explicit !== null ? 1 : 0)) / 4), evidence);
  }

  function scoreGoing(horse, race) {
    const group = GOING_GROUPS[race.going] || race.going;
    const matching = horse.recentRuns.filter(run => (GOING_GROUPS[run.going] || run.going) === group);
    const runScore = mean(matching.map(runQuality));
    const explicit = ratioFromPercent(horse.goingFit);
    const ratio = weightedMean([{ value: runScore, weight: 2.5 }, { value: explicit, weight: 1 }]);
    const evidence = matching.length ? [`近い馬場状態で${matching.length}走`] : ['馬場状態の実績不足'];
    if (matching.some(run => Number(run.finish) <= 3)) evidence.push('同系馬場で好走');
    return metric(ratio, clamp((matching.length + (explicit !== null ? 1 : 0)) / 3), evidence);
  }

  function stylePaceFit(style, pace) {
    const table = {
      fast: { front: .46, stalk: .66, mid: .83, close: .76, unknown: .5 },
      middle: { front: .7, stalk: .78, mid: .7, close: .57, unknown: .5 },
      slow: { front: .86, stalk: .8, mid: .57, close: .42, unknown: .5 }
    };
    return table[pace]?.[style] ?? .5;
  }

  function scoreDrawPace(horse, race, maxGate) {
    if (race.raceType === 'jump') return metric(.5, .15, '障害戦は枠順・脚質の影響を限定評価');
    const gate = numeric(horse.gate);
    const bias = numeric(race.drawBias) ?? 0;
    let drawScore = null;
    if (gate !== null && maxGate > 1) {
      const position = (gate - 1) / (maxGate - 1);
      drawScore = clamp(.64 + (position - .5) * bias * .7);
    }
    const pace = stylePaceFit(horse.runningStyle || 'unknown', race.pace || 'middle');
    const explicitPace = ratioFromPercent(horse.paceFit);
    const explicitDraw = ratioFromPercent(horse.drawFit);
    const ratio = weightedMean([
      { value: drawScore, weight: 1.2 },
      { value: pace, weight: 2 },
      { value: explicitPace, weight: 1 },
      { value: explicitDraw, weight: .8 }
    ]);
    const paceLabel = { fast: '速め', middle: '平均', slow: '遅め' }[race.pace] || '平均';
    const evidence = [`想定${paceLabel}×${STYLE_LABELS[horse.runningStyle] || '脚質不明'}`];
    if (drawScore !== null && drawScore >= .7) evidence.push('枠順に追い風');
    if (pace >= .75) evidence.push('展開が向きそう');
    return metric(ratio, clamp((gate !== null ? .35 : 0) + (horse.runningStyle ? .35 : 0) + (explicitPace !== null ? .15 : 0) + (explicitDraw !== null ? .15 : 0)), evidence);
  }

  function scoreJockey(horse, race) {
    const stats = horse.jockeyStats || {};
    const values = [
      { value: ratioFromPercent(stats.winRate, .25), weight: 1.2 },
      { value: ratioFromPercent(stats.placeRate, .55), weight: 1.6 },
      { value: ratioFromPercent(stats.coursePlaceRate, .55), weight: 1.5 },
      { value: ratioFromPercent(stats.pairPlaceRate, .6), weight: 1.7 }
    ];
    const ratio = weightedMean(values);
    const usable = values.filter(item => item.value !== null).length;
    const evidence = [];
    if (numeric(stats.coursePlaceRate) !== null) evidence.push(`${race.venue}複勝率${round(Number(stats.coursePlaceRate) * 100, 0)}%`);
    if (numeric(stats.pairStarts) >= 3) evidence.push(`コンビ${stats.pairStarts}戦`);
    if (!evidence.length) evidence.push('騎手データ不足');
    return metric(ratio, usable / values.length, evidence);
  }

  function scoreCondition(horse, fieldContext = {}) {
    const values = [];
    const evidence = [];
    const bodyChange = numeric(horse.bodyWeightChange);
    if (bodyChange !== null) {
      const abs = Math.abs(bodyChange);
      values.push({ value: abs <= 4 ? .78 : abs <= 8 ? .64 : abs <= 12 ? .46 : .28, weight: 1.3 });
      evidence.push(`馬体重${bodyChange >= 0 ? '+' : ''}${bodyChange}kg`);
    }
    const restDays = numeric(horse.restDays);
    if (restDays !== null) {
      const restScore = restDays >= 18 && restDays <= 56 ? .78 : restDays >= 10 && restDays <= 90 ? .64 : restDays <= 180 ? .48 : .35;
      values.push({ value: restScore, weight: 1.25 });
      evidence.push(`中${Math.max(0, Math.round(restDays / 7) - 1)}週`);
    }
    const burdenChange = numeric(horse.burdenChange);
    if (burdenChange !== null) {
      values.push({ value: clamp(.62 - burdenChange * .08), weight: 1 });
      if (burdenChange <= -1) evidence.push('斤量減');
      else if (burdenChange >= 1) evidence.push('斤量増');
    }
    const carriedWeight = numeric(horse.carriedWeight);
    const meanCarriedWeight = numeric(fieldContext.meanCarriedWeight);
    if (carriedWeight !== null && meanCarriedWeight !== null) {
      const difference = carriedWeight - meanCarriedWeight;
      values.push({ value: clamp(.58 - difference * .055), weight: .9 });
      evidence.push(`斤量${carriedWeight}kg（平均との差${difference >= 0 ? '+' : ''}${round(difference, 1)}kg）`);
    }
    const bodyWeight = numeric(horse.bodyWeight);
    if (bodyWeight !== null) evidence.push(`馬体重${bodyWeight}kg`);
    const explicit = ratioFromPercent(horse.conditionScore);
    values.push({ value: explicit, weight: 1.1 });
    const ratio = weightedMean(values);
    return metric(ratio, values.filter(item => item.value !== null).length / 5, evidence.length ? evidence : '当日状態データ不足');
  }

  function scoreClassLevel(horse, race) {
    const speed = mean(horse.recentRuns.map(run => {
      const value = numeric(run.speedRating);
      return value === null ? null : clamp((value - 55) / 65);
    }));
    const opponent = mean(horse.recentRuns.map(run => ratioFromPercent(run.opponentRating)));
    const classRuns = horse.recentRuns.filter(run => numeric(run.classLevel) !== null);
    const classFit = classRuns.length ? mean(classRuns.map(run => {
      const difference = Number(run.classLevel) - Number(race.classLevel || run.classLevel);
      return clamp((runQuality(run) ?? .5) + difference * .08);
    })) : null;
    const explicit = ratioFromPercent(horse.classFit);
    const ratio = weightedMean([{ value: speed, weight: 1.7 }, { value: opponent, weight: 1.2 }, { value: classFit, weight: 1.5 }, { value: explicit, weight: 1 }]);
    const evidence = [];
    if (numeric(horse.recentRuns[0]?.classLevel) > numeric(race.classLevel)) evidence.push('前走から相手弱化');
    if (speed !== null && speed >= .72) evidence.push('近走指数上位');
    if (!evidence.length) evidence.push('相手比較は標準');
    return metric(ratio, clamp(([speed, opponent, classFit, explicit].filter(value => value !== null).length) / 4), evidence);
  }

  function scoreConnections(horse, race) {
    const values = [
      { value: ratioFromPercent(horse.pedigree?.[`${race.surface}Score`]), weight: 1 },
      { value: ratioFromPercent(horse.pedigree?.distanceScore), weight: .8 },
      { value: ratioFromPercent(horse.trainerStats?.placeRate, .5), weight: 1 },
      { value: ratioFromPercent(horse.trainerStats?.coursePlaceRate, .5), weight: .8 },
      { value: ratioFromPercent(horse.workout?.score), weight: 1.5 }
    ];
    const ratio = weightedMean(values);
    const evidence = [];
    if (numeric(horse.workout?.score) >= 75) evidence.push('追い切り評価良好');
    if (numeric(horse.trainerStats?.placeRate) >= .3) evidence.push('厩舎成績良好');
    if (!evidence.length) evidence.push('血統・陣営は標準');
    return metric(ratio, values.filter(item => item.value !== null).length / values.length, evidence);
  }

  function scoreHorse(horseInput, race, edition, weights, maxGate, fieldContext) {
    const mergedHorse = mergeHorseEdition(horseInput, edition);
    const raceType = race.raceType || 'flat';
    const horse = {
      ...mergedHorse,
      recentRuns: (mergedHorse.recentRuns || [])
        .filter(run => (run.raceType || 'flat') === raceType)
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    };
    const metrics = {
      recentForm: scoreRecentForm(horse),
      surface: scoreSurface(horse, race),
      distance: scoreDistance(horse, race),
      course: scoreCourse(horse, race),
      going: scoreGoing(horse, race),
      drawPace: scoreDrawPace(horse, race, maxGate),
      jockey: scoreJockey(horse, race),
      condition: scoreCondition(horse, fieldContext),
      classLevel: scoreClassLevel(horse, race),
      connections: scoreConnections(horse, race)
    };
    const breakdown = {};
    let score = 0;
    let weightedCoverage = 0;
    CATEGORY_META.forEach(category => {
      const weight = weights[category.key];
      const current = metrics[category.key];
      const points = current.ratio * weight;
      score += points;
      weightedCoverage += current.coverage * weight;
      breakdown[category.key] = {
        ...current,
        label: category.label,
        weight,
        points: round(points, 1)
      };
    });
    return {
      ...horse,
      scoreRaw: score,
      score: round(score, 1),
      coverage: round(weightedCoverage, 0),
      breakdown
    };
  }

  function buildReason(scoredHorse) {
    const impacts = Object.values(scoredHorse.breakdown)
      .map(item => ({ ...item, impact: item.weight * (item.ratio - .5) }));
    const strengths = impacts.filter(item => item.coverage > .2 && item.impact >= .3).sort((a, b) => b.impact - a.impact).slice(0, 2);
    const risk = impacts.filter(item => item.coverage > .25 && item.impact <= -.3).sort((a, b) => a.impact - b.impact)[0];
    const positive = strengths.length
      ? strengths.map(item => item.evidence[0] || `${item.label}を評価`).join('、')
      : '利用可能な情報を均等評価';
    return risk ? `${positive}。${risk.label}は割引` : `${positive}を評価`;
  }

  function confidenceFor(runners) {
    if (!runners.length) return { value: 0, label: '算出不可', reason: '出走馬なし' };
    const coverage = mean(runners.map(runner => runner.coverage)) || 0;
    const scoreOf = runner => Number(runner.scoreRaw ?? runner.score) || 0;
    const topGap = runners.length > 1 ? scoreOf(runners[0]) - scoreOf(runners[1]) : 8;
    const topFive = runners.slice(0, 5).map(scoreOf);
    const spread = topFive.length > 1 ? Math.max(...topFive) - Math.min(...topFive) : 0;
    const value = round(clamp(.52 * coverage / 100 + .28 * topGap / 9 + .2 * spread / 18) * 100, 0);
    const label = value >= 75 ? '高め' : value >= 56 ? '標準' : '慎重';
    const reason = coverage < 55 ? 'データ充足度が低め' : topGap < 2 ? '上位が接戦' : '上位に点差あり';
    return { value, label, reason, coverage: round(coverage, 0), topGap: round(topGap, 1) };
  }

  function scoreRace(race, edition = 'final', weightInput = DEFAULT_WEIGHTS) {
    if (!race || !Array.isArray(race.horses)) throw new Error('出走馬データがありません');
    const effectiveRace = mergeRaceEdition(race, edition);
    const weights = normalizeWeights(weightInput);
    const activeHorses = race.horses.filter(horse => !mergeHorseEdition(horse, edition).scratched);
    const maxGate = Math.max(1, ...activeHorses.map(horse => Number(mergeHorseEdition(horse, edition).gate) || 1));
    const meanCarriedWeight = mean(activeHorses.map(horse => mergeHorseEdition(horse, edition).carriedWeight));
    const runners = activeHorses
      .map(horse => scoreHorse(horse, effectiveRace, edition, weights, maxGate, { meanCarriedWeight }))
      .sort((a, b) => b.scoreRaw - a.scoreRaw
        || b.coverage - a.coverage
        || b.breakdown.recentForm.ratio - a.breakdown.recentForm.ratio
        || b.breakdown.classLevel.ratio - a.breakdown.classLevel.ratio
        || b.breakdown.distance.ratio - a.breakdown.distance.ratio
        || b.breakdown.course.ratio - a.breakdown.course.ratio
        || Number(a.number) - Number(b.number)
        || String(a.id || '').localeCompare(String(b.id || '')));
    const markedCount = Math.min(runners.length, Math.max(5, Math.min(7, Math.ceil(runners.length / 3) + 2)));
    const starCandidates = runners.slice(3, markedCount).filter(runner => runner.coverage >= 50);
    const star = starCandidates.sort((a, b) => {
      const upsideA = a.breakdown.distance.ratio * .3 + a.breakdown.course.ratio * .25 + a.breakdown.drawPace.ratio * .3 + a.breakdown.connections.ratio * .15;
      const upsideB = b.breakdown.distance.ratio * .3 + b.breakdown.course.ratio * .25 + b.breakdown.drawPace.ratio * .3 + b.breakdown.connections.ratio * .15;
      return upsideB - upsideA || Number(a.number) - Number(b.number);
    })[0];
    runners.forEach((runner, index) => {
      runner.rank = index + 1;
      if (index < 3) runner.mark = MARKS[index];
      else if (index < markedCount) runner.mark = runner === star ? '☆' : '△';
      else runner.mark = '消';
      runner.reason = buildReason(runner);
    });
    return {
      raceId: race.id,
      edition,
      engineVersion: ENGINE_VERSION,
      fieldSize: Number(effectiveRace.bettingFieldSize) || activeHorses.length,
      generatedAt: new Date().toISOString(),
      weights,
      confidence: confidenceFor(runners),
      runners
    };
  }

  function combinations(items, size) {
    const result = [];
    const walk = (start, current) => {
      if (current.length === size) { result.push(current.slice()); return; }
      for (let index = start; index <= items.length - (size - current.length); index += 1) {
        current.push(items[index]);
        walk(index + 1, current);
        current.pop();
      }
    };
    walk(0, []);
    return result;
  }

  function allocateBudget(ticketTemplates, budget) {
    const totalBudget = Math.max(0, Math.floor(Number(budget || 0) / 100) * 100);
    const sorted = ticketTemplates.slice().sort((a, b) => b.priority - a.priority);
    const affordableCount = Math.min(sorted.length, Math.floor(totalBudget / 100));
    const active = sorted.slice(0, affordableCount).map(ticket => ({ ...ticket, amount: 100 }));
    let remaining = totalBudget - active.length * 100;
    if (!active.length) return [];
    const totalWeight = active.reduce((sum, ticket) => sum + ticket.weight, 0);
    active.forEach(ticket => {
      const addition = Math.floor((remaining * ticket.weight / totalWeight) / 100) * 100;
      ticket.amount += addition;
    });
    let assigned = active.reduce((sum, ticket) => sum + ticket.amount, 0);
    let index = 0;
    while (assigned + 100 <= totalBudget) {
      active[index % active.length].amount += 100;
      assigned += 100;
      index += 1;
    }
    return active.sort((a, b) => a.order - b.order);
  }

  function createTickets(prediction, budget = 3000) {
    const top = prediction?.runners?.slice(0, 5) || [];
    if (top.length < 3 || Number(prediction?.confidence?.value || 0) < 35) return { budget: 0, tickets: [], unallocated: Number(budget) || 0, reason: '自信度が低いため見送り' };
    const fieldSize = Math.max(0, Number(prediction.fieldSize) || prediction.runners.length);
    const [a, b, c, d, e] = top;
    const star = prediction.runners.find(runner => runner.mark === '☆') || e;
    const candidates = [...new Map([...top, star].filter(Boolean).map(runner => [Number(runner.number), runner])).values()];
    const n = runner => Number(runner.number);
    const name = runner => runner.name;
    const templates = [];
    const add = (type, runners, options = {}) => {
      if (runners.some(runner => !runner) || new Set(runners.map(n)).size !== runners.length) return;
      templates.push({ type, numbers: runners.map(n), names: runners.map(name), ordered: Boolean(options.ordered), priority: options.priority, order: templates.length + 1, note: options.note });
    };
    add('単勝', [a], { priority: 100, note: '◎の勝ち切り' });
    if (fieldSize >= 5) add('複勝', [a], { priority: 96, note: '◎の安定軸' });
    add('馬連', [a, b], { priority: 94, note: '本線' });
    add('馬連', [a, c], { priority: 82, note: '対抗' });
    if (fieldSize >= 4) add('ワイド', [a, b], { priority: 92, note: '本線' });
    if (fieldSize >= 4) add('ワイド', [a, c], { priority: 84, note: '押さえ' });
    add('馬単', [a, b], { ordered: true, priority: 79, note: '◎→○' });
    add('馬単', [a, c], { ordered: true, priority: 72, note: '◎→▲' });
    if (fieldSize >= 4) add('三連複', [a, b, c], { priority: 77, note: '上位3頭' });
    if (fieldSize >= 4) add('三連複', [a, b, d], { priority: 68, note: '△押さえ' });
    if (fieldSize >= 4) add('三連単', [a, b, c], { ordered: true, priority: 66, note: '◎→○→▲' });
    if (fieldSize >= 4) add('三連単', [a, c, b], { ordered: true, priority: 61, note: '◎→▲→○' });
    if (fieldSize >= 5) add('複勝', [star], { priority: 58, note: star?.mark === '☆' ? '☆の押さえ' : '上位馬の押さえ' });
    const deduplicated = [...new Map(templates.map(ticket => [`${ticket.type}:${normalizeCombo(ticket.type, ticket.numbers)}`, ticket])).values()];
    const confidence = Number(prediction.confidence?.value || 50);
    const band = confidence >= 75 ? 'high' : confidence >= 55 ? 'middle' : 'low';
    const typeShares = {
      high: { '単勝': 20, '複勝': 8, '馬連': 16, 'ワイド': 8, '馬単': 14, '三連複': 19, '三連単': 15 },
      middle: { '単勝': 14, '複勝': 16, '馬連': 14, 'ワイド': 16, '馬単': 10, '三連複': 20, '三連単': 10 },
      low: { '単勝': 8, '複勝': 26, '馬連': 10, 'ワイド': 24, '馬単': 5, '三連複': 22, '三連単': 5 }
    }[band];
    const scoreOf = runner => Number(runner.scoreRaw ?? runner.score) || 0;
    const maximumScore = Math.max(...candidates.map(scoreOf));
    const strengths = new Map(candidates.map(runner => [n(runner), Math.exp((scoreOf(runner) - maximumScore) / 7.5)]));
    deduplicated.forEach(ticket => {
      const values = ticket.numbers.map(number => strengths.get(number) || .01);
      ticket.probabilityWeight = values.reduce((product, value, index) => product * value * (ticket.ordered && index === 0 ? 1.15 : 1), 1);
    });
    Object.keys(typeShares).forEach(type => {
      const group = deduplicated.filter(ticket => ticket.type === type);
      const totalProbability = group.reduce((sum, ticket) => sum + ticket.probabilityWeight, 0) || 1;
      group.forEach(ticket => {
        ticket.weight = typeShares[type] * ticket.probabilityWeight / totalProbability;
        ticket.priority = ticket.weight;
      });
    });
    const templatesWithWeights = deduplicated.filter(ticket => ticket.weight > 0);
    const tickets = allocateBudget(templatesWithWeights, budget);
    const allocated = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
    return { budget: Math.floor(Number(budget || 0) / 100) * 100, allocated, unallocated: Math.max(0, Number(budget || 0) - allocated), fieldSize, tickets };
  }

  function normalizeCombo(type, numbers) {
    const ordered = type === '馬単' || type === '三連単';
    const values = numbers.map(Number);
    return (ordered ? values : values.slice().sort((a, b) => a - b)).join('-');
  }

  function isTicketHit(ticket, resultOrder, fieldSize = resultOrder.length) {
    const first = resultOrder.slice(0, 3).map(Number);
    const numbers = ticket.numbers.map(Number);
    if (!first.length) return false;
    if (ticket.type === '単勝') return numbers[0] === first[0];
    if (ticket.type === '複勝') {
      const places = fieldSize >= 8 ? 3 : fieldSize >= 5 ? 2 : 0;
      return places > 0 && first.slice(0, places).includes(numbers[0]);
    }
    if (ticket.type === '馬連') return numbers.every(number => first.slice(0, 2).includes(number));
    if (ticket.type === 'ワイド') return numbers.every(number => first.includes(number));
    if (ticket.type === '馬単') return numbers[0] === first[0] && numbers[1] === first[1];
    if (ticket.type === '三連複') return numbers.every(number => first.includes(number));
    if (ticket.type === '三連単') return numbers.every((number, index) => number === first[index]);
    return false;
  }

  function compareResult(prediction, result, ticketPlan = null) {
    const order = Array.isArray(result?.order) ? result.order.map(Number) : [];
    if (!order.length) return null;
    const predictedNumbers = prediction.runners.map(runner => Number(runner.number));
    const predictedRank = new Map(predictedNumbers.map((number, index) => [number, index + 1]));
    const runnerByNumber = new Map(prediction.runners.map(runner => [Number(runner.number), runner]));
    const comparisons = order.map((number, index) => {
      const rank = predictedRank.get(number) || null;
      const runner = runnerByNumber.get(number);
      return {
        number,
        name: runner?.name || `馬番${number}`,
        mark: runner?.mark || '',
        score: runner?.score ?? null,
        odds: runner?.capturedOdds ?? runner?.odds ?? null,
        popularity: runner?.capturedPopularity ?? runner?.popularity ?? null,
        finish: index + 1,
        predictedRank: rank,
        difference: rank === null ? null : rank - (index + 1)
      };
    });
    const top3Actual = new Set(order.slice(0, 3));
    const top3Predicted = predictedNumbers.slice(0, 3);
    const top3Overlap = top3Predicted.filter(number => top3Actual.has(number)).length;
    const rankErrors = comparisons.slice(0, 3).map(item => Math.abs((item.predictedRank || predictedNumbers.length + 1) - item.finish));
    const plan = ticketPlan || createTickets(prediction, 3000);
    const fieldSize = Math.max(0, Number(plan.fieldSize) || Number(prediction.fieldSize) || prediction.runners.length);
    const placeCount = fieldSize >= 8 ? 3 : fieldSize >= 5 ? 2 : 0;
    const payoutMap = new Map((result.payouts || []).map(payout => [`${payout.type}:${normalizeCombo(payout.type, payout.numbers || [])}`, Number(payout.payoutPer100) || 0]));
    const refundKeys = new Set((result.refunds || []).map(refund => `${refund.type}:${normalizeCombo(refund.type, refund.numbers || [])}`));
    const ticketResults = plan.tickets.map(ticket => {
      const payoutKey = `${ticket.type}:${normalizeCombo(ticket.type, ticket.numbers)}`;
      const payoutAvailable = payoutMap.has(payoutKey);
      const refunded = refundKeys.has(payoutKey);
      const hit = payoutAvailable || isTicketHit(ticket, order, fieldSize);
      const payoutPer100 = payoutAvailable ? payoutMap.get(payoutKey) : null;
      return {
        ...ticket,
        hit,
        refunded,
        payoutAvailable,
        returnKnown: refunded || !hit || payoutAvailable,
        returnAmount: refunded ? ticket.amount : hit && !payoutAvailable ? null : hit ? Math.floor(ticket.amount / 100) * payoutPer100 : 0
      };
    });
    const stake = ticketResults.reduce((sum, ticket) => sum + ticket.amount, 0);
    const returns = ticketResults.reduce((sum, ticket) => sum + (Number(ticket.returnAmount) || 0), 0);
    const returnsKnown = ticketResults.every(ticket => ticket.returnKnown);
    return {
      winnerHit: predictedNumbers[0] === order[0],
      mainPlaced: placeCount ? new Set(order.slice(0, placeCount)).has(predictedNumbers[0]) : null,
      exactTop3: top3Overlap === 3,
      top3Overlap,
      meanRankError: rankErrors.length ? round(mean(rankErrors), 2) : null,
      comparisons,
      ticketResults,
      ticketHitCount: ticketResults.filter(ticket => ticket.hit).length,
      stake,
      returns,
      returnsKnown,
      returnRate: stake && returnsKnown ? round(returns / stake * 100, 1) : null
    };
  }

  function distanceBand(distance) {
    const value = Number(distance);
    if (value <= 1400) return '短距離';
    if (value <= 1800) return 'マイル';
    if (value <= 2200) return '中距離';
    return '長距離';
  }

  function racePostTime(race) {
    if (!race?.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(race?.startTime || ''))) return null;
    const value = new Date(`${race.date}T${race.startTime}:00+09:00`).getTime();
    return Number.isFinite(value) ? value : null;
  }

  function predictionDeadline(race, edition = 'final') {
    if (edition === 'dayBefore') {
      const raceDay = new Date(`${race?.date || ''}T00:00:00+09:00`).getTime();
      return Number.isFinite(raceDay) ? raceDay : null;
    }
    const explicit = Date.parse(race?.salesCloseAt || '');
    if (Number.isFinite(explicit)) return explicit;
    const postTime = racePostTime(race);
    return postTime === null ? null : postTime - 2 * 60 * 1000;
  }

  function isHistoricalRaceEligible(race, edition = 'final') {
    if (!race || !Array.isArray(race.result?.order) || race.result.order.length < 3) return false;
    if (race.snapshots?.[edition]?.ready === false) return false;
    const deadline = predictionDeadline(race, edition);
    const snapshot = race.snapshots?.[edition];
    const asOf = Date.parse(snapshot?.asOf || '');
    return snapshot?.ready === true && deadline !== null && Number.isFinite(asOf) && asOf < deadline;
  }

  function summarizeGroup(items, label) {
    const count = items.length;
    const placeItems = items.filter(item => item.comparison.mainPlaced !== null);
    const top3Total = items.reduce((sum, item) => sum + item.comparison.top3Overlap, 0);
    return {
      label,
      count,
      winRate: count ? round(items.filter(item => item.comparison.winnerHit).length / count * 100, 1) : 0,
      placeRate: placeItems.length ? round(placeItems.filter(item => item.comparison.mainPlaced).length / placeItems.length * 100, 1) : null,
      top3Rate: count ? round(top3Total / (count * 3) * 100, 1) : 0,
      meanRankError: count ? round(mean(items.map(item => item.comparison.meanRankError)) || 0, 2) : 0,
      returnRate: (() => {
        const betItems = items.filter(item => item.comparison.stake > 0);
        if (!betItems.length || betItems.some(item => !item.comparison.returnsKnown)) return null;
        const stake = betItems.reduce((sum, item) => sum + item.comparison.stake, 0);
        const returns = betItems.reduce((sum, item) => sum + item.comparison.returns, 0);
        return stake ? round(returns / stake * 100, 1) : null;
      })()
    };
  }

  function aggregateRecords(races, edition = 'final', weights = DEFAULT_WEIGHTS, snapshotResolver = null) {
    const entries = [];
    (races || []).forEach(race => {
      if (!Array.isArray(race.result?.order) || !race.result.order.length) return;
      const prediction = snapshotResolver ? snapshotResolver(race, edition) : scoreRace(race, edition, weights);
      if (!prediction) return;
      const comparison = compareResult(prediction, race.result, prediction.ticketPlan || null);
      if (comparison) entries.push({ race, effectiveRace: mergeRaceEdition(race, edition), prediction, comparison });
    });
    const groups = [];
    ['東京', '中山', '京都'].forEach(venue => {
      const items = entries.filter(entry => entry.race.venue === venue);
      if (items.length) groups.push(summarizeGroup(items, venue));
    });
    ['turf', 'dirt'].forEach(surface => {
      const items = entries.filter(entry => entry.effectiveRace.surface === surface);
      if (items.length) groups.push(summarizeGroup(items, surface === 'turf' ? '芝' : 'ダート'));
    });
    ['短距離', 'マイル', '中距離', '長距離'].forEach(band => {
      const items = entries.filter(entry => distanceBand(entry.effectiveRace.distance) === band);
      if (items.length) groups.push(summarizeGroup(items, band));
    });
    if (entries.some(entry => (entry.effectiveRace.raceType || 'flat') === 'jump')) {
      ['flat', 'jump'].forEach(raceType => {
        const items = entries.filter(entry => (entry.effectiveRace.raceType || 'flat') === raceType);
        if (items.length) groups.push(summarizeGroup(items, raceType === 'jump' ? '障害' : '平地'));
      });
    }
    const ticketGroups = ['単勝', '複勝', '馬連', 'ワイド', '馬単', '三連複', '三連単'].map(type => {
      const tickets = entries.flatMap(entry => entry.comparison.ticketResults).filter(ticket => ticket.type === type);
      const stake = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
      const returns = tickets.reduce((sum, ticket) => sum + (Number(ticket.returnAmount) || 0), 0);
      const returnsKnown = tickets.every(ticket => ticket.returnKnown);
      return { type, betCount: tickets.length, hitCount: tickets.filter(ticket => ticket.hit).length, stake, returns, returnsKnown, returnRate: stake && returnsKnown ? round(returns / stake * 100, 1) : null };
    }).filter(group => group.betCount);
    return { entries, overall: summarizeGroup(entries, '全体'), groups, ticketGroups };
  }

  function performanceScore(races, weights, edition = 'final') {
    if (!races.length) return 0;
    const values = races.map(race => {
      const prediction = scoreRace(race, edition, weights);
      const comparison = compareResult(prediction, race.result);
      if (!comparison) return 0;
      const winner = comparison.winnerHit ? 1 : 0;
      const placed = comparison.mainPlaced === null ? .5 : comparison.mainPlaced ? 1 : 0;
      const top3 = comparison.top3Overlap / 3;
      const rank = clamp(1 - comparison.meanRankError / Math.max(4, prediction.runners.length / 2));
      return winner * .34 + placed * .22 + top3 * .28 + rank * .16;
    });
    return mean(values) || 0;
  }

  function optimizeWeights(races, currentWeights = DEFAULT_WEIGHTS) {
    const finalized = (races || [])
      .filter(race => isHistoricalRaceEligible(race, 'final'))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (finalized.length < 120) return { adopted: false, reason: '発走前スナップショット付きの確定レースが120件未満です', sampleSize: finalized.length };
    const latestTime = Math.max(...finalized.map(race => new Date(race.date).getTime()).filter(Number.isFinite));
    const cutoff = latestTime - 365 * 24 * 60 * 60 * 1000;
    const year = finalized.filter(race => new Date(race.date).getTime() >= cutoff);
    if (year.length < 120) return { adopted: false, reason: '過去1年の確定レースが120件未満です', sampleSize: year.length };
    const dates = [...new Set(year.map(race => race.date))].sort();
    if (dates.length < 5) return { adopted: false, reason: '時系列分割に必要な開催日が5日未満です', sampleSize: year.length };
    const trainingEnd = dates[Math.max(0, Math.floor(dates.length * .6) - 1)];
    const validationEnd = dates[Math.max(1, Math.floor(dates.length * .8) - 1)];
    const training = year.filter(race => race.date <= trainingEnd);
    const validation = year.filter(race => race.date > trainingEnd && race.date <= validationEnd);
    const holdout = year.filter(race => race.date > validationEnd);
    if (training.length < 60 || validation.length < 20 || holdout.length < 20) return { adopted: false, reason: '学習60件・検証20件・最終確認20件を確保できません', sampleSize: year.length };
    const baseline = normalizeWeights(currentWeights);
    let candidate = { ...baseline };
    let candidateTrain = performanceScore(training, candidate);
    const minWeights = Object.fromEntries(CATEGORY_META.map(item => [item.key, item.weight * .8]));
    const maxWeights = Object.fromEntries(CATEGORY_META.map(item => [item.key, item.weight * 1.2]));
    const step = .5;
    for (let pass = 0; pass < 1; pass += 1) {
      let best = null;
      CATEGORY_META.forEach(from => CATEGORY_META.forEach(to => {
        if (from.key === to.key || candidate[from.key] - step < minWeights[from.key] || candidate[to.key] + step > maxWeights[to.key]) return;
        const trial = { ...candidate, [from.key]: candidate[from.key] - step, [to.key]: candidate[to.key] + step };
        const score = performanceScore(training, trial);
        if (score > candidateTrain + .0005 && (!best || score > best.score)) best = { weights: trial, score };
      }));
      if (!best) break;
      candidate = best.weights;
      candidateTrain = best.score;
    }
    const baselineValidation = performanceScore(validation, baseline);
    const candidateValidation = performanceScore(validation, candidate);
    const baselineHoldout = performanceScore(holdout, baseline);
    const candidateHoldout = performanceScore(holdout, candidate);
    const changed = CATEGORY_META.some(item => Math.abs(candidate[item.key] - baseline[item.key]) >= .5);
    const adopted = changed && candidateValidation > baselineValidation + .002 && candidateHoldout >= baselineHoldout;
    return {
      adopted,
      reason: adopted ? '検証期間が改善し、最終確認期間でも悪化しませんでした' : '未知期間まで含めた改善が確認できないため据え置きました',
      weights: adopted ? normalizeWeights(candidate) : baseline,
      baselineWeights: baseline,
      sampleSize: year.length,
      trainingSize: training.length,
      validationSize: validation.length,
      holdoutSize: holdout.length,
      trainingScoreBefore: round(performanceScore(training, baseline) * 100, 2),
      trainingScoreAfter: round(candidateTrain * 100, 2),
      validationScoreBefore: round(baselineValidation * 100, 2),
      validationScoreAfter: round(candidateValidation * 100, 2),
      holdoutScoreBefore: round(baselineHoldout * 100, 2),
      holdoutScoreAfter: round(candidateHoldout * 100, 2)
    };
  }

  function validateDataset(payload) {
    const fail = message => { throw new Error(message); };
    const stringValue = (value, label, { required = false, max = 160 } = {}) => {
      if (value === null || value === undefined || value === '') {
        if (required) fail(`${label} がありません`);
        return;
      }
      if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${label} が不正です`);
    };
    const numberValue = (value, label, { required = false, min = -Infinity, max = Infinity, integer = false } = {}) => {
      if (value === null || value === undefined || value === '') {
        if (required) fail(`${label} がありません`);
        return;
      }
      const number = Number(value);
      if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) fail(`${label} が不正です`);
    };
    const enumValue = (value, allowed, label, required = false) => {
      if (value === null || value === undefined || value === '') {
        if (required) fail(`${label} がありません`);
        return;
      }
      if (!allowed.includes(value)) fail(`${label} が不正です`);
    };
    const dateValue = (value, label, required = false) => {
      if (!value && !required) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) fail(`${label} は YYYY-MM-DD 形式にしてください`);
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(`${label} が実在しない日付です`);
    };
    const timestampValue = (value, label, required = false) => {
      if ((value === null || value === undefined || value === '') && !required) return;
      const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
      if (typeof value !== 'string' || !zoned.test(value)) fail(`${label} はタイムゾーン付きISO時刻にしてください`);
      if (!Number.isFinite(Date.parse(value))) fail(`${label} が不正です`);
    };
    const validateRateObject = (object, label) => {
      if (object === null || object === undefined) return;
      if (typeof object !== 'object' || Array.isArray(object)) fail(`${label} が不正です`);
      ['winRate', 'placeRate', 'coursePlaceRate', 'pairPlaceRate'].forEach(key => numberValue(object[key], `${label}.${key}`, { min: 0, max: 1 }));
      numberValue(object.pairStarts, `${label}.pairStarts`, { min: 0, max: 10000, integer: true });
    };
    const validateRun = (run, label, raceDate) => {
      if (!run || typeof run !== 'object' || Array.isArray(run)) fail(`${label} が不正です`);
      stringValue(run.id, `${label}.id`, { max: 180 });
      dateValue(run.date, `${label}.date`);
      if (run.date && run.date >= raceDate) fail(`${label}.date は対象レースより前である必要があります`);
      stringValue(run.venue, `${label}.venue`, { max: 40 });
      enumValue(run.surface, ['turf', 'dirt'], `${label}.surface`);
      enumValue(run.raceType, ['flat', 'jump'], `${label}.raceType`);
      enumValue(run.direction, ['left', 'right', 'straight'], `${label}.direction`);
      enumValue(run.going, ['firm', 'good', 'standard', 'yielding', 'soft', 'heavy', 'muddy'], `${label}.going`);
      numberValue(run.distance, `${label}.distance`, { min: 800, max: 5000, integer: true });
      numberValue(run.gate, `${label}.gate`, { min: 1, max: 8, integer: true });
      numberValue(run.finish, `${label}.finish`, { min: 1, max: 40, integer: true });
      numberValue(run.fieldSize, `${label}.fieldSize`, { min: 2, max: 40, integer: true });
      if (numeric(run.finish) !== null && numeric(run.fieldSize) !== null && Number(run.finish) > Number(run.fieldSize)) fail(`${label}.finish が頭数を超えています`);
      numberValue(run.margin, `${label}.margin`, { min: -20, max: 100 });
      numberValue(run.last3F, `${label}.last3F`, { min: 20, max: 80 });
      numberValue(run.last3FRank, `${label}.last3FRank`, { min: 1, max: 40, integer: true });
      numberValue(run.speedRating, `${label}.speedRating`, { min: 0, max: 200 });
      numberValue(run.classLevel, `${label}.classLevel`, { min: 0, max: 20 });
      numberValue(run.opponentRating, `${label}.opponentRating`, { min: 0, max: 100 });
    };
    const validateHorseFields = (horse, label) => {
      stringValue(horse.id, `${label}.id`, { max: 180 });
      stringValue(horse.name, `${label}.name`, { max: 100 });
      stringValue(horse.sexAge, `${label}.sexAge`, { max: 16 });
      stringValue(horse.jockey, `${label}.jockey`, { max: 80 });
      stringValue(horse.trainer, `${label}.trainer`, { max: 80 });
      enumValue(horse.runningStyle, ['front', 'stalk', 'mid', 'close', 'unknown'], `${label}.runningStyle`);
      numberValue(horse.gate, `${label}.gate`, { min: 1, max: 8, integer: true });
      numberValue(horse.carriedWeight, `${label}.carriedWeight`, { min: 40, max: 75 });
      numberValue(horse.burdenChange, `${label}.burdenChange`, { min: -10, max: 10 });
      numberValue(horse.bodyWeight, `${label}.bodyWeight`, { min: 200, max: 800 });
      numberValue(horse.bodyWeightChange, `${label}.bodyWeightChange`, { min: -100, max: 100 });
      numberValue(horse.restDays, `${label}.restDays`, { min: 0, max: 2000 });
      numberValue(horse.odds, `${label}.odds`, { min: 1, max: 100000 });
      numberValue(horse.popularity, `${label}.popularity`, { min: 1, max: 40, integer: true });
      numberValue(horse.number, `${label}.number`, { min: 1, max: 40, integer: true });
      if (horse.scratched !== undefined && typeof horse.scratched !== 'boolean') fail(`${label}.scratched が不正です`);
      ['distanceFit', 'courseFit', 'goingFit', 'paceFit', 'drawFit', 'classFit', 'conditionScore'].forEach(key => numberValue(horse[key], `${label}.${key}`, { min: 0, max: 100 }));
      validateRateObject(horse.jockeyStats, `${label}.jockeyStats`);
      validateRateObject(horse.trainerStats, `${label}.trainerStats`);
      if (horse.pedigree !== null && horse.pedigree !== undefined) {
        if (typeof horse.pedigree !== 'object' || Array.isArray(horse.pedigree)) fail(`${label}.pedigree が不正です`);
        ['turfScore', 'dirtScore', 'distanceScore'].forEach(key => numberValue(horse.pedigree[key], `${label}.pedigree.${key}`, { min: 0, max: 100 }));
      }
      if (horse.workout !== null && horse.workout !== undefined) {
        if (typeof horse.workout !== 'object' || Array.isArray(horse.workout)) fail(`${label}.workout が不正です`);
        numberValue(horse.workout.score, `${label}.workout.score`, { min: 0, max: 100 });
        stringValue(horse.workout.label, `${label}.workout.label`, { max: 60 });
      }
    };
    if (!payload || typeof payload !== 'object') throw new Error('JSONの形式が正しくありません');
    if (Number(payload.schemaVersion) !== 1) throw new Error('schemaVersion 1 のデータが必要です');
    if (!Array.isArray(payload.races) || !payload.races.length || payload.races.length > 5000) throw new Error('races が空、または5000件を超えています');
    timestampValue(payload.generatedAt, 'generatedAt');
    if (!payload.source || typeof payload.source !== 'object' || Array.isArray(payload.source)) fail('source が不正です');
    stringValue(payload.source.name, 'source.name', { required: true, max: 120 });
    stringValue(payload.source.mode, 'source.mode', { required: true, max: 40 });
    stringValue(payload.source.detail, 'source.detail', { max: 300 });
    stringValue(payload.source.datasetId, 'source.datasetId', { required: true, max: 120 });
    if (payload.source.redistributable !== undefined && typeof payload.source.redistributable !== 'boolean') fail('source.redistributable が不正です');
    if (payload.source.automated !== undefined && typeof payload.source.automated !== 'boolean') fail('source.automated が不正です');
    if (payload.source.asOfFieldsGuaranteed !== undefined && typeof payload.source.asOfFieldsGuaranteed !== 'boolean') fail('source.asOfFieldsGuaranteed が不正です');
    const ids = new Set();
    const slots = new Set();
    payload.races.forEach((race, raceIndex) => {
      if (!race || typeof race !== 'object' || Array.isArray(race)) fail(`${raceIndex + 1}件目のレースが不正です`);
      stringValue(race.id, `${raceIndex + 1}件目のrace.id`, { required: true, max: 180 });
      if (ids.has(race.id)) throw new Error(`${raceIndex + 1}件目のレースIDが重複しています`);
      ids.add(race.id);
      if (!['東京', '中山', '京都'].includes(race.venue)) throw new Error(`${race.id}: 対応外の競馬場です`);
      dateValue(race.date, `${race.id}.date`, true);
      if (!Number.isInteger(Number(race.raceNumber)) || Number(race.raceNumber) < 1 || Number(race.raceNumber) > 12) throw new Error(`${race.id}: raceNumber は1〜12です`);
      const slot = `${race.date}:${race.venue}:${Number(race.raceNumber)}`;
      if (slots.has(slot)) fail(`${race.id}: 同じ開催日・競馬場・レース番号が重複しています`);
      slots.add(slot);
      if (!['turf', 'dirt'].includes(race.surface)) throw new Error(`${race.id}: surface は turf または dirt です`);
      enumValue(race.raceType, ['flat', 'jump'], `${race.id}.raceType`);
      stringValue(race.name, `${race.id}.name`, { required: true, max: 120 });
      stringValue(race.meetingLabel, `${race.id}.meetingLabel`, { max: 120 });
      if (race.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(race.startTime)) fail(`${race.id}.startTime が不正です`);
      timestampValue(race.salesCloseAt, `${race.id}.salesCloseAt`);
      if (race.salesCloseAt) {
        const postTime = racePostTime(race);
        if (postTime !== null && Date.parse(race.salesCloseAt) >= postTime) fail(`${race.id}.salesCloseAt は発走前である必要があります`);
      }
      enumValue(race.status, ['scheduled', 'final', 'cancelled'], `${race.id}.status`);
      enumValue(race.direction, ['left', 'right', 'straight'], `${race.id}.direction`, true);
      enumValue(race.going, ['firm', 'good', 'standard', 'yielding', 'soft', 'heavy', 'muddy'], `${race.id}.going`);
      enumValue(race.weather, ['sunny', 'cloudy', 'rain', 'snow'], `${race.id}.weather`);
      enumValue(race.pace, ['fast', 'middle', 'slow'], `${race.id}.pace`);
      numberValue(race.distance, `${race.id}.distance`, { required: true, min: 800, max: 5000, integer: true });
      numberValue(race.classLevel, `${race.id}.classLevel`, { min: 0, max: 20 });
      numberValue(race.drawBias, `${race.id}.drawBias`, { min: -2, max: 2 });
      numberValue(race.bettingFieldSize, `${race.id}.bettingFieldSize`, { min: 2, max: 24, integer: true });
      if (race.versions !== null && race.versions !== undefined) {
        if (typeof race.versions !== 'object' || Array.isArray(race.versions)) fail(`${race.id}.versions が不正です`);
        ['dayBefore', 'final'].forEach(edition => {
          const override = race.versions[edition];
          if (override === null || override === undefined) return;
          if (typeof override !== 'object' || Array.isArray(override) || override.horses !== undefined || override.result !== undefined) fail(`${race.id}.versions.${edition} が不正です`);
          const allowed = new Set(['surface', 'direction', 'going', 'weather', 'pace', 'distance', 'classLevel', 'drawBias']);
          const unknown = Object.keys(override).find(key => !allowed.has(key));
          if (unknown) fail(`${race.id}.versions.${edition}.${unknown} は変更できません`);
          enumValue(override.surface, ['turf', 'dirt'], `${race.id}.versions.${edition}.surface`);
          enumValue(override.direction, ['left', 'right', 'straight'], `${race.id}.versions.${edition}.direction`);
          enumValue(override.going, ['firm', 'good', 'standard', 'yielding', 'soft', 'heavy', 'muddy'], `${race.id}.versions.${edition}.going`);
          enumValue(override.weather, ['sunny', 'cloudy', 'rain', 'snow'], `${race.id}.versions.${edition}.weather`);
          enumValue(override.pace, ['fast', 'middle', 'slow'], `${race.id}.versions.${edition}.pace`);
          numberValue(override.distance, `${race.id}.versions.${edition}.distance`, { min: 800, max: 5000, integer: true });
          numberValue(override.classLevel, `${race.id}.versions.${edition}.classLevel`, { min: 0, max: 20 });
          numberValue(override.drawBias, `${race.id}.versions.${edition}.drawBias`, { min: -2, max: 2 });
        });
      }
      if (race.snapshots !== null && race.snapshots !== undefined) {
        if (typeof race.snapshots !== 'object' || Array.isArray(race.snapshots)) fail(`${race.id}.snapshots が不正です`);
        ['dayBefore', 'final'].forEach(edition => {
          const snapshot = race.snapshots[edition];
          if (snapshot === null || snapshot === undefined) return;
          if (typeof snapshot !== 'object' || Array.isArray(snapshot)) fail(`${race.id}.snapshots.${edition} が不正です`);
          timestampValue(snapshot.asOf, `${race.id}.snapshots.${edition}.asOf`, true);
          stringValue(snapshot.label, `${race.id}.snapshots.${edition}.label`, { max: 40 });
          if (snapshot.ready !== undefined && typeof snapshot.ready !== 'boolean') fail(`${race.id}.snapshots.${edition}.ready が不正です`);
          const postTime = predictionDeadline(race, edition);
          const asOf = Date.parse(snapshot.asOf);
          if (postTime !== null && asOf >= postTime) fail(`${race.id}.snapshots.${edition}.asOf は発走前である必要があります`);
          if (edition === 'dayBefore') {
            const raceDay = new Date(`${race.date}T00:00:00+09:00`).getTime();
            if (asOf >= raceDay) fail(`${race.id}.snapshots.dayBefore.asOf は前日以前である必要があります`);
          }
        });
      }
      if (!Array.isArray(race.horses) || race.horses.length < 3 || race.horses.length > 24) throw new Error(`${race.id}: 出走馬は3〜24頭必要です`);
      const numbers = new Set();
      race.horses.forEach((horse, horseIndex) => {
        const label = `${race.id}.horses[${horseIndex}]`;
        if (!horse || typeof horse !== 'object' || Array.isArray(horse)) fail(`${label} が不正です`);
        stringValue(horse.id, `${label}.id`, { required: true, max: 180 });
        stringValue(horse.name, `${label}.name`, { required: true, max: 100 });
        if (!Number.isInteger(Number(horse.number)) || Number(horse.number) < 1 || Number(horse.number) > 40 || numbers.has(Number(horse.number))) throw new Error(`${race.id}: 馬番が不正または重複しています`);
        numbers.add(Number(horse.number));
        validateHorseFields(horse, label);
        if (!Array.isArray(horse.recentRuns) || horse.recentRuns.length > 10) fail(`${label}.recentRuns は0〜10件の配列にしてください`);
        horse.recentRuns.forEach((run, runIndex) => validateRun(run, `${label}.recentRuns[${runIndex}]`, race.date));
        if (horse.versions !== null && horse.versions !== undefined) {
          if (typeof horse.versions !== 'object' || Array.isArray(horse.versions)) fail(`${label}.versions が不正です`);
          ['dayBefore', 'final'].forEach(edition => {
            const override = horse.versions[edition];
            if (override !== null && override !== undefined) {
              validateHorseFields(override, `${label}.versions.${edition}`);
              if (override.id !== undefined && override.id !== horse.id) fail(`${label}.versions.${edition}.id は変更できません`);
              if (override.number !== undefined && Number(override.number) !== Number(horse.number)) fail(`${label}.versions.${edition}.number は変更できません`);
              if (override.name !== undefined && override.name !== horse.name) fail(`${label}.versions.${edition}.name は変更できません`);
              if (override.recentRuns !== undefined) {
                if (!Array.isArray(override.recentRuns) || override.recentRuns.length > 10) fail(`${label}.versions.${edition}.recentRuns は0〜10件の配列にしてください`);
                override.recentRuns.forEach((run, runIndex) => validateRun(run, `${label}.versions.${edition}.recentRuns[${runIndex}]`, race.date));
              }
            }
          });
        }
      });
      if (race.result !== null && race.result !== undefined) {
        if (typeof race.result !== 'object' || Array.isArray(race.result) || !Array.isArray(race.result.order)) fail(`${race.id}.result が不正です`);
        enumValue(race.result.status, ['final'], `${race.id}.result.status`);
        timestampValue(race.result.confirmedAt, `${race.id}.result.confirmedAt`);
        if (race.result.confirmedAt) {
          const postTime = racePostTime(race);
          if (postTime !== null && Date.parse(race.result.confirmedAt) < postTime) fail(`${race.id}.result.confirmedAt は発走後である必要があります`);
        }
        const order = race.result.order.map(Number);
        if (order.length < 3 || order.length > race.horses.length || new Set(order).size !== order.length || order.some(number => !numbers.has(number))) fail(`${race.id}.result.order が出走馬と一致しません`);
        if (race.result.payouts !== undefined) {
          if (!Array.isArray(race.result.payouts) || race.result.payouts.length > 80) fail(`${race.id}.result.payouts が不正です`);
          const payoutKeys = new Set();
          race.result.payouts.forEach((payout, payoutIndex) => {
            const payoutLabel = `${race.id}.result.payouts[${payoutIndex}]`;
            if (!payout || typeof payout !== 'object' || Array.isArray(payout)) fail(`${payoutLabel} が不正です`);
            enumValue(payout.type, ['単勝', '複勝', '馬連', 'ワイド', '馬単', '三連複', '三連単'], `${payoutLabel}.type`, true);
            if (!Array.isArray(payout.numbers) || !payout.numbers.length || new Set(payout.numbers.map(Number)).size !== payout.numbers.length || payout.numbers.some(number => !numbers.has(Number(number)))) fail(`${payoutLabel}.numbers が不正です`);
            const requiredNumbers = ['単勝', '複勝'].includes(payout.type) ? 1 : ['馬連', 'ワイド', '馬単'].includes(payout.type) ? 2 : 3;
            if (payout.numbers.length !== requiredNumbers) fail(`${payoutLabel}.numbers の頭数が券種と一致しません`);
            const payoutKey = `${payout.type}:${normalizeCombo(payout.type, payout.numbers)}`;
            if (payoutKeys.has(payoutKey)) fail(`${payoutLabel} が重複しています`);
            payoutKeys.add(payoutKey);
            numberValue(payout.payoutPer100, `${payoutLabel}.payoutPer100`, { required: true, min: 0, max: 100000000, integer: true });
          });
        }
        if (race.result.refunds !== undefined) {
          if (!Array.isArray(race.result.refunds) || race.result.refunds.length > 200) fail(`${race.id}.result.refunds が不正です`);
          const refundKeys = new Set();
          race.result.refunds.forEach((refund, refundIndex) => {
            const refundLabel = `${race.id}.result.refunds[${refundIndex}]`;
            if (!refund || typeof refund !== 'object' || Array.isArray(refund)) fail(`${refundLabel} が不正です`);
            enumValue(refund.type, ['単勝', '複勝', '馬連', 'ワイド', '馬単', '三連複', '三連単'], `${refundLabel}.type`, true);
            if (!Array.isArray(refund.numbers) || !refund.numbers.length || new Set(refund.numbers.map(Number)).size !== refund.numbers.length || refund.numbers.some(number => !numbers.has(Number(number)))) fail(`${refundLabel}.numbers が不正です`);
            const requiredNumbers = ['単勝', '複勝'].includes(refund.type) ? 1 : ['馬連', 'ワイド', '馬単'].includes(refund.type) ? 2 : 3;
            if (refund.numbers.length !== requiredNumbers) fail(`${refundLabel}.numbers の頭数が券種と一致しません`);
            const refundKey = `${refund.type}:${normalizeCombo(refund.type, refund.numbers)}`;
            if (refundKeys.has(refundKey)) fail(`${refundLabel} が重複しています`);
            refundKeys.add(refundKey);
          });
        }
      }
    });
    return true;
  }

  return {
    ENGINE_VERSION,
    CATEGORY_META,
    DEFAULT_WEIGHTS,
    STYLE_LABELS,
    normalizeWeights,
    mergeRaceEdition,
    mergeHorseEdition,
    scoreRace,
    createTickets,
    isTicketHit,
    compareResult,
    aggregateRecords,
    optimizeWeights,
    isHistoricalRaceEligible,
    predictionDeadline,
    validateDataset,
    distanceBand,
    _test: { clamp, runQuality, performanceScore, normalizeCombo, combinations }
  };
}));
