(() => {
  'use strict';

  const metrics = [
    { id: 'importantCount', action: 'consensus', label: '重要ニュースを開く' },
    { id: 'readMinutes', action: 'news', label: 'ニュース一覧へ移動' },
    { id: 'sourceCount', action: 'settings', label: 'データソースを確認' }
  ];

  function activateTab(name) {
    const button = document.querySelector(`.tab[data-tab="${CSS.escape(name)}"]`);
    if (!button) return false;
    button.click();
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    return true;
  }

  function run(action) {
    if (action === 'consensus') {
      activateTab('consensus');
      document.querySelector('#consensusSpotlight')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (action === 'settings') {
      document.querySelector('#settingsBtn')?.click();
      return;
    }
    document.querySelector('#newsToolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  metrics.forEach(config => {
    const value = document.querySelector(`#${config.id}`);
    const card = value?.closest('.metric');
    if (!card) return;
    card.dataset.digestAction = config.action;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', config.label);
    card.addEventListener('click', () => run(config.action));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        run(config.action);
      }
    });
  });
})();
