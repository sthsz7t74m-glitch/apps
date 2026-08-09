import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const ProfitEngine = require('../profit-engine.js');

test('August 9 archive remains reference-only with zero yen under the locked v5 gate', async () => {
  const dataset = JSON.parse(await readFile(new URL('../data/races.json', import.meta.url), 'utf8'));
  const plans = dataset.races.map(race => {
    if (!race.publishedPrediction) return null;
    const published = race.publishedPrediction;
    const names = new Map(race.horses.map(horse => [Number(horse.number), horse.name]));
    const prediction = {
      fieldSize: published.runners.length,
      generatedAt: published.generatedAt,
      capturedAt: published.capturedAt,
      probabilityModel: race.probabilityModel,
      runners: published.runners.map(runner => ({
        number: Number(runner.number),
        name: names.get(Number(runner.number)),
        rank: Number(runner.rank),
        modelProbability: Number(runner.probability),
        capturedOdds: Number(runner.odds),
        score: 50
      }))
    };
    return ProfitEngine.createPlan(prediction, {
      race: {
        date: race.date,
        startTime: race.startTime,
        venue: race.venue,
        raceNumber: race.raceNumber,
        name: race.name,
        raceType: race.raceType || 'flat',
        isDebut: race.isDebut === true
      },
      snapshotAt: published.capturedAt,
      gateStatus: 'LOCKED',
      bankrollYen: 100000
    });
  });
  const modeled = plans.filter(Boolean);
  assert.equal(modeled.length, 35);
  assert.ok(modeled.every(plan => plan.recommendation.status === 'REFERENCE_ONLY'));
  assert.equal(modeled.reduce((sum, plan) => sum + plan.realAllocated, 0), 0);
  assert.equal(modeled.reduce((sum, plan) => sum + plan.paperAllocated, 0), 0);
  assert.equal(dataset.races.length - modeled.length, 1);
});

test('predictions-results overview rates use only the 20 pre-race captures', async () => {
  const dataset = JSON.parse(await readFile(new URL('../data/races.json', import.meta.url), 'utf8'));
  const preRace = dataset.races.filter(race => race.publishedPrediction?.captureTiming === 'pre-race');
  const postRace = dataset.races.filter(race => race.publishedPrediction?.captureTiming === 'post-race');
  const rows = preRace.map(race => {
    const main = race.publishedPrediction.runners.slice().sort((a, b) => a.rank - b.rank)[0].number;
    const result = race.result.order.map(Number);
    return { mainHit: result[0] === main, mainTop3: result.slice(0, 3).includes(main) };
  });
  assert.equal(preRace.length, 20);
  assert.equal(postRace.length, 15);
  assert.equal(rows.filter(row => row.mainHit).length, 5);
  assert.equal(rows.filter(row => row.mainTop3).length, 14);
  assert.equal(rows.filter(row => row.mainHit).length / rows.length, .25);
  assert.equal(rows.filter(row => row.mainTop3).length / rows.length, .7);
});
