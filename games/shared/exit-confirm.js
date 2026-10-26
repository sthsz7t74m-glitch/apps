/* GameBOX: shared confirmation for abandoning an active game */
(function(){
 'use strict';
 let config=null,bypass=null,modal=null,returnFocus=null;
 const el=(tag,cls,text)=>{const x=document.createElement(tag);x.className=cls;if(text)x.textContent=text;return x};
 function ensure(){
  if(modal)return;
  const style=document.createElement('style');
  style.textContent='.gb-confirm-backdrop{position:fixed;inset:0;z-index:20000;background:#142c4b77;display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(3px)}.gb-confirm-backdrop.open{display:flex}.gb-confirm-box{background:#fff;color:#173451;border-radius:23px;border:1px solid #dce8ff;box-shadow:0 18px 54px #142c4b45;padding:24px;width:min(100%,360px);text-align:center}.gb-confirm-box h2{font-size:21px;margin:0 0 10px}.gb-confirm-box p{font-size:14px;line-height:1.55;color:#60748e;margin:0 0 21px}.gb-confirm-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gb-confirm-buttons button{border:0;border-radius:12px;font:inherit;font-weight:800;padding:13px 6px;min-height:48px;touch-action:manipulation}.gb-confirm-cancel{background:#eaf2ff;color:#256bdc}.gb-confirm-accept{background:#dc3535;color:white}';
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
})();
