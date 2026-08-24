'use strict';

(() => {
  const APP_VERSION = 'v1.3.0';
  const MANIFEST_URL = './data/articles-manifest.json';
  let batchArticles = [];
  let batchUpdatedAt = '';
  let loadingPromise = null;

  function setVersion() {
    document.body.dataset.appVersion = APP_VERSION;
    const version = document.querySelector('.version');
    if (version) {
      version.textContent = APP_VERSION;
      version.setAttribute('aria-label', `アプリバージョン ${APP_VERSION}`);
    }
  }

  function mergeIntoApp() {
    try {
      if (typeof app === 'undefined' || typeof render !== 'function' || !batchArticles.length) return false;

      const base = Array.isArray(app.feed?.articles) ? app.feed.articles : [];
      const merged = new Map(base.map(article => [article.id, article]));
      batchArticles.forEach(article => merged.set(article.id, article));

      app.feed.articles = [...merged.values()];
      if (batchUpdatedAt) app.feed.updatedAt = batchUpdatedAt;
      render();

      const updateText = document.getElementById('updateText');
      if (updateText && !updateText.dataset.batchLabel) {
        updateText.dataset.batchLabel = 'true';
        updateText.textContent = `${updateText.textContent} · 記事${app.feed.articles.length}件`;
      }
      return true;
    } catch (error) {
      console.warn('MITAATO batch merge failed', error);
      return false;
    }
  }

  async function fetchJson(url) {
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.json();
  }

  async function loadBatch(force = false) {
    if (loadingPromise && !force) return loadingPromise;

    loadingPromise = (async () => {
      try {
        const manifest = await fetchJson(MANIFEST_URL);
        const urls = Array.isArray(manifest.articles) ? manifest.articles : [];
        const results = await Promise.allSettled(urls.map(fetchJson));
        batchArticles = results
          .filter(result => result.status === 'fulfilled' && result.value?.id)
          .map(result => result.value);
        batchUpdatedAt = manifest.updatedAt || '';
        mergeIntoApp();
      } catch (error) {
        console.warn('MITAATO article batch could not be loaded', error);
      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  setVersion();
  loadBatch();

  // app.js の基本フィード取得より先に完了しても、後から確実に再統合する。
  [500, 1400, 3000].forEach(delay => setTimeout(() => {
    setVersion();
    if (!mergeIntoApp()) loadBatch();
  }, delay));

  document.addEventListener('click', event => {
    if (!event.target.closest('#refreshButton')) return;
    setTimeout(() => loadBatch(true), 350);
  });

  window.addEventListener('pageshow', () => {
    setVersion();
    mergeIntoApp();
  });
})();
