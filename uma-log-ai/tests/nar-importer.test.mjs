import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const Engine = require('../engine.js');
require('../nar-importer.js');

const Importer = globalThis.UmaLogNarImporter;
const raceIdentity = (venue, raceNumber) => ({ 競馬場: venue, 競走年月日: '20260912', レース番号: String(raceNumber) });

function raceRow(venue, raceNumber, startTime) {
  return {
    ...raceIdentity(venue, raceNumber),
    レース名: `${venue}取込テスト競走`,
    条件: '3歳以上',
    発走時刻: startTime,
    芝ダート区分: 'ダート',
    距離: venue === '帯広ば' ? '200' : '1600',
    回り: venue === '帯広ば' ? '直' : '左',
    天候: '晴',
    馬場: '良'
  };
}

function horseRow(venue, raceNumber, number, finish) {
  return {
    ...raceIdentity(venue, raceNumber),
    馬番: String(number),
    枠番: String(Math.min(number, 8)),
    馬名: `地方テスト馬${venue}${number}`,
    性: number % 2 ? '牡' : '牝',
    齢: '4',
    騎手名: `地方騎手${number}`,
    調教師: `地方調教師${number}`,
    負担重量: venue === '帯広ば' ? '620' : '56',
    馬体重: venue === '帯広ば' ? String(900 + number) : String(460 + number),
    馬体重増減: number === 1 ? '+2' : '0',
    全成績: `${number}-2-1-4`,
    ダート左成績: '1-1-1-3',
    ダート右成績: '0-1-1-4',
    当競馬場成績: '1-1-0-2',
    うち当距離成績: '1-0-1-2',
    騎手成績: '1-1-1-3',
    父馬名: `父馬${number}`,
    母馬名: `母馬${number}`,
    母父馬名: `母父${number}`,
    着順: String(finish),
    人気: String(number)
  };
}

function oddsRows(venue, raceNumber, count) {
  const rows = [];
  for (let number = 1; number <= count; number += 1) {
    rows.push({ ...raceIdentity(venue, raceNumber), 賭式: '単勝', 番号1: String(number), オッズ: String(number + 1), 'オッズ（最大）': String(number + 1), 人気: String(number) });
    rows.push({ ...raceIdentity(venue, raceNumber), 賭式: '複勝', 番号1: String(number), オッズ: `${1 + number / 10}`, 'オッズ（最大）': `${1.2 + number / 10}`, 人気: String(number) });
  }
  rows.push({ ...raceIdentity(venue, raceNumber), 賭式: 'ワイド', 番号1: '1', 番号2: '2', オッズ: '4.2', 'オッズ（最大）': '4.8', 人気: '1' });
  return rows;
}

test('NAR CSV parser handles BOM, Japanese headers, commas, quotes, and newlines', () => {
  const rows = Importer.parseCsv('\uFEFF競馬場,馬名,メモ\r\n盛岡,"テスト,ホース","改行\nあり"\r\n');
  assert.deepEqual(rows, [{ 競馬場: '盛岡', 馬名: 'テスト,ホース', メモ: '改行\nあり' }]);
});

test('official-style rows build a valid local NAR dataset while separating banei', async () => {
  const model = JSON.parse(await readFile(new URL('../data/nar-model.json', import.meta.url), 'utf8'));
  const thoroughbredCount = 5;
  const baneiCount = 5;
  const extracted = {
    dataDate: '20260912',
    raceCapturedAt: '2026-09-12T04:00:00.000Z',
    oddsCapturedAt: '2026-09-12T02:55:00.000Z',
    raceRows: [raceRow('盛岡', 1, '1200'), raceRow('帯広ば', 2, '1230')],
    horseRows: [
      ...Array.from({ length: thoroughbredCount }, (_, index) => horseRow('盛岡', 1, index + 1, index + 1)),
      ...Array.from({ length: baneiCount }, (_, index) => horseRow('帯広ば', 2, index + 1, index + 1))
    ],
    oddsRows: [...oddsRows('盛岡', 1, thoroughbredCount), ...oddsRows('帯広ば', 2, baneiCount)],
    paybackRows: [{ ...raceIdentity('盛岡', 1), 単勝組番: '1', '単勝払戻金（円）': '250' }]
  };

  const dataset = Importer.buildDataset(extracted, model, '2026-09-12T04:01:00.000Z');
  assert.equal(Engine.validateDataset(dataset), true);
  assert.equal(dataset.source.mode, 'local-nar');
  assert.equal(dataset.source.redistributable, false);
  assert.equal(dataset.races.length, 2);
  assert.equal(dataset.archive.horseCount, thoroughbredCount + baneiCount);

  const morioka = dataset.races.find(race => race.venue === '盛岡');
  assert.equal(morioka.authority, 'NAR');
  assert.equal(morioka.publishedPrediction.captureTiming, 'pre-race');
  assert.equal(morioka.probabilityModel.placementStrengthGamma, 0.8);
  assert.ok(Math.abs(morioka.publishedPrediction.runners.reduce((sum, runner) => sum + runner.probability, 0) - 1) < 1e-10);
  assert.deepEqual(morioka.result.payouts[0], { type: '単勝', numbers: [1], payoutPer100: 250 });
  const expectedFirst = (1 / 2) / Array.from({ length: thoroughbredCount }, (_, index) => 1 / (index + 2)).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(morioka.publishedPrediction.runners.find(runner => runner.number === 1).probability - expectedFirst) < 1e-10);

  const banei = dataset.races.find(race => race.venue === '帯広ば');
  assert.equal(banei.raceType, 'banei');
  assert.equal(banei.modelStatus, 'out-of-scope');
  assert.equal(banei.publishedPrediction, null);

  const mismatched = structuredClone(dataset);
  mismatched.source.authority = 'JRA';
  assert.throws(() => Engine.validateDataset(mismatched), /source\.authority と競馬場が一致しません/);
});

test('the committed NAR model records an honest market-baseline selection before August 9', async () => {
  const model = JSON.parse(await readFile(new URL('../data/nar-model.json', import.meta.url), 'utf8'));
  assert.equal(model.modelVersion, 'NAR-1.0.0-market-reference');
  assert.equal(model.trainingRange.end, '2026-08-08');
  assert.equal(model.trainingRange.races, 6065);
  assert.equal(model.selectedMode, 'market');
  assert.ok(model.coefficients.every(coefficient => coefficient === 0));
  assert.equal(model.forwardAudit.length, 4);
  assert.equal(model.placementStrengthGamma, 0.8);
});
