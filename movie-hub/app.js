(() => {
  'use strict';
  const { StaticMediaProvider, MediaFilterService, FavoriteService, MediaCard, escapeHtml } = window.MediaHub;
  const sampleMovies = [
    {id:'movie-1',rank:1,title:'ショーシャンクの空に',subtitle:'The Shawshank Redemption',year:'1994',rating:9.3,popularity:98,runtime:142,genres:['ドラマ'],overview:'刑務所を舞台に、希望と友情を描くヒューマンドラマ。',providers:['U-NEXT','Amazon Prime'],source:'TMDb想定'},
    {id:'movie-2',rank:2,title:'ゴッドファーザー',subtitle:'The Godfather',year:'1972',rating:9.2,popularity:96,runtime:175,genres:['ドラマ','犯罪'],overview:'巨大なマフィア一家の権力と家族の物語。',providers:['Amazon Prime'],source:'TMDb想定'},
    {id:'movie-3',rank:3,title:'ダークナイト',subtitle:'The Dark Knight',year:'2008',rating:9.0,popularity:99,runtime:152,genres:['アクション','犯罪'],overview:'秩序と混沌がぶつかり合うヒーロー映画。',providers:['Netflix','U-NEXT'],source:'TMDb想定'},
    {id:'movie-4',rank:4,title:'千と千尋の神隠し',subtitle:'Spirited Away',year:'2001',rating:8.6,popularity:94,runtime:125,genres:['アニメ','ファンタジー'],overview:'不思議な世界へ迷い込んだ少女の成長を描く。',providers:['Netflix'],source:'TMDb想定'},
    {id:'movie-5',rank:5,title:'インターステラー',subtitle:'Interstellar',year:'2014',rating:8.7,popularity:97,runtime:169,genres:['SF','ドラマ'],overview:'人類の未来を懸け、未知の宇宙へ向かう。',providers:['Amazon Prime','U-NEXT'],source:'TMDb想定'},
    {id:'movie-6',rank:6,title:'パラサイト 半地下の家族',subtitle:'Parasite',year:'2019',rating:8.5,popularity:91,runtime:132,genres:['ドラマ','スリラー'],overview:'二つの家族の交錯から格差を描くブラックコメディ。',providers:['Netflix'],source:'TMDb想定'},
    {id:'movie-7',rank:7,title:'君の名は。',subtitle:'Your Name.',year:'2016',rating:8.4,popularity:93,runtime:106,genres:['アニメ','恋愛'],overview:'入れ替わる二人の高校生を描く青春ファンタジー。',providers:['Amazon Prime'],source:'TMDb想定'},
    {id:'movie-8',rank:8,title:'マッドマックス 怒りのデス・ロード',subtitle:'Mad Max: Fury Road',year:'2015',rating:8.1,popularity:89,runtime:120,genres:['アクション','SF'],overview:'荒廃した世界を疾走するノンストップ・アクション。',providers:['U-NEXT'],source:'TMDb想定'}
  ];

  const provider = new StaticMediaProvider({ id:'sample', label:'サンプル', items:sampleMovies });
  const filterService = new MediaFilterService();
  const favorites = new FavoriteService('movieHubFavoritesV1');
  const card = new MediaCard();
  const state = { items:[], query:'', genre:'all', provider:'all', minimumRating:0, sort:'rank' };
  const nodes = {
    list:document.querySelector('#movieList'), count:document.querySelector('#resultCount'),
    search:document.querySelector('#searchInput'), genre:document.querySelector('#genreSelect'),
    provider:document.querySelector('#providerSelect'), rating:document.querySelector('#ratingSelect'),
    sort:document.querySelector('#sortSelect'), detail:document.querySelector('#detailDialog'),
    detailContent:document.querySelector('#detailContent'), source:document.querySelector('#sourceDialog')
  };

  function buildOptions() {
    const genres = [...new Set(state.items.flatMap(item => item.genres))].sort((a,b)=>a.localeCompare(b,'ja'));
    const providers = [...new Set(state.items.flatMap(item => item.providers))].sort((a,b)=>a.localeCompare(b,'ja'));
    nodes.genre.innerHTML = '<option value="all">すべて</option>' + genres.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
    nodes.provider.innerHTML = '<option value="all">すべて</option>' + providers.map(v=>`<option>${escapeHtml(v)}</option>`).join('');
  }

  function render() {
    const items = filterService.execute(state.items, state);
    nodes.count.textContent = `${items.length}本`;
    nodes.list.innerHTML = items.length ? items.map(item => card.render(item,{favorite:favorites.has(item.id)})).join('') : '<p style="padding:24px;text-align:center;color:#7c8798">条件に合う映画がありません。</p>';
  }

  function openDetail(id) {
    const item = state.items.find(movie => movie.id === String(id));
    if (!item) return;
    nodes.detailContent.innerHTML = `<div class="detail-head"><span class="media-card__poster" style="width:116px;flex:0 0 116px"><span class="media-card__fallback">🎬</span><b>#${item.rank}</b></span><div><small>${escapeHtml(item.year)}</small><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.subtitle)}</p></div></div><div class="detail-facts"><article><strong>★ ${item.rating.toFixed(1)}</strong><span>評価</span></article><article><strong>${item.runtime}分</strong><span>上映時間</span></article><article><strong>${item.providers.length}</strong><span>配信先</span></article></div><article><strong>あらすじ</strong><p>${escapeHtml(item.overview)}</p></article><article><strong>ジャンル</strong><p>${item.genres.map(escapeHtml).join('・')}</p></article><article><strong>視聴できるサービス</strong><p>${item.providers.map(escapeHtml).join('・') || '取得情報なし'}</p></article><article><strong>データについて</strong><p>現在はUI検証用サンプル。実データ版ではTMDb APIと、TMDbがJustWatchと連携して提供する日本向け配信情報を使用します。</p></article>`;
    nodes.detail.showModal();
  }

  document.addEventListener('click', event => {
    const open = event.target.closest('[data-open-media]'); if (open) openDetail(open.dataset.openMedia);
    const fav = event.target.closest('[data-favorite-media]'); if (fav) { event.stopPropagation(); favorites.toggle(fav.dataset.favoriteMedia); render(); }
    if (event.target.closest('[data-close]')) event.target.closest('dialog')?.close();
  });
  nodes.search.addEventListener('input',()=>{state.query=nodes.search.value;render();});
  nodes.genre.addEventListener('change',()=>{state.genre=nodes.genre.value;render();});
  nodes.provider.addEventListener('change',()=>{state.provider=nodes.provider.value;render();});
  nodes.rating.addEventListener('change',()=>{state.minimumRating=Number(nodes.rating.value);render();});
  nodes.sort.addEventListener('change',()=>{state.sort=nodes.sort.value;render();});
  document.querySelector('#resetButton').addEventListener('click',()=>{state.query='';state.genre='all';state.provider='all';state.minimumRating=0;state.sort='rank';nodes.search.value='';nodes.genre.value='all';nodes.provider.value='all';nodes.rating.value='0';nodes.sort.value='rank';render();});
  document.querySelector('#sourceBtn').addEventListener('click',()=>nodes.source.showModal());

  provider.fetchItems().then(items=>{state.items=items;buildOptions();render();});
})();