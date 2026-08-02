(() => {
  'use strict';
  const { MediaItem, MediaProvider, MediaFilterService, FavoriteService, MediaCard, escapeHtml, formatCount } = window.MediaHub;

  class MovieDataProvider extends MediaProvider {
    constructor(){ super({id:'tmdb',label:'TMDb実データ'}); }
    async fetchItems(){
      const response = await fetch(`./data/movie-data.json?v=${Math.floor(Date.now()/1800000)}`, { cache:'default' });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return (payload.movies || []).map(movie => new MediaItem({ ...movie, providers:movie.providerNames || [], providerGroups:movie.providers || {}, source:'TMDb' }));
    }
  }

  class MovieCard extends MediaCard {
    render(item,{favorite=false}={}){
      const base = super.render(item,{favorite});
      const flat = item.providerGroups?.flatrate || [];
      const tags = flat.slice(0,3).map(v=>`<span class="watch-tag watch-tag--flat">見放題 ${escapeHtml(v.name)}</span>`).join('');
      if(!tags) return base;
      return base.replace('</span>\n        </button>', `<span class="watch-tags">${tags}</span></span>\n        </button>`);
    }
  }

  const fallback = [
    {id:'sample-1',rank:1,title:'データ取得準備中',subtitle:'GitHub Actions実行後にTMDb実データへ切替',year:'',rating:0,voteCount:0,popularity:0,runtime:0,genres:['準備中'],overview:'Actionsの Update Movie Hub data を手動実行してください。',providers:[],providerGroups:{},source:'待機中'}
  ].map(v=>new MediaItem(v));

  const provider = new MovieDataProvider();
  const filterService = new MediaFilterService();
  const favorites = new FavoriteService('movieHubFavoritesV2');
  const card = new MovieCard();
  const state = { items:[], query:'', genre:'all', provider:'all', minimumRating:0, sort:'rank' };
  const nodes = { list:document.querySelector('#movieList'), count:document.querySelector('#resultCount'), search:document.querySelector('#searchInput'), genre:document.querySelector('#genreSelect'), provider:document.querySelector('#providerSelect'), rating:document.querySelector('#ratingSelect'), sort:document.querySelector('#sortSelect'), detail:document.querySelector('#detailDialog'), detailContent:document.querySelector('#detailContent'), source:document.querySelector('#sourceDialog'), status:document.querySelector('#dataStatus') };

  function buildOptions(){
    const genres=[...new Set(state.items.flatMap(v=>v.genres))].sort((a,b)=>a.localeCompare(b,'ja'));
    const providers=[...new Set(state.items.flatMap(v=>v.providers))].sort((a,b)=>a.localeCompare(b,'ja'));
    nodes.genre.innerHTML='<option value="all">すべて</option>'+genres.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
    nodes.provider.innerHTML='<option value="all">すべて</option>'+providers.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
  }
  function render(){
    const items=filterService.execute(state.items,state); nodes.count.textContent=`${items.length}本`;
    nodes.list.innerHTML=items.length?items.map(v=>card.render(v,{favorite:favorites.has(v.id)})).join(''):'<p class="empty">条件に合う映画がありません。</p>';
  }
  const group=(title,items,type)=>items?.length?`<article><strong>${title}</strong><div class="provider-tags">${items.map(v=>`<span class="watch-tag watch-tag--${type}">${escapeHtml(v.name)}</span>`).join('')}</div></article>`:'';
  function openDetail(id){
    const item=state.items.find(v=>v.id===String(id)); if(!item)return;
    const pg=item.providerGroups||{};
    nodes.detailContent.innerHTML=`<div class="detail-head"><span class="media-card__poster detail-poster">${item.image?`<img src="${escapeHtml(item.image)}" alt="">`:'<span class="media-card__fallback">🎬</span>'}</span><div><small>${escapeHtml(item.year)}</small><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle)}</p></div></div><div class="detail-facts"><article><strong>★ ${item.rating.toFixed(1)}</strong><span>TMDb評価</span></article><article><strong>${formatCount(item.voteCount)}</strong><span>評価総数</span></article><article><strong>${item.runtime||'—'}分</strong><span>上映時間</span></article></div><article><strong>あらすじ</strong><p>${escapeHtml(item.overview||'日本語の概要は未登録です。')}</p></article>${item.director?`<article><strong>監督</strong><p>${escapeHtml(item.director)}</p></article>`:''}${item.cast?.length?`<article><strong>主な出演者</strong><p>${item.cast.map(v=>`${escapeHtml(v.name)}${v.character?`（${escapeHtml(v.character)}）`:''}`).join('・')}</p></article>`:''}<article><strong>ジャンル</strong><p>${item.genres.map(escapeHtml).join('・')}</p></article><section class="watch-section"><h3>日本で視聴できるサービス</h3>${group('見放題',pg.flatrate,'flat')}${group('レンタル',pg.rent,'rent')}${group('購入',pg.buy,'buy')}${!item.providers.length?'<p>日本向け配信情報は取得できませんでした。</p>':''}${pg.link?`<a href="${escapeHtml(pg.link)}" target="_blank" rel="noopener">JustWatchで最新状況を確認 ↗</a>`:''}</section><article><strong>外部リンク</strong><p>${item.trailerUrl?`<a href="${escapeHtml(item.trailerUrl)}" target="_blank" rel="noopener">予告編を見る ↗</a>　`:''}<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">TMDbで見る ↗</a></p></article><div class="attribution">This product uses the TMDB API but is not endorsed or certified by TMDB. 配信情報はTMDb経由のJustWatchデータです。</div>`;
    nodes.detail.showModal();
  }
  document.addEventListener('click',event=>{ const open=event.target.closest('[data-open-media]'); if(open)openDetail(open.dataset.openMedia); const fav=event.target.closest('[data-favorite-media]'); if(fav){event.stopPropagation();favorites.toggle(fav.dataset.favoriteMedia);render();} if(event.target.closest('[data-close]'))event.target.closest('dialog')?.close(); });
  nodes.search.addEventListener('input',()=>{state.query=nodes.search.value;render();});
  nodes.genre.addEventListener('change',()=>{state.genre=nodes.genre.value;render();}); nodes.provider.addEventListener('change',()=>{state.provider=nodes.provider.value;render();}); nodes.rating.addEventListener('change',()=>{state.minimumRating=Number(nodes.rating.value);render();}); nodes.sort.addEventListener('change',()=>{state.sort=nodes.sort.value;render();});
  document.querySelector('#resetButton').addEventListener('click',()=>{Object.assign(state,{query:'',genre:'all',provider:'all',minimumRating:0,sort:'rank'});nodes.search.value='';nodes.genre.value='all';nodes.provider.value='all';nodes.rating.value='0';nodes.sort.value='rank';render();}); document.querySelector('#sourceBtn').addEventListener('click',()=>nodes.source.showModal());
  provider.fetchItems().then(items=>{state.items=items;nodes.status&&(nodes.status.textContent='TMDb実データ');buildOptions();render();}).catch(error=>{console.warn(error);state.items=fallback;nodes.status&&(nodes.status.textContent='取得待ち');buildOptions();render();});
})();
