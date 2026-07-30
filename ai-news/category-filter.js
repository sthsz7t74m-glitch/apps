(() => {
  'use strict';

  const STORAGE_KEY = 'oneNewsCategoryV1';
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
  const tabs = document.querySelector('#tabs');
  const bottomNav = document.querySelector('.bottom-nav');
  if (!select || !newsList) return;

  let activeCategory = localStorage.getItem(STORAGE_KEY) || ALL;
  if (activeCategory !== ALL && !CATEGORY_ORDER.includes(activeCategory)) activeCategory = ALL;
  let applying = false;
  let scheduled = 0;

  function categoryOf(card) {
    const explicit = String(card.dataset.category || '').trim();
    if (CATEGORY_ORDER.includes(explicit)) return explicit;
    const labels = [...card.querySelectorAll('.badges .badge')].map(node => node.textContent.trim());
    return CATEGORY_ORDER.find(category => labels.includes(category)) || 'その他';
  }

  function cards() {
    return [...newsList.querySelectorAll('.news-card')];
  }

  function baseTitle() {
    const active = document.querySelector('.tab.active')?.dataset.tab;
    return {
      recommend: '今日の重要ニュース',
      consensus: '複数社が追う重要ニュース',
      discover: 'ニュースを発見',
      personal: 'あなた向け',
      unread: '未読ニュース',
      latest: '新着ニュース',
      saved: 'あとで読む'
    }[active] || '今日の重要ニュース';
  }

  function countByCategory(list) {
    const counts = new Map(CATEGORY_ORDER.map(category => [category, 0]));
    list.forEach(card => {
      const category = categoryOf(card);
      card.dataset.category = category;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return counts;
  }

  function renderOptions(list) {
    const counts = countByCategory(list);
    const previous = activeCategory;
    select.innerHTML = [
      `<option value="${ALL}">すべてのジャンル（${list.length}）</option>`,
      ...CATEGORY_ORDER.map(category => `<option value="${category}">${category}（${counts.get(category) || 0}）</option>`)
    ].join('');
    select.value = previous;
    if (select.value !== previous) {
      activeCategory = ALL;
      select.value = ALL;
      localStorage.setItem(STORAGE_KEY, ALL);
    }
  }

  function removeFilterEmpty() {
    newsList.querySelector('.category-filter-empty')?.remove();
  }

  function renderFilterEmpty() {
    removeFilterEmpty();
    if (activeCategory === ALL || cards().some(card => !card.hidden)) return;
    const empty = document.createElement('div');
    empty.className = 'empty category-filter-empty';
    empty.innerHTML = `<strong>${activeCategory}のニュースはありません</strong><p>現在のタブ・検索条件との組み合わせでは0件です。ジャンルを「すべて」に戻すか、条件を解除してください。</p>`;
    newsList.appendChild(empty);
  }

  function syncResetButton() {
    if (!resetButton) return;
    const hasSearch = Boolean(searchInput?.value.trim());
    const hasCategory = activeCategory !== ALL;
    resetButton.hidden = !hasSearch && !hasCategory;
    resetButton.textContent = hasSearch && hasCategory
      ? '検索・ジャンルを解除'
      : hasSearch
        ? '検索を解除'
        : 'ジャンル絞り込みを解除';
    resetButton.setAttribute('aria-label', resetButton.textContent);
  }

  function applyFilter({ announce = false } = {}) {
    if (applying) return;
    applying = true;
    removeFilterEmpty();

    const list = cards();
    renderOptions(list);

    let visible = 0;
    list.forEach(card => {
      const category = categoryOf(card);
      const show = activeCategory === ALL || category === activeCategory;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (sectionTitle) {
      const title = baseTitle();
      sectionTitle.textContent = activeCategory === ALL ? title : `${activeCategory}・${title}`;
    }
    if (resultCount) resultCount.textContent = `${visible}件`;

    renderFilterEmpty();
    syncResetButton();
    window.dispatchEvent(new CustomEvent('one-news-category-change', {
      detail: { category: activeCategory, visible, total: list.length, announce }
    }));
    applying = false;
  }

  function scheduleApply(options = {}) {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => applyFilter(options));
  }

  function resetFilters({ scroll = true } = {}) {
    activeCategory = ALL;
    localStorage.setItem(STORAGE_KEY, ALL);
    select.value = ALL;
    if (searchInput?.value) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    scheduleApply({ announce: true });
    if (scroll) document.querySelector('#newsToolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  select.addEventListener('change', () => {
    activeCategory = select.value || ALL;
    localStorage.setItem(STORAGE_KEY, activeCategory);
    scheduleApply({ announce: true });
    newsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  searchInput?.addEventListener('input', () => scheduleApply());
  resetButton?.addEventListener('click', () => resetFilters());

  tabs?.addEventListener('click', event => {
    if (!event.target.closest('.tab')) return;
    setTimeout(() => scheduleApply(), 0);
  });

  bottomNav?.addEventListener('click', event => {
    const button = event.target.closest('.nav-btn');
    if (!button) return;
    if (button.dataset.nav === 'home') {
      activeCategory = ALL;
      localStorage.setItem(STORAGE_KEY, ALL);
      select.value = ALL;
      setTimeout(() => scheduleApply(), 0);
    } else if (button.dataset.nav === 'saved') {
      setTimeout(() => scheduleApply(), 0);
    }
  });

  const observer = new MutationObserver(() => {
    if (!applying) scheduleApply();
  });
  observer.observe(newsList, { childList: true });

  window.ONE_NEWS_CATEGORY = {
    get value() { return activeCategory; },
    all: ALL,
    apply: applyFilter,
    reset: resetFilters
  };

  window.addEventListener('pageshow', () => scheduleApply());
  scheduleApply();
})();