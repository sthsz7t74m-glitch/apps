(() => {
  'use strict';

  const DATA_URL = './data/news.json';
  const root = document.querySelector('#consensusSpotlight');
  const list = document.querySelector('#consensusSpotlightList');
  const count = document.querySelector('#consensusSpotlightCount');
  if (!root || !list) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const sourceNames = item => [...new Set((item.sources || []).map(source => source.name).filter(Boolean))];
  const publishedTime = item => new Date(item.publishedAt || 0).getTime() || 0;

  function score(item) {
    const sources = sourceNames(item).length;
    const official = (item.sources || []).some(source => source.type === '公式発表');
    return Number(item.priority || 0) + Math.min(30, sources * 8) + (official ? 7 : 0) + Number(item.breaking ? 10 : 0);
  }

  function candidates(payload) {
    return (Array.isArray(payload?.items) ? payload.items : [])
      .filter(item => sourceNames(item).length >= 2)
      .sort((left, right) => score(right) - score(left) || publishedTime(right) - publishedTime(left))
      .slice(0, 5);
  }

  function itemMarkup(item, index) {
    const names = sourceNames(item);
    const sourceCount = names.length;
    const confidence = Math.round(Number(item.confidence || 0));
    const label = sourceCount >= 4 ? '多方面で報道' : sourceCount >= 3 ? '複数社が注目' : '複数媒体で確認';
    return `<button class="spotlight-card${index === 0 ? ' is-leading' : ''}" type="button" data-spotlight-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)}の要点を見る">
      <span class="spotlight-card__rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="spotlight-card__body">
        <span class="spotlight-card__meta">
          <b>${escapeHtml(label)}</b>
          <i>${sourceCount}社${confidence ? `・確度${confidence}%` : ''}</i>
        </span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="spotlight-card__sources">${escapeHtml(names.slice(0, 3).join('・'))}${sourceCount > 3 ? ` ほか${sourceCount - 3}社` : ''}</span>
      </span>
      <span class="spotlight-card__arrow" aria-hidden="true">↗</span>
    </button>`;
  }

  function openItem(id) {
    const recommend = document.querySelector('.tab[data-tab="recommend"]');
    if (recommend && !recommend.classList.contains('active')) recommend.click();

    window.setTimeout(() => {
      const card = document.querySelector(`[data-open-card="${CSS.escape(String(id))}"]`);
      if (card) {
        card.click();
        return;
      }
      document.querySelector('#newsList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  async function load() {
    try {
      const response = await fetch(`${DATA_URL}?spotlight=${Math.floor(Date.now() / 1800000)}`, { cache: 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const items = candidates(payload);
      if (!items.length) return;

      list.innerHTML = items.map(itemMarkup).join('');
      if (count) count.textContent = `${items.length}トピック`;
      root.hidden = false;
    } catch (error) {
      console.warn('ONE NEWS spotlight unavailable:', error);
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-spotlight-id]');
    if (button) openItem(button.dataset.spotlightId);
  });

  load();
})();
