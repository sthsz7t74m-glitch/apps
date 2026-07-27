#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'av-actress-directory/data-catalog.js');
const BASE = 'https://db.avjoho.com';
const START_URLS = [
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%882025%E5%B9%B4-%EF%BC%89/',
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%882020-2024%E5%B9%B4%EF%BC%89/',
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%882015-2019%E5%B9%B4%EF%BC%89/',
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%882010-2014%E5%B9%B4%EF%BC%89/',
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%882005-2009%E5%B9%B4%EF%BC%89/',
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%882000-2004%E5%B9%B4%EF%BC%89/',
  '/category/%E3%83%87%E3%83%93%E3%83%A5%E3%83%BC%EF%BC%88-1999%E5%B9%B4%EF%BC%89/'
].map(value => new URL(value, BASE).href);
const USER_AGENT = 'apps-av-directory-catalog/1.0 (+https://github.com/sthsz7t74m-glitch/apps)';
const MAX_PAGES_PER_GROUP = 400;
const CONCURRENCY = 5;

const decode = value => String(value ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
const strip = value => decode(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s・･._\-‐‑‒–—―()（）［］\[\]]/g, '');

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja,en;q=0.7' }
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function pageCount(html) {
  let max = 1;
  for (const match of String(html).matchAll(/href=["'][^"']*\/page\/(\d+)\/?["']/gi)) max = Math.max(max, Number(match[1]));
  return Math.min(max, MAX_PAGES_PER_GROUP);
}

function parseProfiles(html, pageUrl) {
  const rows = [];
  const headingPattern = /<h[12]\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[12]>/gi;
  for (const match of String(html).matchAll(headingPattern)) {
    const text = strip(match[2]).replace(/\s*※.*$/, '').trim();
    const parsed = text.match(/^(.+?)[（(]([^）)]+)[）)]$/);
    const name = (parsed?.[1] || text).trim();
    const kana = parsed?.[2]?.trim() || null;
    if (!name || name.length > 40 || /AV女優データベース|一覧|サイトマップ/.test(name)) continue;
    let profileUrl;
    try { profileUrl = new URL(decode(match[1]), pageUrl).href; } catch { continue; }
    rows.push({ name, kana, profileUrl });
  }
  return rows;
}

async function mapLimit(items, mapper) {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { result[index] = await mapper(items[index]); }
      catch (error) { console.warn(`WARN ${items[index]}: ${error.message}`); }
    }
  }));
  return result.filter(Boolean);
}

async function collectGroup(startUrl) {
  const first = await fetchText(startUrl);
  const count = pageCount(first);
  const urls = Array.from({ length: count }, (_, index) => index === 0 ? startUrl : new URL(`page/${index + 1}/`, startUrl).href);
  const pages = await mapLimit(urls, async (url, index) => index === 0 ? first : fetchText(url));
  const rows = pages.flatMap((html, index) => parseProfiles(html, urls[index] || startUrl));
  console.log(`${startUrl}: ${pages.length} pages / ${rows.length} rows`);
  return rows;
}

function output(rows) {
  const today = new Date().toISOString().slice(0, 10);
  return `(() => {\n  'use strict';\n  const rows = ${JSON.stringify(rows)};\n  const base = Array.isArray(window.AV_ACTRESSES) ? window.AV_ACTRESSES : [];\n  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\\s・･._\\-‐‑‒–—―()（）［］\\[\\]]/g, '');\n  const existing = new Set(base.map(profile => normalize(profile.name)));\n  const additions = [];\n  rows.forEach((row, index) => {\n    const key = normalize(row.name);\n    if (!key || existing.has(key)) return;\n    existing.add(key);\n    additions.push({ id: \`catalog-\${index + 1}-\${[...key].map(c => c.codePointAt(0).toString(16)).join('-')}\`, name: row.name, kana: row.kana || null, aliases: [], birthDate: null, birthplace: null, realName: null, heightCm: null, cup: null, agency: null, agencies: [], performerType: 'unknown', dataTier: 'reference', note: '公開プロフィールデータベースの年代別一覧から収録した参考人物です。プロフィール値・所属・活動状況は個別未照合です。', sources: [{ label: 'AV女優データベース', url: row.profileUrl }] });\n  });\n  window.AV_ACTRESSES = base.concat(additions);\n  window.AV_DIRECTORY_META = { ...(window.AV_DIRECTORY_META || {}), version: '1.5.0', updatedAt: '${today}', catalogReferenceCount: additions.length, catalogSourceCount: rows.length };\n})();\n`;
}

async function main() {
  const groups = [];
  for (const url of START_URLS) {
    try { groups.push(...await collectGroup(url)); }
    catch (error) { console.warn(`GROUP FAILED ${url}: ${error.message}`); }
  }
  const map = new Map();
  for (const row of groups) {
    const key = normalize(row.name);
    if (key && !map.has(key)) map.set(key, row);
  }
  const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  if (rows.length < 500) throw new Error(`Only ${rows.length} profiles collected; refusing to overwrite catalog`);
  await fs.writeFile(OUTPUT, output(rows), 'utf8');
  console.log(`Wrote ${rows.length} unique catalog profiles`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
