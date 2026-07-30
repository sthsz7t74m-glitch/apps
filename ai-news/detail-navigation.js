(() => {
  'use strict';

  const backdrop = document.querySelector('#detailBackdrop');
  const sheet = document.querySelector('#detailSheet');
  if (!backdrop || !sheet) return;

  let restoreY = 0;
  let activeCardId = '';
  let detailOpen = false;

  function capture(event) {
    const trigger = event.target.closest('[data-open], [data-open-card], [data-related-id]');
    if (!trigger || backdrop.classList.contains('open')) return;
    restoreY = window.scrollY;
    activeCardId = trigger.dataset.open || trigger.dataset.openCard || trigger.dataset.relatedId || '';
    detailOpen = true;
  }

  function restore() {
    if (!detailOpen) return;
    detailOpen = false;
    const targetY = restoreY;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
        if (activeCardId) {
          const card = document.querySelector(`[data-open-card="${CSS.escape(String(activeCardId))}"]`);
          card?.focus?.({ preventScroll: true });
        }
      });
    });
  }

  document.addEventListener('pointerdown', capture, true);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close="detail"]') || event.target === backdrop) {
      setTimeout(restore, 0);
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && backdrop.classList.contains('open')) setTimeout(restore, 0);
  }, true);

  new MutationObserver(() => {
    if (!backdrop.classList.contains('open')) restore();
  }).observe(backdrop, { attributes: true, attributeFilter: ['class'] });
})();
