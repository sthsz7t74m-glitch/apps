(()=>{
'use strict';
const D=window.DATA,app=document.querySelector('#app'),$=s=>document.querySelector(s);
let mode=60,answers=[],current=null,locked=false,screen='home',timer;
const modes={30:['簡易診断','約3〜5分','まずは気軽にチェック'],60:['標準診断','約6〜10分','おすすめのバランス'],120:['精密診断','約12〜20分','より多くの語彙を測定']};
const fmt=n=>Math.round(n).toLocaleString('ja-JP'),pct=n=>Math.round(n*100)+'%',clamp=x=>Math.max(0,Math.min(1,x));
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,def){try{return JSON.parse(localStorage.getItem(key))??def}catch{return def}}
function write(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function summarize(arr){let c=arr.filter(a=>a.result==='correct').length,w=arr.filter(a=>a.result==='wrong').length,n=arr.length;return{c,w,n,u:n-c-w,p:n?clamp((c-w/3)/n):0}}
function byLevel(){return Array.from({length:10},(_,i)=>answers.filter(a=>a.q.l===i))}
function levelLabel(p){return p>=.85?'幅広い語彙理解':p>=.65?'高い語彙理解':p>=.45?'中程度の語彙理解':p>=.25?'基礎〜中級の語彙理解':'基礎語彙を形成中'}
function historyHTML(){const h=read('vocab-history-v1',[]);return h.length?h.slice(0,5).map((x,i)=>`<div class="history-entry"><div><b>${fmt(x.estimate)}語</b><div class="small muted">${safe(x.date)} · ${x.mode}問</div></div><span class="small muted">${i===0?'最新':(x.estimate-h[0].estimate>0?'+':'')+fmt(x.estimate-h[0].estimate)+'語'}</span></div>`).join(''):'<p class="small muted" style="margin-top:10px">診断を完了すると、結果がここに保存されます。</p>'}
function home(){clearTimeout(timer);screen='home';document.body.classList.remove('testing');app.innerHTML=`<section class="hero fade"><span class="kicker">JAPANESE VOCABULARY TEST</span><h1>あなたの語彙力、<br>何語くらい？</h1><p class="muted">単語の意味を選ぶだけ。<br>知っている日本語の語彙数を推定します。</p><div class="facts"><span class="fact"><b>10</b> 難易度</span><span class="fact"><b>${D.items.length}</b> 問収録</span><span class="fact"><b>${fmt(D.total)}</b> 語を基準</span></div></section><div class="section-title"><h2>診断モード</h2><button class="link about">測定方法</button></div><div class="modes">${Object.entries(modes).map(([n,v])=>`<button class="mode ${+n===mode?'selected':''}" data-mode="${n}" aria-pressed="${+n===mode}"><span class="num">${n}<small>問</small></span><span class="mode-info"><strong>${v[0]} ${+n===60?' <span class="pill">推奨</span>':''}</strong><span class="small muted">${v[1]} · ${v[2]}</span></span><span class="radio"></span></button>`).join('')}</div><button class="primary" id="start">診断をはじめる</button><section class="card"><h2>診断履歴</h2>${historyHTML()}</section><p class="small muted">国立国語研究所 BCCWJ 語彙頻度表を使用。語彙数は試作モデルによる参考推定です。</p>`;app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=+b.dataset.mode;home()});$('#start').onclick=()=>{answers=[];current=null;locked=false;screen='quiz';next()};bindAbout()}
function bindAbout(){app.querySelectorAll('.about').forEach(b=>b.onclick=()=>$('#about').showModal())}
function chooseQuestion(){
 const groups=byLevel(),used=new Set(answers.map(a=>a.q.w)),remaining=D.items.filter(q=>!used.has(q.w));
 let l=4;
 if(answers.length){
  const min=mode===30?2:mode===60?4:8;
  const need=groups.map((a,i)=>({i,n:Math.max(0,min-a.length)}));
  const deficit=need.reduce((s,x)=>s+x.n,0);
  const previous=answers.at(-1),recent=answers.slice(-5);
  const performance=summarize(recent).p;
  const target=Math.max(0,Math.min(9,previous.q.l+(performance>.7?1:performance<.35?-1:0)));
  const available=i=>remaining.some(q=>q.l===i);
  if(mode-answers.length<=deficit || answers.length%3===1){
   const pool=need.filter(x=>x.n&&available(x.i)).sort((a,b)=>b.n-a.n||Math.abs(a.i-target)-Math.abs(b.i-target));
   l=pool.length?pool[0].i:target;
  }else l=target;
  if(!available(l)) l=Array.from({length:10},(_,i)=>i).filter(available).sort((a,b)=>Math.abs(a-l)-Math.abs(b-l))[0];
 }
 const pool=remaining.filter(q=>q.l===l);
 // Avoid over-representing one part of speech when several are available.
 const counts={};answers.forEach(a=>counts[a.q.p]=(counts[a.q.p]||0)+1);
 const candidates=shuffle(pool).sort((a,b)=>(counts[a.p]||0)-(counts[b.p]||0));
 const q=candidates[Math.floor(Math.random()*Math.min(candidates.length,7))];
 const matching=shuffle(D.items.filter(x=>x.w!==q.w&&x.p===q.p&&Math.abs(x.l-q.l)<=3));
 const other=shuffle(D.items.filter(x=>x.w!==q.w&&!matching.includes(x)));
 const wrong=[...matching,...other].slice(0,3);
 return {q,options:shuffle([q,...wrong])}
}
function next(){if(answers.length>=mode){finish();return}current=chooseQuestion();locked=false;document.body.classList.add('testing');const n=answers.length+1;app.innerHTML=`<section class="quiz fade"><div class="quiz-status"><span>${modes[mode][0]}</span><span>${n} / ${mode} 問</span></div><div class="progress" role="progressbar" aria-valuenow="${answers.length}" aria-valuemax="${mode}" aria-label="診断の進捗"><div style="width:${100*answers.length/mode}%"></div></div><div class="wordcard"><span class="small muted">この単語の意味は？</span><div class="word">${safe(current.q.w)}</div><span class="pill">${safe(current.q.p)}</span></div><div class="choices">${current.options.map((o,i)=>`<button class="choice" data-choice="${i}"><span class="letter">${'ABCD'[i]}</span><span>${safe(o.m)}</span></button>`).join('')}<button class="choice skip" data-choice="-1">わからない</button></div><p class="quiz-note">推測せず、知らない単語は「わからない」を選んでください。</p></section>`;app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>answer(+b.dataset.choice,b))}
function answer(i,button){if(locked||screen!=='quiz')return;locked=true;const {q,options}=current;const selected=i<0?null:options[i];answers.push({q,selected:selected?.m??null,result:i<0?'unknown':selected.w===q.w?'correct':'wrong'});button.classList.add('chosen');app.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);timer=setTimeout(next,170)}
function estimateStats(){
 const groups=byLevel().map(summarize);
 const estimate=groups.reduce((s,g,i)=>s+D.bands[i].n*g.p,0);
 // Approximate reference interval: independent Dirichlet posterior draws for
 // correct, wrong and skipped responses; does not account for item selection bias.
 const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,Math.random())))*Math.cos(2*Math.PI*Math.random());
 const gamma=a=>{if(a<1)return gamma(a+1)*Math.pow(Math.random(),1/a);const d=a-1/3,c=1/Math.sqrt(9*d);for(;;){const x=normal(),v=(1+c*x)**3;if(v<=0)continue;const u=Math.random();if(u<1-.0331*x**4||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v}};
 const sims=Array.from({length:2500},()=>groups.reduce((sum,g,i)=>{const c=gamma(g.c+.5),w=gamma(g.w+.5),u=gamma(g.u+.5);return sum+D.bands[i].n*clamp((c-w/3)/(c+w+u))},0)).sort((a,b)=>a-b);
 const round=x=>Math.max(0,Math.min(D.total,Math.round(x/100)*100));
 return{estimate:round(estimate),lo:Math.min(round(estimate),round(sims[62])),hi:Math.max(round(estimate),round(sims[2437])),groups}
}
function bars(entries){return entries.map(([name,s])=>`<div class="bar-row"><span>${safe(name)}</span><div class="bar"><span style="width:${s.n?100*s.c/s.n:0}%"></span></div><b>${s.n?pct(s.c/s.n):'—'}</b></div><div class="small muted" style="text-align:right;margin-top:-7px">${s.n?s.c+' / '+s.n+'問':'未出題'}</div>`).join('')}
function finish(){screen='result';document.body.classList.remove('testing');const {estimate,lo,hi,groups}=estimateStats(),all=summarize(answers),h=read('vocab-history-v1',[]),prev=h[0];h.unshift({estimate,lo,hi,mode,date:new Date().toLocaleDateString('ja-JP')});write('vocab-history-v1',h.slice(0,30));const pos=['名詞','動詞','形容詞','形状詞','副詞'].map(p=>[p,summarize(answers.filter(a=>a.q.p===p))]);const missed=answers.filter(a=>a.result!=='correct');
 app.innerHTML=`<section class="card score fade"><span class="pill">診断完了 · ${mode}問</span><p class="muted" style="margin-top:18px">推定受容語彙数（参考）</p><div class="big">${fmt(estimate)} <small>語</small></div><div class="range">${fmt(lo)} 〜 ${fmt(hi)}語</div><p class="small muted">モデル上の参考推定範囲</p><h2 style="margin-top:16px">${levelLabel(estimate/D.total)}</h2><div class="stat-grid"><div class="stat"><strong>${all.c}</strong><span class="small muted">正解</span></div><div class="stat"><strong>${all.w}</strong><span class="small muted">不正解</span></div><div class="stat"><strong>${all.u}</strong><span class="small muted">わからない</span></div></div><div class="disclaimer">対象はBCCWJから抽出した${fmt(D.total)}語。問題は人間による難易度校正・代表性検証を行っていないため、日本語全体の総語彙数を保証する値ではありません。<button class="link about">測定方法</button></div></section><section class="card"><h2>難易度別の正答率</h2><p class="small muted">Lv.1が高頻度、Lv.10が低頻度です。</p>${bars(groups.map((g,i)=>['Lv.'+(i+1),g]))}</section><section class="card"><h2>品詞別の正答率</h2>${bars(pos)}</section><section class="card"><h2>前回との比較</h2>${prev?`<p class="muted">前回 ${fmt(prev.estimate)}語（${prev.mode}問）</p><h2>${estimate-prev.estimate>=0?'+':''}${fmt(estimate-prev.estimate)}語</h2><p class="small muted">推定のばらつきがあるため、変化は参考値です。</p>`:'<p class="muted">初回の診断です。</p>'}</section><section class="card"><h2>復習 <span class="pill">${missed.length}語</span></h2>${missed.length?missed.map(a=>`<div class="review"><h3>${safe(a.q.w)} <span class="small muted">Lv.${a.q.l+1}</span></h3><p class="bad">回答：${safe(a.selected??'わからない')}</p><p class="good">正解：${safe(a.q.m)}</p></div>`).join(''):'<p class="good">全問正解です！</p>'}</section><button class="primary" id="again">もう一度診断する</button>`;
 $('#again').onclick=home;bindAbout();window.scrollTo(0,0)
}
$('#method').innerHTML=`<p><b>測定の範囲</b><br>受容語彙（単語の意味を理解できる力）を測定します。発話・作文で使える語彙、固有名詞、助詞、全ての専門語は対象外です。</p><p><b>使用データ</b><br>国立国語研究所「現代日本語書き言葉均衡コーパス（BCCWJ）短単位語彙表 Version 1.1」。普通名詞・一般動詞・一般形容詞・一般形状詞・副詞を抽出し、語彙素表記で重複を統合、合計出現頻度10以上の${fmt(D.total)}語を母集団とします。頻度順に10等分し、各帯から選んだ${D.items.length}語の意味を独自に編集しました。<br><a target="_blank" rel="noopener" href="https://repository.ninjal.ac.jp/records/3235">原データと利用条件</a></p><p><b>出題・推定方法</b><br>最初は中間の難易度から出題し、直近の成績で頻度帯を調整します。各帯を最低2・4・8問ずつ測り、頻度帯別に「正解数 − 不正解数÷3」を出題数で割り（0〜1に制限）、対象語数を掛けて合計します。「わからない」は0点。4択でのランダムな推測を考慮した補正です。</p><p><b>推定範囲と限界</b><br>正解・不正解・不明の確率に弱い事前分布（各0.5）を置き、2,500回のシミュレーションで中央95%に相当する範囲を参考として算出します。問題選択の偏り、漢字からの類推、適応出題の影響は含みません。難易度は頻度で代用しており、心理測定上の実測難易度ではありません。母集団への外挿は試験的で、年齢別平均や偏差値は表示しません。</p><p><b>語彙レベル</b><br>対象語彙の推定理解割合を5段階に表示する、このアプリ独自の目安です。結果は端末のブラウザ内に保存します。</p>`;
 $('#close').onclick=()=>$('#about').close();
 $('#home').onclick=e=>{e.preventDefault();if(screen!=='quiz'||confirm('診断を中断してホームに戻りますか？'))home()};
 const init=read('vocab-theme',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
 function theme(t){document.documentElement.dataset.theme=t;$('#theme').textContent=t==='dark'?'☀':'☾';write('vocab-theme',t)}
 theme(init);$('#theme').onclick=()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark');
 document.addEventListener('dblclick',e=>{if(e.target.closest('button'))e.preventDefault()},{passive:false});
 home()
})();
