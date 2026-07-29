(() => {
  'use strict';

  const DATA_URL = './data/news.json';
  const SNAPSHOT_KEY = 'oneNewsSnapshotV1';
  const KEYWORDS_KEY = 'oneNewsKeywords';
  const SAVED_KEY = 'oneNewsSaved';
  const VIEW_KEY = 'oneNewsView';
  const initialKeywords = ['AI', 'サッカー', 'バルセロナ', 'Steam'];
  const iconBookmark = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z"/></svg>';

  const state = {
    items: [],
    metadata: null,
    dataMode: 'loading',
    currentTab: 'recommend',
    compact: localStorage.getItem(VIEW_KEY) === 'compact',
    keywords: readJson(KEYWORDS_KEY, initialKeywords),
    saved: new Set(readJson(SAVED_KEY, []).map(String)),
    loading: true,
    lastLoadedAt: 0
  };

  const nodes = {
    newsList: document.querySelector('#newsList'),
    searchInput: document.querySelector('#searchInput'),
    resultCount: document.querySelector('#resultCount'),
    sectionTitle: document.querySelector('#sectionTitle'),
    importantCount: document.querySelector('#importantCount'),
    readMinutes: document.querySelector('#readMinutes'),
    sourceCount: document.querySelector('#sourceCount'),
    brandStatus: document.querySelector('#brandStatus'),
    feedStatusBadge: document.querySelector('#feedStatusBadge'),
    syncLine: document.querySelector('#syncLine'),
    refreshButton: document.querySelector('#refreshBtn'),
    detailBackdrop: document.querySelector('#detailBackdrop'),
    detailSheet: document.querySelector('#detailSheet'),
    settingsBackdrop: document.querySelector('#settingsBackdrop'),
    sourceHealth: document.querySelector('#sourceHealth'),
    sourceStatusList: document.querySelector('#sourceStatusList'),
    keywordInput: document.querySelector('#keywordInput'),
    keywordChips: document.querySelector('#keywordChips'),
    toast: document.querySelector('#toast')
  };

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function validDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function relativeTime(value) {
    const date = validDate(value);
    if (!date) return '時刻不明';
    const diff = Date.now() - date.getTime();
    if (diff < -60 * 1000) {
      return date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  }

  function formatTimestamp(value) {
    const date = validDate(value);
    if (!date) return '更新時刻不明';
    return date.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalizeSource(source, index) {
    return {
      name: String(source?.name || `情報源${index + 1}`),
      type: String(source?.type || '報道機関'),
      url: safeUrl(source?.url),
      publishedAt: source?.publishedAt || null
    };
  }

  function normalizeItem(item, index) {
    const sources = Array.isArray(item?.sources)
      ? item.sources.map(normalizeSource).filter(source => source.name)
      : [];
    const summary = String(item?.summary || item?.description || '概要を取得できませんでした。').trim();
    return {
      id: String(item?.id || `news-${index}`),
      title: String(item?.title || 'タイトル未取得').trim(),
      summary,
      fact: String(item?.fact || summary).trim(),
      background: String(item?.background || '配信元の公開情報をもとに、関連する経緯を整理しています。').trim(),
      importance: String(item?.importance || '生活、仕事、社会への影響が広がる可能性があるため、続報を確認する価値があります。').trim(),
      outlook: String(item?.outlook || '追加発表や続報で内容が更新される可能性があります。元記事で最新情報を確認してください。').trim(),
      category: String(item?.category || 'その他'),
      tags: Array.isArray(item?.tags) ? item.tags.map(String).filter(Boolean).slice(0, 8) : [],
      minutes: Math.max(1, Number(item?.minutes) || 1),
      priority: Math.max(0, Math.min(100, Number(item?.priority) || 50)),
      breaking: Boolean(item?.breaking),
      publishedAt: item?.publishedAt || item?.updatedAt || null,
      sources,
      duplicateCount: Math.max(sources.length, Number(item?.duplicateCount) || 1)
    };
  }

  function normalizePayload(payload) {
    const items = Array.isArray(payload?.items)
      ? payload.items.map(normalizeItem).filter(item => item.title)
      : [];
    if (!items.length) throw new Error('ニュース項目がありません');
    return {
      ...payload,
      items,
      generatedAt: payload.generatedAt || new Date().toISOString(),
      sources: Array.isArray(payload.sources) ? payload.sources : []
    };
  }

  function snapshotPayload(payload) {
    writeJson(SNAPSHOT_KEY, {
      savedAt: new Date().toISOString(),
      payload
    });
  }

  function readSnapshot() {
    const snapshot = readJson(SNAPSHOT_KEY, null);
    if (!snapshot?.payload) return null;
    try {
      return normalizePayload(snapshot.payload);
    } catch {
      return null;
    }
  }

  function demoPayload() {
    try {
      return normalizePayload(window.ONE_NEWS_DEMO || {});
    } catch {
      return {
        generatedAt: new Date().toISOString(),
        sourceMode: 'demo',
        totalArticles: 0,
        totalClusters: 0,
        succeededSources: 0,
        failedSources: 0,
        sources: [],
        items: []
      };
    }
  }

  function setSyncing(syncing) {
    state.loading = syncing;
    nodes.refreshButton?.classList.toggle('is-syncing', syncing);
    if (nodes.refreshButton) nodes.refreshButton.disabled = syncing;
  }

  async function fetchPayload({ fresh = false } = {}) {
    const bucket = fresh ? Date.now() : Math.floor(Date.now() / (30 * 60 * 1000));
    const response = await fetch(`${DATA_URL}?v=${bucket}`, {
      cache: fresh ? 'no-store' : 'default',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`ニュースデータ HTTP ${response.status}`);
    return normalizePayload(await response.json());
  }

  function applyPayload(payload, mode) {
    state.metadata = payload;
    state.items = payload.items;
    state.dataMode = mode;
    state.lastLoadedAt = Date.now();
    setSyncing(false);
    renderAll();
  }

  async function loadNews({ fresh = false, announce = false } = {}) {
    setSyncing(true);
    updateDataStatus('loading');
    try {
      const payload = await fetchPayload({ fresh });
      snapshotPayload(payload);
      applyPayload(payload, 'live');
      if (announce) toast('最新ニュースに更新しました');
      return payload;
    } catch (error) {
      console.warn('ONE NEWS live data unavailable:', error);
      const snapshot = readSnapshot();
      if (snapshot) {
        applyPayload(snapshot, 'snapshot');
        if (announce) toast('通信できないため保存済みニュースを表示します');
        return snapshot;
      }
      const demo = demoPayload();
      applyPayload(demo, 'demo');
      if (announce) toast('実データ取得待ちのためデモを表示します');
      return demo;
    }
  }

  function searchableText(item) {
    return [
      item.title,
      item.summary,
      item.fact,
      item.background,
      item.importance,
      item.outlook,
      item.category,
      ...item.tags,
      ...item.sources.map(source => source.name)
    ].join(' ').toLocaleLowerCase('ja');
  }

  function isPersonal(item) {
    const haystack = searchableText(item);
    return state.keywords.some(keyword => haystack.includes(String(keyword).toLocaleLowerCase('ja')));
  }

  function publishedTime(item) {
    return validDate(item.publishedAt)?.getTime() || 0;
  }

  function filteredItems() {
    let items = [...state.items];
    switch (state.currentTab) {
      case 'personal':
        items = items.filter(isPersonal).sort((a, b) => b.priority - a.priority || publishedTime(b) - publishedTime(a));
        break;
      case 'latest':
        items.sort((a, b) => publishedTime(b) - publishedTime(a));
        break;
      case 'saved':
        items = items.filter(item => state.saved.has(item.id)).sort((a, b) => publishedTime(b) - publishedTime(a));
        break;
      case 'category':
        items.sort((a, b) => a.category.localeCompare(b.category, 'ja') || b.priority - a.priority);
        break;
      default:
        items.sort((a, b) => b.priority - a.priority || publishedTime(b) - publishedTime(a));
        break;
    }

    const query = nodes.searchInput?.value.trim().toLocaleLowerCase('ja') || '';
    if (query) items = items.filter(item => searchableText(item).includes(query));
    return items;
  }

  function sourceBadge(source) {
    const type = source?.type || '報道機関';
    const className = type === '公式発表' ? 'official' : type === '専門メディア' ? 'special' : 'media';
    return `<span class="badge ${className}">${escapeHtml(type)}</span>`;
  }

  function cardMarkup(item) {
    const firstSource = item.sources[0] || { type: '報道機関' };
    const names = item.sources.map(source => source.name).join(' / ') || '配信元未取得';
    return `<article class="news-card${item.sources.length > 1 ? ' is-multi-source' : ''}">
      <div class="progress"><span style="width:${item.priority}%"></span></div>
      <div class="card-body">
        <div class="meta-row">
          <div class="badges">
            ${item.breaking ? '<span class="badge breaking">速報</span>' : ''}
            ${sourceBadge(firstSource)}
            <span class="badge media">${escapeHtml(item.category)}</span>
          </div>
          <time class="time" datetime="${escapeHtml(item.publishedAt || '')}">${escapeHtml(relativeTime(item.publishedAt))}</time>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="summary">${escapeHtml(item.summary)}</p>
        <div class="source-row">
          <span class="source-count">${item.sources.length || 1}ソース統合</span>
          <span>・</span>
          <span class="source-names">${escapeHtml(names)}</span>
        </div>
        <div class="card-actions">
          <button class="open-btn" type="button" data-open="${escapeHtml(item.id)}">詳しく読む</button>
          <button class="mini-btn${state.saved.has(item.id) ? ' active' : ''}" type="button" data-save="${escapeHtml(item.id)}" aria-label="あとで読む">${iconBookmark}</button>
        </div>
      </div>
    </article>`;
  }

  function renderNews() {
    const items = filteredItems();
    nodes.newsList?.classList.toggle('compact', state.compact);
    if (nodes.resultCount) nodes.resultCount.textContent = `${items.length}件`;
    if (nodes.sectionTitle) {
      nodes.sectionTitle.textContent = {
        recommend: '今日の重要ニュース',
        personal: 'あなた向け',
        latest: '新着ニュース',
        category: 'ジャンル順',
        saved: 'あとで読む'
      }[state.currentTab] || '今日の重要ニュース';
    }

    if (!nodes.newsList) return;
    if (!items.length) {
      const message = state.currentTab === 'saved'
        ? 'あとで読むニュースはまだありません。'
        : state.currentTab === 'personal'
          ? '興味キーワードに一致するニュースがありません。設定からキーワードを追加できます。'
          : '検索条件に一致するニュースがありません。';
      nodes.newsList.innerHTML = `<div class="empty"><strong>該当するニュースがありません</strong>${escapeHtml(message)}</div>`;
      return;
    }
    nodes.newsList.innerHTML = items.map(cardMarkup).join('');
  }

  function uniqueSourceCount() {
    if (Number.isFinite(Number(state.metadata?.succeededSources))) return Number(state.metadata.succeededSources);
    return new Set(state.items.flatMap(item => item.sources.map(source => source.name))).size;
  }

  function renderMetrics() {
    const recommended = [...state.items].sort((a, b) => b.priority - a.priority).slice(0, 8);
    const important = state.items.filter(item => item.priority >= 70).length;
    const minutes = recommended.reduce((total, item) => total + item.minutes, 0);
    if (nodes.importantCount) nodes.importantCount.textContent = important || state.items.length;
    if (nodes.readMinutes) nodes.readMinutes.textContent = `${Math.max(1, minutes)}分`;
    if (nodes.sourceCount) nodes.sourceCount.textContent = uniqueSourceCount();
  }

  function updateDataStatus(status = state.dataMode) {
    const metadata = state.metadata || {};
    const totalSources = Array.isArray(metadata.sources) ? metadata.sources.length : 0;
    const success = Number(metadata.succeededSources || 0);
    const generated = formatTimestamp(metadata.generatedAt);
    const articleCount = Number(metadata.totalArticles || state.items.length || 0);
    const clusterCount = Number(metadata.totalClusters || state.items.length || 0);

    if (status === 'loading') {
      if (nodes.feedStatusBadge) {
        nodes.feedStatusBadge.className = 'feed-badge is-loading';
        nodes.feedStatusBadge.innerHTML = '<span class="live-dot"></span>取得中';
      }
      if (nodes.brandStatus) nodes.brandStatus.textContent = '最新ニュースを取得中';
      if (nodes.syncLine) nodes.syncLine.textContent = '公開ニュースデータを確認しています';
      return;
    }

    const modeLabel = state.dataMode === 'live' ? '実データ' : state.dataMode === 'snapshot' ? '保存データ' : 'デモ';
    const fallback = state.dataMode !== 'live';
    if (nodes.feedStatusBadge) {
      nodes.feedStatusBadge.className = `feed-badge${fallback ? ' is-fallback' : ''}`;
      nodes.feedStatusBadge.innerHTML = `<span class="live-dot"></span>${modeLabel}`;
    }
    if (nodes.brandStatus) nodes.brandStatus.textContent = `${generated}更新`;
    if (nodes.syncLine) {
      nodes.syncLine.textContent = state.dataMode === 'live'
        ? `最終更新 ${generated}・${success}/${totalSources || success}ソース・${articleCount}記事を${clusterCount}件に統合`
        : state.dataMode === 'snapshot'
          ? `最終取得 ${generated}・通信復旧時に自動更新します`
          : '実データの初回生成を待ちながら操作確認用データを表示しています';
    }
  }

  function renderSourceStatus() {
    const sources = Array.isArray(state.metadata?.sources) ? state.metadata.sources : [];
    const succeeded = sources.filter(source => source.ok !== false).length;
    if (nodes.sourceHealth) {
      nodes.sourceHealth.textContent = sources.length ? `${succeeded}/${sources.length}接続` : state.dataMode === 'demo' ? 'デモ表示' : '取得情報なし';
    }
    if (!nodes.sourceStatusList) return;
    if (!sources.length) {
      nodes.sourceStatusList.innerHTML = '<div class="source-status-item is-error"><span><strong>実データ未接続</strong><small>定期取得後に配信元の状態を表示します</small></span><b>待機中</b></div>';
      return;
    }
    nodes.sourceStatusList.innerHTML = sources.map(source => {
      const ok = source.ok !== false;
      const count = Number(source.count || 0);
      const detail = ok ? `${count}記事取得` : escapeHtml(source.error || '取得できませんでした');
      return `<div class="source-status-item${ok ? '' : ' is-error'}"><span><strong>${escapeHtml(source.name || source.id || '配信元')}</strong><small>${detail}</small></span><b>${ok ? '接続' : '失敗'}</b></div>`;
    }).join('');
  }

  function renderKeywords() {
    if (!nodes.keywordChips) return;
    nodes.keywordChips.innerHTML = state.keywords.map((keyword, index) => `<span class="chip">${escapeHtml(keyword)}<button type="button" data-remove-keyword="${index}" aria-label="${escapeHtml(keyword)}を削除">×</button></span>`).join('');
  }

  function renderViewButtons() {
    document.querySelector('#cardViewBtn')?.classList.toggle('active', !state.compact);
    document.querySelector('#listViewBtn')?.classList.toggle('active', state.compact);
  }

  function renderAll() {
    updateDataStatus();
    renderMetrics();
    renderNews();
    renderKeywords();
    renderSourceStatus();
    renderViewButtons();
  }

  function sourceLinkMarkup(source) {
    const url = safeUrl(source.url);
    const inner = `<span>${escapeHtml(source.name)}</span><small>${escapeHtml(source.type)}${url ? ' ↗' : ''}</small>`;
    return url
      ? `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
      : `<div class="source-link">${inner}</div>`;
  }

  function openDetail(id) {
    const item = state.items.find(news => news.id === String(id));
    if (!item || !nodes.detailSheet || !nodes.detailBackdrop) return;
    nodes.detailSheet.innerHTML = `<div class="sheet-handle"></div>
      <button class="sheet-close" type="button" data-close="detail" aria-label="詳細を閉じる">×</button>
      <div class="badges">
        ${item.breaking ? '<span class="badge breaking">速報</span>' : ''}
        ${sourceBadge(item.sources[0] || {})}
        <span class="badge media">${escapeHtml(item.category)}</span>
      </div>
      <h2>${escapeHtml(item.title)}</h2>
      <div class="sheet-meta">${escapeHtml(relativeTime(item.publishedAt))}・推定${item.minutes}分・${item.sources.length || 1}ソース統合</div>
      <section class="detail-section"><h3>何が起きた？</h3><p>${escapeHtml(item.fact)}</p></section>
      <section class="detail-section"><h3>背景</h3><p>${escapeHtml(item.background)}</p></section>
      <section class="detail-section"><h3>なぜ重要？</h3><p>${escapeHtml(item.importance)}</p></section>
      <section class="detail-section outlook"><h3>今後の確認ポイント</h3><p>${escapeHtml(item.outlook)}</p><div class="disclaimer">※自動整理された要約です。正確な表現と最新情報は元記事で確認してください。</div></section>
      <section class="detail-section"><h3>情報源</h3><div class="sources">${item.sources.length ? item.sources.map(sourceLinkMarkup).join('') : '<div class="source-link"><span>配信元情報なし</span><small>—</small></div>'}</div></section>`;
    nodes.detailBackdrop.classList.add('open');
    nodes.detailSheet.scrollTop = 0;
  }

  function closeSheet(backdrop) {
    backdrop?.classList.remove('open');
  }

  function toggleSave(id) {
    const key = String(id);
    state.saved.has(key) ? state.saved.delete(key) : state.saved.add(key);
    writeJson(SAVED_KEY, [...state.saved]);
    renderNews();
  }

  function addKeyword() {
    const value = nodes.keywordInput?.value.trim();
    if (!value || state.keywords.includes(value)) return;
    state.keywords.push(value);
    writeJson(KEYWORDS_KEY, state.keywords);
    if (nodes.keywordInput) nodes.keywordInput.value = '';
    renderKeywords();
    renderNews();
  }

  function removeKeyword(index) {
    state.keywords.splice(index, 1);
    writeJson(KEYWORDS_KEY, state.keywords);
    renderKeywords();
    renderNews();
  }

  function openSettings() {
    renderKeywords();
    renderSourceStatus();
    nodes.settingsBackdrop?.classList.add('open');
  }

  let toastTimer = 0;
  function toast(message) {
    if (!nodes.toast) return;
    nodes.toast.textContent = message;
    nodes.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => nodes.toast.classList.remove('show'), 2200);
  }

  function setTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
    renderNews();
  }

  function setActiveNavigation(name) {
    document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.nav === name));
  }

  document.querySelector('#tabs')?.addEventListener('click', event => {
    const button = event.target.closest('.tab');
    if (button) setTab(button.dataset.tab);
  });

  nodes.newsList?.addEventListener('click', event => {
    const openButton = event.target.closest('[data-open]');
    const saveButton = event.target.closest('[data-save]');
    if (openButton) openDetail(openButton.dataset.open);
    if (saveButton) toggleSave(saveButton.dataset.save);
  });

  nodes.detailSheet?.addEventListener('click', event => {
    if (event.target.closest('[data-close="detail"]')) closeSheet(nodes.detailBackdrop);
  });

  [nodes.detailBackdrop, nodes.settingsBackdrop].forEach(backdrop => {
    backdrop?.addEventListener('click', event => {
      if (event.target === backdrop) closeSheet(backdrop);
    });
  });

  nodes.settingsBackdrop?.addEventListener('click', event => {
    if (event.target.closest('[data-close="settings"]')) closeSheet(nodes.settingsBackdrop);
    const removeButton = event.target.closest('[data-remove-keyword]');
    if (removeButton) removeKeyword(Number(removeButton.dataset.removeKeyword));
  });

  document.querySelector('#addKeywordBtn')?.addEventListener('click', addKeyword);
  nodes.keywordInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') addKeyword();
  });

  document.querySelector('#settingsBtn')?.addEventListener('click', openSettings);
  nodes.refreshButton?.addEventListener('click', () => loadNews({ fresh: true, announce: true }));
  nodes.searchInput?.addEventListener('input', renderNews);

  document.querySelector('#cardViewBtn')?.addEventListener('click', () => {
    state.compact = false;
    localStorage.setItem(VIEW_KEY, 'card');
    renderViewButtons();
    renderNews();
  });

  document.querySelector('#listViewBtn')?.addEventListener('click', () => {
    state.compact = true;
    localStorage.setItem(VIEW_KEY, 'compact');
    renderViewButtons();
    renderNews();
  });

  document.querySelector('.bottom-nav')?.addEventListener('click', event => {
    const button = event.target.closest('.nav-btn');
    if (!button) return;
    const nav = button.dataset.nav;
    setActiveNavigation(nav);
    if (nav === 'search') {
      nodes.searchInput?.focus();
      document.querySelector('.controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (nav === 'saved') {
      setTab('saved');
    } else if (nav === 'settings') {
      openSettings();
    } else if (nav === 'home') {
      if (nodes.searchInput) nodes.searchInput.value = '';
      setTab('recommend');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeSheet(nodes.detailBackdrop);
    closeSheet(nodes.settingsBackdrop);
  });

  window.addEventListener('online', () => {
    if (state.dataMode !== 'live') void loadNews({ fresh: true });
  });

  window.addEventListener('pageshow', event => {
    const stale = Date.now() - state.lastLoadedAt > 30 * 60 * 1000;
    if (event.persisted || stale) void loadNews({ fresh: Boolean(event.persisted) });
  });

  renderViewButtons();
  void loadNews();
})();
