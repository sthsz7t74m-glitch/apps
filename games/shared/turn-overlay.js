/* GameBOX: shared turn transition popup */
(function(){
 'use strict';
 let overlay=null,timer=null;
 function ensure(){
   if(overlay)return overlay;
   overlay=document.createElement('div');
   overlay.className='gb-turn-overlay';
   overlay.setAttribute('aria-hidden','true');
   overlay.setAttribute('role','status');
   overlay.innerHTML='<div class="gb-turn-popup"><span class="gb-turn-prefix">次は</span><strong class="gb-turn-name"></strong><span class="gb-turn-suffix">のターン</span></div>';
   document.body.appendChild(overlay);
   return overlay;
 }
 function hide(){
   clearTimeout(timer);timer=null;
   if(overlay){overlay.classList.remove('gb-show');overlay.setAttribute('aria-hidden','true')}
 }
 function show(name,ms=1200){
   hide();const el=ensure();
   el.querySelector('.gb-turn-name').textContent=String(name||'');
   el.classList.add('gb-show');el.setAttribute('aria-hidden','false');
   timer=setTimeout(hide,ms);
 }
 function isShowing(){return !!overlay&&overlay.classList.contains('gb-show')}
 window.GameTurnOverlay={show,hide,isShowing};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide()});
})();