(function exposeUmaLogNarImporter(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.UmaLogNarImporter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createNarImporter() {
  'use strict';

  const NAR_VENUES = Object.freeze(['帯広ば', '門別', '盛岡', '水沢', '浦和', '船橋', '大井', '川崎', '金沢', '笠松', '名古屋', '園田', '姫路', '高知', '佐賀']);
  const THOROUGHBRED_VENUES = new Set(NAR_VENUES.filter(venue => venue !== '帯広ば'));
  const VENUE_CODES = Object.freeze({ '帯広ば': 'obihiro', 門別: 'monbetsu', 盛岡: 'morioka', 水沢: 'mizusawa', 浦和: 'urawa', 船橋: 'funabashi', 大井: 'oi', 川崎: 'kawasaki', 金沢: 'kanazawa', 笠松: 'kasamatsu', 名古屋: 'nagoya', 園田: 'sonoda', 姫路: 'himeji', 高知: 'kochi', 佐賀: 'saga' });
  const ZIP_LIMITS = Object.freeze({ files: 16, compressedBytes: 64 * 1024 * 1024, uncompressedBytes: 128 * 1024 * 1024 });
  const FEATURE_NAMES = Object.freeze([
    'career_log_starts', 'career_win_rate', 'career_place_rate',
    'direction_log_starts', 'direction_win_rate', 'direction_place_rate',
    'course_log_starts', 'course_win_rate', 'course_place_rate',
    'distance_log_starts', 'distance_win_rate', 'distance_place_rate',
    'jockey_log_starts', 'jockey_win_rate', 'jockey_place_rate',
    'draw_position', 'carried_weight_relative', 'body_weight_relative',
    'body_weight_change', 'age_relative', 'is_female', 'is_gelding'
  ]);

  function numeric(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const match = String(value).replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
    if (!match) return fallback;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round(value, digits = 6) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function clamp(value, lower, upper) {
    return Math.max(lower, Math.min(upper, Number(value)));
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function record(value) {
    const values = String(value || '').match(/\d+/g)?.slice(0, 4).map(Number) || [];
    if (values.length < 4) return { starts: 0, wins: 0, seconds: 0, thirds: 0, winRate: 0, placeRate: 0 };
    const [wins, seconds, thirds, others] = values;
    const starts = wins + seconds + thirds + others;
    return {
      starts, wins, seconds, thirds,
      winRate: starts ? wins / starts : 0,
      placeRate: starts ? (wins + seconds + thirds) / starts : 0
    };
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else value += character;
      } else if (character === '"') quoted = true;
      else if (character === ',') { row.push(value); value = ''; }
      else if (character === '\n' || character === '\r') {
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        row.push(value);
        value = '';
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
      } else value += character;
    }
    if (value || row.length) { row.push(value); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map((header, index) => (index ? header : header.replace(/^\uFEFF/, '')).trim());
    return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  }

  function decodeUtf8(bytes) {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  }

  function viewNumber(view, offset, bytes) {
    if (offset < 0 || offset + bytes > view.byteLength) throw new Error('ZIPの構造が壊れています');
    if (bytes === 2) return view.getUint16(offset, true);
    if (bytes === 4) return view.getUint32(offset, true);
    throw new Error('ZIP数値幅が不正です');
  }

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = Array.from({ length: 256 }, (_, number) => {
        let value = number;
        for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        return value >>> 0;
      });
    }
    let crc = 0xffffffff;
    bytes.forEach(byte => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('ZIP展開に対応した最新のChromeまたはEdgeが必要です');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZip(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 22 || arrayBuffer.byteLength > ZIP_LIMITS.compressedBytes) throw new Error('ZIPは64MB以内にしてください');
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let end = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) { end = offset; break; }
    }
    if (end < 0) throw new Error('ZIPの終端情報がありません');
    const entryCount = viewNumber(view, end + 10, 2);
    const centralOffset = viewNumber(view, end + 16, 4);
    if (!entryCount || entryCount > ZIP_LIMITS.files) throw new Error(`ZIP内のファイルは${ZIP_LIMITS.files}件以内にしてください`);
    const entries = new Map();
    let totalSize = 0;
    let offset = centralOffset;
    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      if (viewNumber(view, offset, 4) !== 0x02014b50) throw new Error('ZIP中央ディレクトリが壊れています');
      const method = viewNumber(view, offset + 10, 2);
      const expectedCrc = viewNumber(view, offset + 16, 4);
      const compressedSize = viewNumber(view, offset + 20, 4);
      const size = viewNumber(view, offset + 24, 4);
      const nameLength = viewNumber(view, offset + 28, 2);
      const extraLength = viewNumber(view, offset + 30, 2);
      const commentLength = viewNumber(view, offset + 32, 2);
      const localOffset = viewNumber(view, offset + 42, 4);
      const name = decodeUtf8(bytes.slice(offset + 46, offset + 46 + nameLength));
      totalSize += size;
      if (totalSize > ZIP_LIMITS.uncompressedBytes) throw new Error('ZIP展開後の合計は128MB以内にしてください');
      if (viewNumber(view, localOffset, 4) !== 0x04034b50) throw new Error('ZIPローカルヘッダが壊れています');
      const localNameLength = viewNumber(view, localOffset + 26, 2);
      const localExtraLength = viewNumber(view, localOffset + 28, 2);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      let content;
      if (method === 0) content = compressed;
      else if (method === 8) content = await inflateRaw(compressed);
      else throw new Error(`未対応のZIP圧縮方式です（${method}）`);
      if (content.length !== size || crc32(content) !== expectedCrc) throw new Error(`${name}の整合性を確認できません`);
      if (!name.endsWith('/') && /\.csv$/i.test(name)) entries.set(name.split('/').at(-1), content);
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function captureFromFile(file) {
    const timestamp = String(file.name || '').match(/^\d{8}_(\d{10})_(?:race|odds)\.zip$/i)?.[1];
    if (timestamp) {
      const date = new Date(Number(timestamp) * 1000);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const modified = Number(file.lastModified);
    return Number.isFinite(modified) && modified > 0 ? new Date(modified).toISOString() : new Date().toISOString();
  }

  async function extractFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) throw new Error('NAR公式のレース情報ZIPとオッズ情報ZIPを選んでください');
    if (files.length > 8) throw new Error('一度に選べるのは8ファイルまでです');
    if (files.reduce((sum, file) => sum + Number(file.size || 0), 0) > ZIP_LIMITS.compressedBytes) throw new Error('選択ファイルは合計64MB以内にしてください');
    const entries = new Map();
    let raceCapturedAt = null;
    let oddsCapturedAt = null;
    for (const file of files) {
      const lowerName = String(file.name || '').toLowerCase();
      if (lowerName.endsWith('.zip')) {
        const extracted = await readZip(await file.arrayBuffer());
        extracted.forEach((content, name) => entries.set(name, content));
        if (/_race\.zip$/i.test(file.name)) raceCapturedAt = captureFromFile(file);
        if (/_odds\.zip$/i.test(file.name)) oddsCapturedAt = captureFromFile(file);
      } else if (lowerName.endsWith('.csv')) {
        entries.set(file.name, new Uint8Array(await file.arrayBuffer()));
        if (/_odds\.csv$/i.test(file.name)) oddsCapturedAt = captureFromFile(file);
        else if (/_(?:racelist|horselist|payback)\.csv$/i.test(file.name)) raceCapturedAt = captureFromFile(file);
      }
      else throw new Error('NAR公式の日次ZIPまたは展開済みCSVだけを選択できます');
    }
    const names = [...entries.keys()];
    const pick = suffix => names.find(name => new RegExp(`^\\d{8}_${suffix}\\.csv$`, 'i').test(name));
    const raceListName = pick('racelist');
    const horseListName = pick('horselist');
    const oddsName = pick('odds');
    const paybackName = pick('payback');
    if (!raceListName || !horseListName || !oddsName) throw new Error('日次レース情報ZIPと日次オッズ情報ZIPの両方が必要です');
    const dates = new Set([raceListName, horseListName, oddsName, paybackName].filter(Boolean).map(name => name.slice(0, 8)));
    if (dates.size !== 1) throw new Error('異なる開催日のCSVが混ざっています');
    return {
      raceRows: parseCsv(decodeUtf8(entries.get(raceListName))),
      horseRows: parseCsv(decodeUtf8(entries.get(horseListName))),
      oddsRows: parseCsv(decodeUtf8(entries.get(oddsName))),
      paybackRows: paybackName ? parseCsv(decodeUtf8(entries.get(paybackName))) : [],
      dataDate: [...dates][0],
      raceCapturedAt: raceCapturedAt || new Date().toISOString(),
      oddsCapturedAt: oddsCapturedAt || raceCapturedAt || new Date().toISOString()
    };
  }

  function raceKey(row) {
    return `${row['競馬場']}|${row['競走年月日']}|${Number(row['レース番号'])}`;
  }

  function toIsoDate(raw) {
    const value = String(raw || '');
    if (!/^\d{8}$/.test(value)) throw new Error('競走年月日が不正です');
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  function startTime(raw) {
    const value = String(raw || '').padStart(4, '0');
    if (!/^\d{4}$/.test(value)) return null;
    const output = `${value.slice(0, 2)}:${value.slice(2)}`;
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(output) ? output : null;
  }

  function going(value, venue) {
    if (venue === '帯広ば') return 'standard';
    return ({ 良: 'firm', 稍重: 'yielding', 重: 'soft', 不良: 'heavy' })[String(value)] || null;
  }

  function weather(value) {
    return ({ 晴: 'sunny', 曇: 'cloudy', 雨: 'rain', 雪: 'snow' })[String(value)] || null;
  }

  function direction(value) {
    return ({ 左: 'left', 右: 'right', 直: 'straight' })[String(value)] || 'straight';
  }

  function rateScore(rate, starts) {
    if (!starts) return 50;
    const reliability = Math.min(1, starts / 12);
    return round(clamp(50 + reliability * ((35 + 90 * rate) - 50), 0, 100), 1);
  }

  function rawFeatures(row, raceRow, fieldSize) {
    const career = record(row['全成績']);
    const directional = record(raceRow['回り'] === '左' ? row['ダート左成績'] : row['ダート右成績']);
    const course = record(row['当競馬場成績']);
    const distanceStats = record(row['うち当距離成績']);
    const jockey = record(row['騎手成績']);
    const number = numeric(row['馬番'], 0);
    const sex = String(row['性'] || '');
    return [
      Math.log1p(career.starts), career.winRate, career.placeRate,
      Math.log1p(directional.starts), directional.winRate, directional.placeRate,
      Math.log1p(course.starts), course.winRate, course.placeRate,
      Math.log1p(distanceStats.starts), distanceStats.winRate, distanceStats.placeRate,
      Math.log1p(jockey.starts), jockey.winRate, jockey.placeRate,
      (number - (fieldSize + 1) / 2) / Math.max(fieldSize, 1),
      numeric(row['負担重量']), numeric(row['馬体重']), clamp(numeric(row['馬体重増減'], 0), -50, 50), numeric(row['齢']),
      sex === '牝' ? 1 : 0, sex === 'セン' ? 1 : 0
    ];
  }

  function modelProbabilities(rows, raceRow, winOdds, model) {
    const active = rows.filter(row => winOdds.has(Number(row['馬番'])));
    if (active.length < 5 || !THOROUGHBRED_VENUES.has(raceRow['競馬場'])) return null;
    const raw = active.map(row => rawFeatures(row, raceRow, active.length));
    [16, 17, 19].forEach(column => {
      const fill = median(raw.map(features => features[column]));
      raw.forEach(features => { if (!Number.isFinite(features[column])) features[column] = fill; });
      const mean = raw.reduce((sum, features) => sum + features[column], 0) / raw.length;
      raw.forEach(features => { features[column] -= mean; });
    });
    const standardized = raw.map(features => features.map((value, index) => (value - Number(model.featureMean[index])) / Number(model.featureScale[index])));
    for (let column = 0; column < FEATURE_NAMES.length; column += 1) {
      const mean = standardized.reduce((sum, features) => sum + features[column], 0) / standardized.length;
      standardized.forEach(features => { features[column] -= mean; });
    }
    const inverse = active.map(row => 1 / winOdds.get(Number(row['馬番'])).lower);
    const totalInverse = inverse.reduce((sum, value) => sum + value, 0);
    const scores = standardized.map((features, index) => {
      const market = inverse[index] / totalInverse;
      const residual = features.reduce((sum, value, featureIndex) => sum + value * Number(model.coefficients[featureIndex]), 0);
      return Number(model.marketExponent) * Math.log(market) + residual;
    });
    const maximum = Math.max(...scores);
    const exponentials = scores.map(score => Math.exp(score - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    return new Map(active.map((row, index) => [Number(row['馬番']), exponentials[index] / total]));
  }

  function oddsByRace(rows) {
    const races = new Map();
    rows.forEach(row => {
      const key = raceKey(row);
      if (!races.has(key)) races.set(key, { win: new Map(), place: new Map(), wide: [] });
      const target = races.get(key);
      const lower = numeric(row['オッズ']);
      const upper = numeric(row['オッズ（最大）'], lower);
      const first = numeric(row['番号1']);
      const second = numeric(row['番号2']);
      if (!(lower >= 1) || !(upper >= lower) || !Number.isInteger(first)) return;
      const quote = { lower, upper, popularity: numeric(row['人気']) };
      if (row['賭式'] === '単勝') target.win.set(first, quote);
      if (row['賭式'] === '複勝') target.place.set(first, quote);
      if (row['賭式'] === 'ワイド' && Number.isInteger(second) && first !== second) target.wide.push({ numbers: [first, second].sort((a, b) => a - b), lower, upper });
    });
    return races;
  }

  function payoutRows(rows) {
    const grouped = new Map();
    rows.forEach(row => {
      const key = raceKey(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    return grouped;
  }

  function addPayout(output, seen, type, numbers, amount) {
    const normalizedNumbers = numbers.map(Number);
    const payout = numeric(amount);
    if (!normalizedNumbers.length || normalizedNumbers.some(number => !Number.isInteger(number) || number < 1) || !(payout >= 0)) return;
    const key = `${type}:${type === '馬単' || type === '三連単' ? normalizedNumbers.join('-') : normalizedNumbers.slice().sort((a, b) => a - b).join('-')}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push({ type, numbers: normalizedNumbers, payoutPer100: Math.round(payout) });
  }

  function payoutsFor(rows) {
    const output = [];
    const seen = new Set();
    rows.forEach(row => {
      addPayout(output, seen, '単勝', [row['単勝組番']], row['単勝払戻金（円）']);
      for (let index = 1; index <= 3; index += 1) addPayout(output, seen, '複勝', [row[`複勝組番${index}`]], row[`複勝払戻金${index}（円）`]);
      addPayout(output, seen, '馬連', [row['馬複組番1'], row['馬複組番2']], row['馬複払戻金（円）']);
      addPayout(output, seen, '馬単', [row['馬単組番1'], row['馬単組番2']], row['馬単払戻金（円）']);
      for (let index = 1; index <= 3; index += 1) addPayout(output, seen, 'ワイド', [row[`ワイド組番${index}馬番1`], row[`ワイド組番${index}馬番2`]], row[`ワイド払戻金${index}（円）`]);
      addPayout(output, seen, '三連複', [row['３連複組番馬番1'], row['３連複組番馬番2'], row['３連複組番馬番3']], row['３連複払戻金（円）']);
      addPayout(output, seen, '三連単', [row['３連単組番馬番1'], row['３連単組番馬番2'], row['３連単組番馬番3']], row['３連単払戻金（円）']);
    });
    return output;
  }

  function buildHorse(row, raceId, quotes, raceRow, final) {
    const number = Number(row['馬番']);
    const career = record(row['全成績']);
    const course = record(row['当競馬場成績']);
    const distanceStats = record(row['うち当距離成績']);
    const directional = record(raceRow['回り'] === '左' ? row['ダート左成績'] : row['ダート右成績']);
    const jockey = record(row['騎手成績']);
    const win = quotes.win.get(number);
    const place = quotes.place.get(number);
    const finish = numeric(row['着順']);
    const scratched = final && !finish && !win;
    return {
      id: `${raceId}-${number}`,
      number,
      gate: Number(row['枠番']) || 1,
      name: String(row['馬名'] || '').trim(),
      sexAge: `${String(row['性'] || '').trim()}${String(row['齢'] || '').trim()}`,
      jockey: String(row['騎手名'] || '').trim(),
      trainer: String(row['調教師'] || '').trim(),
      carriedWeight: numeric(row['負担重量']),
      bodyWeight: numeric(row['馬体重']),
      bodyWeightChange: numeric(row['馬体重増減']),
      odds: win?.lower ?? null,
      winOddsSnapshot: win?.lower ?? null,
      placeOdds: place ? { lower: place.lower, upper: place.upper } : null,
      popularity: win?.popularity ?? numeric(row['人気']),
      scratched,
      runningStyle: 'unknown',
      recentRuns: [],
      pedigreeDescription: `父：${String(row['父馬名'] || '不明').trim()} 母：${String(row['母馬名'] || '不明').trim()}（母父：${String(row['母父馬名'] || '不明').trim()}）`,
      courseFit: rateScore(course.placeRate, course.starts),
      distanceFit: rateScore(distanceStats.placeRate, distanceStats.starts),
      paceFit: rateScore(directional.placeRate, directional.starts),
      conditionScore: clamp(50 - Math.abs(numeric(row['馬体重増減'], 0)) * 0.6, 20, 65),
      drawFit: 50,
      jockeyStats: { winRate: jockey.winRate, placeRate: jockey.placeRate },
      narStats: { career, course, distance: distanceStats, direction: directional, jockey }
    };
  }

  function buildDataset(extracted, model, importedAt = new Date().toISOString()) {
    if (!model || model.featureNames?.join('|') !== FEATURE_NAMES.join('|') || model.coefficients?.length !== FEATURE_NAMES.length) throw new Error('NARモデル設定が不正です');
    const horseGroups = new Map();
    extracted.horseRows.forEach(row => {
      const key = raceKey(row);
      if (!horseGroups.has(key)) horseGroups.set(key, []);
      horseGroups.get(key).push(row);
    });
    const quoteGroups = oddsByRace(extracted.oddsRows);
    const paybackGroups = payoutRows(extracted.paybackRows);
    const races = extracted.raceRows.filter(row => NAR_VENUES.includes(row['競馬場'])).map(raceRow => {
      const key = raceKey(raceRow);
      const rows = (horseGroups.get(key) || []).sort((a, b) => Number(a['馬番']) - Number(b['馬番']));
      if (rows.length < 3) return null;
      const quotes = quoteGroups.get(key) || { win: new Map(), place: new Map(), wide: [] };
      const resultOrder = rows.map(row => ({ number: Number(row['馬番']), finish: numeric(row['着順']) })).filter(item => Number.isInteger(item.finish) && item.finish > 0).sort((a, b) => a.finish - b.finish || a.number - b.number).map(item => item.number);
      const final = resultOrder.length >= 3;
      const venue = raceRow['競馬場'];
      const dateValue = toIsoDate(raceRow['競走年月日']);
      const raceNumber = Number(raceRow['レース番号']);
      const id = `nar-${raceRow['競走年月日']}-${VENUE_CODES[venue]}-${String(raceNumber).padStart(2, '0')}`;
      const horses = rows.map(row => buildHorse(row, id, quotes, raceRow, final));
      const activeNumbers = new Set(horses.filter(horse => !horse.scratched).map(horse => horse.number));
      const start = startTime(raceRow['発走時刻']);
      const postAt = start ? Date.parse(`${dateValue}T${start}:00+09:00`) : NaN;
      const snapshotAt = Date.parse(extracted.oddsCapturedAt);
      const minutesBeforePost = Number.isFinite(postAt) && Number.isFinite(snapshotAt) ? (postAt - snapshotAt) / 60000 : null;
      const timing = minutesBeforePost !== null && minutesBeforePost >= 1 && minutesBeforePost <= 10
        ? 'pre-race' : final ? 'post-race' : 'reference';
      const winProbabilities = modelProbabilities(rows, raceRow, quotes.win, model);
      const publishedRunners = winProbabilities ? [...winProbabilities.entries()].filter(([number]) => activeNumbers.has(number)).map(([number, probability]) => ({
        number,
        probability,
        odds: quotes.win.get(number)?.lower ?? null,
        fairOdds: 1 / probability
      })).sort((a, b) => b.probability - a.probability || a.number - b.number).map((runner, index) => ({ ...runner, rank: index + 1 })) : [];
      const modeled = THOROUGHBRED_VENUES.has(venue) && publishedRunners.length === activeNumbers.size && publishedRunners.length >= 5;
      const probabilityModel = modeled ? {
        version: model.modelVersion,
        frozenBeforePost: timing === 'pre-race',
        output: 'final-win-probability',
        placementStrengthGamma: Number(model.placementStrengthGamma),
        authority: 'NAR'
      } : null;
      const payouts = final ? payoutsFor(paybackGroups.get(key) || []).filter(payout => payout.numbers.every(number => activeNumbers.has(number))) : [];
      return {
        id,
        authority: 'NAR',
        date: dateValue,
        venue,
        raceNumber,
        name: String(raceRow['レース名'] || `${raceNumber}R`).trim(),
        meetingLabel: String(raceRow['条件'] || '').trim(),
        startTime: start,
        surface: raceRow['芝ダート区分'] === '芝' ? 'turf' : 'dirt',
        raceType: venue === '帯広ば' ? 'banei' : 'flat',
        direction: direction(raceRow['回り']),
        distance: Number(raceRow['距離']),
        weather: weather(raceRow['天候']),
        going: going(raceRow['馬場'], venue),
        trackConditionLabel: String(raceRow['馬場'] || '').trim(),
        bettingFieldSize: activeNumbers.size,
        status: final ? 'final' : 'scheduled',
        oddsSnapshotAt: extracted.oddsCapturedAt,
        modelStatus: venue === '帯広ば' ? 'out-of-scope' : modeled ? 'reference-model' : 'awaiting-odds',
        probabilityModel,
        publishedPrediction: modeled ? {
          modelVersion: model.modelVersion,
          generatedAt: importedAt,
          capturedAt: extracted.oddsCapturedAt,
          captureTiming: timing,
          output: 'final-win-probability',
          minutesBeforePost: round(minutesBeforePost ?? -1440, 3),
          decision: 'reference-only',
          grade: model.selectedMode === 'market' ? '市場基準' : 'NAR専用',
          runners: publishedRunners
        } : null,
        horses,
        wideOdds: quotes.wide.filter(quote => quote.numbers.every(number => activeNumbers.has(number))),
        result: final ? {
          status: 'final',
          order: resultOrder,
          confirmedAt: extracted.raceCapturedAt,
          capturedAt: extracted.raceCapturedAt,
          payouts,
          refundsUnknown: true,
          source: 'NAR公式日次CSV（端末内取込）'
        } : null
      };
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || NAR_VENUES.indexOf(a.venue) - NAR_VENUES.indexOf(b.venue) || a.raceNumber - b.raceNumber);
    if (!races.length) throw new Error('対応する地方競馬レースがありません');
    const venues = [...new Set(races.map(race => race.venue))];
    const preRace = races.filter(race => race.publishedPrediction?.captureTiming === 'pre-race').length;
    const postRace = races.filter(race => race.publishedPrediction?.captureTiming === 'post-race').length;
    const outsideWindow = races.filter(race => race.publishedPrediction?.captureTiming === 'reference').length;
    return {
      schemaVersion: 1,
      generatedAt: importedAt,
      source: {
        mode: 'local-nar',
        authority: 'NAR',
        datasetId: `uma-log-ai-local-nar-${extracted.dataDate}`,
        name: `${toIsoDate(extracted.dataDate)} NAR端末内実データ`,
        detail: `${venues.join('・')} ${races.length}R（端末内のみ）`,
        redistributable: false,
        automated: false,
        asOfFieldsGuaranteed: false,
        normalizedFactsOnly: true,
        officialResultsVerified: true,
        verificationSource: '地方競馬情報サイト 日次CSV'
      },
      venues: NAR_VENUES,
      archive: {
        raceCount: races.length,
        horseCount: races.reduce((sum, race) => sum + race.horses.length, 0),
        preRaceReferenceCount: preRace,
        postRaceReferenceCount: postRace,
        outsideWindowReferenceCount: outsideWindow,
        outOfScopeCount: races.filter(race => race.modelStatus === 'out-of-scope').length
      },
      races
    };
  }

  async function importFiles(fileList, model, importedAt = new Date().toISOString()) {
    const extracted = await extractFiles(fileList);
    return buildDataset(extracted, model, importedAt);
  }

  return Object.freeze({ NAR_VENUES, FEATURE_NAMES, parseCsv, readZip, extractFiles, buildDataset, importFiles, _test: Object.freeze({ numeric, record, modelProbabilities, payoutsFor, crc32 }) });
}));
