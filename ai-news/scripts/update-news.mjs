import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const SOURCES_PATH = path.join(APP_DIR, 'data', 'sources.json');
const OUTPUT_PATH = path.join(APP_DIR, 'data', 'news.json');
const FETCH_TIMEOUT_MS = 18_000;
const MAX_AGE_HOURS = 24 * 7;
const MAX_OUTPUT_ITEMS = 80;
const DEDUPE_THRESHOLD = 0.58;

const TRACKING_PARAMETERS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'yclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'cmpid'
]);

const CATEGORY_RULES = [
  ['気象・防災', /地震|津波|台風|大雨|豪雨|大雪|気象|警報|注意報|避難|防災|噴火|震度|weather|earthquake|tsunami|typhoon/i],
  ['サッカー', /サッカー|jリーグ|j1|j2|j3|fifa|uefa|プレミアリーグ|ラ・リーガ|セリエa|ブンデスリーガ|リーグ・アン|チャンピオンズリーグ|football|soccer/i],
  ['ゲーム', /ゲーム|steam|任天堂|nintendo|switch|playstation|xbox|ゲーミング|esports|eスポーツ|game|gaming/i],
  ['AI・IT', /生成ai|人工知能|chatgpt|openai|gemini|claude|google|apple|microsoft|半導体|スマートフォン|サイバー|セキュリティ|ソフトウェア|アプリ|テクノロジー|technology|artificial intelligence|machine learning/i],
  ['経済', /円相場|為替|株価|市場|金利|物価|日銀|決算|景気|経済|金融|投資|企業|economy|market|inflation|interest rate/i],
  ['スポーツ', /野球|mlb|プロ野球|大谷|オリンピック|バスケット|nba|テニス|ゴルフ|スポーツ|sports|baseball/i],
  ['国際', /アメリカ|米国|中国|韓国|ロシア|ウクライナ|欧州|eu|中東|国連|海外|国際|world|international|europe|china|russia|ukraine/i],
  ['科学・文化', /科学|宇宙|研究|医療|健康|文化|映画|音楽|書籍|science|space|health|culture|movie|music/i],
  ['国内', /政府|国会|首相|大臣|都道府県|自治体|警察|裁判|選挙|国内|社会|日本|japan/i]
];

const TAG_RULES = [
  ['AI', /生成ai|人工知能|chatgpt|openai|gemini|claude|artificial intelligence/i],
  ['Google', /google|グーグル|gemini/i],
  ['Apple', /apple|アップル|iphone|ipad|mac/i],
  ['Microsoft', /microsoft|マイクロソフト|windows|xbox/i],
  ['Steam', /steam/i],
  ['任天堂', /任天堂|nintendo|switch/i],
  ['サッカー', /サッカー|football|soccer|fifa|uefa/i],
  ['Jリーグ', /jリーグ|j1|j2|j3/i],
  ['MLB', /mlb|大谷|メジャーリーグ/i],
  ['経済', /経済|為替|株価|金利|物価|市場/i],
  ['防災', /地震|津波|台風|警報|避難|防災/i],
  ['国際', /国際|海外|米国|中国|欧州|ロシア|ウクライナ/i]
];

const IMPORTANCE_BY_CATEGORY = {
  '気象・防災': '安全確保や交通、生活インフラに直結するため、自治体や公式機関の最新情報を確認する必要があります。',
  '経済': '企業活動や物価、家計、投資環境へ波及する可能性がある動きです。',
  'AI・IT': '利用中のサービス、業務環境、端末、セキュリティの選択に影響する可能性があります。',
  'サッカー': 'チーム編成、順位、今後の試合展開や観戦計画に関係する情報です。',
  'ゲーム': '発売予定、価格、対応機種、遊べる内容の判断に関係する情報です。',
  'スポーツ': '大会結果や選手・チームの今後の日程、評価に影響する情報です。',
  '国際': '外交、安全保障、経済など複数分野へ影響が広がる可能性があります。',
  '科学・文化': '研究、健康、文化活動や今後の製品・サービスにつながる可能性があります。',
  '国内': '制度、生活、交通、地域社会への影響を確認する必要があるニュースです。',
  'その他': '複数の生活領域へ影響する可能性があるため、続報を確認する価値があります。'
};

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function truncate(value, maxLength = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function decodeEntities(value = '') {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    copy: '©', reg: '®', hellip: '…', ndash: '–', mdash: '—'
  };
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function stripHtml(value = '') {
  return decodeEntities(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tagValue(block, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = String(block).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (match) return stripHtml(match[1]);
  }
  return '';
}

function rawTagValue(block, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = String(block).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    if (match) return decodeEntities(match[1]).trim();
  }
  return '';
}

function attributeValue(block, tagName, attributeName) {
  const escapedTag = escapeRegExp(tagName);
  const escapedAttribute = escapeRegExp(attributeName);
  const match = String(block).match(new RegExp(`<${escapedTag}\\b[^>]*\\b${escapedAttribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function categoryValues(block) {
  const values = [];
  for (const match of String(block).matchAll(/<category\b([^>]*)>([\s\S]*?)<\/category>/gi)) {
    const value = stripHtml(match[2]) || attributeFromString(match[1], 'term');
    if (value) values.push(value);
  }
  for (const match of String(block).matchAll(/<category\b([^>]*)\/>/gi)) {
    const value = attributeFromString(match[1], 'term');
    if (value) values.push(value);
  }
  return [...new Set(values)].slice(0, 8);
}

function attributeFromString(attributes, name) {
  const match = String(attributes || '').match(new RegExp(`\\b${escapeRegExp(name)}=["']([^"']+)["']`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function parseDate(value, fallback = new Date()) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function canonicalUrl(value) {
  try {
    const url = new URL(String(value || ''));
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMETERS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(value || '').trim();
  }
}

function normalizeTitle(value) {
  return stripHtml(value)
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/^\s*(速報|詳報|独自|解説|動画|画像)\s*[：:・-]?\s*/g, '')
    .replace(/\s*[|｜]\s*(nhk|bbc|itmedia|impress watch|ライブドアニュース|openai|google japan blog).*$/i, '')
    .replace(/[「」『』【】〈〉《》〔〕［］\[\]（）(){}｛｝:：;；!?！？…・,，.。"“”'‘’`~〜～／\\_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function featureSet(value) {
  const normalized = normalizeTitle(value);
  const compact = normalized.replace(/\s+/g, '');
  const features = new Set();
  for (let index = 0; index < compact.length - 1; index += 1) {
    features.add(compact.slice(index, index + 2));
  }
  normalized.split(/\s+/).filter(token => token.length >= 2).forEach(token => features.add(token));
  return features;
}

function diceSimilarity(left, right) {
  const leftSet = left instanceof Set ? left : featureSet(left);
  const rightSet = right instanceof Set ? right : featureSet(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  leftSet.forEach(value => {
    if (rightSet.has(value)) intersection += 1;
  });
  return (2 * intersection) / (leftSet.size + rightSet.size);
}

function significantTokens(value) {
  const normalized = normalizeTitle(value);
  const latin = normalized.match(/[a-z0-9][a-z0-9.+-]{2,}/g) || [];
  const japanese = normalized.match(/[一-龠々〆ヵヶァ-ヶーぁ-ん]{3,}/g) || [];
  return new Set([...latin, ...japanese]);
}

function tokenOverlap(left, right) {
  const leftTokens = significantTokens(left);
  const rightTokens = significantTokens(right);
  let count = 0;
  leftTokens.forEach(token => {
    if (rightTokens.has(token)) count += 1;
  });
  return count;
}

function parseFeed(xml, source, fetchedAt) {
  const blocks = [
    ...(String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || [])
  ];

  return blocks.slice(0, Number(source.maxItems) || 30).map((block, index) => {
    const title = tagValue(block, ['title']);
    const rssLink = rawTagValue(block, ['link']);
    const atomLink = attributeValue(block, 'link', 'href');
    const guid = rawTagValue(block, ['guid', 'id']);
    const url = canonicalUrl(atomLink || rssLink || guid);
    const description = tagValue(block, ['description', 'summary', 'content:encoded', 'content']);
    const publishedText = tagValue(block, ['pubDate', 'dc:date', 'published', 'updated', 'date']);
    const publishedAt = parseDate(publishedText, fetchedAt);

    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type || '報道機関',
      sourceCategory: source.category || 'その他',
      sourceLanguage: source.language || 'ja',
      sourcePriority: Number(source.priority) || 0,
      title,
      normalizedTitle: normalizeTitle(title),
      titleFeatures: featureSet(title),
      description: truncate(description || title, 420),
      url,
      categories: categoryValues(block),
      publishedAt: publishedAt.toISOString(),
      timestamp: publishedAt.getTime(),
      feedIndex: index
    };
  }).filter(article => article.title && article.url);
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const fetchedAt = new Date();
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'User-Agent': 'ONE-NEWS-RSS/1.0 (+https://sthsz7t74m-glitch.github.io/apps/ai-news/)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const articles = parseFeed(xml, source, fetchedAt);
    if (!articles.length) throw new Error('フィード内に記事がありません');
    return {
      status: {
        id: source.id,
        name: source.name,
        ok: true,
        count: articles.length,
        fetchedAt: fetchedAt.toISOString()
      },
      articles
    };
  } catch (error) {
    return {
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        count: 0,
        fetchedAt: fetchedAt.toISOString(),
        error: error?.name === 'AbortError' ? 'タイムアウト' : String(error?.message || error)
      },
      articles: []
    };
  } finally {
    clearTimeout(timer);
  }
}

function isRecent(article, now = Date.now()) {
  if (!article.timestamp) return true;
  return now - article.timestamp <= MAX_AGE_HOURS * 60 * 60 * 1000;
}

function sameTopic(article, cluster) {
  const representative = cluster.articles[0];
  if (article.url && cluster.urls.has(article.url)) return true;
  if (article.normalizedTitle && cluster.normalizedTitles.has(article.normalizedTitle)) return true;

  const hoursApart = Math.abs(article.timestamp - representative.timestamp) / (60 * 60 * 1000);
  if (hoursApart > 96) return false;

  let bestSimilarity = 0;
  for (const existing of cluster.articles.slice(0, 5)) {
    const similarity = diceSimilarity(article.titleFeatures, existing.titleFeatures);
    if (similarity > bestSimilarity) bestSimilarity = similarity;
  }

  const leftLength = article.normalizedTitle.replace(/\s/g, '').length;
  const rightLength = representative.normalizedTitle.replace(/\s/g, '').length;
  const lengthRatio = Math.min(leftLength, rightLength) / Math.max(1, Math.max(leftLength, rightLength));
  const overlap = tokenOverlap(article.title, representative.title);

  return (bestSimilarity >= DEDUPE_THRESHOLD && lengthRatio >= 0.5)
    || (bestSimilarity >= 0.46 && overlap >= 2 && lengthRatio >= 0.45);
}

function clusterArticles(articles) {
  const clusters = [];
  for (const article of [...articles].sort((left, right) => right.timestamp - left.timestamp)) {
    const cluster = clusters.find(candidate => sameTopic(article, candidate));
    if (cluster) {
      cluster.articles.push(article);
      cluster.urls.add(article.url);
      cluster.normalizedTitles.add(article.normalizedTitle);
    } else {
      clusters.push({
        articles: [article],
        urls: new Set([article.url]),
        normalizedTitles: new Set([article.normalizedTitle])
      });
    }
  }
  return clusters;
}

function classifyCategory(cluster) {
  const text = cluster.articles.map(article => [
    article.title,
    article.description,
    article.categories.join(' ')
  ].join(' ')).join(' ');
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  const defaults = cluster.articles.map(article => article.sourceCategory).filter(Boolean);
  return defaults[0] || 'その他';
}

function buildTags(cluster, category) {
  const text = cluster.articles.map(article => `${article.title} ${article.description} ${article.categories.join(' ')}`).join(' ');
  const tags = [category];
  TAG_RULES.forEach(([tag, pattern]) => {
    if (pattern.test(text) && !tags.includes(tag)) tags.push(tag);
  });
  cluster.articles.flatMap(article => article.categories).forEach(value => {
    const clean = truncate(value, 20);
    if (clean && !tags.includes(clean) && tags.length < 7) tags.push(clean);
  });
  return tags.slice(0, 7);
}

function representativeScore(article) {
  const typeBonus = article.sourceType === '公式発表' ? 24 : article.sourceType === '専門メディア' ? 8 : 12;
  const descriptionBonus = Math.min(14, article.description.length / 28);
  const recencyHours = Math.max(0, (Date.now() - article.timestamp) / (60 * 60 * 1000));
  const recencyBonus = Math.max(0, 12 - recencyHours / 6);
  return typeBonus + article.sourcePriority + descriptionBonus + recencyBonus;
}

function chooseRepresentative(cluster) {
  return [...cluster.articles].sort((left, right) => representativeScore(right) - representativeScore(left))[0];
}

function isBreaking(cluster) {
  const newestTimestamp = Math.max(...cluster.articles.map(article => article.timestamp));
  const ageHours = (Date.now() - newestTimestamp) / (60 * 60 * 1000);
  if (ageHours > 6) return false;
  return cluster.articles.some(article => /速報|緊急|警報|地震|津波|台風|発表|決定|逮捕|死去|辞任|就任|優勝|移籍|breaking|alert/i.test(article.title));
}

function priorityFor(cluster, category, breaking) {
  const newestTimestamp = Math.max(...cluster.articles.map(article => article.timestamp));
  const ageHours = Math.max(0, (Date.now() - newestTimestamp) / (60 * 60 * 1000));
  const recency = Math.max(0, 36 - ageHours * 1.25);
  const uniqueSources = new Set(cluster.articles.map(article => article.sourceId)).size;
  const sourceBonus = Math.min(18, Math.max(0, uniqueSources - 1) * 7);
  const officialBonus = cluster.articles.some(article => article.sourceType === '公式発表') ? 8 : 0;
  const feedBonus = Math.min(12, Math.max(...cluster.articles.map(article => article.sourcePriority)));
  const categoryBonus = ['気象・防災', '国内', '国際', '経済'].includes(category) ? 5 : 2;
  return Math.round(clamp(34 + recency + sourceBonus + officialBonus + feedBonus + categoryBonus + (breaking ? 8 : 0)));
}

function descriptionsFor(cluster) {
  return [...new Set(cluster.articles.map(article => truncate(article.description, 320)).filter(Boolean))];
}

function sourceList(cluster) {
  const bySource = new Map();
  for (const article of [...cluster.articles].sort((left, right) => right.timestamp - left.timestamp)) {
    if (!bySource.has(article.sourceId)) {
      bySource.set(article.sourceId, {
        name: article.sourceName,
        type: article.sourceType,
        url: article.url,
        publishedAt: article.publishedAt
      });
    }
  }
  return [...bySource.values()];
}

function hashId(value) {
  return `news-${createHash('sha256').update(String(value)).digest('hex').slice(0, 16)}`;
}

function previousIdFor(cluster, representative, previousItems) {
  const urls = new Set(cluster.articles.map(article => article.url));
  let best = null;
  let bestScore = 0;
  for (const item of previousItems) {
    const sourceMatch = (item.sources || []).some(source => urls.has(canonicalUrl(source.url)));
    const titleScore = diceSimilarity(item.title || '', representative.title);
    const score = sourceMatch ? 1 : titleScore;
    if (score > bestScore && score >= 0.72) {
      best = item;
      bestScore = score;
    }
  }
  return best?.id || null;
}

function buildItem(cluster, previousItems) {
  const representative = chooseRepresentative(cluster);
  const category = classifyCategory(cluster);
  const tags = buildTags(cluster, category);
  const sources = sourceList(cluster);
  const descriptions = descriptionsFor(cluster);
  const summary = truncate(representative.description || descriptions[0] || representative.title, 260);
  const breaking = isBreaking(cluster);
  const previousId = previousIdFor(cluster, representative, previousItems);
  const id = previousId || hashId(representative.url || representative.normalizedTitle);
  const newestTimestamp = Math.max(...cluster.articles.map(article => article.timestamp));
  const mergedCount = sources.length;

  return {
    id,
    title: representative.title,
    summary,
    fact: summary,
    background: mergedCount > 1
      ? `同じテーマを${mergedCount}つの配信元が報じています。見出しと公開概要を照合し、重なる事実を中心に整理しています。`
      : '配信元が公開した見出しと概要をもとに、出来事の要点を整理しています。',
    importance: IMPORTANCE_BY_CATEGORY[category] || IMPORTANCE_BY_CATEGORY['その他'],
    outlook: '追加発表や続報で内容が更新される可能性があります。元記事の更新時刻と公式発表を確認してください。',
    category,
    tags,
    minutes: summary.length > 180 || mergedCount >= 3 ? 2 : 1,
    priority: priorityFor(cluster, category, breaking),
    breaking,
    publishedAt: new Date(newestTimestamp).toISOString(),
    duplicateCount: cluster.articles.length,
    sources
  };
}

async function readPreviousItems() {
  try {
    const payload = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return [];
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const config = JSON.parse(await readFile(SOURCES_PATH, 'utf8'));
  const enabledSources = (config.sources || []).filter(source => source.enabled !== false && source.url);
  if (!enabledSources.length) throw new Error('有効なニュースソースがありません');

  const results = await Promise.all(enabledSources.map(fetchSource));
  const statuses = results.map(result => result.status);
  const now = Date.now();
  const articles = results.flatMap(result => result.articles).filter(article => isRecent(article, now));

  if (!articles.length) {
    console.error(JSON.stringify(statuses, null, 2));
    throw new Error('すべてのフィード取得に失敗したため、既存データを保持します');
  }

  const previousItems = await readPreviousItems();
  const clusters = clusterArticles(articles);
  const items = clusters
    .map(cluster => buildItem(cluster, previousItems))
    .sort((left, right) => right.priority - left.priority || new Date(right.publishedAt) - new Date(left.publishedAt))
    .slice(0, MAX_OUTPUT_ITEMS);

  const payload = {
    version: 1,
    generatedAt,
    sourceMode: 'rss',
    totalArticles: articles.length,
    totalClusters: items.length,
    succeededSources: statuses.filter(status => status.ok).length,
    failedSources: statuses.filter(status => !status.ok).length,
    deduplication: {
      algorithm: 'canonical-url-and-title-dice-v1',
      threshold: DEDUPE_THRESHOLD,
      maxAgeHours: MAX_AGE_HOURS
    },
    sources: statuses,
    items
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`ONE NEWS: ${articles.length} articles -> ${items.length} clusters (${payload.succeededSources}/${statuses.length} sources)`);
  statuses.filter(status => !status.ok).forEach(status => console.warn(`${status.name}: ${status.error}`));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
