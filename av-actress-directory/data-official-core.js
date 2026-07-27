(() => {
  'use strict';
  window.AV_OFFICIAL_ROSTERS = window.AV_OFFICIAL_ROSTERS || [];
  window.AV_OFFICIAL_DETAILS = window.AV_OFFICIAL_DETAILS || [];
  window.AV_OFFICIAL_FINALIZE = () => {
    const base = Array.isArray(window.AV_ACTRESSES) ? window.AV_ACTRESSES : [];
    const rosters = window.AV_OFFICIAL_ROSTERS || [];
    const details = window.AV_OFFICIAL_DETAILS || [];
    const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s・･._\-‐‑‒–—―()（）［］\[\]]/g, '');
    const cleanName = value => String(value ?? '').replace(/[\s　]+/g, '').trim();
    const unique = values => [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
    const sources = (left, right) => {
      const seen = new Set();
      return [...(left || []), ...(right || [])].filter(item => {
        const key = `${item?.url || ''}|${item?.label || ''}`;
        if (!item || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const slug = value => {
      const normalized = normalize(value);
      const ascii = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return ascii || [...normalized].map(char => char.codePointAt(0).toString(16)).join('-');
    };
    const map = new Map();
    base.forEach((profile, index) => {
      const key = normalize(profile.name);
      if (!key) return;
      map.set(key, {
        ...profile,
        id: profile.id || `base-${index + 1}`,
        agencies: unique([...(profile.agencies || []), profile.agency]),
        dataTier: profile.dataTier || (String(profile.note || '').includes('参考情報') ? 'reference' : 'curated')
      });
    });
    rosters.forEach(roster => roster.names.forEach((rawName, index) => {
      const name = cleanName(rawName);
      const key = normalize(name);
      if (!key) return;
      const source = { label: `${roster.agency} 公式在籍一覧`, url: roster.url };
      const current = map.get(key);
      if (current) {
        map.set(key, {
          ...current,
          agency: current.agency || roster.agency,
          agencies: unique([...(current.agencies || []), current.agency, roster.agency]),
          rosterVerified: true,
          sources: sources(current.sources, [source])
        });
        return;
      }
      map.set(key, {
        id: `official-${slug(roster.agency)}-${index + 1}-${slug(name)}`,
        name, kana: null, aliases: [], birthDate: null, birthplace: null,
        realName: null, heightCm: null, cup: null,
        note: `${roster.agency}公式在籍一覧で掲載を確認。プロフィール数値は未収録です。`,
        agency: roster.agency, agencies: [roster.agency], rosterVerified: true,
        dataTier: 'roster', sources: [source]
      });
    }));
    details.forEach(detail => {
      const name = cleanName(detail.name);
      const key = normalize(name);
      if (!key) return;
      const current = map.get(key) || { id: `official-profile-${slug(name)}`, name, aliases: [], sources: [] };
      const source = { label: `${detail.agency} 公式プロフィール`, url: detail.profileUrl };
      const merged = {
        ...current,
        name: current.name || name,
        agency: detail.agency,
        agencies: unique([...(current.agencies || []), current.agency, detail.agency]),
        rosterVerified: true,
        dataTier: 'official',
        sources: sources(current.sources, [source]),
        note: `${detail.agency}公式プロフィールの公称値を反映しています。`
      };
      ['kana','birthDate','birthdayLabel','birthplace','bloodType','cup','hobbies','skills'].forEach(field => {
        if (detail[field] !== null && detail[field] !== undefined && detail[field] !== '') merged[field] = detail[field];
      });
      ['heightCm','bustCm','waistCm','hipCm'].forEach(field => {
        if (Number.isFinite(detail[field])) merged[field] = detail[field];
      });
      map.set(key, merged);
    });
    window.AV_ACTRESSES = [...map.values()];
    window.AV_DIRECTORY_META = {
      ...(window.AV_DIRECTORY_META || {}), version: '1.2.0', updatedAt: '2026-07-27',
      officialRosterSources: rosters.length,
      officialRosterNames: rosters.reduce((sum, roster) => sum + roster.names.length, 0),
      officialProfileDetails: details.length,
      dataPolicy: '公式プロフィール・公式在籍一覧・確認済み資料・参考情報を区別して併載。本名は公表済み情報だけを掲載。'
    };
    delete window.AV_OFFICIAL_ROSTERS;
    delete window.AV_OFFICIAL_DETAILS;
    delete window.AV_OFFICIAL_FINALIZE;
  };
})();
