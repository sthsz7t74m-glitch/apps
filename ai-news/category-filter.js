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
  if (!select || !newsList) return;

  let activeCategory = localStorage.getItem(STORAGE_KEY) || ALL;
  if (activeCategory !== ALL && !CATEGORY_ORDER.includes(activeCategory)) activeCategory = ALL;
  let applying = false;

  function categoryOf(card) {
    const labels = [...card.querySelectorAll('.badges .badge')]
      .map(node => node.textContent.trim());
    return CATEGORY_ORDER.find(category => labels.includes(category)) || 'その他';
  }

  function cards() {
    return [...newsList.querySelectorAll('.news-card')];
  }

  function categoryCounts() {
    const counts = new Map(CATEGORY_ORDER.map(category => [category, 0]));
    cards().forEach(card => {
      const category = categoryOf(card);
      card.dataset.category = category;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return counts;
  }

  function renderOptions(counts) {
    const total = cards().length;
    select.innerHTML = [
      `<option value="${ALL}">すべてのジャンル（${total}）</option>`,
      ...CATEGORY_ORDER.map(category => `<option value="${category}">${category}（${counts.get(category) || 0}）</option>`)
    ].join('');
    select.value = activeCategory;
  }

  function titleForCurrentTab() {
    const active = document.querySelector('.tab.active')?.dataset.tab;
    return {
      recommend: '今日の重要ニュース',
      personal: 'あなた向け',
      unread: '未読ニュース',
      latest: '新着ニュース',
      saved: 'あとで読む'
    }[active] || 'ニュース';
  }

  function applyFilter({ announce = false } = {}) {
    if (applying) return;
    applying = true;

    const list = cards();
    const counts = categoryCounts();
    renderOptions(counts);

    let visible = 0;
    list.forEach(card => {
      const show = activeCategory === ALL || card.dataset.category === activeCategory;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const currentTab = document.querySelector('.tab.active')?.dataset.tab;
    if (sectionTitle && currentTab !== 'consensus') {
      sectionTitle.textContent = activeCategory === ALL
        ? titleForCurrentTab()
        : `${activeCategory}のニュース`;
    }
    if (resultCount && currentTab !== 'consensus') resultCount.textContent = `${visible}件`;

    window.dispatchEvent(new CustomEvent('one-news-category-change', {
      detail: { category: activeCategory, visible, total: list.length, announce }
    }));
    applying = false;
  }

  select.addEventListener('change', () => {
    activeCategory = select.value || ALL;
    localStorage.setItem(STORAGE_KEY, activeCategory);
    applyFilter({ announce: true });
    if (document.querySelector('.tab.active')?.dataset.tab !== 'consensus') {
      newsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

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
    apply: applyFilter
  };

  window.addEventListener('pageshow', () => applyFilter());
  applyFilter();
})();
