import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, "..");
const DATA_PATH = path.join(APP_DIR, "data.js");
const DEFAULT_FUTURE_DAYS = 60;
const DEFAULT_MIN_EVENTS = 60;
const FETCH_TIMEOUT_MS = 20_000;
const TOKYO_OFFSET = "+09:00";
const APP_VERSION = "2.6.0";

const VENUES = Object.freeze([
  {
    id: "lumine",
    name: "ルミネtheよしもと",
    venueId: 1205,
    venue: "ルミネtheよしもと",
    area: "新宿",
    url: "https://ticket.fany.lol/lumine"
  },
  {
    id: "jimbocho",
    name: "神保町よしもと漫才劇場",
    venueId: 1209,
    venue: "神保町よしもと漫才劇場",
    area: "神保町",
    url: "https://ticket.fany.lol/jimbocho_manzaigekijyo"
  },
  {
    id: "shibuya",
    name: "渋谷よしもと漫才劇場",
    venueId: 3040,
    venue: "渋谷よしもと漫才劇場",
    area: "渋谷",
    url: "https://ticket.fany.lol/shibuya_manzaigekijyo"
  }
]);

const namedEntities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  yen: "¥"
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toNumber(value) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

export function addDays(iso, amount) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function tokyoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function tokyoTimestamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}:${byType.second}${TOKYO_OFFSET}`;
}

export function decodeEntities(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

export function stripHtml(value = "") {
  return decodeEntities(String(value))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:h[1-6]|p|li|div|section|article|dt|dd|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cleanLine(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[・*●○\-\s]+/, "")
    .trim();
}

function normalizePerformerText(value = "") {
  return cleanLine(value)
    .replace(/\[[^\]]+\]/g, "／")
    .replace(/【[^】]+】/g, "／")
    .replace(/(?:MC|ゲスト|出演|ネタ出演者|コーナー出演者|企画ライブ|前説|若衆|各部班長|部班長|委員長|副祭礼委員長)[：:]/g, "／")
    .replace(/^出演\s+/, "")
    .replace(/ほか|他|もっと見る/g, "")
    .replace(/\s*\/\s*/g, "／");
}

function splitPerformers(value = "") {
  const blocked = /受付|発売|抽選|販売|公演中止|延期|チケット|検索|劇場|会場|問い合わせ|マイページ|ログイン|先行|メンバー/;
  return normalizePerformerText(value)
    .split(/[／、,，]+/)
    .map(name => cleanLine(name).replace(/[。．]+$/g, ""))
    .filter(name => name && name !== "出演" && name.length <= 40 && !blocked.test(name))
    .filter((name, index, list) => list.indexOf(name) === index)
    .slice(0, 36);
}

function inferGenre(title = "", performerText = "", venue = "") {
  const target = `${title} ${performerText} ${venue}`;
  if (/企画|トーク|奇祭|ゲーム|ワークショップ|単独|主催|の会|ライブ[「『].+[」』]/.test(target) && !/ネタ|漫才|コント|寄席|Kakeru|Kiwami|マンゲキ/.test(target)) {
    return "project";
  }
  if (/ルミネ|寄席|特別公演|平日14時|土日祝/.test(target)) return "yose";
  if (/コーナー|プラス|SP|Kiwami|極LIVE|マンゲキお笑いライブ/.test(target)) return "neta-corner";
  if (/ネタ|漫才|コント|Kakeru|翔LIVE|お笑いライブ/.test(target)) return "neta";
  return "project";
}

function inferStatus(blockText = "") {
  if (/先着発売中|受付中|販売中/.test(blockText)) return "available";
  return "check";
}

function priceFromBlock(blockText = "") {
  const matches = [...blockText.matchAll(/(?:前売|当日|一般|小学生以下|子供)[^。\n]*?([0-9,]{3,})円/g)]
    .map(match => toNumber(match[1]))
    .filter(Boolean);
  if (!matches.length) return { priceMin: 0, priceText: "価格は公式で確認" };
  const min = Math.min(...matches);
  return { priceMin: min, priceText: `前売・一般 ${min.toLocaleString("ja-JP")}円〜` };
}

function formatClock(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length < 4) return "";
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function parsePerformanceDate(value = "") {
  const text = stripHtml(value);
  const match = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
}

function statusFromSales(performance = {}) {
  const sales = Array.isArray(performance.performance_sales) ? performance.performance_sales : [];
  if (!performance.is_ticketable) return "check";
  return sales.some(sale => /先着発売中|受付中|販売中/.test(String(sale.display_sales_status || "")))
    ? "available"
    : "check";
}

function eventUrlFromPerformance(performance = {}, venueUrl = "") {
  const sales = Array.isArray(performance.performance_sales) ? performance.performance_sales : [];
  const sale = sales.find(item => /先着発売中|受付中|販売中/.test(String(item.display_sales_status || "")) && item.destination_url);
  if (sale?.destination_url) return sale.destination_url;
  if (performance.event_id && performance.id) return `https://ticket.fany.lol/event/detail/${performance.event_id}/${performance.id}`;
  if (performance.event_id) return `https://ticket.fany.lol/event/detail/${performance.event_id}`;
  return venueUrl;
}

export function performanceToEvent(performance, venueConfig) {
  const date = parsePerformanceDate(performance.performance_date);
  const open = formatClock(performance.opening_time);
  const start = formatClock(performance.start_time);
  const title = cleanLine(performance.name || performance.event?.name || "");
  const performerText = stripHtml(performance.performer_detail || "");
  const price = priceFromBlock([
    performance.remarks,
    performance.precautions_detail,
    performance.other_detail
  ].filter(Boolean).join("\n"));

  return {
    date,
    open,
    start,
    venue: venueConfig.venue,
    area: venueConfig.area,
    title,
    genre: inferGenre(title, performerText, venueConfig.venue),
    status: statusFromSales(performance),
    priceMin: price.priceMin,
    priceText: price.priceText,
    performers: splitPerformers(performerText),
    url: eventUrlFromPerformance(performance, venueConfig.url),
    sourceVenue: venueConfig.id
  };
}

function isUtilityLine(line = "") {
  return /^(出演|受付|先着|抽選|一般発売|FANY|●FANY|検索|クリア|劇場から探す|メニュー|ご利用ガイド|マイページ|新規会員登録|お知らせ|FAQ|お問い合わせ)$/.test(line);
}

function nextMeaningfulLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = cleanLine(lines[index]);
    if (!line || isUtilityLine(line)) continue;
    return { line, index };
  }
  return { line: "", index: startIndex };
}

export function parseFanyPage(html, venueConfig, options = {}) {
  const today = options.today || tokyoDate(options.now || new Date());
  const endDate = options.endDate || addDays(today, DEFAULT_FUTURE_DAYS);
  const lines = stripHtml(html).split("\n").map(cleanLine).filter(Boolean);
  const events = [];
  const datePattern = /(\d{4})\/(\d{1,2})\/(\d{1,2})\([^)]*\)\s*開場\s*(\d{1,2}):(\d{2})\s*開演\s*(\d{1,2}):(\d{2})/;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(datePattern);
    if (!match) continue;

    const [, year, month, day, openHour, openMinute, startHour, startMinute] = match;
    const date = `${year}-${pad(month)}-${pad(day)}`;
    if (date < today || date > endDate) continue;

    const titleEntry = nextMeaningfulLine(lines, index + 1);
    const title = titleEntry.line.replace(/\s*\(.*?東京都.*?\)\s*$/g, "").trim();
    if (!title || datePattern.test(title)) continue;

    const blockLines = [];
    for (let cursor = titleEntry.index + 1; cursor < Math.min(lines.length, titleEntry.index + 18); cursor += 1) {
      const line = lines[cursor];
      if (datePattern.test(line)) break;
      blockLines.push(line);
    }

    const blockText = blockLines.join(" ");
    const performerStart = blockLines.findIndex(line => /^出演$|出演\s/.test(line) || /\[[^\]]*出演者\]/.test(line));
    const performerLines = performerStart >= 0
      ? blockLines.slice(performerStart).filter(line => !/受付|発売|抽選|販売|期間|FANY/.test(line))
      : blockLines.filter(line => /\[[^\]]*出演者\]|／/.test(line));
    const performers = splitPerformers(performerLines.join(" "));
    const price = priceFromBlock(blockText);

    events.push({
      date,
      open: `${pad(openHour)}:${pad(openMinute)}`,
      start: `${pad(startHour)}:${pad(startMinute)}`,
      venue: venueConfig.venue,
      area: venueConfig.area,
      title,
      genre: inferGenre(title, performerLines.join(" "), venueConfig.venue),
      status: inferStatus(blockText),
      priceMin: price.priceMin,
      priceText: price.priceText,
      performers,
      url: venueConfig.url,
      sourceVenue: venueConfig.id
    });
  }

  return events;
}

function rowKey(event) {
  return `${event.date}|${event.start}|${event.title}|${event.venue}`;
}

function uniqueEvents(events) {
  const seen = new Set();
  return events
    .filter(event => event.date && event.start && event.title && event.venue)
    .filter(event => {
      const key = rowKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => `${a.date}${a.start}${a.venue}${a.title}`.localeCompare(`${b.date}${b.start}${b.venue}${b.title}`, "ja"));
}

function eventToRow(event) {
  const performers = event.performers.length ? event.performers.join("／") : "出演者は公式で確認";
  return [
    event.date,
    event.open,
    event.start,
    event.venue,
    event.area,
    event.title,
    event.genre,
    event.status,
    event.priceMin || "",
    event.priceText || "価格は公式で確認",
    performers,
    event.url
  ].map(value => String(value ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "／").trim()).join("|");
}

function parseRowsFromDataJs(source = "") {
  const match = String(source).match(/YOSHIMOTO_LIVE_ROWS\s*=\s*String\.raw`([\s\S]*?)`/);
  if (!match) return [];
  return match[1].trim().split(/\r?\n/).map(line => {
    const [date, open, start, venue, area, title, genre, status, priceMin, priceText, performers, url] = line.split("|");
    return {
      date,
      open,
      start,
      venue,
      area,
      title,
      genre,
      status,
      priceMin: toNumber(priceMin),
      priceText,
      performers: String(performers || "").split("／").map(cleanLine).filter(Boolean),
      url
    };
  }).filter(event => event.date && event.start && event.title);
}

async function readExistingEvents() {
  const files = ["data.js", "data-september-v240.js"];
  const all = [];
  for (const file of files) {
    try {
      all.push(...parseRowsFromDataJs(await readFile(path.join(APP_DIR, file), "utf8")));
    } catch {
      // Missing optional data files should not stop a refresh.
    }
  }
  return all;
}

function dateRangeUrl(baseUrl, today, endDate) {
  const from = today.replaceAll("-", "/");
  const to = endDate.replaceAll("-", "/");
  const params = new URLSearchParams({
    from,
    to,
    genre: "0",
    search_type: "form"
  });
  return `${baseUrl}?${params}`;
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; yoshimoto-live-updater/2.6)"
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "accept": "application/json",
          "user-agent": "Mozilla/5.0 (compatible; yoshimoto-live-updater/2.6)"
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function eventMoreUrl(venue, today, endDate, offset) {
  const params = new URLSearchParams({
    from: today.replaceAll("-", "/"),
    to: endDate.replaceAll("-", "/"),
    genre: "0",
    search_type: "form",
    offset: String(offset),
    venue_id: String(venue.venueId)
  });
  return `https://ticket.fany.lol/search/event_more?${params}`;
}

async function fetchVenueEventsFromJson(venue, today, endDate) {
  const events = [];
  let offset = 0;
  let lastError = null;
  while (offset < 600) {
    let payload;
    try {
      payload = await fetchJson(eventMoreUrl(venue, today, endDate, offset));
    } catch (error) {
      lastError = error;
      if (offset === 0) throw error;
      break;
    }
    const performances = Array.isArray(payload.performances) ? payload.performances : [];
    events.push(...performances.map(performance => performanceToEvent(performance, venue)));
    const loadCount = Number(payload.load_count || performances.length || 0);
    if (!performances.length || loadCount <= 0) break;
    offset += loadCount;
    if (performances.length < loadCount) break;
  }
  return { events, error: lastError };
}

async function fetchVenueEvents({ today, endDate }) {
  const results = [];
  const events = [];
  for (const venue of VENUES) {
    let best = [];
    let lastError = null;

    try {
      const result = await fetchVenueEventsFromJson(venue, today, endDate);
      best = result.events;
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }

    if (!best.length) {
      const candidates = [dateRangeUrl(venue.url, today, endDate), venue.url];
      for (const url of candidates) {
        try {
          const html = await fetchPage(url);
          const parsed = parseFanyPage(html, { ...venue, url }, { today, endDate });
          if (parsed.length > best.length) best = parsed.map(event => ({ ...event, url }));
        } catch (error) {
          lastError = error;
        }
      }
    }
    results.push({ venue, count: best.length, error: lastError ? String(lastError?.message || lastError) : null });
    events.push(...best);
  }
  return { events, checks: results };
}

export function serializeDataJs(data) {
  return `window.YOSHIMOTO_LIVE_META = Object.freeze(${JSON.stringify(data.meta, null, 2)});\n\nwindow.YOSHIMOTO_LIVE_ROWS = String.raw\`\n${data.events.map(eventToRow).join("\n")}\n\`.trim();\n`;
}

export async function buildLiveData(options = {}) {
  const now = options.now || new Date();
  const today = options.today || tokyoDate(now);
  const endDate = options.endDate || addDays(today, options.futureDays ?? DEFAULT_FUTURE_DAYS);
  const existing = options.existing || await readExistingEvents();
  let fetched = [];
  let checks = [];

  if (options.offline) {
    fetched = existing.filter(event => event.date >= today && event.date <= endDate);
    checks = VENUES.map(venue => ({ venue, count: 0, skipped: true }));
  } else if (options.sources) {
    for (const [venueId, html] of Object.entries(options.sources)) {
      const venue = VENUES.find(item => item.id === venueId);
      if (!venue) continue;
      const events = parseFanyPage(html, venue, { today, endDate });
      fetched.push(...events);
      checks.push({ venue, count: events.length });
    }
  } else {
    const result = await fetchVenueEvents({ today, endDate });
    fetched = result.events;
    checks = result.checks;
  }

  const events = uniqueEvents(fetched);
  const minEvents = options.minEvents ?? DEFAULT_MIN_EVENTS;
  if (!options.offline && !options.allowSmall && events.length < minEvents) {
    throw new Error(`FANY取得件数が少なすぎます: ${events.length}件（最低${minEvents}件）。data.jsは更新しません。`);
  }

  return {
    meta: {
      version: APP_VERSION,
      updatedAt: tokyoTimestamp(now),
      sourceName: "FANYチケット",
      sourceUrls: VENUES.map(venue => venue.url),
      coverageLabel: `${today}〜${endDate}`,
      autoUpdate: "毎日6:17ごろ",
      fetchedEventCount: events.length,
      sourceSummary: checks.map(check => ({
        venue: check.venue?.name || check.venue?.venue || check.venue || "",
        count: check.count || 0,
        skipped: Boolean(check.skipped),
        error: check.error || null
      })),
      note: "FANYチケットの劇場ページから今日以降60日分を自動取得。残席・出演者変更は公式ページで最終確認してください。"
    },
    events
  };
}

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

export async function main() {
  const futureDays = Number(readArg("--days", DEFAULT_FUTURE_DAYS));
  const minEvents = Number(readArg("--min-events", process.env.YOSHIMOTO_MIN_EVENTS || DEFAULT_MIN_EVENTS));
  const data = await buildLiveData({
    futureDays,
    minEvents,
    offline: process.argv.includes("--offline"),
    allowSmall: process.argv.includes("--allow-small")
  });
  const output = serializeDataJs(data);
  if (process.argv.includes("--dry-run")) {
    console.log(output);
  } else {
    await writeFile(DATA_PATH, output, "utf8");
  }
  console.log(`Generated ${data.events.length} Yoshimoto live events (${data.meta.coverageLabel}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
