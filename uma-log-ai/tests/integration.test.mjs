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

test('prediction history uses IndexedDB and learning runs in a worker', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../learning-worker.js', import.meta.url), 'utf8');
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(app, /idbSetPredictionSnapshot/);
  assert.match(app, /openCursor\(\)/);
  assert.doesNotMatch(app, /umaLogPredictionSnapshots/);
  assert.doesNotMatch(app, /keys\.length > 60/);
  assert.match(app, /new Worker\('\.\/learning-worker\.js\?v=110'\)/);
  assert.match(worker, /UmaLogEngine\.optimizeWeights/);
  assert.match(serviceWorker, /learning-worker\.js\?v=110/);
  assert.match(serviceWorker, /\.\/data\/races\.json/);
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
