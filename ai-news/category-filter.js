(() => {
  'use strict';

  const STORAGE_KEY = 'oneNewsCategoryV1';
  const DATA_URL = './data/news.json';
  const ALL = 'すべて';
  const CATEGORY_ORDER = [
    '気象・防災',
    '国内',
    '国際',
    '経済',
    'AI・IT',
    'サッカー',
    'スポーツ',
    'ゲーム',
    '科学・文化',
    'その他'
  ];

  const select = document.querySelector('#categorySelect');
  const newsList = document.querySelector('#newsList');
  const sectionTitle = document.querySelector('#sectionTitle');
  const resultCount = document.querySelector('#resultCount');
  const resetButton = document.querySelector('#filterResetBtn');
  const searchInput = document.querySelector('#searchInput');
  if (!select || !newsList) return;

  let activeCategory = localStorage.getItem(STORAGE_KEY) || ALL;
  if (activeCategory !== ALL && !CATEGORY_ORDER.includes(activeCategory)) activeCategory = ALL;
  let applying = false;
  let globalCounts = new Map(CATEGORY_ORDER.map(category => [category, 0]));
  let globalTotal = 0;

  function categoryOf(card) {
    const explicit = String(card.dataset.category || '').trim();
    if (CATEGORY_ORDER.includes(explicit)) return explicit;
    const labels = [...card.querySelectorAll('.badges .badge')].map(node => node.textContent.trim());
    return CATEGORY_ORDER.find(category => labels.includes(category)) || 'その他';
  }

  function cards() {
    return [...newsList.querySelectorAll('.news-card')];
  }

  function currentCounts() {
    const counts = new Map(CATEGORY_ORDER.map(category => [category, 0]));
    cards().forEach(card => {
      const category = categoryOf(card);
      card.dataset.category = category;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return counts;
  }

  function renderOptions() {
    const fallbackCounts = currentCounts();
    const total = globalTotal || cards().length;
    select.innerHTML = [
      `<option value="${ALL}">すべてのジャンル（${total}）</option>`,
      ...CATEGORY_ORDER.map(category => {
        const count = globalTotal ? globalCounts.get(category) || 0 : fallbackCounts.get(category) || 0;
        return `<option value="${category}">${category}（${count}）</option>`;
      })
    ].join('');
    select.value = activeCategory;
  }

  function titleForCurrentTab() {
    const active = document.querySelector('.tab.active')?.dataset.tab;
    return {
      recommend: '今日の重要ニュース',
      consensus: '複数社が追う重要ニュース',
      discover: 'ニュースを発見',
      personal: 'あなた向け',
      unread: '未読ニュース',
      latest: '新着ニュース',
      saved: 'あとで読む'
    }[active] || 'ニュース';
  }

  function syncResetButton() {
    if (!resetButton) return;
    const hasSearch = Boolean(searchInput?.value.trim());
    const hasCategory = activeCategory !== ALL;
    resetButton.hidden = !hasSearch && !hasCategory;
    resetButton.setAttribute('aria-label', [hasSearch && '検索', hasCategory && 'ジャンル'].filter(Boolean).join('と') + 'を解除');
  }

  function applyFilter({ announce = false } = {}) {
    if (applying) return;
    applying = true;

    const list = cards();
    renderOptions();

    let visible = 0;
    list.forEach(card => {
      const category = categoryOf(card);
      card.dataset.category = category;
      const show = activeCategory === ALL || category === activeCategory;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const currentTab = document.querySelector('.tab.active')?.dataset.tab;
    if (sectionTitle && currentTab !== 'consensus' && currentTab !== 'discover') {
      sectionTitle.textContent = activeCategory === ALL ? titleForCurrentTab() : `${activeCategory}のニュース`;
    }
    if (resultCount && currentTab !== 'consensus' && currentTab !== 'discover') resultCount.textContent = `${visible}件`;

    syncResetButton();
    window.dispatchEvent(new CustomEvent('one-news-category-change', {
      detail: { category: activeCategory, visible, total: list.length, announce }
    }));
    applying = false;
  }

  function resetFilters() {
    activeCategory = ALL;
    localStorage.setItem(STORAGE_KEY, ALL);
    select.value = ALL;
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    applyFilter({ announce: true });
    document.querySelector('#newsToolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  select.addEventListener('change', event => {
    if (!event.isTrusted) return;
    activeCategory = select.value || ALL;
    localStorage.setItem(STORAGE_KEY, activeCategory);
    applyFilter({ announce: true });
    if (!['consensus', 'discover'].includes(document.querySelector('.tab.active')?.dataset.tab)) {
      newsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  searchInput?.addEventListener('input', event => {
    if (!event.isTrusted && event.detail !== 'one-news-reset') return;
    requestAnimationFrame(syncResetButton);
  });

  resetButton?.addEventListener('click', resetFilters);

  document.querySelector('#tabs')?.addEventListener('click', event => {
    const button = event.target.closest('.tab');
    if (!button) return;
    window.setTimeout(() => {
      applyFilter();
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 0);
  });

  const observer = new MutationObserver(() => {
    if (applying) return;
    window.requestAnimationFrame(() => applyFilter());
  });
  observer.observe(newsList, { childList: true });

  window.ONE_NEWS_CATEGORY = {
    get value() { return activeCategory; },
    all: ALL,
    apply: applyFilter,
    reset: resetFilters
  };

  fetch(`${DATA_URL}?category-counts=${Math.floor(Date.now() / 1800000)}`, { cache: 'default' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then(payload => {
      const items = Array.isArray(payload.items) ? payload.items : [];
      globalTotal = items.length;
      globalCounts = new Map(CATEGORY_ORDER.map(category => [category, 0]));
      items.forEach(item => {
        const category = CATEGORY_ORDER.includes(item.category) ? item.category : 'その他';
        globalCounts.set(category, (globalCounts.get(category) || 0) + 1);
      });
      renderOptions();
      syncResetButton();
    })
    .catch(() => {});

  window.addEventListener('pageshow', () => applyFilter());
  applyFilter();
})();
