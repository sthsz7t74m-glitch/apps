'use strict';

(() => {
  const FEED_URL = './data/articles.json';
  const fallbackArticles = new Map();
  let scheduled = false;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function safeImageUrl(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      const url = new URL(text, location.href);
      if (!['http:', 'https:', 'data:', 'blob:'].includes(url.protocol)) return '';
      return text;
    } catch {
      return '';
    }
  }

  function allArticles() {
    try {
      if (typeof app !== 'undefined' && Array.isArray(app.articles)) return app.articles;
    } catch {}
    return [...fallbackArticles.values()];
  }

  function findArticle(id) {
    return allArticles().find(article => article.id === id) || fallbackArticles.get(id);
  }

  function selectedId() {
    try {
      if (typeof app !== 'undefined' && app.selectedId) return app.selectedId;
    } catch {}
    return document.querySelector('.article-card.active')?.dataset.articleId || '';
  }

  function imageFor(article) {
    return safeImageUrl(article?.thumbnailImage || article?.thumbnailUrl || '');
  }

  function enhanceList() {
    document.querySelectorAll('.article-card[data-article-id]').forEach(card => {
      const article = findArticle(card.dataset.articleId);
      const source = imageFor(article);
      const old = card.querySelector('.article-card-thumb');
      if (!source) {
        old?.remove();
        card.classList.remove('has-thumbnail');
        return;
      }
      if (old?.dataset.source === source) return;
      old?.remove();
      const frame = document.createElement('div');
      frame.className = 'article-card-thumb';
      frame.dataset.source = source;
      frame.innerHTML = `<img src="${escapeHtml(source)}" alt="${escapeHtml(article.title)}のサムネイル" loading="lazy">`;
      frame.querySelector('img').addEventListener('error', () => {
        frame.remove();
        card.classList.remove('has-thumbnail');
      }, { once: true });
      card.prepend(frame);
      card.classList.add('has-thumbnail');
    });
  }

  function setPlanningOpen(row, toggle, open) {
    row.classList.toggle('is-open', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '予定を閉じる' : (toggle.dataset.hasPlan === 'true' ? '予定あり' : '投稿予定');
    if (open) requestAnimationFrame(() => row.querySelector('input')?.focus({ preventScroll: true }));
  }

  function compactPlanningControls(content, article) {
    const row = content.querySelector('.planning-row');
    const actions = content.querySelector('.detail-actions');
    if (!row || !actions) return;

    row.classList.add('planning-row-compact');
    row.id = 'planningControls';

    let toggle = actions.querySelector('[data-plan-toggle]');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'ghost-button plan-toggle-button';
      toggle.dataset.planToggle = 'true';
      toggle.setAttribute('aria-controls', row.id);
      actions.append(toggle);
      toggle.addEventListener('click', () => {
        setPlanningOpen(row, toggle, !row.classList.contains('is-open'));
      });
    }

    const hasPlan = Boolean(article?.plannedAt);
    toggle.dataset.hasPlan = String(hasPlan);
    if (!row.classList.contains('is-open')) {
      toggle.textContent = hasPlan ? '予定あり' : '投稿予定';
      toggle.setAttribute('aria-expanded', 'false');
    }
  }

  function compactMobileLabels(content) {
    const copy = content.querySelector('#copyBodyButton');
    const note = content.querySelector('#openNoteButton');
    if (!copy || !note) return;

    const update = event => {
      const compact = event.matches;
      copy.textContent = compact ? '本文コピー' : '本文を一括コピー';
      note.textContent = compact ? 'note' : 'noteを開く';
    };

    const media = matchMedia('(max-width: 820px)');
    update(media);
    if (!content.dataset.mobileLabelsBound) {
      content.dataset.mobileLabelsBound = 'true';
      media.addEventListener?.('change', update);
    }
  }

  function enhanceDetail() {
    const detail = document.getElementById('detailPane');
    const content = detail?.querySelector('.detail-content');
    if (!content) return;

    const article = findArticle(selectedId());
    compactPlanningControls(content, article);
    compactMobileLabels(content);

    const source = imageFor(article);
    const existing = content.querySelector('.thumbnail-panel');
    if (!source) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.source === source) return;

    existing?.remove();
    const panel = document.createElement('section');
    panel.className = 'thumbnail-panel';
    panel.dataset.source = source;
    panel.innerHTML = `
      <div class="thumbnail-panel-header">
        <div><p class="eyebrow">THUMBNAIL</p><h3>サムネイル</h3></div>
        <div class="thumbnail-panel-actions"><a class="secondary-button" href="${escapeHtml(source)}" target="_blank" rel="noopener">画像を開く</a></div>
      </div>
      <a class="thumbnail-preview-link" href="${escapeHtml(source)}" target="_blank" rel="noopener" aria-label="サムネイルを拡大表示">
        <img class="thumbnail-preview" src="${escapeHtml(source)}" alt="${escapeHtml(article?.title || '記事')}のサムネイル" loading="eager">
      </a>`;
    panel.querySelector('img').addEventListener('error', () => panel.classList.add('image-error'), { once: true });

    const status = content.querySelector('.status-actions');
    if (status) status.before(panel);
    else content.querySelector('.detail-header')?.after(panel);
  }

  function makeLongSectionsScrollable() {
    document.querySelectorAll('.copy-section').forEach(section => {
      const content = section.querySelector('.copy-content');
      const header = section.querySelector('.copy-section-header');
      const heading = header?.querySelector('h3');
      if (!content || !header || !heading) return;
      const label = heading.textContent.trim();
      const isLongArea = ['本文', '無料公開部分', '有料部分', 'サムネイル生成プロンプト'].includes(label) || content.textContent.length > 420;
      section.classList.toggle('scrollable-section', isLongArea);
      let titleWrap = header.querySelector('.copy-section-title');
      if (!titleWrap) {
        titleWrap = document.createElement('div');
        titleWrap.className = 'copy-section-title';
        heading.before(titleWrap);
        titleWrap.append(heading);
      }
      let badge = titleWrap.querySelector('.scroll-badge');
      if (isLongArea && !badge) {
        badge = document.createElement('span');
        badge.className = 'scroll-badge';
        badge.textContent = 'スクロール';
        titleWrap.append(badge);
      } else if (!isLongArea) {
        badge?.remove();
      }
    });
  }

  function enhance() {
    scheduled = false;
    const version = document.querySelector('.version');
    if (version) version.textContent = 'v1.2.0';
    enhanceList();
    enhanceDetail();
    makeLongSectionsScrollable();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  new MutationObserver(scheduleEnhance).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', scheduleEnhance);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-article-id], [data-status-filter], #refreshButton')) setTimeout(scheduleEnhance, 0);
  });

  fetch(`${FEED_URL}?thumb=${Date.now()}`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then(feed => {
      (feed.articles || []).forEach(article => fallbackArticles.set(article.id, article));
      scheduleEnhance();
    })
    .catch(console.warn);
})();
