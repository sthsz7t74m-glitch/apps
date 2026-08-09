import { readFile, writeFile } from 'node:fs/promises';
import { validatePayload } from './validate-race-data.mjs';

const endpoint = String(process.env.UMA_LOG_DATA_URL || '').trim();
const licenseConfirmed = String(process.env.UMA_LOG_DATA_LICENSE_CONFIRMED || '').toLowerCase() === 'true';

if (!endpoint) {
  console.log('UMA_LOG_DATA_URL is not configured. Keeping the public dataset unchanged.');
  process.exit(0);
}

if (!licenseConfirmed) {
  throw new Error('Refusing to fetch: set UMA_LOG_DATA_LICENSE_CONFIRMED=true only after redistribution rights are documented.');
}

const url = new URL(endpoint);
if (url.protocol !== 'https:') throw new Error('UMA_LOG_DATA_URL must use HTTPS.');
const dataFile = new URL('../data/races.json', import.meta.url);
const MAX_BYTES = 40 * 1024 * 1024;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 45_000);
let payload;
try {
  const response = await fetch(url, {
    signal: controller.signal,
    redirect: 'error',
    headers: { accept: 'application/json', 'user-agent': 'uma-log-ai-data-updater/1.0' }
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  if (new URL(response.url).protocol !== 'https:') throw new Error('Provider redirected to a non-HTTPS URL.');
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) throw new Error('Provider payload exceeds 40MB.');
  if (!response.body) throw new Error('Provider response body is empty.');
  const chunks = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.byteLength;
    if (received > MAX_BYTES) throw new Error('Provider payload exceeds 40MB.');
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Provider response is not valid JSON.');
  }
} finally {
  clearTimeout(timeout);
}

validatePayload(payload);
if (payload.source.redistributable !== true) throw new Error('Provider payload did not confirm redistribution permission.');
if (typeof payload.generatedAt !== 'string' || !Number.isFinite(Date.parse(payload.generatedAt))) {
  throw new Error('Provider payload must include a valid generatedAt timestamp.');
}
const generatedTime = Date.parse(payload.generatedAt);
if (generatedTime > Date.now() + 10 * 60 * 1000) throw new Error('Provider generatedAt is implausibly far in the future.');

let current = null;
try {
  current = JSON.parse(await readFile(dataFile, 'utf8'));
  validatePayload(current, { allowEmpty: true });
} catch (error) {
  throw new Error(`Existing public dataset is invalid: ${error.message}`);
}
const currentTime = Date.parse(current.generatedAt || '');
if (Number.isFinite(currentTime) && generatedTime < currentTime) throw new Error('Provider generatedAt is older than the public dataset.');
if (current.races.length && current.source.datasetId !== payload.source.datasetId) {
  throw new Error('Provider source.datasetId changed; migrate datasets explicitly instead of merging unrelated histories.');
}

const cutoff = generatedTime - 370 * 24 * 60 * 60 * 1000;
const slotKey = race => `${race.date}:${race.venue}:${Number(race.raceNumber)}`;
const mergedBySlot = new Map(current.races
  .filter(race => new Date(`${race.date}T23:59:59Z`).getTime() >= cutoff)
  .map(race => [slotKey(race), race]));
payload.races.forEach(race => mergedBySlot.set(slotKey(race), race));
const venueOrder = new Map(['札幌', '函館', '福島', '新潟', '東京', '中山', '中京', '京都', '阪神', '小倉']
  .map((venue, index) => [venue, index]));
const merged = {
  ...payload,
  races: [...mergedBySlot.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))
    || (venueOrder.get(a.venue) ?? 99) - (venueOrder.get(b.venue) ?? 99)
    || Number(a.raceNumber) - Number(b.raceNumber))
};
validatePayload(merged);

const output = `${JSON.stringify(merged, null, 2)}\n`;
await writeFile(dataFile, output, 'utf8');
console.log(`Updated ${merged.races.length} retained races from ${payload.source.name || url.hostname}.`);
