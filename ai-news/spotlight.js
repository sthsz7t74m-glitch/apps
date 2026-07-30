(() => {
  'use strict';

  const DATA_URL = './data/news.json';
  const root = document.querySelector('#consensusSpotlight');
  const list = document.querySelector('#consensusSpotlightList');
  const count = document.querySelector('#consensusSpotlightCount');
  const newsList = document.querySelector('#newsList');
  const toolbar = document.querySelector('#newsToolbar');
  const tabs = document.querySelector('#tabs');
  if (!root || !list || !tabs) return;

  let payload = null;
  let currentCategory = localStorage.getItem('oneNewsCategoryV1') || 'すべて';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const sourceNames = item => [...new Set((item.sources || []).map(source => source.name).filter(Boolean))];
  const publishedTime = item => new Date(item.publishedAt || 0).getTime() || 0;
  const isConsensusTab = () => document.querySelector('.tab.active')?.dataset.tab === 'consensus';

  function score(item) {
    const sources = sourceNames(item).length;
    const official = (item.sources || []).some(source => source.type === '公式発表');
    const freshness = Math.max(0, 18 - Math.floor((Date.now() - publishedTime(item)) / 3600000));
    return Number(item.priority || 0)
      + Math.min(36, sources * 9)
      + (official ? 9 : 0)
      + Number(item.breaking ? 12 : 0)
      + freshness;
  }

  function candidates() {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items
      .filter(item => sourceNames(item).length >= 2)
      .filter(item => currentCategory === 'すべて' || item.category === currentCategory)
      .sort((left, right) => score(right) - score(left) || publishedTime(right) - publishedTime(left))
      .slice(0, 10);
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
      <span class="spotlight-card__arrow" aria-hidden="true">›</span>
    </button>`;
  }

  function render() {
    const active = isConsensusTab();
    if (newsList) newsList.hidden = active;
    if (toolbar) toolbar.hidden = active;
    root.hidden = !active;
    if (!active) return;

    const items = candidates();
    if (count) count.textContent = currentCategory === 'すべて'
      ? `${items.length}トピック`
      : `${currentCategory}・${items.length}件`;

    list.innerHTML = items.length
      ? items.map(itemMarkup).join('')
      : `<div class="spotlight-empty"><strong>複数社が報じるニュースはありません</strong><p>${escapeHtml(currentCategory)}の条件では、現在2社以上が報じる記事が見つかりませんでした。</p></div>`;
  }

  function openItem(id) {
    const recommend = document.querySelector('.tab[data-tab="recommend"]');
    if (recommend) recommend.click();

    window.setTimeout(() => {
      const card = document.querySelector(`[data-open-card="${CSS.escape(String(id))}"]`);
      if (card) {
        card.click();
        return;
      }
      document.querySelector('#newsList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  async function load() {
    try {
      const response = await fetch(`${DATA_URL}?spotlight=${Math.floor(Date.now() / 1800000)}`, { cache: 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
      render();
    } catch (error) {
      console.warn('ONE NEWS spotlight unavailable:', error);
      if (isConsensusTab()) {
        list.innerHTML = '<div class="spotlight-empty"><strong>重要ニュースを取得できませんでした</strong><p>通信復旧後に自動で再取得します。</p></div>';
        root.hidden = false;
      }
    }
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-spotlight-id]');
    if (button) openItem(button.dataset.spotlightId);
  });

  tabs.addEventListener('click', event => {
    if (!event.target.closest('.tab')) return;
    window.setTimeout(render, 0);
  });

  window.addEventListener('one-news-category-change', event => {
    currentCategory = event.detail?.category || 'すべて';
    render();
  });

  window.addEventListener('pageshow', render);
  render();
  load();
})();
