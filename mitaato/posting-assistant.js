'use strict';

(() => {
  const VERSION = 'v1.5.0';
  const KEY = 'mitaato-posting-assistant-v1';
  const state = load();
  let currentId = '';
  let observerScheduled = false;

  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
  function save(){localStorage.setItem(KEY, JSON.stringify(state))}
  function articleState(id){return state[id] ||= {copied:{},noteUrl:'',queue:'',thumbSaved:false}}
  function getArticles(){try{return Array.isArray(app?.articles)?app.articles:[]}catch{return []}}
  function getArticle(id){return getArticles().find(a=>a.id===id)}
  function selectedId(){try{return app?.selectedId||''}catch{return document.querySelector('.article-card.active')?.dataset.articleId||''}}
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function toast(msg){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
  async function copy(text){await navigator.clipboard.writeText(String(text||''))}
  function plainMarkdown(text=''){return String(text).replace(/^#{1,6}\s+/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/__(.*?)__/g,'$1').replace(/^---$/gm,'').replace(/\n{3,}/g,'\n\n').trim()}
  function fullBody(a){return a.paidSection?`${a.freeSection}\n\n---\n\n${a.paidSection}`:a.freeSection||''}

  function readiness(a){
    const checks=[
      ['タイトル', !!a.title], ['本文', (a.freeSection||'').length>=500], ['ネタバレ範囲', !!a.spoilerRange],
      ['タグ', !!a.tags && !/\n/.test(a.tags) && a.tags.includes('#ミタアト')], ['サムネ文言', !!a.thumbnailText],
      ['サムネ', !!a.thumbnailImage], ['一次情報', Array.isArray(a.sources)&&a.sources.length>0],
      ['有料部分', a.price!=='100円'||(a.paidSection||'').length>=400]
    ];
    const ok=checks.filter(x=>x[1]).length;
    return {pct:Math.round(ok/checks.length*100), missing:checks.filter(x=>!x[1]).map(x=>x[0])};
  }

  function queueFor(a){
    const saved=articleState(a.id).queue;if(saved)return saved;
    const score=Number(a.score||0); const age=(Date.now()-new Date(a.updatedAt||a.generatedAt||0).getTime())/36e5;
    if(score>=86 && age<=18) return 'now';
    if(score>=75 && age<=48) return 'today';
    return 'stock';
  }
  const qLabel={now:'今すぐ出す',today:'今日出す',stock:'ストック'};

  function enhanceCards(){
    document.querySelectorAll('.article-card[data-article-id]').forEach(card=>{
      const a=getArticle(card.dataset.articleId); if(!a)return;
      let badge=card.querySelector('.queue-badge'); if(!badge){badge=document.createElement('span');badge.className='queue-badge';card.querySelector('.article-card-top')?.append(badge)}
      const q=queueFor(a); badge.className=`queue-badge ${q}`; badge.textContent=qLabel[q];
      const r=readiness(a); let ready=card.querySelector('.ready-mini'); if(!ready){ready=document.createElement('span');ready.className='ready-mini';card.querySelector('.article-meta')?.append(ready)} ready.textContent=`準備 ${r.pct}%`;
    });
  }

  function enhanceDetail(){
    const id=selectedId(); const a=getArticle(id); const content=document.querySelector('#detailPane .detail-content'); if(!a||!content)return;
    currentId=id;
    const r=readiness(a), q=queueFor(a), s=articleState(id);
    let panel=content.querySelector('.publish-readiness');
    if(!panel){panel=document.createElement('section');panel.className='publish-readiness';content.querySelector('.thumbnail-panel')?.after(panel); if(!panel.parentNode) content.querySelector('.detail-header')?.after(panel)}
    panel.innerHTML=`<div class="publish-score"><strong>投稿準備 ${r.pct}%</strong><span class="queue-pill ${q}">${qLabel[q]}</span></div><div class="publish-meter"><i style="width:${r.pct}%"></i></div><small>${r.missing.length?'不足：'+esc(r.missing.join('・')):'投稿に必要な項目は揃っています'}</small>`;

    const actions=content.querySelector('.detail-actions');
    if(actions && !actions.querySelector('#postingModeButton')){
      const b=document.createElement('button'); b.id='postingModeButton'; b.className='primary-button posting-mode-button'; b.type='button'; b.textContent='投稿モード'; b.onclick=()=>openPostingMode(a); actions.prepend(b);
      const nb=document.createElement('button'); nb.id='notePlainCopy'; nb.className='ghost-button'; nb.type='button'; nb.textContent='note用コピー'; nb.onclick=async()=>{await copy(plainMarkdown(fullBody(a)));s.copied.body=true;save();toast('note貼り付け用本文をコピー')}; actions.append(nb);
    }
    renderUrlBox(content,a);
  }

  function renderUrlBox(content,a){
    let box=content.querySelector('.posted-url-box'); if(!box){box=document.createElement('div');box.className='posted-url-box';content.querySelector('.status-actions')?.after(box)}
    const s=articleState(a.id); box.innerHTML=`<input type="url" placeholder="投稿したnoteのURLを保存" value="${esc(s.noteUrl||'')}"><button type="button">URL保存</button>${s.noteUrl?`<a href="${esc(s.noteUrl)}" target="_blank" rel="noopener">投稿を見る</a>`:''}`;
    box.querySelector('button').onclick=()=>{s.noteUrl=box.querySelector('input').value.trim();save();renderUrlBox(content,a);toast('note URLを保存しました')};
  }

  function openPostingMode(a){
    closePostingMode(); const s=articleState(a.id);
    const steps=[
      ['title','タイトル',a.title],['body','本文',plainMarkdown(fullBody(a))],['tags','タグ',a.tags],['thumb','サムネ',null],['note','noteを開く',null],['posted','投稿済みにする',null]
    ];
    const doneCount=Object.values(s.copied||{}).filter(Boolean).length+(s.thumbSaved?1:0);
    const bar=document.createElement('div');bar.id='postingDock';bar.className='posting-dock';
    bar.innerHTML=`<div class="posting-dock-head"><div><small>POSTING MODE</small><strong>${esc(a.work||'記事')}</strong></div><button type="button" class="dock-close">×</button></div><div class="posting-step-list">${steps.map((x,i)=>`<button type="button" data-step="${x[0]}" class="${(s.copied?.[x[0]]||(x[0]==='thumb'&&s.thumbSaved))?'done':''}"><span>${i+1}</span>${x[1]}</button>`).join('')}</div><button type="button" class="posting-next">次へ</button>`;
    document.body.append(bar); bar.querySelector('.dock-close').onclick=closePostingMode;
    bar.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>runStep(a,b.dataset.step,bar));
    bar.querySelector('.posting-next').onclick=()=>{const next=steps.find(x=>!(s.copied?.[x[0]]) && !(x[0]==='thumb'&&s.thumbSaved));runStep(a,(next||steps.at(-1))[0],bar)};
    updateDock(a,bar);
  }
  function closePostingMode(){document.getElementById('postingDock')?.remove()}
  function updateDock(a,bar){
    const s=articleState(a.id);bar.querySelectorAll('[data-step]').forEach(b=>b.classList.toggle('done',!!s.copied?.[b.dataset.step]||(b.dataset.step==='thumb'&&s.thumbSaved)));
    const next=[['title','タイトルをコピー'],['body','本文をコピー'],['tags','タグをコピー'],['thumb','サムネを保存'],['note','noteを開く'],['posted','投稿済みにする']].find(x=>!(s.copied?.[x[0]])&&!(x[0]==='thumb'&&s.thumbSaved));
    bar.querySelector('.posting-next').textContent=next?`次：${next[1]}`:'投稿フロー完了 ✓';
  }
  async function runStep(a,step,bar){
    const s=articleState(a.id);
    if(step==='title'){await copy(a.title);s.copied.title=true;toast('タイトルをコピー')}
    if(step==='body'){await copy(plainMarkdown(fullBody(a)));s.copied.body=true;toast('本文をコピー')}
    if(step==='tags'){await copy((a.tags||'').replace(/\n/g,' '));s.copied.tags=true;toast('タグをコピー')}
    if(step==='thumb'){await saveThumbnail(a);s.thumbSaved=true;toast('サムネイルを書き出しました')}
    if(step==='note'){window.open('https://note.com/notes/new','_blank','noopener');s.copied.note=true}
    if(step==='posted'){
      document.querySelector('[data-set-status="posted"]')?.click();
      const u=prompt('投稿したnoteのURL（あとででもOK）',s.noteUrl||''); if(u!==null)s.noteUrl=u.trim();s.copied.posted=true;toast('投稿済みにしました')
    }
    save(); updateDock(a,bar); enhanceDetail();
  }

  async function saveThumbnail(a){
    const W=2280,H=1200,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#111827';ctx.fillRect(0,0,W,H);
    if(a.thumbnailImage){try{const img=await loadImage(a.thumbnailImage);ctx.drawImage(img,0,0,W,H)}catch{}}
    const shouldOverlay=!/\.svg(?:\?|$)/i.test(a.thumbnailImage||'');
    if(shouldOverlay){
      const lines=String(a.thumbnailText||'').split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,4);
      const work=lines.shift()||a.work||''; ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=14;ctx.shadowOffsetY=4;
      ctx.font='700 62px system-ui, sans-serif';ctx.fillStyle='#fff';ctx.fillText(work,W/2,250);
      const main=lines.slice(0,2);ctx.font='900 132px system-ui, sans-serif';main.forEach((t,i)=>fitText(ctx,t,W*.78,W/2,510+i*160));
      if(lines[2]){ctx.font='700 58px system-ui, sans-serif';fitText(ctx,lines[2],W*.72,W/2,890)}
    }
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png',1));const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`mitaato-${a.id}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function fitText(ctx,text,maxWidth,x,y){let size=parseInt(ctx.font)||100;while(ctx.measureText(text).width>maxWidth&&size>44){size-=4;ctx.font=ctx.font.replace(/\d+px/,`${size}px`)}ctx.fillText(text,x,y)}
  function loadImage(src){return new Promise((res,rej)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>res(img);img.onerror=rej;img.src=src+(src.includes('?')?'&':'?')+'v='+Date.now()})}

  function enhance(){observerScheduled=false;document.body.dataset.appVersion=VERSION;const v=document.querySelector('.version');if(v)v.textContent=VERSION;enhanceCards();enhanceDetail()}
  function schedule(){if(observerScheduled)return;observerScheduled=true;requestAnimationFrame(enhance)}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('[data-article-id],#refreshButton,[data-status-filter]'))setTimeout(schedule,50)});
  window.addEventListener('pageshow',schedule);schedule();
})();
