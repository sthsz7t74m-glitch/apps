(function exposeJraLocalImporter(root) {
  'use strict';

  const JRA_VENUES = ['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉'];
  const SUPPORTED_VENUES = new Set(JRA_VENUES);
  const LOCAL_DATASET_ID = 'uma-log-ai-jra-local-v1';
  const GOING_MAP = {
    良: 'firm',
    稍重: 'yielding',
    重: 'soft',
    不良: 'heavy'
  };
  const WEATHER_MAP = { 晴: 'sunny', 曇: 'cloudy', 雨: 'rain', 小雨: 'rain', 雪: 'snow', 小雪: 'snow' };
  const PAYOUT_TYPES = new Map([
    ['単勝', '単勝'],
    ['複勝', '複勝'],
    ['馬連', '馬連'],
    ['ワイド', 'ワイド'],
    ['馬単', '馬単'],
    ['3連複', '三連複'],
    ['三連複', '三連複'],
    ['3連単', '三連単'],
    ['三連単', '三連単']
  ]);

  function clean(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function text(node, selector) {
    return clean(selector ? node?.querySelector(selector)?.textContent : node?.textContent);
  }

  function number(value) {
    const match = String(value ?? '').replace(/,/g, '').match(/[+-]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function integer(value) {
    const parsed = number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function japaneseDate(value) {
    const match = clean(value).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (!match) return null;
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  function japaneseTime(value) {
    const match = clean(value).match(/(\d{1,2})時\s*(\d{2})分/);
    if (!match) return null;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  function daysBetween(from, to) {
    const start = Date.parse(`${from}T00:00:00+09:00`);
    const end = Date.parse(`${to}T00:00:00+09:00`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.round((end - start) / 86_400_000);
  }

  function classLevel(value) {
    const label = clean(value);
    if (/(?:G|Jpn)(?:III|Ⅲ|3)|Ｇ(?:ＩＩＩ|Ⅲ|3)/i.test(label)) return 6;
    if (/(?:G|Jpn)(?:II|Ⅱ|2)|Ｇ(?:ＩＩ|Ⅱ|2)/i.test(label)) return 7;
    if (/(?:G|Jpn)(?:I|Ⅰ|1)|Ｇ(?:Ｉ|Ⅰ|1)/i.test(label)) return 8;
    if (/リステッド|\bL\b|\bOP\b|オープン/i.test(label)) return 5;
    if (/3勝|３勝/.test(label)) return 4;
    if (/2勝|２勝/.test(label)) return 3;
    if (/1勝|１勝/.test(label)) return 2;
    if (/未勝利|新馬/.test(label)) return 1;
    return null;
  }

  function normalizeVenue(value) {
    const label = clean(value);
    return JRA_VENUES.find(venue => label.includes(venue)) || label || null;
  }

  function parseCourse(value) {
    const course = clean(value);
    const distance = integer(course.replace(/,/g, ''));
    const surface = /ダ/.test(course) ? 'dirt' : /芝/.test(course) ? 'turf' : null;
    const direction = /直線/.test(course) ? 'straight' : /左/.test(course) ? 'left' : /右/.test(course) ? 'right' : null;
    return { distance, surface, direction };
  }

  function stableToken(value, fallback) {
    const normalized = clean(value)
      .normalize('NFKC')
      .replace(/[^0-9A-Za-z\u3040-\u30ff\u3400-\u9fff-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    return normalized || fallback;
  }

  function horseId(raceId, horseNumber) {
    return `${raceId}-horse-${horseNumber}`;
  }

  function parseHeader(document) {
    const container = document.querySelector('#syutsuba, #race_result');
    if (!container) throw new Error('JRAの詳細出馬表またはレース結果ページではありません');
    const dateLine = text(container, '.race_header .date_line .cell.date');
    const date = japaneseDate(dateLine);
    const venue = [...SUPPORTED_VENUES].find(item => dateLine.includes(item));
    if (!date) throw new Error('開催日を読み取れませんでした');
    if (!venue) throw new Error('JRAの競馬場名を読み取れませんでした');
    const raceAlt = container.querySelector('.race_number img')?.getAttribute('alt') || '';
    const raceNumber = integer(raceAlt);
    if (!raceNumber || raceNumber < 1 || raceNumber > 12) throw new Error('レース番号を読み取れませんでした');
    const startTime = japaneseTime(text(container, '.race_header .cell.time'));
    if (!startTime) throw new Error('発走時刻を読み取れませんでした');
    const raceName = text(container, '.race_name') || `${raceNumber}レース`;
    const courseText = text(container, '.race_title .type .course') || text(container, '.cell.course');
    const typeText = text(container, '.race_title .type');
    if (/障害|芝\s*→\s*ダート/.test(`${raceName} ${typeText} ${courseText}`)) throw new Error('初版のJRA HTML取込は平地競走だけに対応しています');
    const course = parseCourse(courseText);
    if (!course.distance || !course.surface || !course.direction) throw new Error('コース・距離・方向を読み取れませんでした');
    const gradeAlt = container.querySelector('.race_title .grade_icon img')?.getAttribute('alt') || '';
    const meetingLabel = dateLine.replace(/^.*?日(?:（[^）]+）)?\s*/, '');
    const weatherText = text(container, '.date_line .weather .txt');
    const goingText = text(container, '.date_line .baba li:not(.weather) .txt');
    const raceId = `jra-${date}-${stableToken(venue, 'venue')}-${String(raceNumber).padStart(2, '0')}`;
    return {
      id: raceId,
      date,
      venue,
      meetingLabel,
      raceNumber,
      startTime,
      name: raceName,
      isDebut: /新馬/.test(raceName),
      classLevel: classLevel(`${raceName} ${typeText} ${gradeAlt}`),
      surface: course.surface,
      raceType: 'flat',
      distance: course.distance,
      direction: course.direction,
      weather: WEATHER_MAP[weatherText] || null,
      going: GOING_MAP[goingText] || null,
      pace: null,
      drawBias: 0
    };
  }

  function parsePastRun(cell, targetDate, index) {
    const date = japaneseDate(text(cell, '.date_line .date'));
    if (!date || date >= targetDate) return null;
    const course = parseCourse(text(cell, '.info_line2 .dist'));
    const placeText = text(cell, '.place_line .place');
    if (/取消|除外/.test(placeText)) return null;
    const finish = integer(placeText);
    const fieldSize = integer(text(cell, '.place_line .max'));
    const last3F = number(text(cell, '.info_line3 .f3').replace(/^3F\s*/i, ''));
    const margin = number(text(cell, '.info_line3 .fin .time'));
    const carriedWeight = number(text(cell, '.info_line1 .weight'));
    const bodyWeight = integer(text(cell, '.info_line2 .h_weight'));
    const cornerPositions = [...cell.querySelectorAll('.corner_list li')].map(item => integer(item.textContent)).filter(Number.isInteger);
    const raceName = text(cell, '.race_line .name');
    const classText = `${text(cell, '.race_line .r_class')} ${cell.querySelector('.race_line .r_class img[alt]')?.getAttribute('alt') || ''}`;
    const venue = normalizeVenue(text(cell, '.date_line .rc'));
    const goingText = text(cell, '.info_line2 .condition');
    return {
      id: stableToken(`${date}-${venue}-${raceName}-${index}`, `${date}-${index}`),
      date,
      venue,
      surface: course.surface,
      raceType: /障害/.test(raceName) ? 'jump' : 'flat',
      resultStatus: /中止/.test(placeText) ? 'dnf' : 'finished',
      going: GOING_MAP[goingText] || null,
      distance: course.distance,
      finish,
      fieldSize,
      margin,
      last3F,
      classLevel: classLevel(`${raceName} ${classText}`),
      jockey: text(cell, '.info_line1 .jockey'),
      carriedWeight,
      bodyWeight,
      cornerPositions
    };
  }

  function inferRunningStyle(runs) {
    const samples = runs.map(run => {
      if (!run.cornerPositions?.length || !run.fieldSize) return null;
      const average = run.cornerPositions.reduce((sum, value) => sum + value, 0) / run.cornerPositions.length;
      return average / run.fieldSize;
    }).filter(value => value !== null);
    if (!samples.length) return null;
    const position = samples.slice(0, 3).reduce((sum, value) => sum + value, 0) / Math.min(3, samples.length);
    if (position <= 0.18) return 'front';
    if (position <= 0.4) return 'stalk';
    if (position <= 0.7) return 'mid';
    return 'close';
  }

  function pairStats(runs, jockey) {
    const normalizeJockey = value => clean(value).replace(/^[▲△☆◇]+\s*/, '');
    const paired = runs.filter(run => normalizeJockey(run.jockey) === normalizeJockey(jockey) && Number.isInteger(run.finish));
    if (!paired.length) return null;
    return {
      pairStarts: paired.length,
      ...(paired.length >= 3 ? { pairPlaceRate: paired.filter(run => run.finish <= 3).length / paired.length } : {})
    };
  }

  function pedigreeText(row, selector, excludedSelector = null) {
    const node = row.querySelector(selector);
    if (!node) return '';
    const clone = node.cloneNode(true);
    if (excludedSelector) clone.querySelectorAll(excludedSelector).forEach(item => item.remove());
    return clean(clone.textContent);
  }

  function parseCardHorse(row, race, expectedNumber) {
    const statusText = `${text(row, 'td.num')} ${text(row, 'td.horse .status, td.horse .cancel')}`;
    const scratched = /取消|除外/.test(statusText);
    const horseNumber = integer(text(row, 'td.num')) || (scratched ? expectedNumber : null);
    const gateAlt = row.querySelector('td.waku img')?.getAttribute('alt') || '';
    const gate = integer(gateAlt);
    const name = text(row, 'td.horse .name');
    if (!horseNumber || horseNumber !== expectedNumber || !gate || gate < 1 || gate > 8 || !name) throw new Error(`${expectedNumber}番の出走馬情報を完全に読み取れませんでした`);
    const odds = number(text(row, 'td.horse .odds .num'));
    const popularity = integer(text(row, 'td.horse .pop_rank'));
    const jockeyCell = row.querySelector('td.jockey');
    const jockey = text(jockeyCell, 'p.jockey');
    const carriedWeight = number(text(jockeyCell, 'p.weight'));
    const recentRuns = [...row.querySelectorAll('td.past')]
      .map((cell, index) => parsePastRun(cell, race.date, index))
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    const latest = recentRuns[0];
    const restDays = latest ? daysBetween(latest.date, race.date) : null;
    const burdenChange = latest?.carriedWeight !== null && latest?.carriedWeight !== undefined && carriedWeight !== null
      ? Math.round((carriedWeight - latest.carriedWeight) * 10) / 10
      : null;
    const sire = pedigreeText(row, 'td.horse .family_line .sire').replace(/^父：/, '');
    const mare = pedigreeText(row, 'td.horse .family_line .mare', '.bloodmare').replace(/^母：/, '');
    const bloodmare = text(row, 'td.horse .family_line .bloodmare').replace(/^(?:母の父：|母父：)/, '');
    const trainer = text(row, 'td.horse p.trainer').replace(/\((?:美浦|栗東)\)$/, '');
    const currentBodyWeightText = text(row, 'td.horse .result_line .cell.weight');
    const bodyWeight = integer(currentBodyWeightText);
    const bodyChangeText = text(row, 'td.horse .result_line .transition') || currentBodyWeightText;
    const bodyChangeMatch = bodyChangeText.match(/\(([+-]?\d+)\)|([+-]\d+)/);
    const stats = pairStats(recentRuns, jockey);
    return {
      id: horseId(race.id, horseNumber),
      number: horseNumber,
      gate,
      name,
      sexAge: text(jockeyCell, 'p.age').split('/')[0],
      carriedWeight,
      burdenChange,
      jockey,
      trainer,
      bodyWeight,
      bodyWeightChange: bodyChangeMatch ? Number(bodyChangeMatch[1] || bodyChangeMatch[2]) : null,
      restDays,
      runningStyle: inferRunningStyle(recentRuns),
      odds: odds && odds >= 1 ? odds : null,
      popularity,
      scratched,
      jockeyStats: stats,
      pedigreeNames: { sire, mare, bloodmare },
      recentRuns
    };
  }

  function inferPace(horses) {
    const active = horses.filter(horse => !horse.scratched);
    if (!active.some(horse => horse.runningStyle)) return null;
    const front = active.filter(horse => horse.runningStyle === 'front').length;
    const close = active.filter(horse => horse.runningStyle === 'close').length;
    if (front >= Math.max(3, Math.ceil(active.length * 0.25))) return 'fast';
    if (front <= 1 && close >= Math.ceil(active.length * 0.3)) return 'slow';
    return 'middle';
  }

  function captureSnapshots(race, capturedAt, importedAt, snapshotMode) {
    const captured = Date.parse(capturedAt);
    const imported = Date.parse(importedAt);
    const raceDay = Date.parse(`${race.date}T00:00:00+09:00`);
    const postTime = Date.parse(`${race.date}T${race.startTime}:00+09:00`);
    if (!Number.isFinite(captured) || !Number.isFinite(imported) || !Number.isFinite(raceDay) || !Number.isFinite(postTime)) return {};
    if (snapshotMode === 'reference') return {};
    if (snapshotMode === 'dayBefore') {
      if (captured < raceDay - 24 * 60 * 60 * 1000 || captured >= raceDay || imported >= raceDay) throw new Error('前日版はレース前日に保存し、日付が変わる前に取り込んでください');
      return { dayBefore: { asOf: capturedAt, label: '前日版・手動取込', ready: true } };
    }
    if (snapshotMode === 'final') {
      if (captured < raceDay || captured >= postTime - 2 * 60 * 1000 || imported >= postTime - 2 * 60 * 1000) throw new Error('当日最終版はレース当日に保存し、発走2分前までに取り込んでください');
      return { final: { asOf: capturedAt, label: '当日最終版・手動取込', ready: true } };
    }
    throw new Error('出馬表の取込方法を選んでください');
  }

  function parseCard(document, capturedAt, importedAt, snapshotMode) {
    const race = parseHeader(document);
    const rows = [...document.querySelectorAll('#syutsuba > table.basic > tbody > tr')];
    if (rows.length < 3 || rows.length > 18) throw new Error('出走馬の行数が3〜18頭の範囲ではありません');
    const horses = rows.map((row, index) => parseCardHorse(row, race, index + 1));
    if (new Set(horses.map(horse => horse.number)).size !== horses.length || new Set(horses.map(horse => clean(horse.name))).size !== horses.length) throw new Error('馬番または馬名が重複しています');
    if (horses.length < 3) throw new Error('出走馬を3頭以上読み取れませんでした');
    race.horses = horses;
    race.bettingFieldSize = horses.filter(horse => !horse.scratched).length;
    if (race.bettingFieldSize < 2) throw new Error('発売対象の出走馬が2頭未満です');
    race.pace = inferPace(horses);
    race.status = 'scheduled';
    race.snapshots = captureSnapshots(race, capturedAt, importedAt, snapshotMode);
    return { kind: 'card', race };
  }

  function parseResultHorse(row, race) {
    const horseNumber = integer(text(row, 'td.num'));
    const gate = integer(row.querySelector('td.waku img')?.getAttribute('alt') || '');
    const name = text(row, 'td.horse');
    if (!horseNumber || !gate || gate < 1 || gate > 8 || !name) throw new Error('結果の出走馬情報を完全に読み取れませんでした');
    const placeText = text(row, 'td.place');
    const scratched = /取消|除外/.test(placeText);
    const bodyWeightText = text(row, 'td.h_weight');
    const bodyWeight = integer(bodyWeightText);
    const changeMatch = bodyWeightText.match(/\(([+-]?\d+)\)/);
    return {
      id: horseId(race.id, horseNumber),
      number: horseNumber,
      gate,
      name,
      sexAge: text(row, 'td.age'),
      carriedWeight: number(text(row, 'td.weight')),
      jockey: text(row, 'td.jockey'),
      trainer: text(row, 'td.trainer'),
      bodyWeight,
      bodyWeightChange: changeMatch ? Number(changeMatch[1]) : null,
      popularity: integer(text(row, 'td.pop')),
      scratched,
      resultStatus: scratched ? 'nonStarter' : /中止/.test(placeText) ? 'dnf' : 'finished',
      runningStyle: null,
      recentRuns: []
    };
  }

  function parsePayouts(document) {
    const payouts = [];
    document.querySelectorAll('#race_result .refund_area li').forEach(item => {
      const type = PAYOUT_TYPES.get(text(item, 'dt'));
      if (!type) return;
      item.querySelectorAll('dd .line').forEach(line => {
        const numbers = (text(line, '.num').match(/\d+/g) || []).map(Number);
        const payoutPer100 = integer(text(line, '.yen'));
        if (numbers.length && payoutPer100 !== null) payouts.push({ type, numbers, payoutPer100 });
      });
    });
    return payouts;
  }

  function parseRefundHorses(document) {
    const restoration = document.querySelector('#race_result .refund_unit.restoration');
    if (!restoration) return { numbers: [], unknown: false };
    const numbers = [];
    restoration.querySelectorAll('strong.red').forEach(node => {
      for (const match of text(node).matchAll(/(\d{1,2})番/g)) numbers.push(Number(match[1]));
    });
    restoration.querySelectorAll('.num').forEach(node => {
      const value = integer(text(node));
      if (value) numbers.push(value);
    });
    const unique = [...new Set(numbers.filter(value => value >= 1 && value <= 40))];
    return { numbers: unique, unknown: unique.length === 0 };
  }

  function parseResult(document, importedAt) {
    const race = parseHeader(document);
    const captured = Date.parse(importedAt);
    const postTime = Date.parse(`${race.date}T${race.startTime}:00+09:00`);
    if (!Number.isFinite(captured) || !Number.isFinite(postTime) || captured < postTime) throw new Error('レース結果は発走後に取り込んでください');
    const rows = [...document.querySelectorAll('#race_result .race_result_unit > table.basic > tbody > tr')]
      .filter(row => row.querySelector('td.place') && row.querySelector('td.num'));
    const horses = rows.map(row => parseResultHorse(row, race));
    if (new Set(horses.map(horse => horse.number)).size !== horses.length || new Set(horses.map(horse => clean(horse.name))).size !== horses.length) throw new Error('結果の馬番または馬名が重複しています');
    const finishRows = rows.map(row => ({
      number: integer(text(row, 'td.num')),
      place: integer(text(row, 'td.place'))
    })).filter(item => item.number && item.place);
    const places = finishRows.map(item => item.place);
    if (new Set(places).size !== places.length) throw new Error('同着を含む結果は現在の検証方式では正確に表せないため取り込めません');
    const order = finishRows.slice().sort((a, b) => a.place - b.place).map(item => item.number);
    if (horses.length < 3 || order.length < 3) throw new Error('確定着順を3頭以上読み取れませんでした');
    const refunds = parseRefundHorses(document);
    race.horses = horses;
    race.bettingFieldSize = horses.filter(horse => !horse.scratched).length;
    race.status = 'final';
    race.result = {
      status: 'final',
      capturedAt: importedAt,
      order,
      payouts: parsePayouts(document),
      refundHorseNumbers: refunds.numbers,
      refundsUnknown: refunds.unknown
    };
    return { kind: 'result', race };
  }

  function mergeHorses(cardHorses, resultHorses) {
    const current = new Map(cardHorses.map(horse => [Number(horse.number), horse]));
    resultHorses.forEach(horse => {
      const existing = current.get(Number(horse.number));
      if (existing && clean(existing.name) !== clean(horse.name)) throw new Error(`${horse.number}番の馬名が保存済み出馬表と一致しません`);
      current.set(Number(horse.number), existing ? {
        ...existing,
        ...horse,
        id: existing.id,
        odds: existing.odds,
        recentRuns: existing.recentRuns,
        runningStyle: existing.runningStyle,
        jockeyStats: existing.jockeyStats,
        pedigreeNames: existing.pedigreeNames,
        restDays: existing.restDays,
        burdenChange: existing.burdenChange
      } : horse);
    });
    return [...current.values()].sort((a, b) => Number(a.number) - Number(b.number));
  }

  function mergeRace(existing, incoming, kind) {
    if (!existing) return incoming;
    const existingNames = new Map((existing.horses || []).map(horse => [Number(horse.number), clean(horse.name)]));
    const mismatch = (incoming.horses || []).find(horse => existingNames.has(Number(horse.number)) && existingNames.get(Number(horse.number)) !== clean(horse.name));
    if (mismatch) throw new Error(`${mismatch.number}番の馬名が保存済みデータと一致しません`);
    if (kind === 'result') {
      return {
        ...existing,
        ...incoming,
        horses: mergeHorses(existing.horses || [], incoming.horses || []),
        bettingFieldSize: incoming.bettingFieldSize,
        result: incoming.result,
        status: 'final'
      };
    }
    return {
      ...existing,
      ...incoming,
      horses: existing.result ? mergeHorses(incoming.horses || [], existing.horses || []) : incoming.horses,
      bettingFieldSize: existing.result ? existing.bettingFieldSize : incoming.bettingFieldSize,
      snapshots: { ...(incoming.snapshots || {}), ...(existing.snapshots || {}) },
      result: existing.result,
      status: existing.result?.status === 'final' ? 'final' : incoming.status
    };
  }

  function localDataset(existingDataset, parsed, importedAt) {
    const existingRaces = existingDataset?.source?.mode === 'local-jra' && Array.isArray(existingDataset.races)
      ? existingDataset.races
      : [];
    const slot = `${parsed.race.date}:${parsed.race.venue}:${parsed.race.raceNumber}`;
    const index = existingRaces.findIndex(race => `${race.date}:${race.venue}:${race.raceNumber}` === slot);
    const races = existingRaces.slice();
    const merged = mergeRace(index >= 0 ? races[index] : null, parsed.race, parsed.kind);
    if (index >= 0) races[index] = merged;
    else races.push(merged);
    races.sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue, 'ja') || a.raceNumber - b.raceNumber);
    return {
      schemaVersion: 1,
      generatedAt: importedAt,
      source: {
        mode: 'local-jra',
        datasetId: LOCAL_DATASET_ID,
        name: 'JRA公式ページ・端末内取込',
        detail: '利用者が保存した公式HTMLをこの端末内だけで解析',
        redistributable: false,
        automated: false,
        asOfFieldsGuaranteed: false
      },
      venues: JRA_VENUES.slice(),
      races
    };
  }

  function parseInertFragment(html) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') throw new Error('このブラウザはHTML取込に対応していません');
    const template = document.createElement('template');
    template.innerHTML = String(html || '').replace(/^\uFEFF?\s*<!doctype[^>]*>/i, '');
    return template.content;
  }

  function inspectHtml(html) {
    const parsedDocument = parseInertFragment(html);
    const kind = parsedDocument.querySelector('#syutsuba') ? 'card' : parsedDocument.querySelector('#race_result') ? 'result' : null;
    if (!kind) throw new Error('JRAの詳細出馬表またはレース結果ページではありません');
    const race = parseHeader(parsedDocument);
    return { kind, raceId: race.id, date: race.date, venue: race.venue, raceNumber: race.raceNumber };
  }

  function importHtml(html, existingDataset = null, now = new Date(), snapshotMode = 'reference', captured = now) {
    const parsedDocument = parseInertFragment(html);
    const importedAt = now.toISOString();
    const capturedAt = captured.toISOString();
    const parsed = parsedDocument.querySelector('#syutsuba') ? parseCard(parsedDocument, capturedAt, importedAt, snapshotMode)
      : parsedDocument.querySelector('#race_result') ? parseResult(parsedDocument, capturedAt)
        : null;
    if (!parsed) throw new Error('JRAの詳細出馬表またはレース結果ページではありません');
    const dataset = localDataset(existingDataset, parsed, importedAt);
    return {
      dataset,
      kind: parsed.kind,
      race: dataset.races.find(race => race.id === parsed.race.id),
      replacedOtherDataset: Boolean(existingDataset?.races?.length && existingDataset?.source?.mode !== 'local-jra')
    };
  }

  function decodeHtml(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      // JRAの保存HTMLはShift_JISの場合があるため、宣言を確認して再試行する。
    }
    const header = new TextDecoder('windows-1252').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
    const declared = header.match(/charset\s*=\s*["']?([^\s"'/>]+)/i)?.[1] || '';
    const encoding = /shift[_-]?jis|windows-31j|cp932|ms_kanji/i.test(declared) ? 'shift_jis' : 'utf-8';
    return new TextDecoder(encoding).decode(bytes);
  }

  root.UmaLogJraImporter = { decodeHtml, importHtml, inspectHtml };
}(typeof window !== 'undefined' ? window : globalThis));
