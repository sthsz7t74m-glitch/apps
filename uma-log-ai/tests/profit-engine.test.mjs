import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ProfitEngine = require('../profit-engine.js');

function trustedPrediction(overrides = {}) {
  const probabilities = [.5, .2, .12, .1, .08];
  const odds = [10, 3, 4, 5, 6];
  return {
    fieldSize: 5,
    generatedAt: '2026-08-15T09:56:00+09:00',
    capturedAt: '2026-08-15T09:55:00+09:00',
    probabilityModel: { version: '3.0.0-stable', frozenBeforePost: true },
    runners: probabilities.map((probability, index) => ({
      number: index + 1,
      name: `テスト馬${index + 1}`,
      rank: index + 1,
      score: 80 - index * 4,
      capturedOdds: odds[index],
      v3WinProbability: probability
    })),
    ...overrides
  };
}

const race = {
  date: '2026-08-15',
  startTime: '10:00',
  venue: '札幌',
  raceNumber: 1,
  name: '3歳未勝利',
  raceType: 'flat'
};

test('v4 probability blend follows the fixed residual-shrinkage formula and sums to one', () => {
  const prediction = trustedPrediction();
  const analysis = ProfitEngine.analyze(prediction, { race, gateStatus: 'LOCKED', bankrollYen: 100000 });
  const total = analysis.rows.reduce((sum, row) => sum + row.v4Probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
  const model = prediction.runners.map(runner => runner.v3WinProbability);
  const inverse = prediction.runners.map(runner => 1 / runner.capturedOdds);
  const inverseTotal = inverse.reduce((sum, value) => sum + value, 0);
  const market = inverse.map(value => value / inverseTotal);
  const raw = market.map((q, index) => q * (model[index] / q) ** .8);
  const rawTotal = raw.reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(analysis.rows[0].v4Probability - raw[0] / rawTotal) < 1e-12);
});

test('a positive conservative edge remains paper-only while the forward gate is locked', () => {
  const plan = ProfitEngine.createPlan(trustedPrediction(), { race, gateStatus: 'LOCKED', bankrollYen: 100000 });
  assert.equal(plan.recommendation.status, 'PAPER_ONLY');
  assert.equal(plan.recommendation.candidate.number, 1);
  assert.ok(plan.recommendation.candidate.lowerBoundEv >= .05);
  assert.equal(plan.realAllocated, 0);
  assert.equal(plan.paperAllocated, 100);
  assert.equal(plan.tickets.length, 1);
  assert.equal(plan.tickets[0].paperOnly, true);
  assert.equal(plan.tickets[0].type, '単勝');
});

test('browser score probabilities are visible for reference but cannot unlock a bet', () => {
  const prediction = trustedPrediction({
    probabilityModel: null,
    runners: trustedPrediction().runners.map(({ v3WinProbability, ...runner }) => runner)
  });
  const analysis = ProfitEngine.analyze(prediction, { race, gateStatus: 'VERIFIED', bankrollYen: 100000 });
  assert.equal(analysis.status, 'REFERENCE_ONLY');
  assert.equal(analysis.modelSource, 'browser-score-proxy');
  assert.equal(analysis.realStakeYen, 0);
  assert.equal(analysis.paperStakeYen, 0);
  assert.ok(analysis.rows.every(row => row.probabilityLower90 === null));
});

test('snapshot timing outside one to ten minutes before post is rejected', () => {
  const prediction = trustedPrediction({ capturedAt: '2026-08-15T09:40:00+09:00' });
  const analysis = ProfitEngine.analyze(prediction, { race, gateStatus: 'LOCKED', bankrollYen: 100000 });
  assert.equal(analysis.status, 'SKIP');
  assert.ok(analysis.blockers.some(blocker => blocker.includes('オッズ取得時刻')));
  assert.equal(analysis.paperStakeYen, 0);
});

test('a snapshot older than two minutes at calculation time is rejected', () => {
  const prediction = trustedPrediction({ generatedAt: '2026-08-15T09:57:01+09:00' });
  const analysis = ProfitEngine.analyze(prediction, { race, gateStatus: 'LOCKED', bankrollYen: 100000 });
  assert.equal(analysis.status, 'SKIP');
  assert.ok(analysis.blockers.some(blocker => blocker.includes('2分より古い')));
  assert.equal(analysis.paperStakeYen, 0);
});

test('calibration lower bound uses the frozen 2019 bin multiplier', () => {
  const probability = .45;
  assert.ok(Math.abs(ProfitEngine.calibratedLowerBound(probability) - probability * .8500247617138794) < 1e-12);
});

test('production stake applies one-eighth Kelly and the 0.25% race cap', () => {
  assert.equal(ProfitEngine.productionStake(100000, .2, 5), 200);
  assert.equal(ProfitEngine.productionStake(10000, .01, 2), 0);
});

test('partial or non-normalized v3 inputs fail closed', () => {
  const partial = trustedPrediction();
  delete partial.runners[4].v3WinProbability;
  assert.equal(ProfitEngine.analyze(partial, { race }).status, 'SKIP');
  const badTotal = trustedPrediction();
  badTotal.runners[0].v3WinProbability = .4;
  const analysis = ProfitEngine.analyze(badTotal, { race });
  assert.equal(analysis.status, 'SKIP');
  assert.match(analysis.message, /合計が1/);
});
