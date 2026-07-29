import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '..', 'data', 'news.json');
const MAX_ITEMS = 60;
const MAX_PER_CATEGORY = 16;
const MAX_SINGLE_SOURCE_ITEMS = 14;
const SEMANTIC_THRESHOLD = 0.54;
const MAX_SEMANTIC_GAP_HOURS = 96;

const CRITICAL_ALERT = /特別警報|地震|震度|津波|噴火|火山|台風|土砂災害警戒情報|記録的短時間大雨情報|竜巻注意情報/i;
const GENERIC_JMA = /^(気象警報・注意報|府県気象情報|地方気象情報|全般気象情報|早期注意情報|天気概況|天気予報)/;
const WEAK_BREAKING = /^(気象警報・注意報|台風解析・予報情報)/;
const STOP_WORDS = new Set([
  'について', 'による', 'として', 'から', 'まで', 'など', 'ため', '今後', '発表', '最新', 'ニュース',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'after', 'before', 'news'
]);

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const asArray = value => (Array.isArray(value) ? value : []);
const unique = values => [...new Set(values.filter(Boolean))];

function truncate(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[「」『』【】〈〉《》〔〕［］\[\]（）(){}｛｝:：;；!?！？…・,，.。"“”'‘’`~〜～／\\_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value) {
  const normalized = normalizeText(value);
  const latin = normalized.match(/[a-z0-9][a-z0-9.+]{2,}/g) || [];
  const japanese = normalized.match(/[一-龠々〆ヵヶァ-ヶーぁ-ん]{2,}/g) || [];
  return new Set([...latin, ...japanese].filter(token => !STOP_WORDS.has(token)));
}

function bigramSet(value) {
  const compact = normalizeText(value).replace(/\s+/g, '');
  const values = new Set();
  for (let index = 0; index < compact.length - 1; index += 1) values.add(compact.slice(index, index + 2));
  return values;
}

function overlapRatio(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach(value => {
    if (right.has(value)) intersection += 1;
  });
  return intersection / Math.max(1, Math.min(left.size, right.size));
}

function dice(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach(value => {
    if (right.has(value)) intersection += 1;
  });
  return (2 * intersection) / (left.size + right.size);
}

function entitySet(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${(item.tags || []).join(' ')}`;
  const values = [
    ...(text.match(/[A-Z][A-Za-z0-9.+-]{2,}/g) || []),
    ...(text.match(/[ァ-ヶー]{3,}/g) || []),
    ...(text.match(/[一-龠々〆ヵヶ]{3,}/g) || [])
  ];
  return new Set(values.map(normalizeText).filter(Boolean));
}

function publishedTime(item) {
  const value = new Date(item?.publishedAt || 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function primarySource(item) {
  return String(item?.sources?.[0]?.name || 'unknown');
}

function isJmaOnly(item) {
  const sources = asArray(item.sources);
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

function semanticScore(left, right) {
  const hoursApart = Math.abs(publishedTime(left) - publishedTime(right)) / (60 * 60 * 1000);
  if (hoursApart > MAX_SEMANTIC_GAP_HOURS) return 0;

  const leftTitle = bigramSet(left.title);
  const rightTitle = bigramSet(right.title);
  const titleScore = dice(leftTitle, rightTitle);
  const leftTokens = tokenSet(`${left.title} ${left.summary}`);
  const rightTokens = tokenSet(`${right.title} ${right.summary}`);
  const tokenScore = overlapRatio(leftTokens, rightTokens);
  const entityScore = overlapRatio(entitySet(left), entitySet(right));
  const categoryBonus = left.category && left.category === right.category ? 0.08 : -0.04;
  const sourceUrlOverlap = asArray(left.sources).some(source =>
    asArray(right.sources).some(other => source.url && other.url && source.url === other.url)
  ) ? 0.34 : 0;
  const timeBonus = hoursApart <= 12 ? 0.08 : hoursApart <= 36 ? 0.04 : 0;

  return clamp(titleScore * 0.46 + tokenScore * 0.32 + entityScore * 0.14 + categoryBonus + sourceUrlOverlap + timeBonus, 0, 1);
}

function sameSemanticTopic(item, cluster) {
  let best = 0;
  for (const existing of cluster.items.slice(0, 6)) {
    const score = semanticScore(item, existing);
    if (score > best) best = score;
  }
  return best >= SEMANTIC_THRESHOLD;
}

function uniqueSources(items) {
  const map = new Map();
  items.flatMap(item => asArray(item.sources)).forEach(source => {
    const key = `${String(source.name || 'unknown').toLocaleLowerCase('ja')}|${String(source.type || '')}`;
    const current = map.get(key);
    const currentTime = new Date(current?.publishedAt || 0).getTime() || 0;
    const nextTime = new Date(source?.publishedAt || 0).getTime() || 0;
    if (!current || nextTime >= currentTime) map.set(key, source);
  });
  return [...map.values()];
}

function chooseRepresentative(items) {
  return [...items].sort((left, right) =>
    Number(right.priority || 0) - Number(left.priority || 0)
      || asArray(right.sources).length - asArray(left.sources).length
      || String(right.summary || '').length - String(left.summary || '').length
      || publishedTime(right) - publishedTime(left)
  )[0];
}

function confidenceFor(sources, duplicateCount, hasOfficial) {
  return Math.round(clamp(
    43 + Math.min(sources.length, 5) * 11 + Math.min(duplicateCount, 8) * 2.5 + (hasOfficial ? 7 : 0),
    0,
    98
  ));
}

function consensusFor(sourceCount) {
  if (sourceCount >= 4) return '多方面で一致';
  if (sourceCount >= 3) return '複数社一致';
  if (sourceCount === 2) return '複数ソース';
  return '単独報道';
}

function keyPointsFor(item, sources) {
  return unique([
    truncate(item.fact || item.summary, 150),
    sources.length > 1 ? `${sources.length}つの配信元が同じテーマを報じています。` : '現在は1つの配信元から確認しています。',
    truncate(item.outlook || item.importance, 150)
  ]).slice(0, 3);
}

function mergeSemanticCluster(cluster) {
  const representative = chooseRepresentative(cluster.items);
  const sources = uniqueSources(cluster.items);
  const duplicateCount = cluster.items.reduce((total, item) => total + Math.max(1, Number(item.duplicateCount || 1)), 0);
  const hasOfficial = sources.some(source => source.type === '公式発表');
  const confidence = confidenceFor(sources, duplicateCount, hasOfficial);
  const newest = Math.max(...cluster.items.map(publishedTime));
  const tags = unique(cluster.items.flatMap(item => asArray(item.tags))).slice(0, 8);
  const mergedTitles = unique(cluster.items.map(item => item.title));

  return {
    ...representative,
    title: representative.title,
    summary: truncate(representative.summary || representative.fact, 280),
    fact: truncate(representative.fact || representative.summary, 300),
    publishedAt: newest ? new Date(newest).toISOString() : representative.publishedAt,
    sources,
    tags,
    duplicateCount,
    confidence,
    consensus: consensusFor(sources.length),
    keyPoints: keyPointsFor(representative, sources),
    analysisMode: 'semantic-rules-v2',
    semanticClusterSize: cluster.items.length,
    alternateTitles: mergedTitles.filter(title => title !== representative.title).slice(0, 4),
    priority: Math.round(clamp(Number(representative.priority || 50) + Math.min(7, (sources.length - 1) * 2)))
  };
}

function semanticMerge(items) {
  const clusters = [];
  for (const item of [...items].sort((left, right) => publishedTime(right) - publishedTime(left))) {
    const cluster = clusters.find(candidate => sameSemanticTopic(item, candidate));
    if (cluster) cluster.items.push(item);
    else clusters.push({ items: [item] });
  }
  return clusters.map(mergeSemanticCluster);
}

function balance(items) {
  const sorted = [...items].sort((left, right) =>
    Number(right.priority || 0) - Number(left.priority || 0)
      || publishedTime(right) - publishedTime(left)
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
      || publishedTime(right) - publishedTime(left)
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
  const original = asArray(payload.items);
  const filtered = original.filter(shouldKeep).map(normalizeItem);
  const semanticItems = semanticMerge(filtered);
  const items = balance(semanticItems);

  const refined = {
    ...payload,
    version: Math.max(2, Number(payload.version || 1)),
    totalClustersBeforeCuration: payload.totalClusters ?? original.length,
    totalClustersBeforeSemanticMerge: filtered.length,
    totalClustersAfterSemanticMerge: semanticItems.length,
    totalClusters: items.length,
    semanticDeduplication: {
      algorithm: 'title-summary-entity-semantic-v2',
      threshold: SEMANTIC_THRESHOLD,
      maxGapHours: MAX_SEMANTIC_GAP_HOURS,
      mergedClusters: Math.max(0, filtered.length - semanticItems.length)
    },
    curation: {
      algorithm: 'semantic-cluster-and-source-category-balance-v2',
      removedGenericAlerts: original.length - filtered.length,
      maxItems: MAX_ITEMS,
      maxPerCategory: MAX_PER_CATEGORY,
      maxPerPrimarySource: MAX_SINGLE_SOURCE_ITEMS
    },
    items
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(refined, null, 2)}\n`, 'utf8');
  console.log(`ONE NEWS semantic curation: ${original.length} -> ${semanticItems.length} semantic clusters -> ${items.length} items`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
