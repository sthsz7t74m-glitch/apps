(() => {
  'use strict';
  const profiles = Array.isArray(window.AV_ACTRESSES) ? window.AV_ACTRESSES : [];
  const byId = new Map(profiles.map(profile => [String(profile.id), profile]));
  const grid = document.getElementById('profileGrid');
  const filterGrid = document.querySelector('.filter-grid');
  const resetButton = document.getElementById('resetButton');
  const resultCount = document.getElementById('resultCount');
  const dialogContent = document.getElementById('dialogContent');
  if (!grid || !filterGrid) return;

  const agencies = [...new Set(profiles.flatMap(profile => profile.agencies || []).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ja'));
  const types = [...new Set(profiles.map(profile => profile.performerType).filter(Boolean))];

  const agencyLabel = document.createElement('label');
  agencyLabel.className = 'field';
  agencyLabel.innerHTML = `<span>所属</span><select id="agencyFilter"><option value="">すべて</option><option value="__known__">所属あり</option><option value="__unknown__">所属不明</option>${agencies.map(agency => `<option value="${escapeHtml(agency)}">${escapeHtml(agency)}</option>`).join('')}</select>`;

  const typeLabel = document.createElement('label');
  typeLabel.className = 'field';
  typeLabel.innerHTML = `<span>区分</span><select id="performerTypeFilter"><option value="">すべて</option>${types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}</select>`;

  filterGrid.prepend(typeLabel);
  filterGrid.prepend(agencyLabel);
  const agencyFilter = document.getElementById('agencyFilter');
  const performerTypeFilter = document.getElementById('performerTypeFilter');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function matches(profile) {
    const selectedAgency = agencyFilter.value;
    const selectedType = performerTypeFilter.value;
    const profileAgencies = profile.agencies || [];
    if (selectedAgency === '__known__' && !profileAgencies.length) return false;
    if (selectedAgency === '__unknown__' && profileAgencies.length) return false;
    if (selectedAgency && !selectedAgency.startsWith('__') && !profileAgencies.includes(selectedAgency)) return false;
    if (selectedType && profile.performerType !== selectedType) return false;
    return true;
  }

  function decorateCard(card, profile) {
    const body = card.querySelector('.card-body');
    if (!body || body.querySelector('.classification-row')) return;
    const row = document.createElement('div');
    row.className = 'classification-row';
    const agency = (profile.agencies || [])[0] || '所属不明';
    row.innerHTML = `<span class="class-chip">${escapeHtml(profile.performerType || '区分不明')}</span><span class="agency-chip" title="${escapeHtml((profile.agencies || []).join('・'))}">${escapeHtml(agency)}</span>`;
    body.appendChild(row);
  }

  function applyFilters() {
    let visible = 0;
    grid.querySelectorAll('.profile-card').forEach(card => {
      const button = card.querySelector('[data-profile-id]');
      const profile = button ? byId.get(String(button.dataset.profileId)) : null;
      if (!profile) return;
      decorateCard(card, profile);
      const show = matches(profile);
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (resultCount) resultCount.textContent = String(visible);
  }

  function decorateDialog() {
    const heading = dialogContent?.querySelector('h2');
    if (!heading) return;
    const profile = profiles.find(item => item.name === heading.textContent.trim());
    const dl = dialogContent.querySelector('.profile-dl');
    if (!profile || !dl || dl.querySelector('[data-extra-profile]')) return;
    const dtType = document.createElement('dt');
    dtType.dataset.extraProfile = '1';
    dtType.textContent = '区分';
    const ddType = document.createElement('dd');
    ddType.textContent = profile.performerType || '区分不明';
    const dtAgency = document.createElement('dt');
    dtAgency.textContent = '所属';
    const ddAgency = document.createElement('dd');
    ddAgency.textContent = (profile.agencies || []).join('・') || '—';
    dl.append(dtType, ddType, dtAgency, ddAgency);
  }

  agencyFilter.addEventListener('change', applyFilters);
  performerTypeFilter.addEventListener('change', applyFilters);
  resetButton?.addEventListener('click', () => {
    agencyFilter.value = '';
    performerTypeFilter.value = '';
    setTimeout(applyFilters, 0);
  });

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFilters();
      decorateDialog();
    });
  });
  observer.observe(grid, { childList: true, subtree: true });
  if (dialogContent) observer.observe(dialogContent, { childList: true, subtree: true });
  applyFilters();
})();
