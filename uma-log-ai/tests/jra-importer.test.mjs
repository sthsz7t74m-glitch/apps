import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';

const require = createRequire(import.meta.url);
const Engine = require('../engine.js');
globalThis.document = parseHTML('<!doctype html><html><body></body></html>').document;
require('../jra-importer.js');

const Importer = globalThis.UmaLogJraImporter;

function pastRun({ date, venue, finish, fieldSize, corner, jockey }) {
  return `<td class="past p1">
    <div class="date_line"><span class="date">${date}</span><span class="rc">${venue}</span></div>
    <div class="race_line"><span class="name">1勝クラス</span><span class="r_class">1勝クラス</span></div>
    <div class="place_line"><span class="place">${finish}着</span><span class="max">${fieldSize}頭</span></div>
    <div class="info_line1"><span class="jockey">${jockey}</span><span class="weight">56.0kg</span></div>
    <div class="info_line2"><span class="dist">1200芝</span><span class="condition">良</span><span class="h_weight">470kg</span></div>
    <div class="info_line3"><ul class="corner_list"><li>${corner}</li></ul><span class="f3">3F 35.1</span><span class="fin">先頭馬<span class="time">(0.2)</span></span></div>
  </td>`;
}

function horseRow({ number, gate, name, odds, placeOdds, popularity, jockey, corner }) {
  return `<tr>
    <td class="waku"><img alt="${gate}枠"></td><td class="num">${number}</td>
    <td class="horse"><p class="name"><a>${name}</a></p><div class="odds"><span class="num">${odds}</span>${placeOdds ? `<span class="place_odds">${placeOdds}</span>` : ''}<span class="pop_rank">${popularity}人気</span></div><p class="trainer">調教師${number}</p><ul class="family_line"><li class="sire">父：父馬${number}</li><li class="mare">母：母馬${number}</li></ul><div class="result_line"><span class="cell weight">${470 + number * 2}kg</span><span class="transition">(+2)</span></div></td>
    <td class="jockey"><p class="age">牡3</p><p class="weight">57.0kg</p><p class="jockey">${jockey}</p></td>
    ${pastRun({ date: '2026年8月30日', venue: '新潟', finish: number, fieldSize: 12, corner, jockey })}
  </tr>`;
}

function header(id, { venue = '中山', raceNumber = 1, start = '10時00分' } = {}) {
  return `<div class="race_header"><div class="date_line"><div class="cell date">2026年9月12日（土曜） 4回${venue}1日</div><div class="cell time"><strong>${start}</strong></div><div class="cell baba"><ul><li class="weather"><span class="txt">晴</span></li><li class="turf"><span class="txt">良</span></li></ul></div></div></div>
    <div class="race_title"><div class="race_number"><img alt="${raceNumber}レース"></div><h1 class="race_name">取込テスト競走</h1><div class="type"><span class="category">3歳以上</span><span class="class">1勝クラス</span><span class="course">芝1,200メートル（右）</span></div></div>`;
}

function cardHtml(options = {}) {
  return `<!doctype html><html><body><div id="syutsuba">${header('syutsuba', options)}<table class="basic"><tbody>
    ${horseRow({ number: 1, gate: 1, name: 'テストホースA', odds: 3.2, placeOdds: '1.4 - 1.8', popularity: 1, jockey: '騎手A', corner: 1 })}
    ${horseRow({ number: 2, gate: 2, name: 'テストホースB', odds: 5.4, popularity: 2, jockey: '騎手B', corner: 4 })}
    ${horseRow({ number: 3, gate: 3, name: 'テストホースC', odds: 8.6, popularity: 3, jockey: '騎手C', corner: 9 })}
  </tbody></table></div></body></html>`;
}

function resultHtml({ tie = false } = {}) {
  const places = tie ? [1, 2, 2] : [1, 2, 3];
  const horses = ['テストホースA', 'テストホースB', 'テストホースC'];
  return `<!doctype html><html><body><div id="race_result">${header('race_result')}<div class="race_result_unit"><table class="basic"><tbody>
    ${horses.map((name, index) => `<tr><td class="place">${places[index]}着</td><td class="waku"><img alt="${index + 1}枠"></td><td class="num">${index + 1}</td><td class="horse"><a>${name}</a></td><td class="age">牡3</td><td class="weight">57.0kg</td><td class="jockey">騎手${String.fromCharCode(65 + index)}</td><td class="h_weight">${472 + index * 2}kg(+2)</td><td class="trainer">調教師${index + 1}</td><td class="pop">${index + 1}人気</td></tr>`).join('')}
  </tbody></table></div><div class="refund_area"><ul><li><dl><dt>単勝</dt><dd><div class="line"><span class="num">1</span><span class="yen">350円</span></div></dd></dl></li></ul></div></div></body></html>`;
}

function resultWithScratchAndRefundHtml() {
  const extra = '<tr><td class="place">除外</td><td class="waku"><img alt="4枠"></td><td class="num">4</td><td class="horse"><a>テストホースD</a></td><td class="age">牡3</td><td class="weight">57.0kg</td><td class="jockey">騎手D</td><td class="h_weight">480kg(+2)</td><td class="trainer">調教師4</td><td class="pop">4人気</td></tr>';
  return resultHtml()
    .replace('</tbody></table></div><div class="refund_area">', `${extra}</tbody></table></div><div class="refund_area">`)
    .replace('</div></body></html>', '<div class="refund_unit restoration"><strong class="red">返還馬番 4番</strong></div></div></body></html>');
}

test('saved card HTML produces valid day-before and same-day snapshots without inventing a fifth run', () => {
  const dayBefore = Importer.importHtml(cardHtml(), null, new Date('2026-09-11T12:00:00+09:00'), 'dayBefore');
  Engine.validateDataset(dayBefore.dataset);
  assert.equal(dayBefore.kind, 'card');
  assert.equal(dayBefore.race.horses.length, 3);
  assert.equal(dayBefore.race.horses[0].recentRuns.length, 1);
  assert.deepEqual(Object.keys(dayBefore.race.snapshots), ['dayBefore']);
  assert.equal(dayBefore.race.horses[0].odds, 3.2);
  assert.deepEqual(dayBefore.race.horses[0].placeOdds, { lower: 1.4, upper: 1.8 });

  const sameDay = Importer.importHtml(cardHtml(), dayBefore.dataset, new Date('2026-09-12T09:00:00+09:00'), 'final');
  Engine.validateDataset(sameDay.dataset);
  assert.deepEqual(Object.keys(sameDay.race.snapshots).sort(), ['dayBefore', 'final']);
  assert.equal(sameDay.race.snapshots.dayBefore.asOf, dayBefore.race.snapshots.dayBefore.asOf);
});

test('result HTML merges into the matching card while retaining pre-race evidence and payouts', () => {
  const card = Importer.importHtml(cardHtml(), null, new Date('2026-09-12T09:00:00+09:00'), 'final');
  const result = Importer.importHtml(resultHtml(), card.dataset, new Date('2026-09-12T11:00:00+09:00'));
  Engine.validateDataset(result.dataset);
  assert.equal(result.kind, 'result');
  assert.deepEqual(result.race.result.order, [1, 2, 3]);
  assert.deepEqual(result.race.result.payouts[0], { type: '単勝', numbers: [1], payoutPer100: 350 });
  assert.equal(result.race.horses[0].recentRuns.length, 1);
  assert.equal(result.race.horses[0].odds, 3.2);
});

test('unsafe or ambiguous inputs fail closed', () => {
  assert.throws(() => Importer.importHtml(resultHtml({ tie: true }), null, new Date('2026-09-12T11:00:00+09:00')), /同着/);
  const jump = cardHtml().replace('芝1,200メートル（右）', '3,000メートル（芝→ダート）');
  assert.throws(() => Importer.importHtml(jump, null, new Date('2026-09-12T11:00:00+09:00'), 'reference'), /平地競走/);
  assert.throws(() => Importer.importHtml('<img src="https://example.invalid/pixel">', null), /詳細出馬表またはレース結果/);
});

test('all ten JRA venues are accepted', () => {
  for (const venue of Engine.JRA_VENUES) {
    const imported = Importer.importHtml(cardHtml({ venue }), null, new Date('2026-09-11T12:00:00+09:00'), 'dayBefore');
    assert.equal(imported.race.venue, venue);
  }
});

test('snapshot edition boundaries are explicit and fail closed', () => {
  assert.throws(() => Importer.importHtml(cardHtml(), null, new Date('2026-09-10T23:59:59+09:00'), 'dayBefore'), /レース前日/);
  assert.throws(() => Importer.importHtml(cardHtml(), null, new Date('2026-09-12T00:00:00+09:00'), 'dayBefore'), /レース前日/);
  assert.throws(() => Importer.importHtml(cardHtml(), null, new Date('2026-09-11T23:59:59+09:00'), 'final'), /レース当日/);
  assert.throws(() => Importer.importHtml(cardHtml(), null, new Date('2026-09-12T09:58:00+09:00'), 'final'), /発走2分前/);
  const savedBeforeMidnight = new Date('2026-09-11T23:59:00+09:00');
  const importedAfterMidnight = new Date('2026-09-12T00:01:00+09:00');
  assert.throws(() => Importer.importHtml(cardHtml(), null, importedAfterMidnight, 'final', savedBeforeMidnight), /レース当日/);
  assert.throws(() => Importer.importHtml(cardHtml(), null, importedAfterMidnight, 'dayBefore', savedBeforeMidnight), /日付が変わる前/);
  const savedAt = new Date('2026-09-11T11:55:00+09:00');
  const importedAt = new Date('2026-09-11T12:05:00+09:00');
  const captured = Importer.importHtml(cardHtml(), null, importedAt, 'dayBefore', savedAt);
  assert.equal(captured.race.snapshots.dayBefore.asOf, savedAt.toISOString());
  assert.equal(captured.dataset.generatedAt, importedAt.toISOString());
  const reference = Importer.importHtml(cardHtml(), null, new Date('2026-09-12T11:00:00+09:00'), 'reference');
  assert.deepEqual(reference.race.snapshots, {});
});

test('graded runs, non-starters, weather, and missing normal rows are handled conservatively', () => {
  const graded = cardHtml()
    .replace('<span class="r_class">1勝クラス</span>', '<span class="r_class"><img alt="GⅢ"></span>')
    .replace('<span class="txt">晴</span>', '<span class="txt">小雪</span>');
  const gradedRace = Importer.importHtml(graded, null, new Date('2026-09-12T11:00:00+09:00'), 'reference').race;
  assert.equal(gradedRace.horses[0].recentRuns[0].classLevel, 6);
  assert.equal(gradedRace.weather, 'snow');

  const pastExcluded = cardHtml().replace('<span class="place">1着</span>', '<span class="place">除外</span>');
  const pastExcludedRace = Importer.importHtml(pastExcluded, null, new Date('2026-09-12T11:00:00+09:00'), 'reference').race;
  assert.equal(pastExcludedRace.horses[0].recentRuns.length, 0);
  assert.equal(pastExcludedRace.horses[0].restDays, null);

  const currentExcluded = cardHtml().replace('<td class="num">3</td>\n    <td class="horse"><p class="name"><a>テストホースC</a>', '<td class="num"><span class="cap">除外</span></td>\n    <td class="horse"><p class="name"><a>テストホースC</a>');
  const currentExcludedRace = Importer.importHtml(currentExcluded, null, new Date('2026-09-12T11:00:00+09:00'), 'reference').race;
  assert.equal(currentExcludedRace.horses[2].number, 3);
  assert.equal(currentExcludedRace.horses[2].scratched, true);
  assert.equal(currentExcludedRace.bettingFieldSize, 2);

  const broken = cardHtml().replace('<td class="num">2</td>', '<td class="num"></td>');
  assert.throws(() => Importer.importHtml(broken, null, new Date('2026-09-12T11:00:00+09:00'), 'reference'), /2番/);
});

test('result non-starters reduce field size and refund every ticket containing the returned horse', () => {
  const imported = Importer.importHtml(resultWithScratchAndRefundHtml(), null, new Date('2026-09-12T11:00:00+09:00'));
  Engine.validateDataset(imported.dataset);
  assert.equal(imported.race.bettingFieldSize, 3);
  assert.equal(imported.race.horses.find(horse => horse.number === 4).scratched, true);
  assert.deepEqual(imported.race.result.refundHorseNumbers, [4]);

  const prediction = { fieldSize: 3, runners: [1, 2, 3, 4].map((number, index) => ({ number, name: `馬${number}`, rank: index + 1 })) };
  const ticketPlan = { fieldSize: 3, tickets: [{ type: '単勝', numbers: [4], amount: 100 }] };
  const comparison = Engine.compareResult(prediction, imported.race.result, ticketPlan);
  assert.equal(comparison.ticketResults[0].refunded, true);
  assert.equal(comparison.ticketResults[0].returnAmount, 100);
  assert.equal(comparison.returnsKnown, true);
});

test('decoder supports UTF-8 files with a legacy declaration and genuine Shift_JIS bytes', () => {
  const mislabeledUtf8 = new TextEncoder().encode('<meta charset="Shift_JIS"><p>東京競馬</p>');
  assert.match(Importer.decodeHtml(mislabeledUtf8), /東京競馬/);

  const prefix = [...new TextEncoder().encode('<meta charset="Shift_JIS"><p>')];
  const suffix = [...new TextEncoder().encode('</p>')];
  const tokyoKeibaCp932 = [0x93, 0x8c, 0x8b, 0x9e, 0x8b, 0xa3, 0x94, 0x6e];
  assert.match(Importer.decodeHtml(Uint8Array.from([...prefix, ...tokyoKeibaCp932, ...suffix])), /東京競馬/);
});
