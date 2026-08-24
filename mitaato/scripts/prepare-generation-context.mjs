import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const FEED = path.join(DATA, 'articles.json');
const MANIFEST = path.join(DATA, 'articles-manifest.json');

const feed = JSON.parse(await fs.readFile(FEED, 'utf8'));
feed.articles ||= [];
let manifest;
try { manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch { process.exit(0); }

const merged = new Map(feed.articles.map(article => [article.id, article]));
for (const relative of manifest.articles || []) {
  const file = path.resolve(ROOT, String(relative).replace(/^\.\//, ''));
  try {
    const article = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!article?.id) continue;
    const current = merged.get(article.id);
    const currentTime = new Date(current?.updatedAt || current?.generatedAt || 0).getTime();
    const incomingTime = new Date(article.updatedAt || article.generatedAt || 0).getTime();
    if (!current || incomingTime >= currentTime) merged.set(article.id, article);
  } catch (error) {
    console.warn(`Could not load article history ${relative}: ${error.message}`);
  }
}
feed.articles = [...merged.values()].sort((a,b)=>new Date(b.updatedAt||b.generatedAt||0)-new Date(a.updatedAt||a.generatedAt||0));
await fs.writeFile(FEED, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
console.log(`Generation context prepared with ${feed.articles.length} article(s).`);
