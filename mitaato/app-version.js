'use strict';
(() => {
  const VERSION = 'v1.4.0';
  const apply = () => {
    document.body.dataset.appVersion = VERSION;
    const badge = document.querySelector('.version');
    if (badge && badge.textContent !== VERSION) {
      badge.textContent = VERSION;
      badge.setAttribute('aria-label', `アプリバージョン ${VERSION}`);
    }
  };
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('pageshow', apply);
})();
