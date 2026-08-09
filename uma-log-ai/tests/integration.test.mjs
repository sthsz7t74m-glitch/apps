import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
  assert.match(serviceWorker, /shell-v1\.3\.0/);
});

test('prediction history uses IndexedDB and learning runs in a worker', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../learning-worker.js', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(app, /idbSetPredictionSnapshot/);
  assert.match(app, /openCursor\(\)/);
  assert.doesNotMatch(app, /umaLogPredictionSnapshots/);
  assert.doesNotMatch(app, /keys\.length > 60/);
  assert.match(app, /new Worker\('\.\/learning-worker\.js\?v=130'\)/);
  assert.match(worker, /UmaLogEngine\.optimizeWeights/);
  assert.match(serviceWorker, /learning-worker\.js\?v=130/);
  assert.match(serviceWorker, /\.\/data\/races\.json/);
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
  assert.match(serviceWorker, /jra-importer\.js\?v=130/);
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
  assert.match(app, /const resolver = \(race, edition\) => getFrozenPrediction\(race, edition\)/);
});
