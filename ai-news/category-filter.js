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
  const CATEGORY_ICONS = {
    '気象・防災': '☂',
    '国内': '日',
    '国際': '地',
    '経済': '￥',
    'AI・IT': 'AI',
    'サッカー': '⚽',
    'スポーツ': '🏅',
    'ゲーム': '🎮',
    '科学・文化': '◇',
    'その他': '＋'
  };

  const panel = document.querySelector('#categoryPicker');
  const chips = document.querySelector('#categoryChips');
  const summary = document.querySelector('#categorySummary');
  const newsList = document.querySelector('#newsList');
  const tabs = document.querySelector('#tabs');
  const sectionTitle = document.querySelector('#sectionTitle');
  const resultCount = document.querySelector('#resultCount');

  if (!panel || !chips || !newsList || !tabs) return;

  let activeCategory = localStorage.getItem(STORAGE_KEY) || ALL;
  let applying = false;

  const isCategoryMode = () => document.querySelector('.tab[data-tab="category"]')?.classList.contains('active');

  function categoryOf(card) {
    const labels = [...card.querySelectorAll('.badges .badge')]
      .map(node => node.textContent.trim());
    return CATEGORY_ORDER.find(category => labels.includes(category)) || 'その他';
  }

  function cards() {
    return [...newsList.querySelectorAll('.news-card')];
  }

  function categoryCounts() {
    const counts = new Map();
    cards().forEach(card => {
      const category = categoryOf(card);
      card.dataset.category = category;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return counts;
  }

  function availableCategories(counts) {
    return CATEGORY_ORDER.filter(category => counts.has(category));
  }

  function chipMarkup(category, count) {
    const selected = activeCategory === category;
    const icon = category === ALL ? '全' : CATEGORY_ICONS[category] || '＋';
    return `<button class="category-chip${selected ? ' active' : ''}" type="button" data-category-filter="${category}" aria-pressed="${selected}">
      <span class="category-chip__icon" aria-hidden="true">${icon}</span>
      <span>${category}</span>
      <b>${count}</b>
    </button>`;
  }

  function renderPicker(counts) {
    const total = cards().length;
    const categories = availableCategories(counts);
    if (activeCategory !== ALL && !counts.has(activeCategory)) activeCategory = ALL;

    chips.innerHTML = [
      chipMarkup(ALL, total),
      ...categories.map(category => chipMarkup(category, counts.get(category)))
    ].join('');

    if (summary) {
      summary.textContent = activeCategory === ALL
        ? `${categories.length}ジャンル・全${total}件`
        : `${activeCategory}を表示中`;
    }
  }

  function applyFilter() {
    if (applying) return;
    applying = true;

    const categoryMode = isCategoryMode();
    panel.hidden = !categoryMode;
    const list = cards();

    if (!categoryMode) {
      list.forEach(card => { card.hidden = false; });
      applying = false;
      return;
    }

    const counts = categoryCounts();
    renderPicker(counts);

    let visible = 0;
    list.forEach(card => {
      const show = activeCategory === ALL || card.dataset.category === activeCategory;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (sectionTitle) {
      sectionTitle.textContent = activeCategory === ALL
        ? 'ジャンルを選ぶ'
        : `${activeCategory}のニュース`;
    }
    if (resultCount) resultCount.textContent = `${visible}件`;

    applying = false;
  }

  chips.addEventListener('click', event => {
    const button = event.target.closest('[data-category-filter]');
    if (!button) return;
    activeCategory = button.dataset.categoryFilter || ALL;
    localStorage.setItem(STORAGE_KEY, activeCategory);
    applyFilter();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  tabs.addEventListener('click', event => {
    const button = event.target.closest('.tab');
    if (!button) return;
    window.setTimeout(() => {
      applyFilter();
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 0);
  });

  const observer = new MutationObserver(() => {
    if (applying) return;
    window.requestAnimationFrame(applyFilter);
  });
  observer.observe(newsList, { childList: true });

  window.addEventListener('pageshow', applyFilter);
  applyFilter();
})();
