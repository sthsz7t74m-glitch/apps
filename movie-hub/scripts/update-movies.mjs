import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.TMDB_READ_ACCESS_TOKEN;
const apiKey = process.env.TMDB_API_KEY;
if (!token && !apiKey) throw new Error('TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY is required');

const base = 'https://api.themoviedb.org/3';
const headers = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
const auth = apiKey && !token ? `&api_key=${encodeURIComponent(apiKey)}` : '';
const get = async path => {
  const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}language=ja-JP${auth}`, { headers });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
};

const MIN_VOTES = 500;
const MAX_MOVIES = 180;
const listPaths = [
  ...Array.from({ length: 8 }, (_, index) => `/movie/popular?page=${index + 1}&region=JP`),
  ...Array.from({ length: 5 }, (_, index) => `/movie/top_rated?page=${index + 1}&region=JP`),
  ...Array.from({ length: 3 }, (_, index) => `/movie/now_playing?page=${index + 1}&region=JP`),
  ...Array.from({ length: 3 }, (_, index) => `/movie/upcoming?page=${index + 1}&region=JP`)
];
const lists = await Promise.all(listPaths.map(get));
const unique = new Map();
lists.flatMap(value => value.results || []).forEach(movie => {
  const current = unique.get(movie.id);
  if (!current || Number(movie.popularity || 0) > Number(current.popularity || 0)) unique.set(movie.id, movie);
});
const candidates = [...unique.values()]
  .filter(movie => Number(movie.vote_count || 0) >= MIN_VOTES)
  .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0))
  .slice(0, MAX_MOVIES);

const image = path => path ? `https://image.tmdb.org/t/p/w500${path}` : '';
const providerGroup = group => (group || []).map(value => ({ id: value.provider_id, name: value.provider_name, logo: image(value.logo_path) }));

const movies = [];
for (let index = 0; index < candidates.length; index += 1) {
  const movie = candidates[index];
  const [detail, providers, credits, videos, recommendations] = await Promise.all([
    get(`/movie/${movie.id}?append_to_response=release_dates&region=JP`),
    get(`/movie/${movie.id}/watch/providers`),
    get(`/movie/${movie.id}/credits`),
    get(`/movie/${movie.id}/videos`),
    get(`/movie/${movie.id}/recommendations?page=1`)
  ]);
  if (Number(detail.vote_count || 0) < MIN_VOTES) continue;
  const jp = providers.results?.JP || {};
  const director = (credits.crew || []).find(value => value.job === 'Director');
  const trailer = (videos.results || []).find(value => value.site === 'YouTube' && value.type === 'Trailer' && value.official)
    || (videos.results || []).find(value => value.site === 'YouTube');
  movies.push({
    id: String(movie.id),
    rank: movies.length + 1,
    title: detail.title || movie.title,
    subtitle: detail.original_title || '',
    year: (detail.release_date || '').slice(0, 4),
    releaseDate: detail.release_date || '',
    rating: Number(detail.vote_average || 0),
    voteCount: Number(detail.vote_count || 0),
    popularity: Number(detail.popularity || 0),
    runtime: Number(detail.runtime || 0),
    image: image(detail.poster_path),
    backdrop: image(detail.backdrop_path),
    genres: (detail.genres || []).map(value => value.name),
    overview: detail.overview || '',
    director: director?.name || '',
    cast: (credits.cast || []).slice(0, 8).map(value => ({ name: value.name, character: value.character, profile: image(value.profile_path) })),
    providers: {
      flatrate: providerGroup(jp.flatrate),
      rent: providerGroup(jp.rent),
      buy: providerGroup(jp.buy),
      link: jp.link || ''
    },
    providerNames: [...new Set([
      ...providerGroup(jp.flatrate),
      ...providerGroup(jp.rent),
      ...providerGroup(jp.buy)
    ].map(value => value.name))],
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '',
    recommendations: (recommendations.results || []).slice(0, 6).map(value => ({
      id: String(value.id),
      title: value.title,
      image: image(value.poster_path),
      rating: Number(value.vote_average || 0)
    })),
    source: 'TMDb',
    sourceUrl: `https://www.themoviedb.org/movie/${movie.id}`
  });
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/movie-data.json', import.meta.url), JSON.stringify({
  version: 3,
  generatedAt: new Date().toISOString(),
  region: 'JP',
  minimumVotes: MIN_VOTES,
  candidateCount: unique.size,
  movieCount: movies.length,
  attribution: {
    tmdb: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    watchProviders: 'Streaming availability provided by JustWatch via TMDb.'
  },
  movies
}, null, 2));
console.log(`wrote ${movies.length} movies from ${unique.size} candidates (minimum ${MIN_VOTES} votes)`);
