(() => {
  'use strict';
  const profiles = Array.isArray(window.AV_ACTRESSES) ? window.AV_ACTRESSES : [];
  const amateurPattern = /(素人|一般応募|ナンパ|街角|シロウト|しろうと)/i;
  profiles.forEach(profile => {
    const agencies = [...new Set([...(profile.agencies || []), profile.agency].filter(Boolean))];
    profile.agencies = agencies;
    const sourceText = (profile.sources || []).map(source => `${source.label || ''} ${source.url || ''}`).join(' ');
    const clueText = `${profile.note || ''} ${sourceText}`;
    if (!profile.performerType) {
      profile.performerType = amateurPattern.test(clueText)
        ? '素人系'
        : agencies.length || profile.rosterVerified
          ? '事務所所属'
          : '区分不明';
    }
    profile.affiliationStatus = agencies.length ? '所属あり' : '所属不明';
  });
  window.AV_DIRECTORY_META = {
    ...(window.AV_DIRECTORY_META || {}),
    version: '1.3.0',
    categoryPolicy: '素人系は公開資料上で明示された場合のみ分類。推測分類はしない。'
  };
})();
