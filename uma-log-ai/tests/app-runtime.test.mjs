import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

function setGlobal(window, name, value) {
  Object.defineProperty(window, name, { configurable: true, writable: true, value });
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

test('the real archive renders and both new all-race pages remain interactive', async () => {
  const [html, engine, profit, importer, narImporter, app, dataset, status, narModel] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../profit-engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../jra-importer.js', import.meta.url), 'utf8'),
    readFile(new URL('../nar-importer.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../data/races.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/forward-status.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/nar-model.json', import.meta.url), 'utf8')
  ]);
  const { window, document } = parseHTML(html);
  const storage = new Map();
  setGlobal(window, 'console', console);
  setGlobal(window, 'indexedDB', indexedDB);
  setGlobal(window, 'IDBKeyRange', IDBKeyRange);
  setGlobal(window, 'structuredClone', structuredClone);
  setGlobal(window, 'localStorage', {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  });
  setGlobal(window, 'location', { protocol: 'file:', href: 'file:///uma-log-ai/' });
  setGlobal(window, 'fetch', async url => {
    const path = String(url).split('?')[0];
    const body = path.endsWith('forward-status.json') ? status : path.endsWith('nar-model.json') ? narModel : dataset;
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  });
  setGlobal(window, 'requestAnimationFrame', callback => { callback(); return 1; });
  setGlobal(window, 'cancelAnimationFrame', () => {});
  setGlobal(window, 'scrollTo', () => {});
  setGlobal(window, 'confirm', () => false);
  window.Element.prototype.scrollIntoView = () => {};
  const context = vm.createContext(window);
  for (const source of [engine, profit, importer, narImporter, app]) vm.runInContext(source, context);

  await waitFor(() => document.querySelectorAll('.daily-preview-summary > div').length === 4, 'daily preview did not render');
  assert.match(document.getElementById('dailyPreviewSummary').textContent, /0件正式購入0円0件仮想候補0円3件v5参考候補購入0円33件見送り・対象外全36R/);
  assert.match(document.getElementById('dailyPreviewList').textContent, /中京 11R.*複勝 1.*フロムレイブン.*予測×下限 1\.45.*10%減EV \+30\.3%.*参考・複勝 1/s);

  document.querySelector('[data-nav="tickets"]').click();
  await waitFor(() => document.querySelectorAll('.daily-ticket-row').length === 36, 'daily ticket list did not render');
  assert.equal(document.getElementById('ticketView').hidden, false);
  assert.match(document.getElementById('dailyTicketSummary').textContent, /本日の正式購入0円/);
  assert.equal(document.querySelectorAll('.daily-ticket-row.is-reference').length, 3);
  assert.equal(document.querySelectorAll('.daily-ticket-row.is-skip').length, 33);

  document.querySelector('[data-ticket-filter="reference"]').click();
  assert.equal(document.querySelectorAll('.daily-ticket-row').length, 3);

  document.querySelector('[data-nav="results"]').click();
  await waitFor(() => document.querySelectorAll('.result-overview-row').length === 36, 'results overview did not render');
  assert.equal(document.getElementById('resultView').hidden, false);
  assert.match(document.getElementById('resultOverviewSummary').textContent, /20発走前予想25\.0%◎1着率70\.0%◎Top3率15時刻外・結果後参考/);

  document.querySelector('[data-result-filter="main-hit"]').click();
  assert.equal(document.querySelectorAll('.result-overview-row').length, 5);
  const firstHit = document.querySelector('.result-overview-row');
  const venue = firstHit.dataset.selectVenue;
  const raceNumber = firstHit.dataset.selectRace;
  firstHit.click();
  assert.equal(document.getElementById('selectedResultHeading').querySelector('h2').textContent, `${venue} ${raceNumber}Rの照合`);

  document.querySelector('[data-authority="NAR"]').click();
  await waitFor(() => document.getElementById('sourceMode').textContent === '地方データ未取込', 'NAR authority did not load');
  assert.equal(document.getElementById('officialRaceLink').textContent, 'NAR公式情報');
  document.querySelector('[data-nav="settings"]').click();
  assert.equal(document.getElementById('narImportPanel').hidden, false);
  assert.equal(document.getElementById('jraImportPanel').hidden, true);
  assert.equal(document.getElementById('profitPolicyTitle').textContent, '地方競馬参考モデル');
  assert.match(document.getElementById('profitPolicyList').textContent, /6,065R.*能力残差.*ばんえい.*実購入0円/s);
  assert.match(document.getElementById('forwardValidationSummary').textContent, /市場基準を採用.*実購入 0円.*6,065.*4.*1\.0.*0\.8/s);
});
