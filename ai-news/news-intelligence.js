(() => {
  'use strict';

  const DATA_URL = './data/news.json';
  const READ_KEY = 'oneNewsReadV1';
  const controls = document.querySelector('.controls');
  const detailSheet = document.querySelector('#detailSheet');
  const settingsSheet = document.querySelector('.settings-sheet');
  const search = document.querySelector('#searchInput');
  const toolbar = document.querySelector('#newsToolbar');
  const newsList = document.querySelector('#newsList');
  if (!controls || !detailSheet) return;

  let items = [];
  let currentRange = '24h';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const time = item => new Date(item.publishedAt || 0).getTime() || 0;
  const sourceNames = item => [...new Set((item.sources || []).map(source => source.name).filter(Boolean))];
  const tokenize = item => [...new Set([
    ...(item.tags || []),
    ...String(item.title || '').split(/[\s、。・「」『』（）()\[\]【】]/)
  ].map(value => String(value).trim()).filter(value => value.length >= 2 && value.length <= 24))];
  const importance = item => Number(item.priority || 0) + sourceNames(item).length * 8 + (item.breaking ? 10 : 0);
  const isDiscoverMode = () => document.querySelector('.tab[data-tab="discover"]')?.classList.contains('active');

  function trendCounts() {
    const cutoff = Date.now() - 7 * 86400000;
    const counts = new Map();
    items.filter(item => time(item) >= cutoff).forEach(item => {
      tokenize(item).forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
    });
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
      .slice(0, 14);
  }

  function ranking(range = currentRange) {
    const span = range === '7d' ? 7 * 86400000 : 24 * 3600000;
    const cutoff = Date.now() - span;
    return items.filter(item => time(item) >= cutoff)
      .sort((a, b) => importance(b) - importance(a) || time(b) - time(a))
      .slice(0, 10);
  }

  function renderExplorer() {
    let panel = document.querySelector('#newsExplorer');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'newsExplorer';
      panel.className = 'news-explorer';
      controls.insertAdjacentElement('afterend', panel);
    }
    const trends = trendCounts();
    const ranked = ranking();
    panel.innerHTML = `<div class="news-explorer__hero">
      <div><small>DISCOVER</small><h2>ニュースを探す</h2><p>いま多く報じられている話題と、重要度の高いニュースをまとめます。</p></div>
      <span>${items.length}件から分析</span>
    </div>
    <section class="news-explorer__section">
      <div class="news-explorer__head"><strong>トレンドワード</strong><small>直近7日</small></div>
      <div class="news-explorer__trends">${trends.map(([word, count]) => `<button type="button" data-trend="${escapeHtml(word)}"><span>#${escapeHtml(word)}</span><b>${count}</b></button>`).join('') || '<span class="news-explorer__empty">話題を集計中です</span>'}</div>
    </section>
    <section class="news-explorer__section">
      <div class="news-explorer__head"><strong>注目ランキング</strong><div class="news-explorer__ranges"><button type="button" data-range="24h" class="${currentRange === '24h' ? 'active' : ''}">24時間</button><button type="button" data-range="7d" class="${currentRange === '7d' ? 'active' : ''}">7日</button></div></div>
      <div class="news-explorer__ranking">${ranked.map((item, index) => `<button type="button" data-related-id="${escapeHtml(item.id)}"><i>${index + 1}</i><span><strong>${escapeHtml(item.title)}</strong><small>${sourceNames(item).length || 1}社・${escapeHtml(item.category || 'その他')}・重要度${Math.round(Number(item.priority || 0))}</small></span><b>›</b></button>`).join('')}</div>
    </section>`;
    syncDiscoverVisibility();
  }

  function syncDiscoverVisibility() {
    const panel = document.querySelector('#newsExplorer');
    const active = isDiscoverMode();
    if (panel) panel.hidden = !active;
    if (toolbar) toolbar.hidden = active;
    if (newsList) newsList.hidden = active;
  }

  function findItemFromDetail() {
    const title = detailSheet.querySelector('h2')?.textContent.trim();
    return items.find(item => item.title === title) || null;
  }

  function relatedTo(item) {
    const tokens = new Set(tokenize(item));
    return items.filter(candidate => candidate.id !== item.id).map(candidate => {
      const shared = tokenize(candidate).filter(token => tokens.has(token)).length;
      const category = candidate.category === item.category ? 2 : 0;
      return { candidate, score: shared * 3 + category + Math.max(0, 4 - Math.floor((Date.now() - time(candidate)) / 86400000)) };
    }).filter(entry => entry.score >= 3).sort((a, b) => b.score - a.score || time(b.candidate) - time(a.candidate)).slice(0, 6).map(entry => entry.candidate);
  }

  function timelineFor(item) {
    const sources = [...(item.sources || [])].sort((a, b) => new Date(a.publishedAt || item.publishedAt || 0) - new Date(b.publishedAt || item.publishedAt || 0));
    return sources.map((source, index) => ({
      label: index === 0 ? '第一報' : index === sources.length - 1 ? '最新報' : '続報',
      source: source.name || `情報源${index + 1}`,
      type: source.type || '報道機関',
      date: new Date(source.publishedAt || item.publishedAt || 0)
    }));
  }

  function coverageMarkup(item) {
    const sources = item.sources || [];
    const alternate = (item.alternateTitles || []).slice(0, 4);
    const tags = tokenize(item).slice(0, 10);
    return `<div class="news-depth-grid">
      <article><span>報道の広がり</span><strong>${sources.length || 1}媒体</strong><p>${escapeHtml(item.consensus || (sources.length >= 2 ? '複数ソース' : '単独報道'))}・確度${Math.round(Number(item.confidence || 0))}%</p></article>
      <article><span>注目度</span><strong>${Math.round(Number(item.priority || 0))}</strong><p>${item.breaking ? '速報性あり' : '継続して確認したい話題'}</p></article>
      <article><span>読了目安</span><strong>${Math.max(1, Number(item.minutes || 1))}分</strong><p>${sources.length > 1 ? '複数媒体を統合' : '公開概要を整理'}</p></article>
    </div>
    ${alternate.length ? `<div class="news-angle-list"><h4>各社の見出し・切り口</h4>${alternate.map(title => `<p>${escapeHtml(title)}</p>`).join('')}</div>` : ''}
    ${tags.length ? `<div class="news-topic-tags">${tags.map(tag => `<button type="button" data-trend="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join('')}</div>` : ''}`;
  }

  function sourceComparisonMarkup(item) {
    const sources = item.sources || [];
    if (!sources.length) return '<p>配信元情報はありません。</p>';
    return `<div class="source-comparison">${sources.map((source, index) => `<article>
      <i>${String(index + 1).padStart(2, '0')}</i>
      <span><strong>${escapeHtml(source.name || `情報源${index + 1}`)}</strong><small>${escapeHtml(source.type || '報道機関')}${source.publishedAt ? `・${new Date(source.publishedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</small></span>
    </article>`).join('')}</div>`;
  }

  function enhanceDetail() {
    const item = findItemFromDetail();
    if (!item || detailSheet.querySelector('[data-intelligence-ready]')) return;
    const related = relatedTo(item);
    const timeline = timelineFor(item);
    const section = document.createElement('section');
    section.className = 'detail-section news-intelligence-detail';
    section.dataset.intelligenceReady = 'true';
    section.innerHTML = `<section class="news-depth"><h3>情報を深掘り</h3>${coverageMarkup(item)}</section>
      <section><h3>報道機関の比較</h3>${sourceComparisonMarkup(item)}</section>
      <section><h3>報道タイムライン</h3>
      <div class="news-timeline">${timeline.map(entry => `<article><time>${Number.isNaN(entry.date.getTime()) ? '時刻不明' : entry.date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span><b>${escapeHtml(entry.label)}</b><small>${escapeHtml(entry.source)}・${escapeHtml(entry.type)}</small></span></article>`).join('') || '<p>タイムライン情報はありません。</p>'}</div></section>
      <section><h3>関連ニュース</h3>
      <div class="related-news">${related.map(candidate => `<button type="button" data-related-id="${escapeHtml(candidate.id)}"><strong>${escapeHtml(candidate.title)}</strong><small>${escapeHtml(candidate.category || '')}・${sourceNames(candidate).length || 1}社</small></button>`).join('') || '<p>関連ニュースはまだありません。</p>'}</div></section>`;
    detailSheet.appendChild(section);
  }

  function openRelated(id) {
    const item = items.find(entry => String(entry.id) === String(id));
    if (!item) return;
    document.querySelector('.tab[data-tab="recommend"]')?.click();
    if (search) {
      search.value = item.title.slice(0, 40);
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setTimeout(() => document.querySelector(`[data-open-card="${CSS.escape(String(id))}"]`)?.click(), 80);
  }

  function renderReadingStats() {
    if (!settingsSheet || settingsSheet.querySelector('#readingInsights')) return;
    const read = new Set(readJson(READ_KEY, []).map(String));
    const weekCutoff = Date.now() - 7 * 86400000;
    const weekItems = items.filter(item => time(item) >= weekCutoff);
    const readWeek = weekItems.filter(item => read.has(String(item.id)));
    const minutes = readWeek.reduce((sum, item) => sum + Math.max(1, Number(item.minutes || 1)), 0);
    const rate = weekItems.length ? Math.round(readWeek.length / weekItems.length * 100) : 0;
    const block = document.createElement('div');
    block.id = 'readingInsights';
    block.className = 'setting-group reading-insights';
    block.innerHTML = `<div class="setting-heading"><label>今週のニュース読書</label><span>${rate}%</span></div><div class="reading-insights__grid"><article><strong>${readWeek.length}</strong><span>読んだ記事</span></article><article><strong>${minutes}分</strong><span>推定読了</span></article><article><strong>${rate}%</strong><span>読了率</span></article></div>`;
    settingsSheet.querySelector('.setting-group')?.insertAdjacentElement('afterend', block);
  }

  document.addEventListener('click', event => {
    const trend = event.target.closest('[data-trend]');
    if (trend && search) {
      document.querySelector('.tab[data-tab="recommend"]')?.click();
      search.value = trend.dataset.trend;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => document.querySelector('#newsToolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
    const range = event.target.closest('[data-range]');
    if (range) { currentRange = range.dataset.range; renderExplorer(); }
    const related = event.target.closest('[data-related-id]');
    if (related) openRelated(related.dataset.relatedId);
    if (event.target.closest('.tab')) setTimeout(syncDiscoverVisibility, 0);
  });

  new MutationObserver(() => enhanceDetail()).observe(detailSheet, { childList: true });
  document.querySelector('#settingsBtn')?.addEventListener('click', () => setTimeout(renderReadingStats, 0));

  fetch(`${DATA_URL}?intelligence=${Math.floor(Date.now() / 1800000)}`, { cache: 'default' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then(payload => { items = Array.isArray(payload.items) ? payload.items : []; renderExplorer(); })
    .catch(error => console.warn('News intelligence unavailable:', error));
})();
