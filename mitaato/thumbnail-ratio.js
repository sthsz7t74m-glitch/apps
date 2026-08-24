'use strict';
(() => {
  const VERSION = 'v1.5.1';
  const TARGET_W = 2292;
  const TARGET_H = 1200;
  const SOURCE_W = 2280;
  const SOURCE_H = 1200;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  function applyVersion() {
    document.body.dataset.appVersion = VERSION;
    const badge = document.querySelector('.version');
    if (badge) {
      badge.textContent = VERSION;
      badge.setAttribute('aria-label', `アプリバージョン ${VERSION}`);
    }
  }

  HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
    if (this.width !== SOURCE_W || this.height !== SOURCE_H) {
      return originalToBlob.call(this, callback, type, quality);
    }

    const out = document.createElement('canvas');
    out.width = TARGET_W;
    out.height = TARGET_H;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);
    ctx.drawImage(this, 0, 0, SOURCE_W, SOURCE_H, 0, 0, TARGET_W, TARGET_H);
    return originalToBlob.call(out, callback, type, quality);
  };

  applyVersion();
  new MutationObserver(applyVersion).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('pageshow', applyVersion);
})();
