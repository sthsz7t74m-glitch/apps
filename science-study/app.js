const STORAGE_KEY = 'science_whiteboard_plus_v2';
let state = loadState();
let activeFilters = {grade:'all', field:'all'};
let currentUnit = null;
let boardIndex = 0;
let quizState = null;
let analysisMode = 'pref';

function loadState(){
  const base = {learned:{}, stats:{correct:0,total:0,solved:0}, weak:[], lastMode:null};
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
  setActiveTab(id);
}
function tabNav(id, btn){
  if(id==='home') showScreen('home');
  if(id==='analysis') showScreen('analysis');
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
  if(id==='analysis') btns[3].classList.add('active');
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
function unitProgress(unit){
  const done = state.learned[unit.id] ? 100 : 0;
  return done;
}
function renderUnits(){
  const units = filteredUnits();
  document.getElementById('unitCountLabel').textContent = `全${UNITS.length}単元`;
  const el = document.getElementById('units');
  el.innerHTML = units.map(u=>`
    <button class="card" onclick="openUnit('${u.id}')">
      <div class="icon">${u.icon}</div>
      <h3>${u.title}</h3>
      <p>中${u.grade}・${u.field}<br>${u.desc}</p>
      <small>${state.learned[u.id] ? '学習済み' : '未学習'}</small>
      <div class="bar"><i style="width:${unitProgress(u)}%"></i></div>
    </button>
  `).join('');
}

function renderSummaryCards(){
  const el = document.getElementById('summaryCards');
  el.innerHTML = SUMMARY_SETS.map(s=>`
    <button class="card" onclick="startQuizMode('summary','${s.id}')">
      <div class="icon">${s.icon}</div>
      <h3>${s.title}</h3>
      <p>${s.desc}</p>
      <small>総まとめ演習</small>
    </button>
  `).join('');
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
  currentUnit = UNITS.find(u=>u.id===id);
  boardIndex = 0;
  renderBoard();
  showScreen('lesson');
}
function renderBoard(){
  const page = currentUnit.boards[boardIndex];
  document.getElementById('board').innerHTML = `<h2>${page.title}</h2>${page.content}`;
  document.getElementById('dots').innerHTML = currentUnit.boards.map((_,i)=>`<span class="dot ${i===boardIndex?'active':''}"></span>`).join('');
}
function moveBoard(delta){
  if(!currentUnit) return;
  boardIndex = Math.min(currentUnit.boards.length-1, Math.max(0, boardIndex + delta));
  renderBoard();
}
function startRandomLesson(){
  const unit = UNITS[Math.floor(Math.random() * UNITS.length)];
  openUnit(unit.id);
}
function markLearned(){
  if(!currentUnit) return;
  state.learned[currentUnit.id] = true;
  saveState(); updateStats(); renderUnits();
}

function buildQuestions(mode, arg){
  if(mode==='unit' && currentUnit) return shuffle([...currentUnit.questions]).slice(0, Math.min(8,currentUnit.questions.length)).map(q=>({...q, unitId:currentUnit.id}));
  if(mode==='exam') return shuffle(UNITS.flatMap(u=>u.questions.map(q=>({...q, unitId:u.id, unitTitle:u.title})))).slice(0,10);
  if(mode==='weak') return shuffle([...state.weak]).slice(0,10);
  if(mode==='summary'){
    const set = SUMMARY_SETS.find(s=>s.id===arg);
    let pool = [];
    if(set){
      pool = UNITS.filter(u => (set.type==='grade' ? u.grade===set.target : u.field===set.target)).flatMap(u=>u.questions.map(q=>({...q, unitId:u.id, unitTitle:u.title})));
    } else {
      pool = UNITS.flatMap(u=>u.questions.map(q=>({...q, unitId:u.id, unitTitle:u.title})));
    }
    return shuffle(pool).slice(0,10);
  }
  return [];
}

function startQuizMode(mode, arg){
  const questions = buildQuestions(mode, arg);
  if(!questions.length){
    alert(mode==='weak' ? '苦手問題がまだありません。' : '問題データがありません。');
    return;
  }
  state.lastMode = {mode, arg}; saveState();
  quizState = {mode, arg, questions, index:0, score:0, answered:0, reviewed:false};
  document.getElementById('resultBox').style.display = 'none';
  document.getElementById('quizBox').style.display = 'block';
  renderQuestion();
  showScreen('quiz');
}
function retryCurrentMode(){
  if(!state.lastMode) return;
  startQuizMode(state.lastMode.mode, state.lastMode.arg);
}
function renderQuestion(){
  const q = quizState.questions[quizState.index];
  document.getElementById('quizType').textContent = quizLabel(quizState.mode, quizState.arg);
  document.getElementById('quizCount').textContent = `${quizState.index+1} / ${quizState.questions.length}`;
  document.getElementById('question').textContent = q.q;
  document.getElementById('choices').innerHTML = q.c.map((choice,i)=>`<button class="choice" onclick="answerQuestion(${i})">${String.fromCharCode(65+i)}. ${choice}</button>`).join('');
  document.getElementById('explain').style.display = 'none';
  document.getElementById('explain').textContent = q.e;
  document.getElementById('nextBtn').style.display = 'none';
}
function answerQuestion(idx){
  const q = quizState.questions[quizState.index];
  const buttons = [...document.querySelectorAll('.choice')];
  buttons.forEach((b,i)=>{
    b.disabled = true;
    if(i===q.a) b.classList.add('correct');
    if(i===idx && i!==q.a) b.classList.add('wrong');
  });
  const correct = idx===q.a;
  if(correct) quizState.score++;
  else {
    state.weak.push({...q}); uniqWeak();
  }
  state.stats.total++;
  state.stats.solved++;
  if(correct) state.stats.correct++;
  saveState(); updateStats();
  const explain = document.getElementById('explain');
  explain.style.display = 'block';
  explain.innerHTML = `<b>${correct ? '正解' : '不正解'}</b><br>${q.e}`;
  document.getElementById('nextBtn').style.display = 'block';
}
function nextQuestion(){
  quizState.index++;
  if(quizState.index >= quizState.questions.length){
    finishQuiz(); return;
  }
  renderQuestion();
}
function finishQuiz(){
  const rate = Math.round(quizState.score / quizState.questions.length * 100);
  document.getElementById('quizBox').style.display = 'none';
  document.getElementById('resultBox').style.display = 'block';
  document.getElementById('scoreText').textContent = `${rate}%`;
  let msg = '復習しながら繰り返すと定着しやすい。';
  if(rate===100) msg = '満点！ 次は入試ミックスや都道府県別分析も見てみよう。';
  else if(rate>=70) msg = 'かなり良い調子。間違えた問題を中心に見直そう。';
  else if(rate<50) msg = 'まずはホワイトボード授業を見直して基本を固めよう。';
  document.getElementById('resultText').textContent = msg;
}
function quizLabel(mode,arg){
  if(mode==='unit') return `${currentUnit?.title || ''} 単元テスト`;
  if(mode==='exam') return '高校入試ミックス';
  if(mode==='weak') return '苦手復習';
  if(mode==='summary'){
    const set = SUMMARY_SETS.find(s=>s.id===arg);
    return set ? set.title : '総まとめ';
  }
  return '問題演習';
}

function switchAnalysis(mode){
  analysisMode = mode;
  document.getElementById('prefTabBtn').className = `btn ${mode==='pref'?'secondary':'ghost'}`;
  document.getElementById('schoolTabBtn').className = `btn ${mode==='school'?'secondary':'ghost'}`;
  renderAnalysis();
}
function renderAnalysis(){
  const area = document.getElementById('analysisArea');
  const list = analysisMode==='pref' ? PREF_ANALYSIS : SCHOOL_ANALYSIS;
  area.innerHTML = `<div class="analysisList">${list.map(item=>
    `<div class="analysis"><h3>${item.name}</h3>${item.level ? `<p><b>難度感：</b>${item.level}</p>`:''}<p>${item.body}</p>${item.tags ? `<p><b>特徴：</b>${item.tags.join(' / ')}</p>`:''}<ul>${item.points ? item.points.map(p=>`<li>${p}</li>`).join('') : item.tips.map(t=>`<li>${t}</li>`).join('')}</ul></div>`
  ).join('')}</div>`;
}

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

(function init(){
  renderFilters();
  renderUnits();
  renderSummaryCards();
  updateStats();
  switchAnalysis('pref');
})();
