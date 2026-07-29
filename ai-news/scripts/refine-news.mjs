import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '..', 'data', 'news.json');
const MAX_ITEMS = 60;
const MAX_PER_CATEGORY = 16;
const MAX_SINGLE_SOURCE_ITEMS = 14;

const CRITICAL_ALERT = /特別警報|地震|震度|津波|噴火|火山|台風|土砂災害警戒情報|記録的短時間大雨情報|竜巻注意情報/i;
const GENERIC_JMA = /^(気象警報・注意報|府県気象情報|地方気象情報|全般気象情報|早期注意情報|天気概況|天気予報)/;
const WEAK_BREAKING = /^(気象警報・注意報|台風解析・予報情報)/;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

function primarySource(item) {
  return String(item?.sources?.[0]?.name || 'unknown');
}

function isJmaOnly(item) {
  const sources = Array.isArray(item.sources) ? item.sources : [];
  return sources.length > 0 && sources.every(source => String(source.name).includes('気象庁'));
}

function shouldKeep(item) {
  if (!isJmaOnly(item)) return true;
  const text = `${item.title || ''} ${item.summary || ''}`;
  if (CRITICAL_ALERT.test(text)) return true;
  return !GENERIC_JMA.test(String(item.title || ''));
}

function normalizeItem(item) {
  const text = `${item.title || ''} ${item.summary || ''}`;
  const critical = CRITICAL_ALERT.test(text);
  let priority = Number(item.priority || 50);
  let breaking = Boolean(item.breaking);

  if (isJmaOnly(item)) {
    priority = Math.min(priority, critical ? 94 : 78);
    if (WEAK_BREAKING.test(String(item.title || '')) && !critical) breaking = false;
  }

  if ((item.sources?.length || 0) >= 2) priority += Math.min(8, (item.sources.length - 1) * 3);
  if ((item.duplicateCount || 1) >= 3) priority += Math.min(5, Math.floor(item.duplicateCount / 3));

  return {
    ...item,
    priority: Math.round(clamp(priority)),
    breaking
  };
}

function balance(items) {
  const sorted = [...items].sort((left, right) =>
    Number(right.priority || 0) - Number(left.priority || 0)
      || new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0)
  );

  const categorySeen = new Map();
  const sourceSeen = new Map();
  const rescored = sorted.map(item => {
    const category = String(item.category || 'その他');
    const source = primarySource(item);
    const categoryIndex = categorySeen.get(category) || 0;
    const sourceIndex = sourceSeen.get(source) || 0;
    categorySeen.set(category, categoryIndex + 1);
    sourceSeen.set(source, sourceIndex + 1);

    const diversityPenalty = categoryIndex * 2.8 + sourceIndex * 1.4;
    return {
      ...item,
      priority: Math.round(clamp(Number(item.priority || 0) - diversityPenalty))
    };
  }).sort((left, right) =>
    Number(right.priority || 0) - Number(left.priority || 0)
      || new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0)
  );

  const selected = [];
  const categoryCounts = new Map();
  const sourceCounts = new Map();

  for (const item of rescored) {
    const category = String(item.category || 'その他');
    const source = primarySource(item);
    const categoryCount = categoryCounts.get(category) || 0;
    const sourceCount = sourceCounts.get(source) || 0;
    if (categoryCount >= MAX_PER_CATEGORY) continue;
    if (sourceCount >= MAX_SINGLE_SOURCE_ITEMS) continue;

    selected.push(item);
    categoryCounts.set(category, categoryCount + 1);
    sourceCounts.set(source, sourceCount + 1);
    if (selected.length >= MAX_ITEMS) break;
  }

  return selected;
}

async function main() {
  const payload = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  const original = Array.isArray(payload.items) ? payload.items : [];
  const filtered = original.filter(shouldKeep).map(normalizeItem);
  const items = balance(filtered);

  const refined = {
    ...payload,
    totalClustersBeforeCuration: payload.totalClusters ?? original.length,
    totalClusters: items.length,
    curation: {
      algorithm: 'source-and-category-balance-v1',
      removedGenericAlerts: original.length - filtered.length,
      maxItems: MAX_ITEMS,
      maxPerCategory: MAX_PER_CATEGORY,
      maxPerPrimarySource: MAX_SINGLE_SOURCE_ITEMS
    },
    items
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(refined, null, 2)}\n`, 'utf8');
  console.log(`ONE NEWS curation: ${original.length} -> ${items.length} items`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
