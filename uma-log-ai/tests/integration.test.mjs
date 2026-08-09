import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

test('every DOM node used by the app exists in the application shell', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const nodeList = app.match(/const nodes = Object\.fromEntries\(\[([\s\S]*?)\]\.map\(id/);
  assert.ok(nodeList, 'app node registry was not found');
  const ids = [...nodeList[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const { document } = parseHTML(html);
  assert.deepEqual(ids.filter(id => !document.getElementById(id)), []);
});

test('service worker only removes caches owned by Uma Log AI', async () => {
  const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(source, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/);
  assert.doesNotMatch(source, /filter\(key => key !== CACHE_NAME\)/);
});

test('sibling apps cannot delete Uma Log AI caches or service-worker registrations', async () => {
  const money = await readFile(new URL('../../money-manager/sw.js', import.meta.url), 'utf8');
  const tapWorker = await readFile(new URL('../../number-tap-25/sw.js', import.meta.url), 'utf8');
  assert.match(money, /startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(money, /filter\(k=>k!==CACHE_NAME\)/);
  assert.match(tapWorker, /filter\(key=>key\.startsWith\(CACHE_PREFIX\)\)/);
  for (const version of ['121', '122', '123']) {
    const tapApp = await readFile(new URL(`../../number-tap-25/app-v${version}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(tapApp, /getRegistrations\(\)/);
    assert.match(tapApp, /key\.startsWith\('number-tap-25-'\)/);
  }
});

test('data workflow cannot retrigger itself from its generated JSON commit', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/update-uma-log-ai.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /^\s+- ['"]uma-log-ai\/data\/races\.json['"]\s*$/m);
  const updater = await readFile(new URL('../scripts/update-races.mjs', import.meta.url), 'utf8');
  assert.match(updater, /must include a valid generatedAt timestamp/);
  assert.doesNotMatch(updater, /generatedAt\s*=.*new Date/);
});

test('install metadata includes raster icons for Android and iOS', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.ok(manifest.icons.some(icon => icon.type === 'image/png' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.type === 'image/png' && icon.sizes === '512x512'));
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /apple-touch-icon\.png/);
});

test('the application shell uses the white theme and a fresh cache version', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(styles, /color-scheme:\s*light/);
  assert.match(styles, /--panel:\s*#ffffff/);
  assert.doesNotMatch(styles, /--bg:\s*#06110c/);
  assert.equal(manifest.theme_color, '#ffffff');
  assert.equal(manifest.background_color, '#f5f8f6');
  assert.match(html, /name="theme-color" content="#ffffff"/);
  assert.match(serviceWorker, /shell-v2\.3\.0/);
});

test('prediction history uses IndexedDB and learning runs in a worker', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../learning-worker.js', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(app, /idbSetPredictionSnapshot/);
  assert.match(app, /openCursor\(\)/);
  assert.match(app, /v5WinProbability: runner\.v5WinProbability \?\? null/);
  assert.doesNotMatch(app, /umaLogPredictionSnapshots/);
  assert.doesNotMatch(app, /keys\.length > 60/);
  assert.match(app, /new Worker\('\.\/learning-worker\.js\?v=230'\)/);
  assert.match(worker, /UmaLogEngine\.optimizeWeights/);
  assert.match(serviceWorker, /learning-worker\.js\?v=230/);
  assert.match(serviceWorker, /\.\/data\/races\.json/);
  assert.match(serviceWorker, /\.\/data\/forward-status\.json/);
  assert.match(serviceWorker, /profit-engine\.js\?v=230/);
});

test('manual JRA HTML import stays local, is atomic, and does not auto-create both editions', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const importer = await readFile(new URL('../jra-importer.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(html, /id="jraHtmlImportInput"[^>]*multiple/);
  assert.match(html, /Webページ、HTMLのみ/);
  assert.match(html, /id="jraSnapshotMode"/);
  assert.match(importer, /document\.createElement\('template'\)/);
  assert.match(importer, /template\.content/);
  assert.match(importer, /mode: 'local-jra'/);
  assert.match(importer, /snapshotMode === 'dayBefore'/);
  assert.match(importer, /snapshotMode === 'final'/);
  assert.match(importer, /snapshotMode === 'reference'/);
  assert.doesNotMatch(importer, /\bfetch\s*\(/);
  assert.doesNotMatch(importer, /appendChild|replaceChildren|insertAdjacentHTML/);
  assert.doesNotMatch(importer, /getAttribute\(['"](?:src|href)/);
  assert.doesNotMatch(importer, /localStorage|indexedDB/);
  assert.match(app, /database\.transaction\(DB_STORE, 'readwrite'\)/);
  assert.match(app, /new Date\(entry\.lastModified\)/);
  assert.match(app, /error\?\.code !== 'NON_JRA_DATASET'/);
  assert.match(app, /Engine\.validateDataset\(dataset\);\s+output = \{ dataset, summaries \};\s+store\.put\(dataset, 'active-import'\)/);
  assert.match(app, /state\.dataset\?\.source\?\.mode === 'local-jra'/);
  assert.doesNotMatch(app, /state\.dataset = window\.UMA_LOG_DEMO/);
  assert.doesNotMatch(html, /demo-data\.js/);
  assert.doesNotMatch(serviceWorker, /demo-data\.js/);
  assert.match(serviceWorker, /jra-importer\.js\?v=230/);
});

test('v5 multi-market UI fails closed and separates reference probabilities from purchase decisions', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const profit = await readFile(new URL('../profit-engine.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(app, /ProfitEngine\.createPlan/);
  assert.match(profit, /decisionOddsHaircut:\s*0\.1/);
  assert.match(profit, /minimumLowerBoundEv:\s*0\.05/);
  assert.match(profit, /maximumSnapshotAgeMinutes:\s*2/);
  assert.match(profit, /productionBuyEnabled:\s*false/);
  assert.match(profit, /REFERENCE_ONLY/);
  assert.match(html, /利益ゲート LOCKED/);
  assert.match(html, /実購入0円/);
  assert.match(html, /単勝・複勝・ワイドから1レース最大1点/);
});

test('manual JRA result import rejects ties and preserves pre-race evidence', async () => {
  const importer = await readFile(new URL('../jra-importer.js', import.meta.url), 'utf8');
  assert.match(importer, /同着を含む結果/);
  assert.match(importer, /recentRuns: existing\.recentRuns/);
  assert.match(importer, /odds: existing\.odds/);
  assert.match(importer, /馬名が保存済み.*一致しません/);
  assert.match(importer, /asOfFieldsGuaranteed: false/);
});

test('the first saved edition is immutable, including across concurrent tabs', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /objectStore\(DB_STORE\)\.add\(value, `\$\{PREDICTION_KEY_PREFIX\}\$\{key\}`\)/);
  assert.doesNotMatch(app, /objectStore\(DB_STORE\)\.put\(value, `\$\{PREDICTION_KEY_PREFIX\}\$\{key\}`\)/);
  assert.match(app, /const existing = state\.predictions\[key\];\s+if \(existing\) return existing;/);
  assert.match(app, /if \(state\.predictions\[key\] \|\| state\.pendingPredictions\[key\]\) return;/);
  assert.doesNotMatch(app, /stored\.inputFingerprint !== fingerprint/);
  assert.match(app, /idbAddTicketPlanRevision/);
  assert.match(app, /savedTicketPlanRevision/);
  assert.match(app, /savedPlan && !isCaptureWindowOpen\(race, state\.edition\)/);
  assert.match(app, /TICKET_PLAN_KEY_PREFIX/);
  assert.match(app, /const resolver = \(race, edition\) => \{[\s\S]*getFrozenPrediction\(race, edition\)[\s\S]*published-post-race/);
});

test('the bundled archive exposes all real August 9 races without counting post-race captures', async () => {
  const dataset = JSON.parse(await readFile(new URL('../data/races.json', import.meta.url), 'utf8'));
  const raw = await readFile(new URL('../data/races.json', import.meta.url), 'utf8');
  assert.equal(dataset.source.mode, 'reference-archive');
  assert.equal(dataset.races.length, 36);
  assert.equal(dataset.races.reduce((sum, race) => sum + race.horses.length, 0), 495);
  assert.deepEqual(Object.fromEntries(['札幌', '新潟', '中京'].map(venue => [venue, dataset.races.filter(race => race.venue === venue).length])), {
    札幌: 12,
    新潟: 12,
    中京: 12
  });
  const published = dataset.races.filter(race => race.publishedPrediction);
  assert.equal(published.length, 35);
  assert.equal(published.filter(race => race.publishedPrediction.captureTiming === 'pre-race').length, 20);
  assert.equal(published.filter(race => race.publishedPrediction.captureTiming === 'post-race').length, 15);
  assert.equal(dataset.races.filter(race => race.modelStatus === 'out-of-scope').length, 1);
  published.forEach(race => {
    const total = race.publishedPrediction.runners.reduce((sum, runner) => sum + runner.probability, 0);
    assert.ok(Math.abs(total - 1) < 1e-8, `${race.id} probabilities must total one`);
  });
  const sapporo1 = dataset.races.find(race => race.id === '2601010601');
  assert.equal(sapporo1.name, 'サラ系2歳未勝利');
  assert.equal(sapporo1.publishedPrediction.runners[0].number, 12);
  assert.ok(Math.abs(sapporo1.publishedPrediction.runners[0].probability - 0.5168107857362774) < 1e-12);
  assert.deepEqual(sapporo1.result.order, [10, 12, 4]);
  assert.doesNotMatch(raw, /cite|\bL\d+:/);
});

test('daily bet list and predictions-results overview are first-class app pages', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(html, /id="dailyPreviewSummary"/);
  assert.match(html, /id="dailyTicketList"/);
  assert.match(html, /id="resultOverviewList"/);
  assert.match(html, />買い目<\/span>/);
  assert.match(html, />予想結果<\/span>/);
  assert.match(app, /function buildDailyBetEntries\(\)/);
  assert.match(app, /function renderDailyTickets\(\)/);
  assert.match(app, /function buildResultOverviewEntries\(\)/);
  assert.match(app, /if \(race\.modelStatus === 'out-of-scope'\) return null/);
  assert.match(app, /結果後に取得した\$\{postRace\}Rは一覧表示のみ/);
  assert.match(app, /candidate\.lowerBoundEv === null \? candidate\.referenceEv : candidate\.lowerBoundEv/);
  assert.match(styles, /\.daily-ticket-row/);
  assert.match(styles, /\.result-overview-row/);
  assert.match(serviceWorker, /shell-v2\.3\.0/);
  assert.match(html, /v2\.3\.0/);
});

test('all archived races can be paired into compact prediction and result rows', async () => {
  const dataset = JSON.parse(await readFile(new URL('../data/races.json', import.meta.url), 'utf8'));
  const rows = dataset.races.map(race => {
    const predictions = race.publishedPrediction?.runners || [];
    const result = race.result?.order || [];
    return {
      id: race.id,
      captureTiming: race.publishedPrediction?.captureTiming || 'out-of-scope',
      predictedTop3: predictions.slice().sort((a, b) => a.rank - b.rank).slice(0, 3).map(runner => runner.number),
      actualTop3: result.slice(0, 3)
    };
  });
  assert.equal(rows.length, 36);
  assert.equal(rows.filter(row => row.captureTiming === 'pre-race').length, 20);
  assert.equal(rows.filter(row => row.captureTiming === 'post-race').length, 15);
  assert.equal(rows.filter(row => row.captureTiming === 'out-of-scope').length, 1);
  assert.ok(rows.filter(row => row.captureTiming !== 'out-of-scope').every(row => row.predictedTop3.length === 3));
  assert.ok(rows.every(row => row.actualTop3.length === 3));
});
