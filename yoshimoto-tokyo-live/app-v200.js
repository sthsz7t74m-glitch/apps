(() => {
  "use strict";
  const D=window.YoshimotoDomain;
  const repo=new D.EventRepository(window.YOSHIMOTO_LIVE_ROWS||"");
  const favorites=new D.FavoriteStore();
  const time=new D.EventTimeService();
  const holidays=new D.HolidayCalendar();
  const recommendations=new D.RecommendationService(favorites,time);
  const cards=new D.EventCardRenderer(favorites,time);
  const state={page:"list",mode:"neta",performer:"",recommendationFilter:"all"};
  const $=s=>document.querySelector(s);
  const ordinary=e=>["yose","neta","neta-corner","conte"].includes(e.genre);
  const renderList=(el,items,empty,mapper=e=>cards.render(e))=>{if(!el)return;el.innerHTML=items.length?items.map(mapper).join(""):`<div class="empty-state"><strong>${D.esc(empty)}</strong></div>`;};

  function filtered(){
    const q=String($("#searchInput")?.value||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
    const venue=$("#venueFilter")?.value||"",genre=$("#genreFilter")?.value||"",from=$("#fromDate")?.value||"",to=$("#toDate")?.value||"",status=$("#statusFilter")?.value||"",dayType=$("#dayTypeFilter")?.value||"",max=Number($("#priceFilter")?.value||0),sort=$("#sortFilter")?.value||"date";
    return repo.all().filter(e=>{
      if(state.mode==="neta"&&!ordinary(e))return false;
      if(state.mode==="available"&&e.status!=="available")return false;
      if(state.performer&&!e.performers.includes(state.performer))return false;
      if(q&&!`${e.title}${e.venue}${e.area}${e.performers.join("")}`.normalize("NFKC").toLowerCase().replace(/\s+/g,"").includes(q))return false;
      if(venue&&e.venue!==venue)return false;if(genre&&e.genre!==genre)return false;if(from&&e.date<from)return false;if(to&&e.date>to)return false;if(status&&e.status!==status)return false;if(dayType&&!holidays.matches(e.date,dayType))return false;if(max&&(!e.priceMin||e.priceMin>max))return false;
      return true;
    }).sort((a,b)=>sort==="price"?(a.priceMin||999999)-(b.priceMin||999999):sort==="venue"?a.venue.localeCompare(b.venue,"ja"):sort==="performers"?b.performers.length-a.performers.length:`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  }

  function renderMain(){const items=filtered();renderList($("#liveList"),items,"条件に合う公演がありません");$("#visibleCount").textContent=items.length;$("#netaCount").textContent=items.filter(ordinary).length;if(items[0]){const d=cards.formatDate(items[0].date);$("#nextDate").textContent=d.md;$("#nextDateSub").textContent=`${d.wd}曜 ${items[0].start}〜`;}else{$("#nextDate").textContent="—";$("#nextDateSub").textContent="該当なし";}$("#resultSummary").textContent=`${state.mode==="neta"?"ネタ中心":state.mode==="available"?"販売中のみ":"全公演"}：${items.length}件表示`;}
  function renderShows(){favorites.cleanupExpired(repo.all(),time);const items=repo.all().filter(e=>favorites.isShow(e)&&!time.isFavoriteExpired(e)).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));renderList($("#favoriteShowsList"),items,"お気に入り公演はまだありません");$("#favoriteShowCount").textContent=items.length;}
  function renderArtists(){
    const top=[...favorites.topArtists].sort((a,b)=>a.localeCompare(b,"ja"));
    const normal=[...favorites.artists].filter(n=>!favorites.topArtists.has(n)).sort((a,b)=>a.localeCompare(b,"ja"));
    const el=$("#favoriteArtistsList");
    const card=(n,isTop)=>`<article class="artist-favorite-card${isTop?" is-top-favorite":""}"><div><strong>${isTop?"♥":"★"} ${D.esc(n)}</strong><span>${isTop?"最推し・":""}今後の掲載公演 ${repo.all().filter(e=>e.performers.includes(n)&&time.endDate(e)>new Date()).length}件</span></div><div class="artist-card-actions">${!isTop?`<button type="button" data-promote-artist="${D.esc(n)}">最推しにする</button>`:""}<button type="button" data-remove-artist="${D.esc(n)}">解除</button></div></article>`;
    el.innerHTML=(top.length||normal.length)?`${top.length?`<h3 class="favorite-group-title">♥ 最推し</h3>${top.map(n=>card(n,true)).join("")}`:""}${normal.length?`<h3 class="favorite-group-title">★ お気に入り</h3>${normal.map(n=>card(n,false)).join("")}`:""}`:`<div class="empty-state"><strong>お気に入り芸人はまだありません</strong></div>`;
    $("#favoriteArtistCount").textContent=top.length+normal.length;
  }
  function renderRecommendations(){let items=repo.all().filter(e=>time.endDate(e)>new Date()).map(e=>recommendations.score(e)).filter(Boolean);if(state.recommendationFilter==="week")items=items.filter(i=>i.days<=7);if(state.recommendationFilter==="many")items=items.filter(i=>i.matched.length>=2);if(state.recommendationFilter==="value")items=items.filter(i=>i.event.priceMin&&i.event.priceMin<=2500);items.sort((a,b)=>b.score-a.score||(b.top?.length||0)-(a.top?.length||0)||b.matched.length-a.matched.length||`${a.event.date}${a.event.start}`.localeCompare(`${b.event.date}${b.event.start}`));renderList($("#recommendationList"),items,"おすすめ公演はまだありません",i=>cards.render(i.event,{recommendation:i}));}
  function renderPerformers(){const el=$("#performerChips");el.innerHTML=repo.performers().map(n=>`<button class="performer-chip${state.performer===n?" is-active":""}" type="button" data-filter-artist="${D.esc(n)}">${D.esc(n)}</button>`).join("");$("#clearPerformer").hidden=!state.performer;}
  function updatePage(){["list","recommendations","shows","artists"].forEach(p=>{const el=$(p==="list"?"#listPage":p==="recommendations"?"#recommendationsPage":p==="shows"?"#showsPage":"#artistsPage");if(el)el.hidden=state.page!==p;});document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("is-active",b.dataset.page===state.page));}
  function renderAll(){renderMain();renderShows();renderArtists();renderRecommendations();renderPerformers();updatePage();}

  function preservePosition(source,action){
    const card=source?.closest?.(".live-card");
    const eventId=card?.dataset.eventId||"";
    const oldTop=card?.getBoundingClientRect().top;
    const oldScroll=window.scrollY;
    action();
    renderAll();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const replacement=eventId?[...document.querySelectorAll(".page-section:not([hidden]) .live-card")].find(el=>el.dataset.eventId===eventId):null;
      if(replacement&&Number.isFinite(oldTop))window.scrollBy(0,replacement.getBoundingClientRect().top-oldTop);
      else window.scrollTo(0,oldScroll);
    }));
  }

  function init(){
    $(".version").textContent="v2.2.0";
    favorites.migrateShows(repo.all());
    [...new Set(repo.all().map(e=>e.venue))].sort((a,b)=>a.localeCompare(b,"ja")).forEach(v=>$("#venueFilter").insertAdjacentHTML("beforeend",`<option>${D.esc(v)}</option>`));
    if($("#fromDate"))$("#fromDate").value=repo.all()[0]?.date||"";
    document.addEventListener("click",e=>{
      const page=e.target.closest("[data-page]");if(page){state.page=page.dataset.page;updatePage();return;}
      const mode=e.target.closest("[data-mode]");if(mode){state.mode=mode.dataset.mode;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("is-active",b===mode));renderMain();return;}
      const rf=e.target.closest("[data-recommendation-filter]");if(rf){state.recommendationFilter=rf.dataset.recommendationFilter;document.querySelectorAll("[data-recommendation-filter]").forEach(b=>b.classList.toggle("is-active",b===rf));renderRecommendations();return;}
      const sf=e.target.closest("[data-show-id]");if(sf){const event=repo.findById(sf.dataset.showId);if(event)preservePosition(sf,()=>favorites.toggleShow(event));return;}
      const af=e.target.closest("[data-artist]");if(af){preservePosition(af,()=>favorites.cycleArtist(af.dataset.artist));return;}
      const promote=e.target.closest("[data-promote-artist]");if(promote){preservePosition(promote,()=>favorites.cycleArtist(promote.dataset.promoteArtist));return;}
      const ra=e.target.closest("[data-remove-artist]");if(ra){preservePosition(ra,()=>favorites.removeArtist(ra.dataset.removeArtist));return;}
      const pf=e.target.closest("[data-filter-artist]");if(pf){state.performer=state.performer===pf.dataset.filterArtist?"":pf.dataset.filterArtist;renderAll();}
    });
    ["#searchInput","#venueFilter","#genreFilter","#fromDate","#toDate","#statusFilter","#dayTypeFilter","#priceFilter","#sortFilter"].forEach(s=>$(s)?.addEventListener("input",renderMain));
    $("#filterToggle")?.addEventListener("click",()=>$("#advancedFilters")?.classList.toggle("is-open"));
    $("#clearPerformer")?.addEventListener("click",()=>{state.performer="";renderAll();});
    $("#resetButton")?.addEventListener("click",()=>{["#searchInput","#venueFilter","#genreFilter","#toDate","#statusFilter","#dayTypeFilter","#priceFilter"].forEach(s=>{if($(s))$(s).value="";});if($("#sortFilter"))$("#sortFilter").value="date";state.mode="neta";state.performer="";renderAll();});
    renderAll();
  }
  window.addEventListener("DOMContentLoaded",init);
})();