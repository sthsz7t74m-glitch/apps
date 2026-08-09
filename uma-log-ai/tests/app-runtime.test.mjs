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
  const [html, engine, profit, importer, app, dataset, status] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../profit-engine.js', import.meta.url), 'utf8'),
    readFile(new URL('../jra-importer.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../data/races.json', import.meta.url), 'utf8'),
    readFile(new URL('../data/forward-status.json', import.meta.url), 'utf8')
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
    const body = path.endsWith('forward-status.json') ? status : dataset;
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  });
  setGlobal(window, 'requestAnimationFrame', callback => { callback(); return 1; });
  setGlobal(window, 'cancelAnimationFrame', () => {});
  setGlobal(window, 'scrollTo', () => {});
  setGlobal(window, 'confirm', () => false);
  window.Element.prototype.scrollIntoView = () => {};
  const context = vm.createContext(window);
  for (const source of [engine, profit, importer, app]) vm.runInContext(source, context);

  await waitFor(() => document.querySelectorAll('.daily-preview-summary > div').length === 3, 'daily preview did not render');
  assert.match(document.getElementById('dailyPreviewSummary').textContent, /0件正式購入0円0件仮想候補0円36件見送り・対象外全36R/);
  assert.match(document.getElementById('dailyPreviewList').textContent, /正式な買い目はありません/);
  assert.match(document.getElementById('dailyPreviewList').textContent, /札幌 6R.*14番 ギオンバヤシ.*参考EV -10\.9%.*見送り/s);

  document.querySelector('[data-nav="tickets"]').click();
  await waitFor(() => document.querySelectorAll('.daily-ticket-row').length === 36, 'daily ticket list did not render');
  assert.equal(document.getElementById('ticketView').hidden, false);
  assert.match(document.getElementById('dailyTicketSummary').textContent, /本日の正式購入0円/);
  assert.equal(document.querySelectorAll('.daily-ticket-row.is-skip').length, 36);

  document.querySelector('[data-nav="results"]').click();
  await waitFor(() => document.querySelectorAll('.result-overview-row').length === 36, 'results overview did not render');
  assert.equal(document.getElementById('resultView').hidden, false);
  assert.match(document.getElementById('resultOverviewSummary').textContent, /20発走前予想25\.0%◎1着率70\.0%◎Top3率15結果後参考・集計外/);

  document.querySelector('[data-result-filter="main-hit"]').click();
  assert.equal(document.querySelectorAll('.result-overview-row').length, 5);
  const firstHit = document.querySelector('.result-overview-row');
  const venue = firstHit.dataset.selectVenue;
  const raceNumber = firstHit.dataset.selectRace;
  firstHit.click();
  assert.equal(document.getElementById('selectedResultHeading').querySelector('h2').textContent, `${venue} ${raceNumber}Rの照合`);
});
