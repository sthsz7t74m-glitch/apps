/* BAR: shared confirmation and compact relocated settings layout v1.2.0 */
(function(){
 'use strict';
 let config=null,bypass=null,modal=null,returnFocus=null;
 const el=(tag,cls,text)=>{const x=document.createElement(tag);x.className=cls;if(text)x.textContent=text;return x};
 function ensure(){
  if(modal)return;
  const style=document.createElement('style');
  style.textContent='.gb-confirm-backdrop{position:fixed;inset:0;z-index:20000;background:rgba(5,2,8,.84);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(5px)}.gb-confirm-backdrop.open{display:flex}.gb-confirm-box{box-sizing:border-box;background:#211322!important;color:#fff3fb!important;border-radius:23px;border:2px solid #a7487b!important;box-shadow:0 18px 54px #000a,0 0 20px #f04daa22;padding:24px;width:min(100%,360px);text-align:center}.gb-confirm-box h2{font-size:21px;margin:0 0 12px;color:#fff3fb!important;font-weight:900}.gb-confirm-box p{font-size:14px;line-height:1.65;color:#f0cade!important;margin:0 0 22px}.gb-confirm-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gb-confirm-buttons button{box-sizing:border-box;border:1px solid transparent!important;border-radius:12px;font:inherit;font-weight:850;padding:13px 6px;min-height:50px;touch-action:manipulation}.gb-confirm-buttons .gb-confirm-cancel{background:#382039!important;border-color:#a45885!important;color:#fff3fb!important}.gb-confirm-buttons .gb-confirm-accept{background:#f04daa!important;border-color:#f04daa!important;color:#180a13!important}.gb-confirm-buttons button:focus-visible{outline:3px solid #ffb9df!important;outline-offset:3px}@media(max-width:350px){.gb-confirm-box{padding:18px}.gb-confirm-buttons{gap:8px}}';
  document.head.append(style);
  modal=el('div','gb-confirm-backdrop');
  modal.setAttribute('role','presentation');
  const box=el('div','gb-confirm-box');box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','gb-confirm-title');
  const heading=el('h2','', '本当に終了しますか？');heading.id='gb-confirm-title';
  const desc=el('p','', 'ゲーム途中の記録や進行状況は失われます。');
  const actions=el('div','gb-confirm-buttons'),cancel=el('button','gb-confirm-cancel','キャンセル'),accept=el('button','gb-confirm-accept','終了する');
  cancel.type='button';accept.type='button';actions.append(cancel,accept);box.append(heading,desc,actions);modal.append(box);document.body.append(modal);
  const close=()=>{modal.classList.remove('open');if(returnFocus?.isConnected)returnFocus.focus()};
  cancel.addEventListener('click',close);
  accept.addEventListener('click',()=>{const target=returnFocus;modal.classList.remove('open');if(target){bypass=target;target.click();bypass=null}});
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',e=>{if(modal.classList.contains('open')&&e.key==='Escape'){e.preventDefault();close()}});
 }
 window.GameExitGuard={
  configure(opts){config=opts;ensure()},
  confirmAction(target){ensure();returnFocus=target;const label=target.textContent.trim();const redo=/もう一度|最初から|やり直/.test(label);modal.querySelector('h2').textContent=redo?'本当にやり直しますか？':'本当に終了しますか？';modal.querySelector('.gb-confirm-accept').textContent=redo?'やり直す':'終了する';modal.classList.add('open');const ok=modal.querySelector('.gb-confirm-cancel');ok.focus()}
 };
 document.addEventListener('click',e=>{
  if(!config||!e.isTrusted&&e.target!==bypass)return;
  const button=e.target.closest?.('button,a');if(!button||button===bypass||!config.buttons.includes(button.id))return;
  if(!config.isActive())return;
  e.preventDefault();e.stopImmediatePropagation();window.GameExitGuard.confirmAction(button);
 },true);
 // Keep settings controls in the header, away from large gameplay buttons.
 function installTopSettings(){
  const header=document.querySelector('.app > header, main > header, .app header');
  if(!header||document.getElementById('gb-top-settings'))return;
  const sources=[...document.querySelectorAll('button#settings,button#backToSettings')];
  if(!sources.length)return;
  const style=document.createElement('style');
  style.textContent='.gb-top-settings-source{display:none!important}.gb-top-settings-compact{grid-template-columns:minmax(0,1fr)!important}.gb-top-settings-compact:not(.gb-top-settings-empty)>:not(.gb-top-settings-source){min-width:0}.gb-top-settings-compact.gb-top-settings-empty{display:contents!important}.gb-top-settings{flex:none!important;min-width:0!important;width:auto!important;max-width:96px!important;min-height:34px!important;padding:5px 10px!important;margin:0 0 0 6px!important;border:1px solid #874265!important;border-radius:11px!important;background:#321b2e!important;color:#ffb9dd!important;font-size:12px!important;font-weight:800!important;white-space:nowrap!important;line-height:1.2!important;touch-action:manipulation}.gb-top-settings[hidden]{display:none!important}';
  document.head.append(style);
  const top=document.createElement('button');
  top.type='button';top.id='gb-top-settings';top.className='gb-top-settings';top.textContent='設定';top.title='設定に戻る';top.setAttribute('aria-label','設定に戻る');top.hidden=true;
  const version=header.querySelector('.version,.ver,small');
  if(version)header.insertBefore(top,version);else header.append(top);
  let active=null;
  const isParentVisible=source=>{
   for(let node=source.parentElement;node;node=node.parentElement){
    const cs=getComputedStyle(node);
    if(cs.display==='none'||cs.visibility==='hidden')return false;
   }
   return true;
  };
  function refresh(){
   const next=sources.find(isParentVisible)||null;
   if(active!==next)active=next;
   for(const source of sources){
    const relocated=source===active;
    source.classList.toggle('gb-top-settings-source',relocated);
    const parent=source.parentElement;
    if(!parent)continue;
    // A relocated button must not occupy a grid column or leave an empty controls row.
    parent.classList.toggle('gb-top-settings-compact',relocated);
    const onlyControl=parent.children.length===1&&!parent.textContent.replace(source.textContent,'').trim();
    parent.classList.toggle('gb-top-settings-empty',relocated&&onlyControl);
   }
   top.hidden=!active;
  }
  top.addEventListener('click',()=>{
   if(!active)return;
   if(config&&config.buttons.includes(active.id)&&config.isActive())window.GameExitGuard.confirmAction(active);
   else active.click();
  });
  const observer=new MutationObserver(refresh);
  observer.observe(document.body,{attributes:true,attributeFilter:['class','style','hidden'],subtree:true});
  refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installTopSettings,{once:true});
 else installTopSettings();

})();
