(() => {
  "use strict";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  class EventRepository{
    constructor(raw){
      this.events=String(raw||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map((line,index)=>{
        const[date="",open="",start="",venue="",area="",title="",genre="",status="",priceMin="",priceText="",performers="",url=""]=line.split("|");
        return{
          id:`${date}|${start}|${title}|${venue}`,
          legacyId:`${date}|${start}|${title}|${index}`,
          date,open,start,venue,area,title,genre,status,
          priceMin:Number(priceMin)||0,
          priceText,
          performers:performers.split("／").map(v=>v.trim()).filter(Boolean),
          url
        };
      }).filter(e=>e.date&&e.start&&e.title);
    }
    all(){return[...this.events];}
    findById(id){return this.events.find(e=>e.id===id||e.legacyId===id);}
    performers(){
      const c=new Map();
      this.events.forEach(e=>e.performers.forEach(n=>c.set(n,(c.get(n)||0)+1)));
      return[...c.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"ja")).map(([n])=>n);
    }
  }

  class FavoriteStore{
    constructor(showKey="yoshimotoFavoriteShowsV2",artistKey="yoshimotoFavoriteArtistsV2"){
      this.showKey=showKey;
      this.artistKey=artistKey;
      this.shows=new Set(this.read(showKey));
      this.artists=new Set(this.read(artistKey));
    }
    read(k){try{const v=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(v)?v:[];}catch{return[];}}
    save(){try{localStorage.setItem(this.showKey,JSON.stringify([...this.shows]));localStorage.setItem(this.artistKey,JSON.stringify([...this.artists]));}catch{}}
    isShow(e){
      if(typeof e==="string")return this.shows.has(e);
      return this.shows.has(e.id)||this.shows.has(e.legacyId);
    }
    toggleShow(e){
      if(!e)return;
      const on=this.isShow(e);
      this.shows.delete(e.id);
      this.shows.delete(e.legacyId);
      if(!on)this.shows.add(e.id);
      this.save();
    }
    migrateShows(events){
      let changed=false;
      events.forEach(e=>{
        if(this.shows.has(e.legacyId)){
          this.shows.delete(e.legacyId);
          this.shows.add(e.id);
          changed=true;
        }
      });
      if(changed)this.save();
    }
    toggleArtist(n){this.artists.has(n)?this.artists.delete(n):this.artists.add(n);this.save();}
    isArtist(n){return this.artists.has(n);}
    matchedArtists(e){return e.performers.filter(n=>this.artists.has(n));}
    cleanupExpired(events,time){
      const valid=new Set();
      events.filter(e=>!time.isFavoriteExpired(e)).forEach(e=>{valid.add(e.id);valid.add(e.legacyId);});
      const next=new Set([...this.shows].filter(id=>valid.has(id)));
      if(next.size!==this.shows.size){this.shows=next;this.save();}
    }
  }

  class EventTimeService{
    duration(e){if(/ルミネ|特別公演|寄席/.test(`${e.title}${e.venue}`))return 110;if(/マンゲキお笑いライブ|お盆SP/.test(e.title))return 75;return 60;}
    add(t,n){const[h,m]=String(t).split(":").map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return"--:--";const x=h*60+m+n;return`${String(Math.floor(x/60)%24).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`;}
    end(e){return this.add(e.start,this.duration(e));}
    endDate(e){return new Date(`${e.date}T${this.end(e)}:00+09:00`);}
    favoriteExpiryDate(e){return new Date(`${e.date}T24:00:00+09:00`);}
    isFavoriteExpired(e,now=new Date()){return this.favoriteExpiryDate(e)<=now;}
  }

  class HolidayCalendar{
    constructor(){
      this.holidays=new Set([
        "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20","2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06","2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23","2026-10-12","2026-11-03","2026-11-23",
        "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21","2027-03-22","2027-04-29","2027-05-03","2027-05-04","2027-05-05","2027-07-19","2027-08-11","2027-09-20","2027-09-23","2027-10-11","2027-11-03","2027-11-23"
      ]);
    }
    isWeekend(dateString){const[y,m,d]=dateString.split("-").map(Number);const day=new Date(y,m-1,d).getDay();return day===0||day===6;}
    isHoliday(dateString){return this.holidays.has(dateString);}
    isWeekendOrHoliday(dateString){return this.isWeekend(dateString)||this.isHoliday(dateString);}
    matches(dateString,type){if(!type)return true;const off=this.isWeekendOrHoliday(dateString);return type==="weekend"?off:!off;}
  }

  class RecommendationService{
    constructor(f,t){this.favorites=f;this.time=t;}
    score(e){
      const matched=this.favorites.matchedArtists(e);if(!matched.length)return null;
      const days=Math.max(0,Math.ceil((new Date(`${e.date}T${e.start}:00+09:00`)-new Date())/86400000));
      let score=Math.min(70,matched.length*20);const reasons=[`お気に入り芸人${matched.length}組出演`];
      if(["yose","neta","neta-corner","conte"].includes(e.genre)){score+=10;reasons.push("ネタ中心の公演");}
      if(e.status==="available"){score+=10;reasons.push("販売中");}
      if(days<=7){score+=10;reasons.push("今週開催");}
      if(e.priceMin&&e.priceMin<=2500){score+=5;reasons.push("2,500円以下");}
      return{event:e,matched,reasons,days,score:Math.min(100,score)};
    }
  }

  class EventCardRenderer{
    constructor(f,t){this.favorites=f;this.time=t;}
    formatDate(v){const[y,m,d]=v.split("-").map(Number),dt=new Date(y,m-1,d);return{md:`${m}/${d}`,wd:"日月火水木金土"[dt.getDay()]};}
    artistButton(n){const on=this.favorites.isArtist(n);return`<button class="performer-button${on?" is-favorite":""}" type="button" data-artist="${esc(n)}">${on?"★":"☆"} ${esc(n)}</button>`;}
    render(e,{recommendation=null}={}){
      const date=this.formatDate(e.date),matched=this.favorites.matchedArtists(e),ordered=[...e.performers].sort((a,b)=>Number(this.favorites.isArtist(b))-Number(this.favorites.isArtist(a))),showFav=this.favorites.isShow(e),genre={yose:"寄席・ネタ",neta:"ネタライブ","neta-corner":"ネタ＋コーナー",project:"企画ライブ"}[e.genre]||"お笑いライブ";
      return`<article class="live-card" data-event-id="${esc(e.id)}"><button class="show-favorite${showFav?" is-favorite":""}" type="button" data-show-id="${esc(e.id)}">${showFav?"★":"☆"}</button><div class="date-panel"><div class="event-date-layout"><div class="event-date-left"><strong>${date.md}</strong><span>(${date.wd})</span></div><div class="event-date-divider"></div><div class="event-time-list"><div class="event-time-row"><span>◷</span><span class="event-time-label">開場</span><strong>${esc(e.open)}</strong></div><div class="event-time-row"><span>●</span><span class="event-time-label">開演</span><strong>${esc(e.start)}</strong></div><div class="event-time-row end-row"><span>◴</span><span class="event-time-label">終演</span><strong>${this.time.end(e)}</strong></div></div></div></div><div class="card-body"><div class="card-topline"><span class="badge genre">${esc(genre)}</span><span class="badge available">○ ${e.status==="available"?"販売中":"公式確認"}</span>${matched.length?`<span class="badge favorite-artist-mark">★ お気に入り芸人 ${matched.length}組</span>`:""}${recommendation?`<span class="badge recommendation-score-badge">おすすめ ${recommendation.score}点</span>`:""}</div><h2>${esc(e.title)}</h2><div class="meta-line"><span>📍 ${esc(e.area)}・${esc(e.venue)}</span><span>🎫 ${esc(e.priceText)}</span></div><div class="performers-preview">${ordered.map(n=>this.artistButton(n)).join("")}</div>${recommendation?`<div class="recommendation-reasons-inline">${recommendation.reasons.map(r=>`<span>${esc(r)}</span>`).join("")}</div>`:""}<div class="card-actions"><span class="availability-note">終演は公演形式から算出した予定時刻</span><a class="official-link" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">空席・購入を見る →</a></div></div></article>`;
    }
  }

  window.YoshimotoDomain={EventRepository,FavoriteStore,EventTimeService,HolidayCalendar,RecommendationService,EventCardRenderer,esc};
})();