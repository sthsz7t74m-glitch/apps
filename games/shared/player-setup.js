/* GameBOX: shared optional player setup */
(function(){
 'use strict';
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 function create({root,min=2,max=8,initial=4,onChange=()=>{}}){
   const host=typeof root==='string'?document.getElementById(root):root;
   if(!host)throw new Error('Player setup container missing');
   let count=Math.min(max,Math.max(min,initial));
   const saved=Array(max).fill('');
   host.classList.add('gb-player-setup');
   host.innerHTML='<div class="gb-player-head"><strong>参加人数</strong><small>名前は任意・未入力なら A・B・C…</small></div><div class="gb-player-count" role="group" aria-label="参加人数"></div><div class="gb-player-grid"></div>';
   const counts=host.querySelector('.gb-player-count'),grid=host.querySelector('.gb-player-grid');
   for(let i=min;i<=max;i++){const btn=document.createElement('button');btn.type='button';btn.textContent=i+'人';btn.dataset.count=i;btn.addEventListener('click',()=>{count=i;draw();onChange()});counts.append(btn)}
   function getNames(){return Array.from({length:count},(_,i)=>saved[i].trim()||alphabet[i])}
   function draw(){
     counts.querySelectorAll('button').forEach(btn=>{let active=Number(btn.dataset.count)===count;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
     grid.replaceChildren();
     for(let i=0;i<count;i++){
       const row=document.createElement('div');row.className='gb-player-row';
       const label=document.createElement('label');label.textContent=alphabet[i];label.htmlFor='gb-player-'+i;
       const input=document.createElement('input');input.id='gb-player-'+i;input.type='text';input.autocomplete='off';input.maxLength=16;input.placeholder=alphabet[i];input.value=saved[i];input.setAttribute('aria-label','プレイヤー'+alphabet[i]+'の名前（任意）');
       input.addEventListener('input',()=>{saved[i]=input.value;onChange()});row.append(label,input);grid.append(row);
     }
   }
   function validate(){const names=getNames();if(new Set(names).size!==names.length){alert('同じ名前は使用できません');return null}return names}
   draw();
   return {getNames,validate,getCount:()=>count,reset:()=>{saved.fill('');count=Math.min(max,Math.max(min,initial));draw();onChange()}};
 }
 window.GamePlayers={create};
})();
