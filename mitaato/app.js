'use strict';

const DATA_URL = './data/articles.json';
const STORAGE_KEY = 'mitaato-desk-state-v1';
const STATUS_LABELS = { draft: '未投稿', ready: '確認済み', posted: '投稿済み', hold: '保留' };
const STATUS_ORDER = ['draft', 'ready', 'posted', 'hold'];
const EDIT_FIELDS = [
  ['title', 'タイトル', 'input'],
  ['category', 'カテゴリ', 'select'],
  ['work', '作品名', 'input'],
  ['price', '価格', 'select-price'],
  ['spoilerRange', 'ネタバレ範囲', 'textarea'],
  ['freeSection', '無料公開部分／本文', 'textarea-long'],
  ['paidSection', '有料部分', 'textarea-long'],
  ['tags', 'タグ（1行）', 'textarea'],
  ['thumbnailText', 'サムネイル文言', 'textarea'],
  ['thumbnailPrompt', 'サムネイル生成プロンプト', 'textarea-long'],
  ['whyNow', '今出す理由', 'textarea']
];

const elements = {
  list: document.getElementById('articleList'),
  empty: document.getElementById('emptyState'),
  detail: document.getElementById('detailPane'),
  updateText: document.getElementById('updateText'),
  search: document.getElementById('searchInput'),
  category: document.getElementById('categoryFilter'),
  sort: document.getElementById('sortSelect'),
  refresh: document.getElementById('refreshButton'),
  importButton: document.getElementById('importButton'),
  importDialog: document.getElementById('importDialog'),
  importForm: document.getElementById('importForm'),
  importTextarea: document.getElementById('importTextarea'),
  importError: document.getElementById('importError'),
  cancelImport: document.getElementById('cancelImport'),
  editDialog: document.getElementById('editDialog'),
  editForm: document.getElementById('editForm'),
  editFields: document.getElementById('editFields'),
  cancelEdit: document.getElementById('cancelEdit'),
  backdrop: document.getElementById('mobileBackdrop'),
  toast: document.getElementById('toast'),
  counts: {
    all: document.getElementById('countAll'),
    draft: document.getElementById('countDraft'),
    ready: document.getElementById('countReady'),
    posted: document.getElementById('countPosted'),
    hold: document.getElementById('countHold')
  }
};

const app = {
  feed: { version: 1, updatedAt: null, generator: {}, articles: [] },
  state: loadState(),
  articles: [],
  selectedId: null,
  statusFilter: 'all',
  importEditingId: null,
  isLoading: false
};

function defaultState() {
  return { statuses: {}, edits: {}, localArticles: [], hiddenIds: [], preferences: {} };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return { ...defaultState(), ...(parsed || {}) };
  } catch (error) {
    console.warn('Failed to load local state', error);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalizeTags(value = '') {
  return String(value).replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function makeId(title = 'article') {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()).replaceAll('-', '');
  const ascii = title.normalize('NFKC').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-|-$/g, '').slice(0, 46);
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5);
  return `${date}-${ascii || 'article'}-${random}`;
}

function statusFor(id) {
  return app.state.statuses[id]?.status || 'draft';
}

function mergeArticles() {
  const byId = new Map();
  for (const article of [...(app.feed.articles || []), ...(app.state.localArticles || [])]) {
    if (!article?.id || app.state.hiddenIds.includes(article.id)) continue;
    byId.set(article.id, { ...article });
  }
  app.articles = [...byId.values()].map(article => {
    const edited = app.state.edits[article.id] || {};
    const statusState = app.state.statuses[article.id] || {};
    return {
      score: 0,
      revision: 1,
      category: 'その他',
      price: '無料',
      sources: [],
      ...article,
      ...edited,
      status: statusState.status || article.status || 'draft',
      postedAt: statusState.postedAt || article.postedAt || null,
      plannedAt: statusState.plannedAt || article.plannedAt || ''
    };
  });
}

function filteredArticles() {
  const query = elements.search.value.trim().toLowerCase();
  const category = elements.category.value;
  const result = app.articles.filter(article => {
    if (app.statusFilter !== 'all' && statusFor(article.id) !== app.statusFilter) return false;
    if (category !== 'all' && article.category !== category) return false;
    if (!query) return true;
    return [article.title, article.work, article.tags, article.whyNow, article.category]
      .filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  return result.sort((a, b) => {
    if (elements.sort.value === 'score') return Number(b.score || 0) - Number(a.score || 0) || dateValue(b.updatedAt || b.generatedAt) - dateValue(a.updatedAt || a.generatedAt);
    if (elements.sort.value === 'planned') {
      const av = a.plannedAt ? dateValue(a.plannedAt) : Number.MAX_SAFE_INTEGER;
      const bv = b.plannedAt ? dateValue(b.plannedAt) : Number.MAX_SAFE_INTEGER;
      return av - bv || dateValue(b.updatedAt || b.generatedAt) - dateValue(a.updatedAt || a.generatedAt);
    }
    return dateValue(b.updatedAt || b.generatedAt) - dateValue(a.updatedAt || a.generatedAt);
  });
}

function dateValue(value) {
  const result = value ? new Date(value).getTime() : 0;
  return Number.isFinite(result) ? result : 0;
}

function formatDate(value, includeTime = true) {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(date);
}

function render() {
  mergeArticles();
  renderCounts();
  renderList();
  if (app.selectedId && app.articles.some(article => article.id === app.selectedId)) renderDetail(app.selectedId);
  else if (filteredArticles().length) selectArticle(filteredArticles()[0].id, false);
  else renderEmptyDetail();
}

function renderCounts() {
  const counts = { all: app.articles.length, draft: 0, ready: 0, posted: 0, hold: 0 };
  app.articles.forEach(article => { const status = statusFor(article.id); counts[status] = (counts[status] || 0) + 1; });
  Object.entries(elements.counts).forEach(([key, element]) => { element.textContent = counts[key] || 0; });
  document.querySelectorAll('[data-status-filter]').forEach(button => button.classList.toggle('active', button.dataset.statusFilter === app.statusFilter));
}

function renderList() {
  const articles = filteredArticles();
  elements.empty.hidden = articles.length > 0;
  elements.list.hidden = articles.length === 0;
  elements.list.innerHTML = articles.map(article => {
    const status = statusFor(article.id);
    const revised = Number(article.revision || 1) > 1 ? '<span class="badge revised">更新</span>' : '';
    const planned = article.plannedAt ? `<span class="planned-chip">予定 ${escapeHtml(formatDate(article.plannedAt))}</span>` : '';
    return `<button class="article-card ${article.id === app.selectedId ? 'active' : ''}" data-article-id="${escapeHtml(article.id)}" type="button">
      <div class="article-card-top">
        <div class="badge-row">
          <span class="badge category">${escapeHtml(article.category)}</span>
          <span class="badge price">${escapeHtml(article.price)}</span>
          <span class="badge score">優先 ${escapeHtml(article.score || 0)}</span>${revised}
        </div>
        <span class="status-dot ${status}">${STATUS_LABELS[status] || status}</span>
      </div>
      <h3>${escapeHtml(article.title)}</h3>
      ${planned}
      <div class="article-meta"><span>${escapeHtml(article.work || article.category || '')}</span><time>${escapeHtml(formatDate(article.updatedAt || article.generatedAt))}</time></div>
    </button>`;
  }).join('');

  elements.list.querySelectorAll('[data-article-id]').forEach(button => {
    button.addEventListener('click', () => selectArticle(button.dataset.articleId, true));
  });
}

function selectArticle(id, openOnMobile = true) {
  app.selectedId = id;
  renderList();
  renderDetail(id);
  if (openOnMobile && matchMedia('(max-width:820px)').matches) openMobileDetail();
}

function renderEmptyDetail() {
  app.selectedId = null;
  elements.detail.className = 'detail-pane empty-detail';
  elements.detail.innerHTML = '<div class="detail-placeholder"><span>✦</span><h3>記事を選択</h3><p>各領域をワンタップでコピーできます。</p></div>';
}

function copySection(label, field, value, extraClass = '') {
  if (!value && field === 'paidSection') return '';
  return `<section class="copy-section">
    <div class="copy-section-header"><h3>${escapeHtml(label)}</h3><button class="copy-button" type="button" data-copy-field="${escapeHtml(field)}">コピー</button></div>
    <div class="copy-content ${extraClass}">${escapeHtml(value || '（未入力）')}</div>
  </section>`;
}

function renderDetail(id) {
  const article = app.articles.find(item => item.id === id);
  if (!article) return renderEmptyDetail();
  const status = statusFor(id);
  const sourceHtml = (article.sources || []).length ? `<section class="sources"><h3>確認元</h3><div class="source-list">${article.sources.map(source => `<a class="source-link" href="${escapeHtml(source.url || '#')}" target="_blank" rel="noopener"><span>${escapeHtml(source.title || source.publisher || '出典')}</span><span>${escapeHtml(source.publisher || '開く')} ↗</span></a>`).join('')}</div></section>` : '';
  const allBody = buildArticleBody(article);
  const priceSpoiler = `価格：${article.price || '無料'}\n\nネタバレ範囲：${article.spoilerRange || 'なし'}`;
  const generatedLabel = article.updatedAt && article.updatedAt !== article.generatedAt ? `更新 ${formatDate(article.updatedAt)}` : `生成 ${formatDate(article.generatedAt)}`;

  elements.detail.className = 'detail-pane';
  elements.detail.innerHTML = `<article class="detail-content">
    <header class="detail-header">
      <button class="icon-button mobile-close" id="mobileClose" type="button" aria-label="記事一覧へ">×</button>
      <div class="detail-title-row">
        <div><p class="eyebrow">${escapeHtml(article.category)} · ${escapeHtml(article.work || '')}</p><h2>${escapeHtml(article.title)}</h2></div>
      </div>
      <div class="detail-summary">
        <div class="summary-cell"><small>価格</small><strong>${escapeHtml(article.price)}</strong></div>
        <div class="summary-cell"><small>優先度</small><strong>${escapeHtml(article.score || 0)} / 100</strong></div>
        <div class="summary-cell"><small>更新</small><strong>${escapeHtml(generatedLabel)}</strong></div>
      </div>
      <div class="detail-actions">
        <button class="primary-button" id="copyBodyButton" type="button">本文を一括コピー</button>
        <button class="secondary-button" id="openNoteButton" type="button">noteを開く</button>
        <button class="ghost-button" id="editButton" type="button">編集</button>
        ${isLocalArticle(id) ? '<button class="ghost-button danger-button" id="deleteButton" type="button">削除</button>' : ''}
      </div>
      <div class="planning-row">
        <input id="plannedAtInput" type="datetime-local" value="${escapeHtml(toLocalInputValue(article.plannedAt))}" aria-label="投稿予定日時">
        <button class="secondary-button" id="savePlanButton" type="button">予定を保存</button>
      </div>
    </header>

    <div class="status-actions" aria-label="投稿状況">
      ${STATUS_ORDER.map(key => `<button class="status-button ${status === key ? 'active' : ''}" data-set-status="${key}" type="button">${STATUS_LABELS[key]}</button>`).join('')}
    </div>

    ${copySection('タイトル', 'title', article.title, 'short')}
    ${copySection('価格・ネタバレ範囲', 'priceSpoiler', priceSpoiler, 'short')}
    ${copySection(article.price === '無料' ? '本文' : '無料公開部分', 'freeSection', article.freeSection)}
    ${copySection('有料部分', 'paidSection', article.paidSection)}
    ${copySection('タグ', 'tags', normalizeTags(article.tags), 'short tags')}
    ${copySection('サムネイル文言', 'thumbnailText', article.thumbnailText, 'short')}
    ${copySection('サムネイル生成プロンプト', 'thumbnailPrompt', article.thumbnailPrompt)}
    ${article.whyNow ? copySection('今出す理由', 'whyNow', article.whyNow, 'short') : ''}
    ${sourceHtml}
    <span id="allBodyValue" hidden>${escapeHtml(allBody)}</span>
  </article>`;

  document.getElementById('mobileClose')?.addEventListener('click', closeMobileDetail);
  document.getElementById('copyBodyButton')?.addEventListener('click', async event => {
    await copyText(allBody); markCopied(event.currentTarget, '本文をコピー済み');
  });
  document.getElementById('openNoteButton')?.addEventListener('click', () => openNote(article));
  document.getElementById('editButton')?.addEventListener('click', () => openEditDialog(article));
  document.getElementById('deleteButton')?.addEventListener('click', () => deleteLocalArticle(article.id));
  document.getElementById('savePlanButton')?.addEventListener('click', () => savePlan(article.id));
  elements.detail.querySelectorAll('[data-copy-field]').forEach(button => {
    button.addEventListener('click', async () => {
      const field = button.dataset.copyField;
      const value = field === 'priceSpoiler' ? priceSpoiler : field === 'tags' ? normalizeTags(article.tags) : article[field] || '';
      await copyText(value); markCopied(button);
    });
  });
  elements.detail.querySelectorAll('[data-set-status]').forEach(button => {
    button.addEventListener('click', () => setStatus(article.id, button.dataset.setStatus));
  });
}

function isLocalArticle(id) {
  return app.state.localArticles.some(article => article.id === id);
}

function buildArticleBody(article) {
  const free = String(article.freeSection || '').trim();
  const paid = String(article.paidSection || '').trim();
  if (!paid) return free;
  return `${free}\n\n---\n\n## ここから有料\n\n${paid}`.trim();
}

function toLocalInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
  return formatter.format(date).replace(' ', 'T');
}

function fromTokyoLocalInput(value) {
  if (!value) return '';
  return new Date(`${value}:00+09:00`).toISOString();
}

function savePlan(id) {
  const input = document.getElementById('plannedAtInput');
  const current = app.state.statuses[id] || {};
  app.state.statuses[id] = { ...current, plannedAt: fromTokyoLocalInput(input.value) };
  saveState();
  render();
  showToast(input.value ? '投稿予定を保存しました' : '投稿予定を解除しました');
}

function setStatus(id, status) {
  const current = app.state.statuses[id] || {};
  app.state.statuses[id] = {
    ...current,
    status,
    postedAt: status === 'posted' ? (current.postedAt || new Date().toISOString()) : null
  };
  saveState();
  render();
  showToast(`「${STATUS_LABELS[status]}」に変更しました`);
}

async function openNote(article) {
  const popup = window.open('https://note.com/notes/new', '_blank', 'noopener');
  try {
    await copyText(buildArticleBody(article));
    showToast('本文をコピーしました。noteに貼り付けてください');
  } catch (error) {
    console.error(error);
    showToast('noteを開きました');
  }
  if (!popup) showToast('ポップアップを許可して、もう一度押してください');
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(String(text || ''));
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = String(text || '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus(); textarea.select();
  const success = document.execCommand('copy');
  textarea.remove();
  if (!success) throw new Error('Clipboard copy failed');
}

function markCopied(button, message = 'コピーしました') {
  const original = button.textContent;
  button.textContent = 'コピー済み';
  button.classList.add('copied');
  showToast(message);
  setTimeout(() => { button.textContent = original; button.classList.remove('copied'); }, 1200);
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function openMobileDetail() {
  elements.detail.classList.add('mobile-open');
  elements.backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeMobileDetail() {
  elements.detail.classList.remove('mobile-open');
  elements.backdrop.hidden = true;
  document.body.style.overflow = '';
}

function openEditDialog(article) {
  app.importEditingId = article.id;
  elements.editFields.innerHTML = EDIT_FIELDS.map(([key, label, type]) => {
    const value = article[key] || '';
    if (type === 'select') return `<div class="edit-field"><label for="edit-${key}">${label}</label><select id="edit-${key}" name="${key}">${['漫画','アニメ','ドラマ','映画','都市伝説','その他'].map(item => `<option ${item === value ? 'selected' : ''}>${item}</option>`).join('')}</select></div>`;
    if (type === 'select-price') return `<div class="edit-field"><label for="edit-${key}">${label}</label><select id="edit-${key}" name="${key}"><option ${value === '無料' ? 'selected' : ''}>無料</option><option ${value === '100円' ? 'selected' : ''}>100円</option></select></div>`;
    if (type.startsWith('textarea')) return `<div class="edit-field"><label for="edit-${key}">${label}</label><textarea id="edit-${key}" name="${key}" class="${type === 'textarea-long' ? 'long' : ''}">${escapeHtml(value)}</textarea></div>`;
    return `<div class="edit-field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" value="${escapeHtml(value)}"></div>`;
  }).join('');
  elements.editDialog.showModal();
}

function saveEdit(event) {
  event.preventDefault();
  const id = app.importEditingId;
  if (!id) return;
  const formData = new FormData(elements.editForm);
  const edited = {};
  EDIT_FIELDS.forEach(([key]) => { edited[key] = String(formData.get(key) || '').trim(); });
  edited.tags = normalizeTags(edited.tags);
  edited.updatedAt = new Date().toISOString();
  app.state.edits[id] = { ...(app.state.edits[id] || {}), ...edited };
  saveState();
  elements.editDialog.close();
  render();
  showToast('編集内容を端末に保存しました');
}

function deleteLocalArticle(id) {
  if (!confirm('この端末に取り込んだ記事を削除しますか？')) return;
  app.state.localArticles = app.state.localArticles.filter(article => article.id !== id);
  delete app.state.edits[id];
  delete app.state.statuses[id];
  saveState();
  app.selectedId = null;
  render();
  closeMobileDetail();
  showToast('記事を削除しました');
}

function parseImport(raw) {
  const text = raw.trim();
  if (!text) throw new Error('内容を貼り付けてください。');
  try {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : parsed.articles ? parsed.articles : [parsed];
    return items.map(normalizeImportedArticle);
  } catch (jsonError) {
    const blocks = splitArticleBlocks(text);
    const parsedBlocks = blocks.map(parseFormattedArticle).filter(article => article.title || article.freeSection);
    if (!parsedBlocks.length) throw new Error('記事の区切りを読み取れませんでした。分割出力かJSONを貼り付けてください。');
    return parsedBlocks.map(normalizeImportedArticle);
  }
}

function splitArticleBlocks(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const markers = [...normalized.matchAll(/^#\s*\d+本目.*$/gm)];
  if (markers.length <= 1) return [normalized];
  return markers.map((marker, index) => normalized.slice(marker.index, markers[index + 1]?.index ?? normalized.length));
}

function sectionValue(text, headings) {
  for (const heading of headings) {
    const pattern = new RegExp(`^#{1,4}\\s*(?:\\d+[①-⑩]?\\s*)?${heading}\\s*$`, 'm');
    const match = pattern.exec(text);
    if (!match) continue;
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const next = rest.search(/^#{1,4}\s+/m);
    let value = (next >= 0 ? rest.slice(0, next) : rest).trim();
    const fenced = value.match(/```(?:text|markdown)?\s*\n([\s\S]*?)\n```/i);
    if (fenced) value = fenced[1].trim();
    return value;
  }
  return '';
}

function parseFormattedArticle(text) {
  const title = sectionValue(text, ['タイトル']) || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  const priceSpoiler = sectionValue(text, ['価格・ネタバレ範囲']);
  const price = priceSpoiler.match(/価格[：:]\s*(無料|100円)/)?.[1] || (/100円/.test(text) ? '100円' : '無料');
  const spoilerRange = priceSpoiler.match(/ネタバレ範囲[：:]\s*([\s\S]+)/)?.[1]?.trim() || '';
  const freeSection = sectionValue(text, ['無料公開部分', '本文']);
  const paidSection = sectionValue(text, ['有料部分']);
  const tags = normalizeTags(sectionValue(text, ['タグ']));
  const thumbnailText = sectionValue(text, ['サムネイル文言']);
  const thumbnailPrompt = sectionValue(text, ['サムネイル生成プロンプト']);
  return { title, price, spoilerRange, freeSection, paidSection, tags, thumbnailText, thumbnailPrompt };
}

function normalizeImportedArticle(article) {
  const now = new Date().toISOString();
  const title = String(article.title || '').trim();
  if (!title) throw new Error('タイトルがない記事が含まれています。');
  return {
    id: article.id || makeId(title),
    topicKey: article.topicKey || title.normalize('NFKC').toLowerCase().slice(0, 80),
    title,
    category: article.category || inferCategory(title),
    work: article.work || inferWork(title),
    price: article.price === '100円' ? '100円' : '無料',
    spoilerRange: String(article.spoilerRange || '').trim(),
    freeSection: String(article.freeSection || article.body || '').trim(),
    paidSection: String(article.paidSection || '').trim(),
    tags: normalizeTags(article.tags || '#ミタアト'),
    thumbnailText: String(article.thumbnailText || '').trim(),
    thumbnailPrompt: String(article.thumbnailPrompt || '').trim(),
    whyNow: String(article.whyNow || '手動で取り込んだ記事').trim(),
    score: Number(article.score || 70),
    revision: Number(article.revision || 1),
    sources: Array.isArray(article.sources) ? article.sources : [],
    generatedAt: article.generatedAt || now,
    updatedAt: article.updatedAt || now,
    status: 'draft',
    local: true
  };
}

function inferCategory(title) {
  if (/ドラマ|VIVANT|日曜劇場|第\d+話/.test(title) && !/アニメ/.test(title)) return 'ドラマ';
  if (/映画/.test(title)) return '映画';
  if (/都市伝説|怪談|巨頭オ/.test(title)) return '都市伝説';
  if (/巻|話考察|ONE PIECE|HUNTER|漫画/.test(title)) return '漫画';
  return 'アニメ';
}

function inferWork(title) {
  const bracket = title.match(/【([^】]+)】/);
  return bracket?.[1]?.replace(/第?\d+話.*|考察.*/g, '').trim() || '';
}

function handleImport(event) {
  event.preventDefault();
  elements.importError.hidden = true;
  try {
    const articles = parseImport(elements.importTextarea.value);
    const existing = new Map(app.state.localArticles.map(article => [article.id, article]));
    articles.forEach(article => existing.set(article.id, article));
    app.state.localArticles = [...existing.values()];
    saveState();
    elements.importDialog.close();
    elements.importTextarea.value = '';
    app.selectedId = articles[0]?.id || null;
    render();
    showToast(`${articles.length}件の記事を取り込みました`);
  } catch (error) {
    elements.importError.textContent = error.message || '取り込みに失敗しました。';
    elements.importError.hidden = false;
  }
}

async function loadFeed(force = false) {
  if (app.isLoading) return;
  app.isLoading = true;
  elements.refresh.disabled = true;
  elements.refresh.textContent = '…';
  try {
    const response = await fetch(`${DATA_URL}?v=${force ? Date.now() : '1'}`, { cache: force ? 'no-store' : 'default' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const feed = await response.json();
    if (!Array.isArray(feed.articles)) throw new Error('Invalid article feed');
    app.feed = feed;
    const generated = feed.updatedAt ? `最終更新 ${formatDate(feed.updatedAt)}` : '生成データを読み込みました';
    const schedule = feed.generator?.scheduleLabel ? ` · ${feed.generator.scheduleLabel}` : '';
    elements.updateText.textContent = `${generated}${schedule}`;
    render();
    if (force) showToast('最新の記事データに更新しました');
  } catch (error) {
    console.error(error);
    elements.updateText.textContent = '生成データを取得できませんでした。端末保存の記事は利用できます。';
    render();
    if (force) showToast('更新に失敗しました');
  } finally {
    app.isLoading = false;
    elements.refresh.disabled = false;
    elements.refresh.textContent = '↻';
  }
}

function bindEvents() {
  elements.search.addEventListener('input', render);
  elements.category.addEventListener('change', render);
  elements.sort.addEventListener('change', render);
  elements.refresh.addEventListener('click', () => loadFeed(true));
  elements.importButton.addEventListener('click', () => { elements.importError.hidden = true; elements.importDialog.showModal(); });
  elements.cancelImport.addEventListener('click', () => elements.importDialog.close());
  elements.importForm.addEventListener('submit', handleImport);
  elements.cancelEdit.addEventListener('click', () => elements.editDialog.close());
  elements.editForm.addEventListener('submit', saveEdit);
  elements.backdrop.addEventListener('click', closeMobileDetail);
  document.querySelectorAll('[data-status-filter]').forEach(button => {
    button.addEventListener('click', () => { app.statusFilter = button.dataset.statusFilter; render(); });
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') closeMobileDetail(); });
}

bindEvents();
loadFeed();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
