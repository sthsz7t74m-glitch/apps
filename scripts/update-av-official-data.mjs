#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'av-actress-directory/data-live.js');
const TODAY = new Date();
const UPDATED_AT = TODAY.toISOString().slice(0, 10);
const USER_AGENT = 'apps-av-directory-updater/1.2 (+https://github.com/sthsz7t74m-glitch/apps)';

const SOURCES = [
  ['T-POWERS', 'https://www.t-powers.co.jp/talent/', /^\/talent\/[^/]+\/?$/],
  ["Mine'S", 'https://mines-pro.jp/model/', /^\/model\/\d+\/?$/],
  ['LINX', 'https://linx.live/model/', /^\/model\/[^/]+\/?$/],
  ['Life Promotion', 'https://life-promotion.com/', /^\/model\/[^/]+\.php$/],
  ['LIGHT promotion', 'https://lightpro.jp/index.html', /^\/talent\/[^/]+\.html$/],
  ['C-more', 'https://cmore.jp/official/model.html', /^\/official\/model-[^/]+\.html$/]
];

const htmlEntities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeHtml = value => String(value ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (match, name) => htmlEntities[name.toLowerCase()] ?? match);
const stripTags = value => decodeHtml(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s・･._\-‐‑‒–—―()（）［］\[\]]/g, '');
const unique = values => [...new Set(values.filter(Boolean))];

function cleanName(value) {
  return stripTags(value)
    .replace(/^(NEW|MODEL)\s+/i, '')
    .replace(/\s+[A-Za-z][A-Za-z0-9 .,'’\-]+$/u, '')
    .replace(/[\s　]+/g, '')
    .replace(/[|｜].*$/, '')
    .trim();
}

async function fetchText(url, accept = 'text/html,*/*') {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja,en;q=0.7', Accept: accept }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function anchors(html, baseUrl) {
  const rows = [];
  for (const match of String(html).matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    try { rows.push({ url: new URL(decodeHtml(match[2]), baseUrl), text: stripTags(match[3]) }); } catch { /* ignore */ }
  }
  return rows;
}

function rosterRow(name, agency, listUrl, profileUrl = null) {
  return {
    name,
    agency,
    agencies: [agency],
    rosterVerified: true,
    dataTier: 'roster',
    note: `${agency}公式在籍一覧から自動取得。数値プロフィールは公式個人ページ未照合です。`,
    sources: [{ label: `${agency} 公式在籍一覧`, url: profileUrl || listUrl }]
  };
}

async function collectRoster([agency, listUrl, pathPattern]) {
  const html = await fetchText(listUrl);
  const seen = new Set();
  const rows = [];
  for (const anchor of anchors(html, listUrl)) {
    if (!pathPattern.test(anchor.url.pathname)) continue;
    const name = cleanName(anchor.text);
    const key = normalize(name);
    if (!key || seen.has(key) || name.length > 32) continue;
    seen.add(key);
    rows.push(rosterRow(name, agency, listUrl, anchor.url.href));
  }
  if (!rows.length) throw new Error(`no roster names: ${agency}`);
  console.log(`${agency}: ${rows.length}`);
  return rows;
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = await mapper(items[index]); }
      catch (error) { console.warn(`WARN: ${error.message}`); }
    }
  }));
  return output.filter(Boolean);
}

async function collectDino() {
  const sitemapUrls = [
    'https://dino-j.com/wp-sitemap-posts-model-1.xml',
    'https://dino-j.com/wp-sitemap-posts-model-2.xml'
  ];
  const urls = [];
  for (const sitemapUrl of sitemapUrls) {
    try {
      const xml = await fetchText(sitemapUrl, 'application/xml,text/xml,*/*');
      for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/gi)) {
        const url = decodeHtml(match[1]).trim();
        if (/\/model\/[^/]+\/?$/.test(new URL(url).pathname)) urls.push(url);
      }
    } catch (error) { console.warn(`WARN: DINO sitemap: ${error.message}`); }
  }
  const rows = await mapLimit(unique(urls), 5, async url => {
    const html = await fetchText(url);
    const heading = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => cleanName(match[1])).find(Boolean);
    return heading ? rosterRow(heading, 'DINO', 'https://dino-j.com/', url) : null;
  });
  if (rows.length) console.log(`DINO: ${rows.length}`);
  return rows;
}

function ageOn(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  let age = TODAY.getUTCFullYear() - year;
  if (TODAY.getUTCMonth() + 1 < month || (TODAY.getUTCMonth() + 1 === month && TODAY.getUTCDate() < day)) age -= 1;
  return age;
}

async function collectWikidata() {
  const query = `SELECT DISTINCT ?person ?personLabel ?birthDate ?birthPlaceLabel ?height WHERE {
    VALUES ?occupation { wd:Q488111 wd:Q66382950 }
    ?person wdt:P106 ?occupation; wdt:P27 wd:Q17; wdt:P21 wd:Q6581072.
    OPTIONAL { ?person wdt:P569 ?birthDate. }
    OPTIONAL { ?person wdt:P19 ?birthPlace. }
    OPTIONAL { ?person wdt:P2048 ?height. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
  } LIMIT 1000`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.search = new URLSearchParams({ query, format: 'json' });
  const json = JSON.parse(await fetchText(url.href, 'application/sparql-results+json,application/json'));
  return (json.results?.bindings || []).map(row => {
    const name = row.personLabel?.value?.trim();
    const birthDate = row.birthDate?.value?.slice(0, 10) || null;
    const age = ageOn(birthDate);
    if (!name || (age !== null && age < 18)) return null;
    const rawHeight = Number(row.height?.value);
    const heightCm = Number.isFinite(rawHeight) ? Math.round(rawHeight < 3 ? rawHeight * 100 : rawHeight) : null;
    return {
      name,
      birthDate,
      birthplace: row.birthPlaceLabel?.value || null,
      heightCm: heightCm >= 130 && heightCm <= 200 ? heightCm : null,
      agencies: [],
      dataTier: 'open-data',
      note: 'WikidataのCC0構造化データから自動取得。改名・同名人物・更新遅延の可能性があります。',
      sources: [{ label: 'Wikidata', url: row.person?.value || 'https://www.wikidata.org/' }]
    };
  }).filter(Boolean);
}

function mergeRows(rows) {
  const priority = { official: 5, roster: 4, curated: 3, 'open-data': 2, reference: 1 };
  const map = new Map();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!key) continue;
    const current = map.get(key);
    if (!current) { map.set(key, row); continue; }
    const preferred = (priority[row.dataTier] || 0) > (priority[current.dataTier] || 0) ? row : current;
    const other = preferred === row ? current : row;
    map.set(key, {
      ...other,
      ...preferred,
      agencies: unique([...(current.agencies || []), current.agency, ...(row.agencies || []), row.agency]),
      rosterVerified: Boolean(current.rosterVerified || row.rosterVerified),
      sources: unique([...(current.sources || []), ...(row.sources || [])].map(source => JSON.stringify(source))).map(value => JSON.parse(value))
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

function outputFile(liveRows, sourceCount) {
  return `(() => {\n  'use strict';\n  const liveRows = ${JSON.stringify(liveRows)};\n  const base = Array.isArray(window.AV_ACTRESSES) ? window.AV_ACTRESSES : [];\n  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\\s・･._\\-‐‑‒–—―()（）［］\\[\\]]/g, '');\n  const priority = { official: 5, roster: 4, curated: 3, 'open-data': 2, reference: 1 };\n  const map = new Map(base.map(profile => [normalize(profile.name), profile]));\n  liveRows.forEach((row, index) => {\n    const key = normalize(row.name);\n    if (!key) return;\n    const current = map.get(key);\n    if (!current) { map.set(key, { ...row, id: row.id || \`live-\${index + 1}\`, aliases: [], realName: null }); return; }\n    const liveWins = (priority[row.dataTier] || 0) > (priority[current.dataTier] || 0);\n    const merged = { ...(liveWins ? current : row), ...(liveWins ? row : current) };\n    merged.id = current.id || row.id || \`live-\${index + 1}\`;\n    merged.name = current.name || row.name;\n    merged.realName = current.realName || null;\n    merged.agencies = [...new Set([...(current.agencies || []), current.agency, ...(row.agencies || []), row.agency].filter(Boolean))];\n    merged.rosterVerified = Boolean(current.rosterVerified || row.rosterVerified);\n    const sources = [...(current.sources || []), ...(row.sources || [])];\n    const seen = new Set();\n    merged.sources = sources.filter(source => { const sourceKey = \`\${source?.url || ''}|\${source?.label || ''}\`; if (!source || seen.has(sourceKey)) return false; seen.add(sourceKey); return true; });\n    ['kana','birthDate','birthdayLabel','birthplace','heightCm','cup','bloodType','bustCm','waistCm','hipCm','hobbies','skills','photo'].forEach(field => { if (merged[field] == null || merged[field] === '') merged[field] = current[field] ?? row[field] ?? null; });\n    map.set(key, merged);\n  });\n  window.AV_ACTRESSES = [...map.values()];\n  window.AV_DIRECTORY_META = { ...(window.AV_DIRECTORY_META || {}), version: '1.2.0', updatedAt: '${UPDATED_AT}', liveGeneratedAt: '${UPDATED_AT}', liveProfileCount: liveRows.length, liveSourceCount: ${sourceCount} };\n})();\n`;
}

async function main() {
  const rows = [];
  let sourceCount = 0;
  for (const source of SOURCES) {
    try { rows.push(...await collectRoster(source)); sourceCount += 1; }
    catch (error) { console.warn(`WARN: ${source[0]}: ${error.message}`); }
  }
  try { const dino = await collectDino(); if (dino.length) { rows.push(...dino); sourceCount += 1; } }
  catch (error) { console.warn(`WARN: DINO: ${error.message}`); }
  try { const wikidata = await collectWikidata(); if (wikidata.length) { rows.push(...wikidata); sourceCount += 1; } }
  catch (error) { console.warn(`WARN: Wikidata: ${error.message}`); }
  const merged = mergeRows(rows);
  if (!merged.length) throw new Error('All sources failed; refusing to overwrite data-live.js');
  await fs.writeFile(OUTPUT, outputFile(merged, sourceCount), 'utf8');
  console.log(`Wrote ${merged.length} profiles from ${sourceCount} live sources`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
