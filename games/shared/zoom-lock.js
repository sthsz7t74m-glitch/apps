/* GameBOX: disable unintended pinch/double-tap zoom on game UI. */
(function(){
'use strict';
const viewport=document.querySelector('meta[name="viewport"]');
if(viewport){let parts=viewport.content.split(',').map(s=>s.trim()).filter(s=>!/^(user-scalable|maximum-scale|minimum-scale)\s*=/.test(s));parts.push('maximum-scale=1','user-scalable=no');viewport.content=parts.join(',');}
const css=document.createElement('style');css.textContent='html,body{touch-action:manipulation}button,a,[role="button"]{touch-action:manipulation}';document.head.appendChild(css);
document.addEventListener('gesturestart',event=>event.preventDefault(),{passive:false});
document.addEventListener('gesturechange',event=>event.preventDefault(),{passive:false});
let previous=0;
document.addEventListener('touchend',event=>{
 if(event.changedTouches.length!==1||event.touches.length)return;
 const target=event.target;
 if(target.closest?.('input,textarea,select,[contenteditable="true"]')){previous=0;return;}
 const now=Date.now();if(now-previous<310)event.preventDefault();previous=now;
},{passive:false});
})();