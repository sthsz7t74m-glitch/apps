'use strict';

importScripts('./engine.js?v=200');

self.addEventListener('message', event => {
  try {
    const { races, weights } = event.data || {};
    const result = self.UmaLogEngine.optimizeWeights(races, weights);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || '配点検証に失敗しました' });
  }
});
