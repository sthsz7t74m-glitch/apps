import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.TMDB_READ_ACCESS_TOKEN;
const apiKey = process.env.TMDB_API_KEY;
if (!token && !apiKey) throw new Error('TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY is required');

const base = 'https://api.themoviedb.org/3';
const headers = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
const auth = apiKey && !token ? `&api_key=${encodeURIComponent(apiKey)}` : '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(path, attempt = 0) {
  const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}language=ja-JP${auth}`, { headers });
  if (response.status === 429 && attempt < 5) {
    await sleep((attempt + 1) * 1500);
    return get(path, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

const MIN_VOTES = 500;
const MAX_CATALOG = 6000;
const ENRICH_LIMIT = 350;
const PAGES_PER_WINDOW = 30;
const currentYear = new Date().getUTCFullYear();
const image = path => path ? `https://image.tmdb.org/t/p/w500${path}` : '';
const providerGroup = group => (group || []).map(value => ({ id: value.provider_id, name: value.provider_name, logo: image(value.logo_path) }));

const genrePayload = await get('/genre/movie/list');
const genreMap = new Map((genrePayload.genres || []).map(genre => [genre.id, genre.name]));
const windows = [
  [1900, 1949], [1950, 1959], [1960, 1969], [1970, 1979], [1980, 1989],
  [1990, 1999], [2000, 2009], [2010, 2014], [2015, 2019], [2020, currentYear]
];

const unique = new Map();
for (const [from, to] of windows) {
  for (let page = 1; page <= PAGES_PER_WINDOW; page += 1) {
    const path = `/discover/movie?include_adult=false&include_video=false&page=${page}&region=JP&sort_by=vote_count.desc&vote_count.gte=${MIN_VOTES}&primary_release_date.gte=${from}-01-01&primary_release_date.lte=${to}-12-31`;
    const payload = await get(path);
    for (const movie of payload.results || []) {
      const current = unique.get(movie.id);
      if (!current || Number(movie.vote_count || 0) > Number(current.vote_count || 0)) unique.set(movie.id, movie);
    }
    if (page >= Number(payload.total_pages || 1)) break;
    await sleep(45);
  }
}

const ranked = [...unique.values()]
  .filter(movie => Number(movie.vote_count || 0) >= MIN_VOTES)
  .sort((left, right) => Number(right.popularity || 0) - Number(left.popularity || 0)
    || Number(right.vote_count || 0) - Number(left.vote_count || 0))
  .slice(0, MAX_CATALOG);

const catalog = ranked.map((movie, index) => ({
  id: String(movie.id),
  rank: index + 1,
  title: movie.title || movie.original_title || '',
  subtitle: movie.original_title || '',
  year: String(movie.release_date || '').slice(0, 4),
  releaseDate: movie.release_date || '',
  rating: Number(movie.vote_average || 0),
  voteCount: Number(movie.vote_count || 0),
  popularity: Number(movie.popularity || 0),
  runtime: 0,
  image: image(movie.poster_path),
  backdrop: image(movie.backdrop_path),
  genres: (movie.genre_ids || []).map(id => genreMap.get(id)).filter(Boolean),
  overview: movie.overview || '',
  director: '',
  cast: [],
  providers: { flatrate: [], rent: [], buy: [], link: '' },
  providerNames: [],
  trailerUrl: '',
  recommendations: [],
  enriched: false,
  source: 'TMDb',
  sourceUrl: `https://www.themoviedb.org/movie/${movie.id}`
}));

const byId = new Map(catalog.map(movie => [movie.id, movie]));
for (let index = 0; index < Math.min(ENRICH_LIMIT, catalog.length); index += 1) {
  const movie = catalog[index];
  try {
    const detail = await get(`/movie/${movie.id}?append_to_response=credits,videos,recommendations,release_dates,watch/providers&region=JP`);
    const credits = detail.credits || {};
    const videos = detail.videos || {};
    const recommendations = detail.recommendations || {};
    const watchProviders = detail['watch/providers'] || {};
    const jp = watchProviders.results?.JP || {};
    const director = (credits.crew || []).find(value => value.job === 'Director');
    const trailer = (videos.results || []).find(value => value.site === 'YouTube' && value.type === 'Trailer' && value.official)
      || (videos.results || []).find(value => value.site === 'YouTube');
    const flatrate = providerGroup(jp.flatrate);
    const rent = providerGroup(jp.rent);
    const buy = providerGroup(jp.buy);
    byId.set(movie.id, {
      ...movie,
      title: detail.title || movie.title,
      subtitle: detail.original_title || movie.subtitle,
      year: String(detail.release_date || movie.releaseDate).slice(0, 4),
      releaseDate: detail.release_date || movie.releaseDate,
      rating: Number(detail.vote_average || movie.rating),
      voteCount: Number(detail.vote_count || movie.voteCount),
      popularity: Number(detail.popularity || movie.popularity),
      runtime: Number(detail.runtime || 0),
      image: image(detail.poster_path) || movie.image,
      backdrop: image(detail.backdrop_path) || movie.backdrop,
      genres: (detail.genres || []).map(value => value.name),
      overview: detail.overview || movie.overview,
      director: director?.name || '',
      cast: (credits.cast || []).slice(0, 8).map(value => ({ name: value.name, character: value.character, profile: image(value.profile_path) })),
      providers: { flatrate, rent, buy, link: jp.link || '' },
      providerNames: [...new Set([...flatrate, ...rent, ...buy].map(value => value.name))],
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '',
      recommendations: (recommendations.results || []).slice(0, 6).map(value => ({ id: String(value.id), title: value.title, image: image(value.poster_path), rating: Number(value.vote_average || 0) })),
      enriched: true
    });
  } catch (error) {
    console.warn(`enrichment failed for ${movie.id}: ${error.message}`);
  }
  await sleep(75);
}

const movies = catalog.map(movie => byId.get(movie.id) || movie);
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/movie-data.json', import.meta.url), JSON.stringify({
  version: 4,
  generatedAt: new Date().toISOString(),
  region: 'JP',
  minimumVotes: MIN_VOTES,
  movieCount: movies.length,
  enrichedCount: movies.filter(movie => movie.enriched).length,
  acquisition: {
    method: 'TMDb Discover API split by release-year windows',
    windows,
    pagesPerWindow: PAGES_PER_WINDOW,
    maximumCatalogSize: MAX_CATALOG,
    enrichmentLimit: ENRICH_LIMIT
  },
  attribution: {
    tmdb: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    watchProviders: 'Streaming availability provided by JustWatch via TMDb.'
  },
  movies
}, null, 2));
console.log(`wrote ${movies.length} movies; enriched ${movies.filter(movie => movie.enriched).length}`);
