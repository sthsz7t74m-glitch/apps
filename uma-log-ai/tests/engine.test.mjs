import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Engine = require('../engine.js');
require('../demo-data.js');

function minimalHorse(number, overrides = {}) {
  return {
    id: `horse-${number}`,
    number,
    gate: null,
    name: `テスト馬${number}`,
    recentRuns: [],
    versions: { dayBefore: {}, final: {} },
    ...overrides
  };
}

function minimalRace(horses) {
  return {
    id: 'race-test-1',
    date: '2026-08-09',
    venue: '東京',
    raceNumber: 1,
    surface: 'turf',
    distance: 1600,
    direction: 'left',
    going: 'firm',
    pace: 'middle',
    classLevel: 2,
    horses
  };
}

test('initial category weights total exactly 100', () => {
  assert.equal(Object.values(Engine.DEFAULT_WEIGHTS).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(Engine.CATEGORY_META.length, 10);
});

test('all ten JRA venues are supported', () => {
  assert.deepEqual(Engine.JRA_VENUES, ['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉']);
});

test('field running styles infer the race pace and last-four-furlong acceleration affects quality', () => {
  const horses = [1, 2, 3, 4, 5].map(number => minimalHorse(number, { runningStyle: number <= 3 ? 'front' : 'mid' }));
  const sample = minimalRace(horses);
  sample.pace = null;
  const prediction = Engine.scoreRace(sample, 'final');
  assert.equal(prediction.inferredPace, true);
  const accelerating = Engine._test.runQuality({ finish: 3, fieldSize: 12, last4FSplits: [12.6, 12.1, 11.8, 11.4] });
  const fading = Engine._test.runQuality({ finish: 3, fieldSize: 12, last4FSplits: [11.4, 11.8, 12.1, 12.6] });
  assert.ok(accelerating > fading);
});

test('weight normalization is non-negative and totals exactly 100 for hostile persisted values', () => {
  const hostile = {
    recentForm: .0043878,
    surface: .0848816,
    distance: .000549,
    course: .0360149,
    going: .0110557,
    drawPace: 1.3093264,
    jockey: .1085358,
    condition: .0035556,
    classLevel: .0089011,
    connections: 0
  };
  const normalized = Engine.normalizeWeights(hostile);
  assert.equal(Object.values(normalized).reduce((sum, value) => sum + value, 0), 100);
  assert.ok(Object.values(normalized).every(value => Number.isFinite(value) && value >= 0));
});

test('all missing evidence stays neutral at 50 points and lowers confidence', () => {
  const race = minimalRace([minimalHorse(1), minimalHorse(2), minimalHorse(3)]);
  const prediction = Engine.scoreRace(race, 'dayBefore');
  prediction.runners.forEach(runner => assert.equal(runner.score, 50));
  assert.equal(prediction.runners[0].coverage, 0);
  assert.ok(prediction.confidence.value < 35);
  assert.equal(Engine.createTickets(prediction, 3000).tickets.length, 0);
});

test('odds never change scores, ranking, marks, or budget allocation', () => {
  const base = structuredClone(globalThis.UMA_LOG_DEMO.races.at(-1));
  const changed = structuredClone(base);
  changed.horses.forEach((horse, index) => {
    horse.versions.final.odds = index % 2 ? 1.1 : 999.9;
    horse.versions.final.popularity = changed.horses.length - index;
  });
  const first = Engine.scoreRace(base, 'final');
  const second = Engine.scoreRace(changed, 'final');
  const compact = prediction => prediction.runners.map(runner => ({ number: runner.number, rank: runner.rank, mark: runner.mark, score: runner.score }));
  assert.deepEqual(compact(first), compact(second));
  const ticketsA = Engine.createTickets(first, 5000).tickets.map(({ type, numbers, amount }) => ({ type, numbers, amount }));
  const ticketsB = Engine.createTickets(second, 5000).tickets.map(({ type, numbers, amount }) => ({ type, numbers, amount }));
  assert.deepEqual(ticketsA, ticketsB);
});

test('all agreed marks and cuts are assigned for a ten-runner demo race', () => {
  const prediction = Engine.scoreRace(globalThis.UMA_LOG_DEMO.races.at(-1), 'final');
  assert.equal(prediction.runners[0].mark, '◎');
  assert.equal(prediction.runners[1].mark, '○');
  assert.equal(prediction.runners[2].mark, '▲');
  assert.ok(prediction.runners.some(runner => runner.mark === '△'));
  assert.ok(prediction.runners.some(runner => runner.mark === '☆'));
  assert.ok(prediction.runners.some(runner => runner.mark === '消'));
});

test('ticket plan uses the requested budget in 100-yen units and covers all ticket types', () => {
  const prediction = {
    confidence: { value: 72 },
    runners: [1, 2, 3, 4, 5].map(number => ({ number, name: `馬${number}`, score: 82 - number }))
  };
  const plan = Engine.createTickets(prediction, 3000);
  assert.equal(plan.allocated, 3000);
  assert.ok(plan.tickets.every(ticket => ticket.amount % 100 === 0));
  assert.deepEqual([...new Set(plan.tickets.map(ticket => ticket.type))].sort(), ['三連単', '三連複', '単勝', '複勝', '馬単', '馬連', 'ワイド'].sort());
});

test('ticket allocation changes with confidence and score gaps without using odds', () => {
  const runners = [80, 79, 78, 77, 76].map((score, index) => ({ number: index + 1, name: `馬${index + 1}`, score }));
  const high = Engine.createTickets({ confidence: { value: 82 }, runners }, 10000);
  const low = Engine.createTickets({ confidence: { value: 42 }, runners }, 10000);
  const totalFor = (plan, types) => plan.tickets.filter(ticket => types.includes(ticket.type)).reduce((sum, ticket) => sum + ticket.amount, 0);
  assert.ok(totalFor(high, ['単勝', '馬単', '三連単']) > totalFor(low, ['単勝', '馬単', '三連単']));
  assert.ok(totalFor(low, ['複勝', 'ワイド']) > totalFor(high, ['複勝', 'ワイド']));
  const highSmall = Engine.createTickets({ confidence: { value: 82 }, runners }, 500);
  const lowSmall = Engine.createTickets({ confidence: { value: 42 }, runners }, 500);
  assert.notDeepEqual(highSmall.tickets.map(ticket => ticket.type), lowSmall.tickets.map(ticket => ticket.type));

  const separated = Engine.createTickets({
    confidence: { value: 65 },
    runners: [80, 79, 55, 50, 45].map((score, index) => ({ number: index + 1, name: `馬${index + 1}`, score }))
  }, 10000);
  const amount = (plan, type, numbers) => plan.tickets.find(ticket => ticket.type === type && ticket.numbers.join('-') === numbers.join('-'))?.amount || 0;
  assert.ok(amount(separated, '馬連', [1, 2]) > amount(separated, '馬連', [1, 3]));
});

test('three-runner ticket plan has no duplicate combinations or repeated horse numbers', () => {
  const prediction = {
    confidence: { value: 70 },
    runners: [1, 2, 3].map((number, index) => ({ number, name: `馬${number}`, score: 80 - index * 4 }))
  };
  const plan = Engine.createTickets(prediction, 5000);
  const keys = plan.tickets.map(ticket => `${ticket.type}:${Engine._test.normalizeCombo(ticket.type, ticket.numbers)}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(plan.tickets.every(ticket => new Set(ticket.numbers).size === ticket.numbers.length));
  assert.deepEqual([...new Set(plan.tickets.map(ticket => ticket.type))].sort(), ['単勝', '馬単', '馬連'].sort());
});

test('ticket availability and place cutoffs follow the saved betting field size', () => {
  const prediction = fieldSize => ({
    fieldSize,
    confidence: { value: 70 },
    runners: [1, 2, 3, 4, 5].map((number, index) => ({ number, name: `馬${number}`, score: 80 - index * 4 }))
  });
  const four = Engine.createTickets(prediction(4), 5000);
  assert.ok(four.tickets.some(ticket => ticket.type === 'ワイド'));
  assert.ok(four.tickets.some(ticket => ticket.type === '三連単'));
  assert.ok(four.tickets.every(ticket => ticket.type !== '複勝'));
  assert.equal(Engine.isTicketHit({ type: '複勝', numbers: [3] }, [1, 2, 3], 7), false);
  assert.equal(Engine.isTicketHit({ type: '複勝', numbers: [3] }, [1, 2, 3], 8), true);
});

test('result comparison reports winner, top-three overlap, rank error, and ticket hits', () => {
  const prediction = {
    raceId: 'comparison',
    edition: 'final',
    fieldSize: 8,
    confidence: { value: 70 },
    runners: [
      { number: 1, name: 'A', rank: 1, mark: '◎', score: 80 },
      { number: 2, name: 'B', rank: 2, mark: '○', score: 75 },
      { number: 3, name: 'C', rank: 3, mark: '▲', score: 70 },
      { number: 4, name: 'D', rank: 4, mark: '☆', score: 65 }
    ]
  };
  const result = { order: [2, 1, 4, 3], payouts: [] };
  const compared = Engine.compareResult(prediction, result);
  assert.equal(compared.winnerHit, false);
  assert.equal(compared.mainPlaced, true);
  assert.equal(compared.top3Overlap, 2);
  assert.equal(compared.meanRankError, 1);
  assert.ok(compared.ticketHitCount >= 1);
});

test('missing payout for a winning saved ticket is reported as unknown, not zero return', () => {
  const prediction = {
    raceId: 'missing-payout',
    edition: 'final',
    confidence: { value: 70 },
    runners: [
      { number: 1, name: 'A', rank: 1, mark: '◎', score: 80 },
      { number: 2, name: 'B', rank: 2, mark: '○', score: 75 },
      { number: 3, name: 'C', rank: 3, mark: '▲', score: 70 }
    ]
  };
  const plan = { tickets: [{ type: '単勝', numbers: [1], names: ['A'], amount: 1000, ordered: false }] };
  const compared = Engine.compareResult(prediction, { order: [1, 2, 3], payouts: [] }, plan);
  assert.equal(compared.ticketResults[0].hit, true);
  assert.equal(compared.ticketResults[0].returnAmount, null);
  assert.equal(compared.returnRate, null);
});

test('official payout entries and refunds override a single strict finish order', () => {
  const prediction = {
    fieldSize: 8,
    confidence: { value: 70 },
    runners: [1, 2, 3, 4].map((number, index) => ({ number, name: `馬${number}`, rank: index + 1, mark: index ? '' : '◎', score: 80 - index * 4 }))
  };
  const plan = {
    fieldSize: 8,
    tickets: [
      { type: '馬連', numbers: [1, 3], amount: 500 },
      { type: '単勝', numbers: [4], amount: 300 }
    ]
  };
  const result = {
    order: [1, 2, 3, 4],
    payouts: [{ type: '馬連', numbers: [1, 3], payoutPer100: 820 }],
    refunds: [{ type: '単勝', numbers: [4] }]
  };
  const compared = Engine.compareResult(prediction, result, plan);
  assert.equal(compared.ticketResults[0].hit, true);
  assert.equal(compared.ticketResults[0].returnAmount, 4100);
  assert.equal(compared.ticketResults[1].refunded, true);
  assert.equal(compared.ticketResults[1].returnAmount, 300);
});

test('record aggregation excludes races without a saved snapshot and preserves the saved ticket budget', () => {
  const race = structuredClone(globalThis.UMA_LOG_DEMO.races.find(item => item.result?.order?.length));
  const prediction = Engine.scoreRace(race, 'final');
  prediction.ticketPlan = Engine.createTickets(prediction, 5000);
  const excluded = Engine.aggregateRecords([race], 'final', Engine.DEFAULT_WEIGHTS, () => null);
  assert.equal(excluded.overall.count, 0);
  const included = Engine.aggregateRecords([race], 'final', Engine.DEFAULT_WEIGHTS, () => prediction);
  assert.equal(included.overall.count, 1);
  assert.equal(included.entries[0].comparison.stake, 5000);
});

test('aggregate return rate stays unknown when any winning payout is missing', () => {
  const races = structuredClone(globalThis.UMA_LOG_DEMO.races.filter(item => item.result?.order?.length).slice(0, 2));
  const predictions = new Map();
  races.forEach((race, index) => {
    const prediction = Engine.scoreRace(race, 'final');
    const winner = race.result.order[0];
    prediction.ticketPlan = { fieldSize: prediction.fieldSize, tickets: [{ type: '単勝', numbers: [winner], amount: 100 }] };
    race.result.payouts = index ? [{ type: '単勝', numbers: [winner], payoutPer100: 250 }] : [];
    predictions.set(race.id, prediction);
  });
  const record = Engine.aggregateRecords(races, 'final', Engine.DEFAULT_WEIGHTS, race => predictions.get(race.id));
  assert.equal(record.overall.returnRate, null);
  assert.equal(record.ticketGroups[0].returnsKnown, false);
});

test('mean rank error uses the same top-three denominator for partial and full orders', () => {
  const prediction = {
    fieldSize: 8,
    confidence: { value: 70 },
    runners: [1, 2, 3, 4, 5].map((number, index) => ({ number, name: `馬${number}`, rank: index + 1, mark: index ? '' : '◎', score: 80 - index }))
  };
  const partial = Engine.compareResult(prediction, { order: [2, 3, 1], payouts: [] }, { fieldSize: 8, tickets: [] });
  const full = Engine.compareResult(prediction, { order: [2, 3, 1, 5, 4], payouts: [] }, { fieldSize: 8, tickets: [] });
  assert.equal(partial.meanRankError, full.meanRankError);
});

test('edition deadlines and ready flags prevent late or incomplete snapshots', () => {
  const race = structuredClone(globalThis.UMA_LOG_DEMO.races.find(item => item.result?.order?.length));
  const raceDay = new Date(`${race.date}T00:00:00+09:00`).getTime();
  const post = new Date(`${race.date}T${race.startTime}:00+09:00`).getTime();
  assert.equal(Engine.predictionDeadline(race, 'dayBefore'), raceDay);
  assert.equal(Engine.predictionDeadline(race, 'final'), post - 2 * 60 * 1000);
  assert.equal(Engine.isHistoricalRaceEligible(race, 'final'), true);
  race.snapshots.final.ready = false;
  assert.equal(Engine.isHistoricalRaceEligible(race, 'final'), false);
});

test('result comparison retains the odds captured with the prediction', () => {
  const prediction = {
    fieldSize: 8,
    runners: [
      { number: 1, name: 'A', rank: 1, mark: '◎', score: 80, odds: 99, capturedOdds: 12.3, capturedPopularity: 2 },
      { number: 2, name: 'B', rank: 2, mark: '○', score: 70 },
      { number: 3, name: 'C', rank: 3, mark: '▲', score: 60 }
    ]
  };
  const comparison = Engine.compareResult(prediction, { order: [1, 2, 3], payouts: [] }, { fieldSize: 8, tickets: [] });
  assert.equal(comparison.comparisons[0].odds, 12.3);
  assert.equal(comparison.comparisons[0].popularity, 2);
});

test('demo dataset is valid, covers its 3 sample venues and all 12 races, and produces finite scores', () => {
  assert.equal(Engine.validateDataset(globalThis.UMA_LOG_DEMO), true);
  const latestDate = [...new Set(globalThis.UMA_LOG_DEMO.races.map(race => race.date))].sort().at(-1);
  for (const venue of ['東京', '中山', '京都']) {
    const venueRaces = globalThis.UMA_LOG_DEMO.races.filter(race => race.date === latestDate && race.venue === venue);
    assert.equal(venueRaces.length, 12);
  }
  globalThis.UMA_LOG_DEMO.races.slice(0, 12).forEach(race => {
    const prediction = Engine.scoreRace(race, 'final');
    assert.ok(prediction.runners.every(runner => Number.isFinite(runner.score) && runner.score >= 0 && runner.score <= 100));
  });
});

test('invalid public dataset is rejected and small history never updates weights', () => {
  assert.throws(() => Engine.validateDataset({ schemaVersion: 1, races: [] }), /races/);
  const injected = structuredClone(globalThis.UMA_LOG_DEMO);
  injected.races[0].horses[0].recentRuns[0].surface = '<img src=x onerror=alert(1)>';
  assert.throws(() => Engine.validateDataset(injected), /surface/);
  const duplicateResult = structuredClone(globalThis.UMA_LOG_DEMO);
  duplicateResult.races[0].result.order[1] = duplicateResult.races[0].result.order[0];
  assert.throws(() => Engine.validateDataset(duplicateResult), /result\.order/);
  const lateSnapshot = structuredClone(globalThis.UMA_LOG_DEMO);
  lateSnapshot.races[0].snapshots.final.asOf = `${lateSnapshot.races[0].date}T${lateSnapshot.races[0].startTime}:00+09:00`;
  assert.equal(Engine.isHistoricalRaceEligible(lateSnapshot.races[0], 'final'), false);
  assert.throws(() => Engine.validateDataset(lateSnapshot), /発走前/);
  const earlyResult = structuredClone(globalThis.UMA_LOG_DEMO);
  earlyResult.races[0].result.confirmedAt = `${earlyResult.races[0].date}T00:01:00+09:00`;
  assert.throws(() => Engine.validateDataset(earlyResult), /発走後/);
  const result = Engine.optimizeWeights(globalThis.UMA_LOG_DEMO.races.slice(0, 10), Engine.DEFAULT_WEIGHTS);
  assert.equal(result.adopted, false);
  assert.match(result.reason, /120件未満/);
});

test('schema rejects ambiguous slots, partial finals, local timestamps, and mutable race identity', () => {
  const duplicateSlot = structuredClone(globalThis.UMA_LOG_DEMO);
  duplicateSlot.races[1].date = duplicateSlot.races[0].date;
  duplicateSlot.races[1].venue = duplicateSlot.races[0].venue;
  duplicateSlot.races[1].raceNumber = duplicateSlot.races[0].raceNumber;
  assert.throws(() => Engine.validateDataset(duplicateSlot), /重複/);

  const partial = structuredClone(globalThis.UMA_LOG_DEMO);
  partial.races[0].result.order = partial.races[0].result.order.slice(0, 1);
  assert.throws(() => Engine.validateDataset(partial), /result\.order/);

  const localTime = structuredClone(globalThis.UMA_LOG_DEMO);
  localTime.generatedAt = '2026-08-09T00:00:00';
  assert.throws(() => Engine.validateDataset(localTime), /タイムゾーン/);

  const stringBoolean = structuredClone(globalThis.UMA_LOG_DEMO);
  stringBoolean.source.automated = 'false';
  assert.throws(() => Engine.validateDataset(stringBoolean), /automated/);

  const mutableIdentity = structuredClone(globalThis.UMA_LOG_DEMO);
  mutableIdentity.races[0].versions.final.id = 'different-race';
  assert.throws(() => Engine.validateDataset(mutableIdentity), /変更できません/);
});

test('jump races above 4000m validate and ignore flat-only recent evidence', () => {
  const payload = structuredClone(globalThis.UMA_LOG_DEMO);
  const race = payload.races[0];
  race.raceType = 'jump';
  race.distance = 4100;
  race.horses.forEach(horse => {
    horse.recentRuns.forEach(run => { run.raceType = 'flat'; });
  });
  assert.equal(Engine.validateDataset(payload), true);
  const prediction = Engine.scoreRace(race, 'final');
  assert.ok(prediction.runners.every(runner => runner.breakdown.recentForm.coverage === 0));
});
