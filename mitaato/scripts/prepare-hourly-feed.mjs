import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const FEED_PATH = path.join(DATA_DIR, 'articles.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'articles-manifest.json');

const feed = JSON.parse(await fs.readFile(FEED_PATH, 'utf8'));
feed.articles ||= [];

let manifest = { articles: [] };
try {
  manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
} catch {
  // 初回や旧バージョンではmanifestがなくても続行する。
}

const merged = new Map(feed.articles.filter(article => article?.id).map(article => [article.id, article]));
for (const ref of manifest.articles || []) {
  try {
    const relative = String(ref).replace(/^\.\/data\//, '');
    const fullPath = path.join(DATA_DIR, relative);
    const article = JSON.parse(await fs.readFile(fullPath, 'utf8'));
    if (!article?.id) continue;
    const current = merged.get(article.id);
    const currentTime = new Date(current?.updatedAt || current?.generatedAt || 0).getTime();
    const incomingTime = new Date(article.updatedAt || article.generatedAt || 0).getTime();
    if (!current || incomingTime >= currentTime) merged.set(article.id, article);
  } catch (error) {
    console.warn(`Could not merge ${ref}: ${error.message}`);
  }
}

feed.articles = [...merged.values()]
  .sort((a, b) => new Date(b.updatedAt || b.generatedAt || 0) - new Date(a.updatedAt || a.generatedAt || 0))
  .slice(0, 480);
feed.updatedAt = new Date().toISOString();
feed.generator = {
  ...(feed.generator || {}),
  historyPrepared: true,
  historyCount: feed.articles.length
};

await fs.writeFile(FEED_PATH, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
console.log(`Prepared ${feed.articles.length} articles for duplicate checking.`);
