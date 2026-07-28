(() => {
  "use strict";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  class EventRepository {
    constructor(raw) {
      this.events = String(raw || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean).map((line, index) => {
        const [date="", open="", start="", venue="", area="", title="", genre="", status="", priceMin="", priceText="", performers="", url=""] = line.split("|");
        return { id:`${date}|${start}|${title}|${index}`, date, open, start, venue, area, title, genre, status, priceMin:Number(priceMin)||0, priceText, performers:performers.split("／").map(v=>v.trim()).filter(Boolean), url };
      }).filter(e => e.date && e.start && e.title);
    }
    all() { return [...this.events]; }
    performers() {
      const counts = new Map();
      this.events.forEach(e => e.performers.forEach(n => counts.set(n, (counts.get(n)||0)+1)));
      return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"ja")).map(([name])=>name);
    }
  }

  class FavoriteStore {
    constructor(showKey="yoshimotoFavoriteShowsV2", artistKey="yoshimotoFavoriteArtistsV2") {
      this.showKey=showKey; this.artistKey=artistKey;
      this.shows=new Set(this.read(showKey)); this.artists=new Set(this.read(artistKey));
    }
    read(key) { try { const v=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(v)?v:[]; } catch { return []; } }
    save() { try { localStorage.setItem(this.showKey,JSON.stringify([...this.shows])); localStorage.setItem(this.artistKey,JSON.stringify([...this.artists])); } catch {} }
    toggleShow(id){ this.shows.has(id)?this.shows.delete(id):this.shows.add(id); this.save(); }
    toggleArtist(name){ this.artists.has(name)?this.artists.delete(name):this.artists.add(name); this.save(); }
    isShow(id){ return this.shows.has(id); }
    isArtist(name){ return this.artists.has(name); }
    matchedArtists(event){ return event.performers.filter(n=>this.artists.has(n)); }
  }

  class EventTimeService {
    duration(event){ if(/ルミネ|特別公演|寄席/.test(`${event.title}${event.venue}`))return 110; if(/マンゲキお笑いライブ|お盆SP/.test(event.title))return 75; return 60; }
    add(time,minutes){ const [h,m]=String(time).split(":").map(Number); if(!Number.isFinite(h)||!Number.isFinite(m))return "--:--"; const t=h*60+m+minutes; return `${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; }
    end(event){ return this.add(event.start,this.duration(event)); }
    endDate(event){ return new Date(`${event.date}T${this.end(event)}:00+09:00`); }
  }

  class RecommendationService {
    constructor(favorites,time){ this.favorites=favorites; this.time=time; }
    score(event){
      const matched=this.favorites.matchedArtists(event); if(!matched.length)return null;
      const days=Math.max(0,Math.ceil((new Date(`${event.date}T${event.start}:00+09:00`)-new Date())/86400000));
      let score=Math.min(70,matched.length*20); const reasons=[`お気に入り芸人${matched.length}組出演`];
      if(["yose","neta","neta-corner","conte"].includes(event.genre)){score+=10;reasons.push("ネタ中心の公演");}
      if(event.status==="available"){score+=10;reasons.push("販売中");}
      if(days<=7){score+=10;reasons.push("今週開催");}
      if(event.priceMin&&event.priceMin<=2500){score+=5;reasons.push("2,500円以下");}
      return {event,matched,reasons,days,score:Math.min(100,score)};
    }
  }

  class EventCardRenderer {
    constructor(favorites,time){ this.favorites=favorites; this.time=time; }
    formatDate(value){ const [y,m,d]=value.split("-").map(Number); const dt=new Date(y,m-1,d); return {md:`${m}/${d}`,wd:"日月火水木金土"[dt.getDay()]}; }
    artistButton(name){ const on=this.favorites.isArtist(name); return `<button class="performer-button${on?" is-favorite":""}" type="button" data-artist="${esc(name)}">${on?"★":"☆"} ${esc(name)}</button>`; }
    render(event,{recommendation=null}={}){
      const date=this.formatDate(event.date), matched=this.favorites.matchedArtists(event), first=event.performers.slice(0,6), rest=event.performers.slice(6), showFav=this.favorites.isShow(event.id);
      const genre={yose:"寄席・ネタ",neta:"ネタライブ","neta-corner":"ネタ＋コーナー",project:"企画ライブ"}[event.genre]||"お笑いライブ";
      return `<article class="live-card" data-event-id="${esc(event.id)}">
        <button class="show-favorite${showFav?" is-favorite":""}" type="button" data-show-id="${esc(event.id)}">${showFav?"★":"☆"}</button>
        <div class="date-panel"><div class="event-date-layout"><div class="event-date-left"><strong>${date.md}</strong><span>(${date.wd})</span></div><div class="event-date-divider"></div><div class="event-time-list"><div class="event-time-row"><span>◷</span><span class="event-time-label">開場</span><strong>${esc(event.open)}</strong></div><div class="event-time-row"><span>●</span><span class="event-time-label">開演</span><strong>${esc(event.start)}</strong></div><div class="event-time-row end-row"><span>◴</span><span class="event-time-label">終演</span><strong>${this.time.end(event)}</strong></div></div></div></div>
        <div class="card-body"><div class="card-topline"><span class="badge genre">${esc(genre)}</span><span class="badge available">○ ${event.status==="available"?"販売中":"公式確認"}</span>${matched.length?`<span class="badge favorite-artist-mark">★ お気に入り芸人 ${matched.length}組</span>`:""}${recommendation?`<span class="badge recommendation-score-badge">おすすめ ${recommendation.score}点</span>`:""}</div>
        <h2>${esc(event.title)}</h2><div class="meta-line"><span>📍 ${esc(event.area)}・${esc(event.venue)}</span><span>🎫 ${esc(event.priceText)}</span></div>
        <div class="performers-preview">${first.map(n=>this.artistButton(n)).join("")}</div>${rest.length?`<details class="performer-details"><summary>ほか ${rest.length}組を見る</summary><div class="performers-preview">${rest.map(n=>this.artistButton(n)).join("")}</div></details>`:""}
        ${recommendation?`<div class="recommendation-reasons-inline">${recommendation.reasons.map(r=>`<span>${esc(r)}</span>`).join("")}</div>`:""}
        <div class="card-actions"><span class="availability-note">終演は公演形式から算出した予定時刻</span><a class="official-link" href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">空席・購入を見る →</a></div></div></article>`;
    }
  }

  window.YoshimotoDomain={EventRepository,FavoriteStore,EventTimeService,RecommendationService,EventCardRenderer,esc};
})();