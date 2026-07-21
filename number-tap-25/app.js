const grid=document.querySelector('#grid');
const timeEl=document.querySelector('#time');
const nextEl=document.querySelector('#next');
const bestEl=document.querySelector('#best');
const progressEl=document.querySelector('#progress');
const messageEl=document.querySelector('#message');
const startButton=document.querySelector('#start');
const resetBestButton=document.querySelector('#resetBest');
const sizeDown=document.querySelector('#sizeDown');
const sizeUp=document.querySelector('#sizeUp');
const sizeLabel=document.querySelector('#sizeLabel');
const totalLabel=document.querySelector('#totalLabel');
const fillMode=document.querySelector('#fillMode');
const rotateMode=document.querySelector('#rotateMode');
const moveMode=document.querySelector('#moveMode');
const modeName=document.querySelector('#modeName');

let gridSize=5;
let total=25;
let expected=1;
let playing=false;
let startedAt=0;
let animationId=0;
let board=[];
let rotation=0;

function shuffle(values){
  for(let i=values.length-1;i>0;i-=1){
    const j=Math.floor(Math.random()*(i+1));
    [values[i],values[j]]=[values[j],values[i]];
  }
  return values;
}

function ruleCode(){
  return `${fillMode.checked?'F':'N'}${rotateMode.checked?'R':'N'}${moveMode.checked?'M':'N'}`;
}

function bestKey(){
  return `numberTapBest-${gridSize}-${ruleCode()}`;
}

function getBest(){
  const value=Number(localStorage.getItem(bestKey()));
  return Number.isFinite(value)&&value>0?value:null;
}

function showBest(){
  const best=getBest();
  bestEl.textContent=best?best.toFixed(2):'--';
}

function updateModeName(){
  const count=[fillMode,rotateMode,moveMode].filter(input=>input.checked).length;
  modeName.textContent=count===0?'NORMAL':count===1?'HARD':count===2?'EXPERT':'MASTER';
  showBest();
}

function setSettingsDisabled(disabled){
  fillMode.disabled=disabled;
  rotateMode.disabled=disabled;
  moveMode.disabled=disabled;
  sizeDown.disabled=disabled||gridSize<=3;
  sizeUp.disabled=disabled||gridSize>=10;
}

function updateSizeUi(){
  total=gridSize*gridSize;
  sizeLabel.textContent=`${gridSize}×${gridSize}`;
  totalLabel.textContent=`1〜${total}`;
  progressEl.textContent=`0 / ${total}`;
  nextEl.textContent='1';
  grid.style.setProperty('--grid-size',gridSize);
  grid.style.setProperty('--grid-gap',`${Math.max(2,8-gridSize*.65)}px`);
  grid.style.setProperty('--number-size',`${Math.max(11,29-gridSize*1.7)}px`);
  setSettingsDisabled(false);
  showBest();
  createBoard();
  renderGrid(false);
}

function createBoard(){
  board=shuffle(Array.from({length:total},(_,index)=>index+1));
  rotation=0;
  grid.style.transform='rotate(0deg)';
}

function renderGrid(enabled=true){
  grid.replaceChildren();
  board.forEach(value=>{
    if(value===null){
      const hole=document.createElement('span');
      hole.className='number-button done';
      hole.setAttribute('aria-hidden','true');
      grid.append(hole);
      return;
    }
    const button=document.createElement('button');
    button.className='number-button';
    button.type='button';
    button.textContent=value;
    button.disabled=!enabled;
    button.setAttribute('aria-label',String(value));
    button.addEventListener('click',()=>handleTap(button,value));
    grid.append(button);
  });
}

function updateTimer(){
  if(!playing)return;
  timeEl.textContent=((performance.now()-startedAt)/1000).toFixed(2);
  animationId=requestAnimationFrame(updateTimer);
}

function moveSomeNumbers(){
  const positions=board.map((value,index)=>value===null?null:index).filter(index=>index!==null);
  const amount=Math.min(5,positions.length);
  const selected=shuffle([...positions]).slice(0,amount);
  const values=shuffle(selected.map(index=>board[index]));
  selected.forEach((index,i)=>{board[index]=values[i]});
}

function rotateBoard(){
  const turns=[90,180,270];
  rotation=(rotation+turns[Math.floor(Math.random()*turns.length)])%360;
  grid.style.transform=`rotate(${rotation}deg) scale(.96)`;
  window.setTimeout(()=>{grid.style.transform=`rotate(${rotation}deg)`},220);
}

function handleTap(button,number){
  if(!playing)return;
  if(number!==expected){
    button.classList.remove('wrong');
    void button.offsetWidth;
    button.classList.add('wrong');
    navigator.vibrate?.(20);
    return;
  }

  const index=board.indexOf(number);
  if(fillMode.checked)board.splice(index,1);
  else board[index]=null;

  progressEl.textContent=`${number} / ${total}`;
  if(number===total){
    finishGame();
    return;
  }

  expected+=1;
  nextEl.textContent=expected;
  messageEl.textContent=`${expected} をタップ！`;

  if(moveMode.checked)moveSomeNumbers();
  renderGrid(true);
  if(rotateMode.checked&&number%5===0)rotateBoard();
}

function startGame(){
  cancelAnimationFrame(animationId);
  expected=1;
  playing=true;
  timeEl.textContent='0.00';
  nextEl.textContent='1';
  progressEl.textContent=`0 / ${total}`;
  messageEl.textContent='1 をタップ！';
  startButton.textContent='やり直す';
  setSettingsDisabled(true);
  createBoard();
  renderGrid(true);
  startedAt=performance.now();
  updateTimer();
}

function finishGame(){
  playing=false;
  cancelAnimationFrame(animationId);
  const result=(performance.now()-startedAt)/1000;
  timeEl.textContent=result.toFixed(2);
  nextEl.textContent='✓';
  progressEl.textContent=`${total} / ${total}`;
  const oldBest=getBest();
  const isNewBest=!oldBest||result<oldBest;
  if(isNewBest)localStorage.setItem(bestKey(),String(result));
  showBest();
  messageEl.textContent=isNewBest?`新記録！ ${result.toFixed(2)}秒`:`クリア！ ${result.toFixed(2)}秒`;
  startButton.textContent='もう一度';
  setSettingsDisabled(false);
  renderGrid(false);
  navigator.vibrate?.([40,40,80]);
}

function changeSize(delta){
  if(playing)return;
  gridSize=Math.min(10,Math.max(3,gridSize+delta));
  timeEl.textContent='0.00';
  messageEl.textContent='サイズとルールを選んでスタート！';
  updateSizeUi();
}

startButton.addEventListener('click',startGame);
sizeDown.addEventListener('click',()=>changeSize(-1));
sizeUp.addEventListener('click',()=>changeSize(1));
[fillMode,rotateMode,moveMode].forEach(input=>input.addEventListener('change',()=>{
  updateModeName();
  messageEl.textContent='ルールを変更しました';
}));
resetBestButton.addEventListener('click',()=>{
  localStorage.removeItem(bestKey());
  showBest();
  messageEl.textContent=`現在の条件のベストを削除しました`;
});

updateModeName();
updateSizeUi();
if('serviceWorker'in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=1.2.0'));
}