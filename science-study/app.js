const STORAGE_KEY = 'science_whiteboard_plus_v2';
let state = loadState();
let activeFilters = {grade:'all', field:'all'};
let currentUnit = null;
let boardIndex = 0;
let quizState = null;
let analysisMode = 'pref';
let memoryFilter = {grade:'all', field:'all', type:'all'};
let memoryOrder = [];
let allAnswersVisible = false;

function loadState(){
  const base = {learned:{}, stats:{correct:0,total:0,solved:0}, weak:[], lastMode:null, memoryRemembered:{}, memoryWeak:{}};
  try{ return Object.assign(base, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch(e){ return base; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uniqWeak(){
  const seen = new Set();
  state.weak = state.weak.filter(item=>{
    const key = `${item.unitId}-${item.q}`;
    if(seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(-100);
}
function showScreen(id){
  document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='analysis') renderAnalysis();
  if(id==='memory') renderMemory();
  setActiveTab(id);
}
function tabNav(id, btn){
  if(id==='home') showScreen('home');
  if(id==='analysis') showScreen('analysis');
  if(id==='memory') showScreen('memory');
  if(btn) setNavBtn(btn);
}
function setNavBtn(btn){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function setActiveTab(id){
  const btns = document.querySelectorAll('#tabs button');
  btns.forEach(b=>b.classList.remove('active'));
  if(id==='home') btns[0].classList.add('active');
  if(id==='memory') btns[1].classList.add('active');
  if(id==='analysis') btns[4].classList.add('active');
}
function renderFilters(){
  const wrap = document.getElementById('filters');
  const grades = ['all',1,2,3];
  const fields = ['all','物理','化学','生物','地学'];
  const make = (list, key, fmt=v=>v==='all'?'すべて':`中${v}`) => list.map(v=>`<button class="chip ${activeFilters[key]===v?'active':''}" onclick="setFilter('${key}','${v}')">${fmt(v)}</button>`).join('');
  wrap.innerHTML = make(grades,'grade',v=>v==='all'?'すべて':`中${v}`) + make(fields,'field',v=>v==='all'?'全分野':v);
}
function setFilter(key, value){
  activeFilters[key] = value === 'all' ? 'all' : (key==='grade' ? Number(value) : value);
  renderFilters(); renderUnits();
}
function filteredUnits(){
  return UNITS.filter(u => (activeFilters.grade==='all' || u.grade===activeFilters.grade) && (activeFilters.field==='all' || u.field===activeFilters.field));
}
function unitProgress(unit){ return state.learned[unit.id] ? 100 : 0; }
function renderUnits(){
  const units = filteredUnits();
  document.getElementById('unitCountLabel').textContent = `全${UNITS.length}単元`;
  document.getElementById('units').innerHTML = units.map(u=>`
    <button class="card" onclick="openUnit('${u.id}')">
      <div class="icon">${u.icon}</div><h3>${u.title}</h3>
      <p>中${u.grade}・${u.field}<br>${u.desc}</p>
      <small>${state.learned[u.id] ? '学習済み' : `教材 ${u.boards.length}ページ`}</small>
      <div class="bar"><i style="width:${unitProgress(u)}%"></i></div>
    </button>`).join('');
}
function renderSummaryCards(){
  document.getElementById('summaryCards').innerHTML = SUMMARY_SETS.map(s=>`
    <button class="card" onclick="startQuizMode('summary','${s.id}')"><div class="icon">${s.icon}</div><h3>${s.title}</h3><p>${s.desc}</p><small>総まとめ演習</small></button>`).join('');
}
function updateStats(){
  const totalUnitsLearned = Object.values(state.learned).filter(Boolean).length;
  const rate = state.stats.total ? Math.round(state.stats.correct / state.stats.total * 100) : 0;
  document.getElementById('statLearned').textContent = totalUnitsLearned;
  document.getElementById('statRate').textContent = `${rate}%`;
  document.getElementById('statWeak').textContent = state.weak.length;
  document.getElementById('statSolved').textContent = state.stats.solved || 0;
}
function openUnit(id){
  currentUnit = UNITS.find(u=>u.id===id); boardIndex = 0; renderBoard(); showScreen('lesson');
}
function renderBoard(){
  const page = currentUnit.boards[boardIndex];
  document.getElementById('board').innerHTML = `<h2>${page.title}</h2>${page.content}`;
  document.getElementById('dots').innerHTML = currentUnit.boards.map((_,i)=>`<span class="dot ${i===boardIndex?'active':''}"></span>`).join('');
}
function moveBoard(delta){
  if(!currentUnit) return;
  boardIndex = Math.min(currentUnit.boards.length-1, Math.max(0, boardIndex + delta)); renderBoard();
}
function startRandomLesson(){ openUnit(UNITS[Math.floor(Math.random() * UNITS.length)].id); }
function markLearned(){
  if(!currentUnit) return;
  state.learned[currentUnit.id] = true; saveState(); updateStats(); renderUnits();
}
function buildQuestions(mode, arg){
  if(mode==='unit' && currentUnit) return shuffle([...currentUnit.questions]).slice(0, Math.min(8,currentUnit.questions.length)).map(q=>({...q, unitId:currentUnit.id}));
  if(mode==='exam') return shuffle(UNITS.flatMap(u=>u.questions.map(q=>({...q, unitId:u.id, unitTitle:u.title})))).slice(0,10);
  if(mode==='weak') return shuffle([...state.weak]).slice(0,10);
  if(mode==='summary'){
    const set = SUMMARY_SETS.find(s=>s.id===arg); let pool = [];
    if(set) pool = UNITS.filter(u => (set.type==='grade' ? u.grade===set.target : u.field===set.target)).flatMap(u=>u.questions.map(q=>({...q, unitId:u.id, unitTitle:u.title})));
    else pool = UNITS.flatMap(u=>u.questions.map(q=>({...q, unitId:u.id, unitTitle:u.title})));
    return shuffle(pool).slice(0,10);
  }
  return [];
}
function startQuizMode(mode, arg){
  const questions = buildQuestions(mode, arg);
  if(!questions.length){ alert(mode==='weak' ? '苦手問題がまだありません。' : '問題データがありません。'); return; }
  state.lastMode = {mode, arg}; saveState();
  quizState = {mode, arg, questions, index:0, score:0};
  document.getElementById('resultBox').style.display = 'none';
  document.getElementById('quizBox').style.display = 'block'; renderQuestion(); showScreen('quiz');
}
function retryCurrentMode(){ if(state.lastMode) startQuizMode(state.lastMode.mode, state.lastMode.arg); }
function renderQuestion(){
  const q = quizState.questions[quizState.index];
  document.getElementById('quizType').textContent = quizLabel(quizState.mode, quizState.arg);
  document.getElementById('quizCount').textContent = `${quizState.index+1} / ${quizState.questions.length}`;
  document.getElementById('question').textContent = q.q;
  document.getElementById('choices').innerHTML = q.c.map((choice,i)=>`<button class="choice" onclick="answerQuestion(${i})">${String.fromCharCode(65+i)}. ${choice}</button>`).join('');
  document.getElementById('explain').style.display = 'none';
  document.getElementById('nextBtn').style.display = 'none';
}
function answerQuestion(idx){
  const q = quizState.questions[quizState.index];
  [...document.querySelectorAll('.choice')].forEach((b,i)=>{ b.disabled=true; if(i===q.a)b.classList.add('correct'); if(i===idx&&i!==q.a)b.classList.add('wrong'); });
  const correct = idx===q.a;
  if(correct) quizState.score++; else { state.weak.push({...q}); uniqWeak(); }
  state.stats.total++; state.stats.solved++; if(correct) state.stats.correct++;
  saveState(); updateStats();
  const explain=document.getElementById('explain'); explain.style.display='block'; explain.innerHTML=`<b>${correct?'正解':'不正解'}</b><br>${q.e}`;
  document.getElementById('nextBtn').style.display='block';
}
function nextQuestion(){ quizState.index++; if(quizState.index>=quizState.questions.length) finishQuiz(); else renderQuestion(); }
function finishQuiz(){
  const rate=Math.round(quizState.score/quizState.questions.length*100);
  document.getElementById('quizBox').style.display='none'; document.getElementById('resultBox').style.display='block'; document.getElementById('scoreText').textContent=`${rate}%`;
  document.getElementById('resultText').textContent=rate===100?'満点！ 次は発展教材へ。':rate>=70?'かなり良い調子。間違いを暗記シートに追加して復習しよう。':rate<50?'ホワイトボード教材と暗記シートで基本から見直そう。':'あと少し。苦手を絞って復習しよう。';
}
function quizLabel(mode,arg){
  if(mode==='unit') return `${currentUnit?.title||''} 単元テスト`;
  if(mode==='exam') return '高校入試ミックス'; if(mode==='weak') return '苦手復習';
  if(mode==='summary'){ const set=SUMMARY_SETS.find(s=>s.id===arg); return set?set.title:'総まとめ'; }
  return '問題演習';
}
function switchAnalysis(mode){
  analysisMode=mode;
  document.getElementById('prefTabBtn').className=`btn ${mode==='pref'?'secondary':'ghost'}`;
  document.getElementById('schoolTabBtn').className=`btn ${mode==='school'?'secondary':'ghost'}`;
  renderAnalysis();
}
function renderAnalysis(){
  const list=analysisMode==='pref'?PREF_ANALYSIS:SCHOOL_ANALYSIS;
  document.getElementById('analysisArea').innerHTML=`<div class="analysisList">${list.map(item=>`<div class="analysis"><h3>${item.name}</h3>${item.level?`<p><b>難度感：</b>${item.level}</p>`:''}<p>${item.body}</p>${item.tags?`<p><b>特徴：</b>${item.tags.join(' / ')}</p>`:''}<ul>${item.points?item.points.map(p=>`<li>${p}</li>`).join(''):item.tips.map(t=>`<li>${t}</li>`).join('')}</ul></div>`).join('')}</div>`;
}
function renderMemoryFilters(){
  const grades=[['all','全学年'],['1','中1'],['2','中2'],['3','中3'],['0','入試']];
  const fields=['all','物理','化学','生物','地学','入試'];
  const types=['all','用語','暗記','公式','法則','実験','記述'];
  document.getElementById('memoryFilters').innerHTML=grades.map(([v,l])=>`<button class="chip ${String(memoryFilter.grade)===v?'active':''}" onclick="setMemoryFilter('grade','${v}')">${l}</button>`).join('')+fields.map(v=>`<button class="chip ${memoryFilter.field===v?'active':''}" onclick="setMemoryFilter('field','${v}')">${v==='all'?'全分野':v}</button>`).join('')+types.map(v=>`<button class="chip ${memoryFilter.type===v?'active':''}" onclick="setMemoryFilter('type','${v}')">${v==='all'?'全種類':v}</button>`).join('');
}
function setMemoryFilter(key,value){ memoryFilter[key]=key==='grade'?(value==='all'?'all':Number(value)):value; renderMemory(); }
function memoryItems(){
  let items=MEMORY_CARDS.filter(x=>(memoryFilter.grade==='all'||x.grade===memoryFilter.grade)&&(memoryFilter.field==='all'||x.field===memoryFilter.field)&&(memoryFilter.type==='all'||x.type===memoryFilter.type));
  if(memoryOrder.length){ const pos=new Map(memoryOrder.map((id,i)=>[id,i])); items=[...items].sort((a,b)=>(pos.get(a.id)??999)-(pos.get(b.id)??999)); }
  return items;
}
function renderMemory(){
  renderMemoryFilters(); const items=memoryItems();
  document.getElementById('memoryTotal').textContent=`${items.length}件`;
  document.getElementById('memoryRemembered').textContent=`覚えた ${Object.values(state.memoryRemembered||{}).filter(Boolean).length}`;
  document.getElementById('memoryWeak').textContent=`苦手 ${Object.values(state.memoryWeak||{}).filter(Boolean).length}`;
  document.getElementById('memorySheet').innerHTML=items.map(x=>`<article class="memoryCard ${state.memoryWeak?.[x.id]?'isWeak':''} ${state.memoryRemembered?.[x.id]?'isRemembered':''}"><div class="metaLine"><span>${x.grade?`中${x.grade}`:'入試'}・${x.field}</span><span>${x.type}</span></div><div class="prompt">${x.q}</div><div id="ans-${x.id}" class="answer ${allAnswersVisible?'':'hidden'}">${x.a}<br><small>${x.note||''}</small></div><div class="memoryActions"><button class="showBtn" onclick="toggleMemoryAnswer('${x.id}')">答え</button><button class="remembered" onclick="markMemory('${x.id}','remembered')">覚えた</button><button class="weakBtn" onclick="markMemory('${x.id}','weak')">苦手</button></div></article>`).join('')||'<div class="panel">該当する暗記カードがありません。</div>';
}
function toggleMemoryAnswer(id){ document.getElementById(`ans-${id}`)?.classList.toggle('hidden'); }
function toggleAllAnswers(){ allAnswersVisible=!allAnswersVisible; renderMemory(); }
function markMemory(id,kind){
  state.memoryRemembered=state.memoryRemembered||{}; state.memoryWeak=state.memoryWeak||{};
  if(kind==='remembered'){ state.memoryRemembered[id]=!state.memoryRemembered[id]; if(state.memoryRemembered[id]) state.memoryWeak[id]=false; }
  else { state.memoryWeak[id]=!state.memoryWeak[id]; if(state.memoryWeak[id]) state.memoryRemembered[id]=false; }
  saveState(); renderMemory();
}
function shuffleMemory(){ memoryOrder=MEMORY_CARDS.map(x=>x.id).sort(()=>Math.random()-.5); renderMemory(); }
function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
(function init(){ renderFilters(); renderUnits(); renderSummaryCards(); updateStats(); switchAnalysis('pref'); if(typeof MEMORY_CARDS!=='undefined') renderMemory(); })();