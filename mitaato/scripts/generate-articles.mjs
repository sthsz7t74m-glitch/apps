import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'articles.json');
const PROMPT_PATH = path.join(ROOT, 'prompts', 'master-prompt.md');
const API_URL = 'https://api.openai.com/v1/responses';
const IMAGE_API_URL = 'https://api.openai.com/v1/images/generations';
const API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';
const GENERATE_THUMBNAILS = process.env.GENERATE_THUMBNAILS !== '0';
const THUMBNAIL_DIR = path.join(ROOT, 'thumbnails');
const LIMIT = clamp(Number(process.env.ARTICLE_LIMIT || 3), 1, 6);
const CATEGORY_HINT = String(process.env.CATEGORY_HINT || 'all').trim();
const DRY_RUN = process.env.DRY_RUN === '1';

if (!API_KEY && !DRY_RUN) {
  console.log('OPENAI_API_KEY is not configured. Generation is skipped.');
  process.exit(0);
}

const masterPrompt = await fs.readFile(PROMPT_PATH, 'utf8');
const feed = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
feed.articles ||= [];

const now = new Date();
const jstDate = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
}).format(now);

const recent = feed.articles
  .filter(article => Date.now() - new Date(article.updatedAt || article.generatedAt || 0).getTime() < 21 * 86400000)
  .slice(0, 60)
  .map(article => ({ id: article.id, topicKey: article.topicKey, title: article.title, work: article.work, updatedAt: article.updatedAt || article.generatedAt }));

const discoverySchema = {
  type: 'object', additionalProperties: false,
  properties: {
    candidates: {
      type: 'array', minItems: 1, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          topicKey: { type: 'string' },
          work: { type: 'string' },
          category: { type: 'string', enum: ['漫画','アニメ','ドラマ','映画','都市伝説','その他'] },
          angle: { type: 'string' },
          whyNow: { type: 'string' },
          eventDate: { type: 'string' },
          score: { type: 'integer', minimum: 1, maximum: 100 },
          recommendedPrice: { type: 'string', enum: ['無料','100円'] },
          spoilerRange: { type: 'string' },
          mode: { type: 'string', enum: ['new','update'] },
          updateTargetId: { type: 'string' },
          sourceHints: { type: 'array', items: { type: 'string' }, maxItems: 8 }
        },
        required: ['topicKey','work','category','angle','whyNow','eventDate','score','recommendedPrice','spoilerRange','mode','updateTargetId','sourceHints']
      }
    }
  },
  required: ['candidates']
};

const articleSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' },
    category: { type: 'string', enum: ['漫画','アニメ','ドラマ','映画','都市伝説','その他'] },
    work: { type: 'string' },
    price: { type: 'string', enum: ['無料','100円'] },
    spoilerRange: { type: 'string' },
    freeSection: { type: 'string' },
    paidSection: { type: 'string' },
    tags: { type: 'string' },
    thumbnailText: { type: 'string' },
    thumbnailPrompt: { type: 'string' },
    whyNow: { type: 'string' },
    sources: {
      type: 'array', minItems: 1, maxItems: 10,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' }, publisher: { type: 'string' }, url: { type: 'string' }, publishedAt: { type: 'string' }
        },
        required: ['title','publisher','url','publishedAt']
      }
    }
  },
  required: ['title','category','work','price','spoilerRange','freeSection','paidSection','tags','thumbnailText','thumbnailPrompt','whyNow','sources']
};

let candidates;
if (DRY_RUN) {
  candidates = [{
    topicKey: `dry-run-${Date.now()}`, work: '動作確認', category: 'その他', angle: '自動生成の動作確認',
    whyNow: 'ワークフローの確認用', eventDate: new Date().toISOString().slice(0,10), score: 50,
    recommendedPrice: '無料', spoilerRange: 'なし', mode: 'new', updateTargetId: '', sourceHints: []
  }];
} else {
  const discoveryPrompt = `
${masterPrompt}

今日は日本時間で${jstDate}です。
最新72時間を中心に、アニメ・漫画・ドラマ・映画・都市伝説の公式発表、最新話、最新回、興行、配信、放送ニュースをWeb検索してください。
ミタアトの記事候補を最大8件選び、優先度順に返してください。
カテゴリ指定は「${CATEGORY_HINT}」です。allなら全カテゴリを均等に見ます。

候補選定の重み：話題性20、鮮度15、長期検索15、考察余地15、タイトルの引き15、100円相性10、競合の弱さ10。
公式一次情報が確認できない候補、リーク、早バレ、根拠不明のSNS投稿は除外してください。
既存記事に重大な新情報が出た場合はmode=updateとし、updateTargetIdへ対象IDを入れてください。単なる重複は除外してください。

直近の記事一覧：
${JSON.stringify(recent, null, 2)}
`;
  const discovered = await callOpenAI({ prompt: discoveryPrompt, schema: discoverySchema, name: 'mitaato_candidates', maxOutputTokens: 7000 });
  candidates = discovered.candidates || [];
}

candidates = candidates
  .sort((a,b) => Number(b.score || 0) - Number(a.score || 0))
  .filter(candidate => candidate.mode === 'update' || !recent.some(item => item.topicKey === candidate.topicKey))
  .slice(0, LIMIT);

if (!candidates.length) {
  console.log('No new article candidates.');
  process.exit(0);
}

const generated = [];
for (const [index, candidate] of candidates.entries()) {
  console.log(`[${index + 1}/${candidates.length}] Generating: ${candidate.work} / ${candidate.angle}`);
  let article;
  if (DRY_RUN) {
    article = {
      title: '【動作確認】ミタアト自動生成テスト', category: 'その他', work: '動作確認', price: '無料', spoilerRange: 'なし',
      freeSection: 'これはDRY_RUNで生成された確認用記事です。\n\n読み終わった。そのあとが面白い。\n\nミタアト。', paidSection: '',
      tags: '#動作確認 #ミタアト', thumbnailText: '自動生成\n動作確認',
      thumbnailPrompt: 'note記事用の非常に横長なサムネイル。人物を使わず、生成処理を抽象的な書類とチェックマークで表現する。',
      whyNow: candidate.whyNow,
      sources: [{ title: 'OpenAI API Documentation', publisher: 'OpenAI', url: 'https://developers.openai.com/api/docs', publishedAt: '' }]
    };
  } else {
    const articlePrompt = `
${masterPrompt}

日本時間${jstDate}時点で、次の候補を1本の記事にしてください。
候補：${JSON.stringify(candidate, null, 2)}

必ずWeb検索を行い、一次情報を優先して事実を再確認してください。
タイトルは検索語と論点が一目で分かる形にします。
無料記事はfreeSectionへ本文全文を入れ、paidSectionは空文字にします。
100円記事はfreeSectionを全体の35〜45%、paidSectionを55〜65%の目安にし、無料部分の最後に有料部分で解く問いを置きます。
本文はMarkdown。合計3500〜6500字を目安にし、ニュース転載ではなく独自の結論まで進めます。
タグは必ず改行なしの1行で、#ミタアトを含めます。
thumbnailTextは3〜4行、短く太い言葉にします。
thumbnailPromptは記事固有の用語を検索で確認したうえで、人物・キャラクター・顔・目・後ろ姿・シルエット・身体の一部・人型や生物型の代替表現を使わずに作ります。
本文内に出典番号や架空の引用記号を入れないでください。確認元はsourcesへ正式URLで格納します。
`;
    article = await callOpenAI({ prompt: articlePrompt, schema: articleSchema, name: 'mitaato_article', maxOutputTokens: 22000 });
  }

  article.tags = normalizeTags(article.tags);
  if (!article.tags.includes('#ミタアト')) article.tags = `${article.tags} #ミタアト`.trim();
  article.paidSection = article.price === '無料' ? '' : article.paidSection;

  const target = candidate.mode === 'update' && candidate.updateTargetId
    ? feed.articles.find(item => item.id === candidate.updateTargetId)
    : null;
  const timestamp = new Date().toISOString();
  const id = target?.id || createId(candidate.topicKey || article.title);
  const revision = Number(target?.revision || 0) + 1;
  let thumbnailImage = target?.thumbnailImage || '';

  if (!DRY_RUN && GENERATE_THUMBNAILS && article.thumbnailPrompt) {
    try {
      thumbnailImage = await generateThumbnail({
        prompt: article.thumbnailPrompt,
        id,
        revision
      });
    } catch (error) {
      console.error(`Thumbnail generation failed for ${id}:`, error.message);
      console.log('The article will still be saved with its thumbnail prompt.');
    }
  }

  generated.push({
    ...article,
    id,
    topicKey: candidate.topicKey,
    score: candidate.score,
    eventDate: candidate.eventDate,
    thumbnailImage,
    generatedAt: target?.generatedAt || timestamp,
    updatedAt: timestamp,
    revision,
    status: 'draft'
  });
}

const replacements = new Map(generated.map(article => [article.id, article]));
const untouched = feed.articles.filter(article => !replacements.has(article.id));
feed.articles = [...generated, ...untouched]
  .sort((a,b) => new Date(b.updatedAt || b.generatedAt) - new Date(a.updatedAt || a.generatedAt))
  .slice(0, 240);
feed.updatedAt = new Date().toISOString();
feed.generator = {
  model: MODEL,
  scheduleLabel: '毎日 4:45 自動生成（日本時間）',
  lastGeneratedCount: generated.length,
  categoryHint: CATEGORY_HINT,
  imageModel: GENERATE_THUMBNAILS ? IMAGE_MODEL : '',
  imageQuality: GENERATE_THUMBNAILS ? IMAGE_QUALITY : '',
  thumbnailsEnabled: GENERATE_THUMBNAILS
};

await fs.writeFile(DATA_PATH, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
console.log(`Saved ${generated.length} article(s) to ${DATA_PATH}`);

async function generateThumbnail({ prompt, id, revision }) {
  const fileBase = safeFileBase(id);
  const fileName = `${fileBase}-r${revision}.webp`;
  const outputPath = path.join(THUMBNAIL_DIR, fileName);
  const body = {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    size: '1728x912',
    quality: IMAGE_QUALITY,
    background: 'opaque',
    output_format: 'webp',
    output_compression: 86
  };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(IMAGE_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12 * 60 * 1000)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`OpenAI image ${response.status}: ${JSON.stringify(payload)}`);
      const base64 = payload?.data?.[0]?.b64_json;
      if (!base64) throw new Error(`Image response did not contain b64_json: ${JSON.stringify(payload).slice(0, 900)}`);
      await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
      await fs.writeFile(outputPath, Buffer.from(base64, 'base64'));
      console.log(`Saved thumbnail: ${outputPath}`);
      return `./thumbnails/${fileName}`;
    } catch (error) {
      lastError = error;
      console.error(`Thumbnail attempt ${attempt} failed:`, error.message);
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2500 * attempt));
    }
  }
  throw lastError;
}

function safeFileBase(value) {
  const plain = String(value || 'article').normalize('NFKC').toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  const hash = crypto.createHash('sha1').update(String(value || 'article')).digest('hex').slice(0, 8);
  return `${plain || 'article'}-${hash}`;
}

async function callOpenAI({ prompt, schema, name, maxOutputTokens }) {
  const body = {
    model: MODEL,
    input: prompt,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    max_output_tokens: maxOutputTokens,
    text: { format: { type: 'json_schema', name, strict: true, schema } }
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12 * 60 * 1000)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`OpenAI ${response.status}: ${JSON.stringify(payload)}`);
      const text = extractOutputText(payload);
      if (!text) throw new Error(`OpenAI response did not contain output text: ${JSON.stringify(payload).slice(0, 1200)}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2500 * attempt));
    }
  }
  throw lastError;
}

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  return (payload.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text' && typeof content.text === 'string')
    .map(content => content.text)
    .join('');
}

function createId(value) {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()).replaceAll('-', '');
  const slug = String(value || 'article').normalize('NFKC').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-|-$/g, '').slice(0, 54);
  const hash = crypto.createHash('sha1').update(`${value}-${Date.now()}`).digest('hex').slice(0, 7);
  return `${date}-${slug || 'article'}-${hash}`;
}

function normalizeTags(value) {
  return String(value || '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
