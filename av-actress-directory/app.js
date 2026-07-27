(() => {
  'use strict';

  const DATA = Array.isArray(window.AV_ACTRESSES) ? window.AV_ACTRESSES : [];
  const META = window.AV_DIRECTORY_META || {};
  const CUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const AGE_GATE_KEY = 'av-directory-age-confirmed-v1';
  const collator = new Intl.Collator('ja', { sensitivity: 'base', numeric: true });
  const htmlEscapes = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });
  const $ = id => document.getElementById(id);

  const elements = {
    ageGate: $('ageGate'),
    enterButton: $('enterButton'),
    mainContent: $('mainContent'),
    searchInput: $('searchInput'),
    filterToggle: $('filterToggle'),
    filterPanel: $('filterPanel'),
    activeFilterCount: $('activeFilterCount'),
    birthplaceFilter: $('birthplaceFilter'),
    ageMin: $('ageMin'),
    ageMax: $('ageMax'),
    realNameFilter: $('realNameFilter'),
    heightMin: $('heightMin'),
    heightMax: $('heightMax'),
    cupMin: $('cupMin'),
    cupMax: $('cupMax'),
    sortSelect: $('sortSelect'),
    realNameOnly: $('realNameOnly'),
    photoOnly: $('photoOnly'),
    resetButton: $('resetButton'),
    resultCount: $('resultCount'),
    dataCount: $('dataCount'),
    profileGrid: $('profileGrid'),
    profileDialog: $('profileDialog'),
    dialogClose: $('dialogClose'),
    dialogContent: $('dialogContent')
  };

  let hasRendered = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => htmlEscapes[character]);
  }

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('ja')
      .replace(/[\s・･._\-‐‑‒–—―]/g, '');
  }

  function getTokyoDateParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day)
    };
  }

  function calculateAge(birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate ?? ''))) return null;
    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
    const today = getTokyoDateParts();
    if (![birthYear, birthMonth, birthDay, today.year, today.month, today.day].every(Number.isFinite)) return null;
    const birthdayPassed = today.month > birthMonth || (today.month === birthMonth && today.day >= birthDay);
    return today.year - birthYear - (birthdayPassed ? 0 : 1);
  }

  function formatBirthDate(profile) {
    if (profile.birthDate) {
      const [year, month, day] = profile.birthDate.split('-').map(Number);
      return `${year}年${month}月${day}日`;
    }
    return profile.birthdayLabel || '—';
  }

  function formatUpdatedAt(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return '';
    const [year, month, day] = value.split('-');
    return `${year}.${month}.${day}`;
  }

  function readOptionalNumber(input) {
    if (!input || input.value === '') return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
  }

  function cupRank(cup) {
    if (!cup) return null;
    const rank = CUP_LETTERS.indexOf(String(cup).trim().toUpperCase());
    return rank === -1 ? null : rank;
  }

  function photoUrl(photo, width = 720) {
    if (!photo?.file) return '';
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(photo.file)}?width=${width}`;
  }

  function initials(name) {
    const value = String(name ?? '').trim();
    if (!value) return '?';
    if (/^[A-Za-z0-9]/.test(value)) return value.slice(0, 2).toUpperCase();
    return [...value].slice(0, 2).join('');
  }

  function placeholderMarkup(profile, dialog = false) {
    const className = dialog ? 'dialog-placeholder' : 'placeholder';
    return `<div class="${className}"><div><strong>${escapeHtml(initials(profile.name))}</strong>${dialog ? '' : '<span>NO PUBLIC PHOTO</span>'}</div></div>`;
  }

  function portraitMarkup(profile, dialog = false) {
    if (!profile.photo) return placeholderMarkup(profile, dialog);
    const position = escapeHtml(profile.photo.position || '50% 22%');
    const imageWidth = dialog ? 1000 : 720;
    return `
      <img
        src="${escapeHtml(photoUrl(profile.photo, imageWidth))}"
        alt="${escapeHtml(profile.name)}の顔写真"
        loading="lazy"
        decoding="async"
        data-photo-for="${escapeHtml(profile.id)}"
        style="object-position:${position}"
      >
      ${dialog ? '' : `<span class="photo-credit-badge">${escapeHtml(profile.photo.license || 'LICENSED')}</span>`}
    `;
  }

  function populateSelects() {
    const places = [...new Set(DATA.map(profile => profile.birthplace).filter(Boolean))]
      .sort((left, right) => collator.compare(left, right));
    elements.birthplaceFilter.insertAdjacentHTML(
      'beforeend',
      places.map(place => `<option value="${escapeHtml(place)}">${escapeHtml(place)}</option>`).join('')
    );

    const knownRanks = DATA.map(profile => cupRank(profile.cup)).filter(Number.isInteger);
    const highestKnownRank = knownRanks.length ? Math.max(...knownRanks) : CUP_LETTERS.indexOf('O');
    const visibleCupLetters = CUP_LETTERS.slice(0, Math.max(highestKnownRank + 1, CUP_LETTERS.indexOf('O') + 1));
    const cupOptions = visibleCupLetters.map(cup => `<option value="${cup}">${cup}カップ</option>`).join('');
    elements.cupMin.insertAdjacentHTML('beforeend', cupOptions);
    elements.cupMax.insertAdjacentHTML('beforeend', cupOptions);
  }

  function currentState() {
    return {
      query: normalize(elements.searchInput.value),
      birthplace: elements.birthplaceFilter.value,
      ageMin: readOptionalNumber(elements.ageMin),
      ageMax: readOptionalNumber(elements.ageMax),
      realNameQuery: normalize(elements.realNameFilter.value),
      heightMin: readOptionalNumber(elements.heightMin),
      heightMax: readOptionalNumber(elements.heightMax),
      cupMin: cupRank(elements.cupMin.value),
      cupMax: cupRank(elements.cupMax.value),
      sort: elements.sortSelect.value,
      realNameOnly: elements.realNameOnly.checked,
      photoOnly: elements.photoOnly.checked
    };
  }

  function matchesRange(value, minimum, maximum) {
    if (minimum === null && maximum === null) return true;
    if (value === null || value === undefined || !Number.isFinite(value)) return false;
    if (minimum !== null && value < minimum) return false;
    if (maximum !== null && value > maximum) return false;
    return true;
  }

  function profileSearchText(profile) {
    return normalize([
      profile.name,
      profile.kana,
      profile.realName,
      profile.birthplace,
      ...(profile.aliases || [])
    ].filter(Boolean).join(' '));
  }

  function filterProfiles(state) {
    return DATA.filter(profile => {
      const age = calculateAge(profile.birthDate);
      const rank = cupRank(profile.cup);

      if (state.query && !profileSearchText(profile).includes(state.query)) return false;
      if (state.birthplace && profile.birthplace !== state.birthplace) return false;
      if (!matchesRange(age, state.ageMin, state.ageMax)) return false;
      if (state.realNameQuery && !normalize(profile.realName).includes(state.realNameQuery)) return false;
      if (!matchesRange(profile.heightCm, state.heightMin, state.heightMax)) return false;
      if (!matchesRange(rank, state.cupMin, state.cupMax)) return false;
      if (state.realNameOnly && !profile.realName) return false;
      if (state.photoOnly && !profile.photo) return false;
      return true;
    });
  }

  function compareNullable(left, right, direction = 1) {
    const leftMissing = left === null || left === undefined || !Number.isFinite(left);
    const rightMissing = right === null || right === undefined || !Number.isFinite(right);
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    return (left - right) * direction;
  }

  function sortProfiles(profiles, sort) {
    const copy = profiles.slice();
    copy.sort((left, right) => {
      let result = 0;
      switch (sort) {
        case 'ageAsc':
          result = compareNullable(calculateAge(left.birthDate), calculateAge(right.birthDate), 1);
          break;
        case 'ageDesc':
          result = compareNullable(calculateAge(left.birthDate), calculateAge(right.birthDate), -1);
          break;
        case 'heightAsc':
          result = compareNullable(left.heightCm, right.heightCm, 1);
          break;
        case 'heightDesc':
          result = compareNullable(left.heightCm, right.heightCm, -1);
          break;
        case 'cupAsc':
          result = compareNullable(cupRank(left.cup), cupRank(right.cup), 1);
          break;
        case 'cupDesc':
          result = compareNullable(cupRank(left.cup), cupRank(right.cup), -1);
          break;
        default:
          result = collator.compare(left.kana || left.name, right.kana || right.name);
      }
      return result || collator.compare(left.kana || left.name, right.kana || right.name);
    });
    return copy;
  }

  function activeFilterTotal(state) {
    return [
      state.birthplace,
      state.ageMin,
      state.ageMax,
      state.realNameQuery,
      state.heightMin,
      state.heightMax,
      state.cupMin,
      state.cupMax,
      state.realNameOnly,
      state.photoOnly
    ].filter(value => value !== '' && value !== null && value !== false).length;
  }

  function cardMarkup(profile) {
    const age = calculateAge(profile.birthDate);
    const ageLabel = age === null ? '—' : `${age}歳`;
    const heightLabel = Number.isFinite(profile.heightCm) ? `${profile.heightCm}cm` : '—';
    const cupLabel = profile.cup ? `${profile.cup}カップ` : '—';
    const aliases = (profile.aliases || []).filter(alias => alias !== profile.realName);
    const aliasLabel = aliases.length ? `別名：${aliases.join('・')}` : '&nbsp;';

    return `
      <article class="profile-card">
        <button class="profile-button" type="button" data-profile-id="${escapeHtml(profile.id)}" aria-label="${escapeHtml(profile.name)}の詳細を開く">
          <div class="portrait">${portraitMarkup(profile)}</div>
          <div class="card-body">
            <div class="card-title-row">
              <div class="card-title">
                <h2>${escapeHtml(profile.name)}</h2>
                <p>${escapeHtml(profile.kana || '')}</p>
              </div>
              <span class="detail-cue" aria-hidden="true">›</span>
            </div>
            <div class="card-stats">
              <div class="stat"><b>${escapeHtml(ageLabel)}</b><span>年齢</span></div>
              <div class="stat"><b>${escapeHtml(heightLabel)}</b><span>身長</span></div>
              <div class="stat"><b>${escapeHtml(cupLabel)}</b><span>カップ</span></div>
            </div>
            <div class="birthplace">出身地：${escapeHtml(profile.birthplace || '—')}</div>
            ${profile.realName ? `<span class="real-name-chip">公表名：${escapeHtml(profile.realName)}</span>` : ''}
            <p class="sr-only">${aliasLabel}</p>
          </div>
        </button>
      </article>
    `;
  }

  function sourceLinks(profile) {
    const sources = Array.isArray(profile.sources) ? profile.sources : [];
    if (!sources.length) return '<span>確認元なし</span>';
    return sources.map(source => `
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label || '確認元')}</a>
    `).join('');
  }

  function dialogMarkup(profile) {
    const age = calculateAge(profile.birthDate);
    const ageLabel = age === null ? '—' : `${age}歳`;
    const aliases = (profile.aliases || []).filter(Boolean);
    const aliasText = aliases.length ? aliases.join('・') : '—';
    const photoCredit = profile.photo ? `
      <p class="photo-credit">
        写真：<a href="${escapeHtml(profile.photo.pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(profile.photo.author)}</a>
        / <a href="${escapeHtml(profile.photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(profile.photo.license)}</a>
        （Wikimedia Commons。表示上のトリミングのみ）
      </p>
    ` : '<p class="photo-credit">再利用条件を確認できる顔写真がないため、プレースホルダーを表示しています。</p>';

    return `
      <div class="dialog-portrait">${portraitMarkup(profile, true)}</div>
      <div class="dialog-body">
        <p class="eyebrow">PUBLIC PROFILE</p>
        <h2>${escapeHtml(profile.name)}</h2>
        <p class="dialog-kana">${escapeHtml(profile.kana || '')}</p>
        <dl class="profile-dl">
          <dt>生年月日</dt><dd>${escapeHtml(formatBirthDate(profile))}</dd>
          <dt>現在の年齢</dt><dd>${escapeHtml(ageLabel)}</dd>
          <dt>出身地</dt><dd>${escapeHtml(profile.birthplace || '—')}</dd>
          <dt>本名</dt><dd>${escapeHtml(profile.realName || '—')}</dd>
          <dt>身長</dt><dd>${Number.isFinite(profile.heightCm) ? `${profile.heightCm}cm` : '—'}</dd>
          <dt>カップ数</dt><dd>${profile.cup ? `${escapeHtml(profile.cup)}カップ` : '—'}</dd>
          <dt>旧芸名・別名</dt><dd>${escapeHtml(aliasText)}</dd>
        </dl>
        ${profile.note ? `<p class="dialog-note">${escapeHtml(profile.note)}</p>` : ''}
        <div class="source-block">
          <h3>プロフィール確認元</h3>
          <div class="source-list">${sourceLinks(profile)}</div>
        </div>
        ${photoCredit}
      </div>
    `;
  }

  function attachImageFallbacks(root = document) {
    root.querySelectorAll('img[data-photo-for]').forEach(image => {
      image.addEventListener('error', () => {
        const profile = DATA.find(item => item.id === image.dataset.photoFor);
        if (!profile) return;
        const container = image.closest('.dialog-portrait, .portrait');
        if (!container) return;
        container.innerHTML = placeholderMarkup(profile, container.classList.contains('dialog-portrait'));
      }, { once: true });
    });
  }

  function render() {
    const state = currentState();
    const profiles = sortProfiles(filterProfiles(state), state.sort);
    const filterCount = activeFilterTotal(state);

    elements.activeFilterCount.textContent = String(filterCount);
    elements.activeFilterCount.hidden = filterCount === 0;
    elements.resultCount.textContent = String(profiles.length);
    elements.dataCount.textContent = `全${DATA.length}名 / 更新 ${formatUpdatedAt(META.updatedAt)}`;

    elements.profileGrid.innerHTML = profiles.length
      ? profiles.map(cardMarkup).join('')
      : '<div class="empty-state"><strong>該当する人物がいません</strong><span>条件を少し広げるか、リセットしてください。</span></div>';

    attachImageFallbacks(elements.profileGrid);
    hasRendered = true;
  }

  function openProfile(profileId) {
    const profile = DATA.find(item => item.id === profileId);
    if (!profile) return;
    elements.dialogContent.innerHTML = dialogMarkup(profile);
    attachImageFallbacks(elements.dialogContent);
    if (typeof elements.profileDialog.showModal === 'function') {
      elements.profileDialog.showModal();
    } else {
      elements.profileDialog.setAttribute('open', '');
    }
  }

  function closeDialog() {
    if (typeof elements.profileDialog.close === 'function') {
      elements.profileDialog.close();
    } else {
      elements.profileDialog.removeAttribute('open');
    }
  }

  function resetFilters() {
    elements.searchInput.value = '';
    elements.birthplaceFilter.value = '';
    elements.ageMin.value = '';
    elements.ageMax.value = '';
    elements.realNameFilter.value = '';
    elements.heightMin.value = '';
    elements.heightMax.value = '';
    elements.cupMin.value = '';
    elements.cupMax.value = '';
    elements.sortSelect.value = 'name';
    elements.realNameOnly.checked = false;
    elements.photoOnly.checked = false;
    render();
    elements.searchInput.focus({ preventScroll: true });
  }

  function unlockDirectory() {
    document.body.classList.remove('gated');
    elements.ageGate.hidden = true;
    elements.mainContent.setAttribute('aria-hidden', 'false');
    if (!hasRendered) render();
  }

  function hasAgeConfirmation() {
    try {
      return localStorage.getItem(AGE_GATE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function storeAgeConfirmation() {
    try {
      localStorage.setItem(AGE_GATE_KEY, '1');
    } catch (_) {
      // Private browsing or storage restrictions should not block access after confirmation.
    }
  }

  function bindEvents() {
    elements.filterPanel.addEventListener('submit', event => event.preventDefault());

    const rerenderOnInput = [
      elements.searchInput,
      elements.ageMin,
      elements.ageMax,
      elements.realNameFilter,
      elements.heightMin,
      elements.heightMax
    ];
    rerenderOnInput.forEach(input => input.addEventListener('input', render));

    const rerenderOnChange = [
      elements.birthplaceFilter,
      elements.cupMin,
      elements.cupMax,
      elements.sortSelect,
      elements.realNameOnly,
      elements.photoOnly
    ];
    rerenderOnChange.forEach(input => input.addEventListener('change', render));

    elements.filterToggle.addEventListener('click', () => {
      const willOpen = elements.filterPanel.hidden;
      elements.filterPanel.hidden = !willOpen;
      elements.filterToggle.setAttribute('aria-expanded', String(willOpen));
    });

    elements.resetButton.addEventListener('click', resetFilters);

    elements.profileGrid.addEventListener('click', event => {
      const button = event.target.closest('[data-profile-id]');
      if (button) openProfile(button.dataset.profileId);
    });

    elements.dialogClose.addEventListener('click', closeDialog);
    elements.profileDialog.addEventListener('click', event => {
      if (event.target !== elements.profileDialog) return;
      const rect = elements.profileDialog.getBoundingClientRect();
      const clickedInside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!clickedInside) closeDialog();
    });

    elements.enterButton.addEventListener('click', () => {
      storeAgeConfirmation();
      unlockDirectory();
    });
  }

  function init() {
    populateSelects();
    bindEvents();

    if (!DATA.length) {
      elements.profileGrid.innerHTML = '<div class="empty-state"><strong>データを読み込めませんでした</strong><span>ページを再読み込みしてください。</span></div>';
    }

    if (hasAgeConfirmation()) unlockDirectory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
