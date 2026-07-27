(() => {
  'use strict';
  const seeds = [];
  const byName = new Map((window.AV_ACTRESSES || []).map(profile => [String(profile.name || '').normalize('NFKC'), profile]));
  seeds.forEach(seed => {
    const profile = byName.get(String(seed.name || '').normalize('NFKC'));
    if (!profile) return;
    if (seed.performerType) profile.performerType = seed.performerType;
    if (seed.agency && !(profile.agencies || []).includes(seed.agency)) profile.agencies = [...(profile.agencies || []), seed.agency];
    if (seed.source) profile.sources = [...(profile.sources || []), seed.source];
  });
})();
