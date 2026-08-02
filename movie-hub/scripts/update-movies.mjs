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

const listPaths = ['/movie/popular?page=1&region=JP','/movie/popular?page=2&region=JP','/movie/top_rated?page=1&region=JP','/movie/now_playing?page=1&region=JP','/movie/upcoming?page=1&region=JP'];
const lists = await Promise.all(listPaths.map(get));
const unique = new Map();
lists.flatMap(v => v.results || []).forEach(movie => unique.set(movie.id, movie));
const candidates = [...unique.values()].sort((a,b) => b.popularity-a.popularity).slice(0,60);

const image = path => path ? `https://image.tmdb.org/t/p/w500${path}` : '';
const providerGroup = group => (group || []).map(v => ({ id:v.provider_id, name:v.provider_name, logo:image(v.logo_path) }));

const movies = [];
for (let index=0; index<candidates.length; index+=1) {
  const movie = candidates[index];
  const [detail, providers, credits, videos, recommendations] = await Promise.all([
    get(`/movie/${movie.id}?append_to_response=release_dates&region=JP`),
    get(`/movie/${movie.id}/watch/providers`),
    get(`/movie/${movie.id}/credits`),
    get(`/movie/${movie.id}/videos`),
    get(`/movie/${movie.id}/recommendations?page=1`)
  ]);
  const jp = providers.results?.JP || {};
  const director = (credits.crew || []).find(v => v.job === 'Director');
  const trailer = (videos.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) || (videos.results || []).find(v => v.site === 'YouTube');
  movies.push({
    id:String(movie.id), rank:index+1, title:detail.title || movie.title, subtitle:detail.original_title || '',
    year:(detail.release_date || '').slice(0,4), releaseDate:detail.release_date || '', rating:Number(detail.vote_average || 0),
    voteCount:Number(detail.vote_count || 0), popularity:Number(detail.popularity || 0), runtime:Number(detail.runtime || 0),
    image:image(detail.poster_path), backdrop:image(detail.backdrop_path), genres:(detail.genres || []).map(v=>v.name),
    overview:detail.overview || '', director:director?.name || '', cast:(credits.cast || []).slice(0,8).map(v=>({name:v.name,character:v.character,profile:image(v.profile_path)})),
    providers:{ flatrate:providerGroup(jp.flatrate), rent:providerGroup(jp.rent), buy:providerGroup(jp.buy), link:jp.link || '' },
    providerNames:[...new Set([...providerGroup(jp.flatrate),...providerGroup(jp.rent),...providerGroup(jp.buy)].map(v=>v.name))],
    trailerUrl:trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '',
    recommendations:(recommendations.results || []).slice(0,6).map(v=>({id:String(v.id),title:v.title,image:image(v.poster_path),rating:Number(v.vote_average||0)})),
    source:'TMDb', sourceUrl:`https://www.themoviedb.org/movie/${movie.id}`
  });
}

await mkdir(new URL('../data/', import.meta.url), { recursive:true });
await writeFile(new URL('../data/movie-data.json', import.meta.url), JSON.stringify({ version:2, generatedAt:new Date().toISOString(), region:'JP', attribution:{tmdb:'This product uses the TMDB API but is not endorsed or certified by TMDB.',watchProviders:'Streaming availability provided by JustWatch via TMDb.'}, movies }, null, 2));
console.log(`wrote ${movies.length} movies`);
