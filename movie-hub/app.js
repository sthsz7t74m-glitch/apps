(() => {
  'use strict';
  const { MediaItem, MediaProvider, MediaFilterService, FavoriteService, MediaCard, escapeHtml, formatCount } = window.MediaHub;

  class MovieDataProvider extends MediaProvider {
    constructor(){ super({id:'tmdb',label:'TMDb実データ'}); }
    async fetchItems(){
      const response = await fetch(`./data/movie-data.json?v=${Math.floor(Date.now()/1800000)}`, { cache:'default' });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return (payload.movies || [])
        .filter(movie => Number(movie.voteCount || 0) >= 500)
        .map(movie => new MediaItem({ ...movie, providers:movie.providerNames || [], providerGroups:movie.providers || {}, source:'TMDb' }));
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
    {id:'sample-1',rank:1,title:'データ取得準備中',subtitle:'GitHub Actions実行後にTMDb実データへ切替',year:'',rating:0,voteCount:500,popularity:0,runtime:0,genres:['準備中'],overview:'Actionsの Update Movie Hub data を手動実行してください。',providers:[],providerGroups:{},source:'待機中'}
  ].map(v=>new MediaItem(v));

  const provider = new MovieDataProvider();
  const filterService = new MediaFilterService();
  const favorites = new FavoriteService('movieHubFavoritesV2');
  const card = new MovieCard();
  const PAGE_SIZE = 80;
  const state = { items:[], query:'', genre:'all', provider:'all', minimumRating:0, minimumVotes:500, releaseYearFrom:0, releaseYearTo:0, sort:'rank', visibleLimit:PAGE_SIZE };
  const nodes = {
    list:document.querySelector('#movieList'), count:document.querySelector('#resultCount'), search:document.querySelector('#searchInput'),
    genre:document.querySelector('#genreSelect'), provider:document.querySelector('#providerSelect'), rating:document.querySelector('#ratingSelect'),
    votes:document.querySelector('#votesSelect'), yearFrom:document.querySelector('#yearFromSelect'), yearTo:document.querySelector('#yearToSelect'),
    sort:document.querySelector('#sortSelect'), detail:document.querySelector('#detailDialog'), detailContent:document.querySelector('#detailContent'),
    source:document.querySelector('#sourceDialog'), status:document.querySelector('#dataStatus'), loadMore:document.querySelector('#loadMoreButton')
  };

  function resetVisible(){ state.visibleLimit=PAGE_SIZE; }
  function buildOptions(){
    const genres=[...new Set(state.items.flatMap(v=>v.genres))].sort((a,b)=>a.localeCompare(b,'ja'));
    const providers=[...new Set(state.items.flatMap(v=>v.providers))].sort((a,b)=>a.localeCompare(b,'ja'));
    const years=state.items.map(v=>Number(v.year)).filter(Boolean);
    const minimumYear=years.length?Math.min(...years):1950;
    const maximumYear=years.length?Math.max(...years):new Date().getFullYear();
    const yearOptions=[];
    for(let year=maximumYear;year>=minimumYear;year-=1) yearOptions.push(`<option value="${year}">${year}年</option>`);
    nodes.genre.innerHTML='<option value="all">すべて</option>'+genres.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
    nodes.provider.innerHTML='<option value="all">すべて</option>'+providers.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
    nodes.yearFrom.innerHTML='<option value="0">指定なし</option>'+yearOptions.join('');
    nodes.yearTo.innerHTML='<option value="0">指定なし</option>'+yearOptions.join('');
  }

  function normalizeYearRange(changed){
    if(state.releaseYearFrom && state.releaseYearTo && state.releaseYearFrom>state.releaseYearTo){
      if(changed==='from') state.releaseYearTo=state.releaseYearFrom;
      else state.releaseYearFrom=state.releaseYearTo;
      nodes.yearFrom.value=String(state.releaseYearFrom);
      nodes.yearTo.value=String(state.releaseYearTo);
    }
  }

  function render(){
    const items=filterService.execute(state.items,state);
    const visible=items.slice(0,state.visibleLimit);
    nodes.count.textContent=`${items.length.toLocaleString('ja-JP')}本`;
    nodes.list.innerHTML=visible.length?visible.map(v=>card.render(v,{favorite:favorites.has(v.id)})).join(''):'<p class="empty">条件に合う映画がありません。</p>';
    if(nodes.loadMore){
      nodes.loadMore.hidden=visible.length>=items.length;
      nodes.loadMore.textContent=visible.length<items.length?`さらに表示（残り ${(items.length-visible.length).toLocaleString('ja-JP')}本）`:'すべて表示済み';
    }
  }

  const group=(title,items,type)=>items?.length?`<article><strong>${title}</strong><div class="provider-tags">${items.map(v=>`<span class="watch-tag watch-tag--${type}">${escapeHtml(v.name)}</span>`).join('')}</div></article>`:'';
  function openDetail(id){
    const item=state.items.find(v=>v.id===String(id)); if(!item)return;
    const pg=item.providerGroups||{};
    const detailNote=item.enriched===false?'<p class="detail-note">この作品は一覧情報のみ取得済みです。上映時間・出演者・配信先は段階的に補完されます。</p>':'';
    nodes.detailContent.innerHTML=`<div class="detail-head"><span class="media-card__poster detail-poster">${item.image?`<img src="${escapeHtml(item.image)}" alt="">`:'<span class="media-card__fallback">🎬</span>'}</span><div><small>${escapeHtml(item.year)}</small><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle)}</p></div></div>${detailNote}<div class="detail-facts"><article><strong>★ ${item.rating.toFixed(1)}</strong><span>TMDb評価</span></article><article><strong>${formatCount(item.voteCount)}</strong><span>評価総数</span></article><article><strong>${item.runtime||'—'}分</strong><span>上映時間</span></article></div><article><strong>あらすじ</strong><p>${escapeHtml(item.overview||'日本語の概要は未登録です。')}</p></article>${item.director?`<article><strong>監督</strong><p>${escapeHtml(item.director)}</p></article>`:''}${item.cast?.length?`<article><strong>主な出演者</strong><p>${item.cast.map(v=>`${escapeHtml(v.name)}${v.character?`（${escapeHtml(v.character)}）`:''}`).join('・')}</p></article>`:''}<article><strong>ジャンル</strong><p>${item.genres.map(escapeHtml).join('・')}</p></article><section class="watch-section"><h3>日本で視聴できるサービス</h3>${group('見放題',pg.flatrate,'flat')}${group('レンタル',pg.rent,'rent')}${group('購入',pg.buy,'buy')}${!item.providers.length?'<p>日本向け配信情報は未取得、または配信先がありません。</p>':''}${pg.link?`<a href="${escapeHtml(pg.link)}" target="_blank" rel="noopener">JustWatchで最新状況を確認 ↗</a>`:''}</section><article><strong>外部リンク</strong><p>${item.trailerUrl?`<a href="${escapeHtml(item.trailerUrl)}" target="_blank" rel="noopener">予告編を見る ↗</a>　`:''}<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">TMDbで見る ↗</a></p></article><div class="attribution">This product uses the TMDB API but is not endorsed or certified by TMDB. 配信情報はTMDb経由のJustWatchデータです。</div>`;
    nodes.detail.showModal();
  }

  document.addEventListener('click',event=>{
    const open=event.target.closest('[data-open-media]'); if(open)openDetail(open.dataset.openMedia);
    const fav=event.target.closest('[data-favorite-media]'); if(fav){event.stopPropagation();favorites.toggle(fav.dataset.favoriteMedia);render();}
    if(event.target.closest('[data-close]'))event.target.closest('dialog')?.close();
  });
  nodes.search.addEventListener('input',()=>{state.query=nodes.search.value;resetVisible();render();});
  nodes.genre.addEventListener('change',()=>{state.genre=nodes.genre.value;resetVisible();render();});
  nodes.provider.addEventListener('change',()=>{state.provider=nodes.provider.value;resetVisible();render();});
  nodes.rating.addEventListener('change',()=>{state.minimumRating=Number(nodes.rating.value);resetVisible();render();});
  nodes.votes.addEventListener('change',()=>{state.minimumVotes=Number(nodes.votes.value);resetVisible();render();});
  nodes.yearFrom.addEventListener('change',()=>{state.releaseYearFrom=Number(nodes.yearFrom.value);normalizeYearRange('from');resetVisible();render();});
  nodes.yearTo.addEventListener('change',()=>{state.releaseYearTo=Number(nodes.yearTo.value);normalizeYearRange('to');resetVisible();render();});
  nodes.sort.addEventListener('change',()=>{state.sort=nodes.sort.value;resetVisible();render();});
  nodes.loadMore?.addEventListener('click',()=>{state.visibleLimit+=PAGE_SIZE;render();});
  document.querySelector('#resetButton').addEventListener('click',()=>{
    Object.assign(state,{query:'',genre:'all',provider:'all',minimumRating:0,minimumVotes:500,releaseYearFrom:0,releaseYearTo:0,sort:'rank',visibleLimit:PAGE_SIZE});
    nodes.search.value=''; nodes.genre.value='all'; nodes.provider.value='all'; nodes.rating.value='0'; nodes.votes.value='500';
    nodes.yearFrom.value='0'; nodes.yearTo.value='0'; nodes.sort.value='rank'; render();
  });
  document.querySelector('#sourceBtn').addEventListener('click',()=>nodes.source.showModal());

  provider.fetchItems().then(items=>{
    state.items=items;
    nodes.status&&(nodes.status.textContent=`TMDb実データ・${items.length.toLocaleString('ja-JP')}本`);
    buildOptions(); render();
  }).catch(error=>{
    console.warn(error); state.items=fallback; nodes.status&&(nodes.status.textContent='取得待ち'); buildOptions(); render();
  });
})();
