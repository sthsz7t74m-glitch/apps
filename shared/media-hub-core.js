window.MediaHub = window.MediaHub || {};

(function initMediaHub(namespace) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const formatCount = value => {
    const count = Number(value || 0);
    if (!count) return '評価なし';
    return `${new Intl.NumberFormat('ja-JP').format(count)}件`;
  };

  class MediaItem {
    constructor(data = {}) {
      Object.assign(this, {
        id: '', title: '', subtitle: '', image: '', year: '', rating: 0,
        voteCount: 0, popularity: 0, genres: [], overview: '', source: '', sourceUrl: '',
        runtime: 0, providers: [], releaseDate: '', rank: 0
      }, data);
      this.id = String(this.id || this.title);
      this.rating = Number(this.rating || 0);
      this.voteCount = Number(this.voteCount || 0);
      this.popularity = Number(this.popularity || 0);
      this.runtime = Number(this.runtime || 0);
      this.genres = Array.isArray(this.genres) ? this.genres : [];
      this.providers = Array.isArray(this.providers) ? this.providers : [];
    }
  }

  class MediaProvider {
    constructor({ id, label, description, url } = {}) {
      this.id = id || 'provider';
      this.label = label || this.id;
      this.description = description || '';
      this.url = url || '';
    }
    async fetchItems() { return []; }
  }

  class StaticMediaProvider extends MediaProvider {
    constructor(options = {}) { super(options); this.items = options.items || []; }
    async fetchItems() { return this.items.map(item => new MediaItem(item)); }
  }

  class MediaFilterService {
    execute(items = [], state = {}) {
      const query = String(state.query || '').trim().toLocaleLowerCase('ja');
      const genre = String(state.genre || 'all');
      const provider = String(state.provider || 'all');
      const minimumRating = Number(state.minimumRating || 0);
      let result = [...items].filter(item => {
        const haystack = [item.title, item.subtitle, item.overview, ...item.genres].join(' ').toLocaleLowerCase('ja');
        return (!query || haystack.includes(query))
          && (genre === 'all' || item.genres.includes(genre))
          && (provider === 'all' || item.providers.includes(provider))
          && item.rating >= minimumRating;
      });
      const sort = state.sort || 'rank';
      result.sort((a, b) => {
        if (sort === 'rating') return b.rating - a.rating || b.voteCount - a.voteCount || b.popularity - a.popularity;
        if (sort === 'new') return String(b.releaseDate).localeCompare(String(a.releaseDate));
        if (sort === 'runtime') return a.runtime - b.runtime;
        if (sort === 'title') return a.title.localeCompare(b.title, 'ja');
        return (a.rank || 9999) - (b.rank || 9999) || b.popularity - a.popularity;
      });
      return result;
    }
  }

  class FavoriteService {
    constructor(key = 'mediaHubFavorites') { this.key = key; this.values = new Set(this.load()); }
    load() { try { return JSON.parse(localStorage.getItem(this.key) || '[]').map(String); } catch { return []; } }
    save() { localStorage.setItem(this.key, JSON.stringify([...this.values])); }
    has(id) { return this.values.has(String(id)); }
    toggle(id) { const key = String(id); this.has(key) ? this.values.delete(key) : this.values.add(key); this.save(); return this.has(key); }
  }

  class MediaCard {
    render(item, { favorite = false } = {}) {
      const image = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">`
        : `<span class="media-card__fallback">🎬</span>`;
      return `<article class="media-card" data-media-id="${escapeHtml(item.id)}">
        <button class="media-card__main" type="button" data-open-media="${escapeHtml(item.id)}">
          <span class="media-card__poster">${image}<b>#${escapeHtml(item.rank || '—')}</b></span>
          <span class="media-card__body">
            <small>${escapeHtml(item.year || '')}${item.runtime ? `・${item.runtime}分` : ''}</small>
            <strong>${escapeHtml(item.title)}</strong>
            ${item.subtitle ? `<span class="media-card__subtitle">${escapeHtml(item.subtitle)}</span>` : ''}
            <span class="media-card__genres">${item.genres.slice(0, 3).map(g => `<i>${escapeHtml(g)}</i>`).join('')}</span>
            <span class="media-card__score"><b>★ ${item.rating.toFixed(1)}</b><em>${formatCount(item.voteCount)}の評価</em></span>
          </span>
        </button>
        <button class="media-card__favorite${favorite ? ' active' : ''}" type="button" data-favorite-media="${escapeHtml(item.id)}" aria-label="お気に入り">${favorite ? '★' : '☆'}</button>
      </article>`;
    }
  }

  Object.assign(namespace, {
    escapeHtml, formatCount, MediaItem, MediaProvider, StaticMediaProvider,
    MediaFilterService, FavoriteService, MediaCard
  });
})(window.MediaHub);
