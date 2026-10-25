(()=>{'use strict';
if(window.GameAudio)return;
const key='gamebox-audio-v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
let music=!!saved.music,effects=saved.effects!==false,volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):.35;
let ctx=null,musicTimer=null,step=0,unlocked=false;
function getContext(){try{if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ctx=new A()}if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx}catch{return null}}
function tone(freq,duration=.12,gain=.1,type='sine',delay=0){const a=getContext();if(!a||!unlocked)return;try{const now=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*volume),now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(a.destination);o.start(now);o.stop(now+duration+.02)}catch{}}
function clickSound(){if(effects)tone(690,.07,.11,'sine')}
const notes=[261.63,329.63,392,523.25,440,392,329.63,293.66,349.23,440,523.25,587.33,523.25,440,392,329.63];
function musicTick(){if(!music||!unlocked||document.hidden)return;const note=notes[step++%notes.length];tone(note,.19,.075,'triangle');if(step%4===1)tone(note/2,.38,.038,'sine')}
function updateMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null}if(music&&unlocked&&!document.hidden){musicTick();musicTimer=setInterval(musicTick,360)}}
function store(){try{localStorage.setItem(key,JSON.stringify({music,effects,volume}))}catch{}}
function unlock(){if(!unlocked){unlocked=true;getContext();updateMusic()}}
window.GameAudio={play:(freq=700)=>{if(effects)tone(freq,.12,.13)},setMusic:v=>{music=!!v;store();updateMusic()},setEffects:v=>{effects=!!v;store()}};
function mount(){
const css=document.createElement('style');css.textContent='.gb-audio-button{flex:none;width:34px;height:34px;padding:0;border:1px solid #cbdcf3;border-radius:11px;background:#edf4ff;color:#256bdc;font-size:18px;display:grid;place-items:center;touch-action:manipulation}.gb-audio-panel{position:fixed;top:calc(env(safe-area-inset-top) + 54px);right:12px;z-index:9999;background:white;border:1px solid #dbe7fa;border-radius:15px;box-shadow:0 12px 36px #17345133;padding:13px;min-width:218px;max-width:calc(100vw - 24px);color:#173451;font:14px system-ui,sans-serif}.gb-audio-panel[hidden]{display:none!important}.gb-audio-panel label{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:7px 0}.gb-audio-panel input[type=checkbox]{width:20px;height:20px;accent-color:#256bdc}.gb-audio-panel input[type=range]{width:105px;accent-color:#256bdc}.gb-audio-panel small{display:block;color:#7890ad;line-height:1.4;font-size:11px}.gb-audio-close{border:1px solid #cbdcf3;border-radius:9px;background:#edf4ff;color:#256bdc;padding:6px 12px;font-weight:700;margin-top:8px}';document.head.append(css);
const header=document.querySelector('header');if(!header)return;
const toggle=document.createElement('button');toggle.type='button';toggle.className='gb-audio-button';toggle.title='音の設定';toggle.setAttribute('aria-label','BGM・効果音の設定');toggle.textContent='♫';toggle.style.order='10';header.append(toggle);
const panel=document.createElement('div');panel.className='gb-audio-panel';panel.hidden=true;panel.innerHTML='<strong>サウンド設定</strong><label>BGM <input type="checkbox" data-setting="music"></label><label>操作音 <input type="checkbox" data-setting="effects"></label><label>音量 <input type="range" data-setting="volume" min="0" max="100" step="5"></label><small>BGMはONにすると再生。設定は全ゲーム共通です。</small><button type="button" class="gb-audio-close">閉じる</button>';document.body.append(panel);
const m=panel.querySelector('[data-setting=music]'),e=panel.querySelector('[data-setting=effects]'),v=panel.querySelector('[data-setting=volume]');m.checked=music;e.checked=effects;v.value=String(Math.round(volume*100));
toggle.addEventListener('click',ev=>{ev.stopPropagation();panel.hidden=!panel.hidden});
panel.querySelector('.gb-audio-close').addEventListener('click',()=>panel.hidden=true);
m.addEventListener('change',()=>{unlock();music=m.checked;store();updateMusic()});e.addEventListener('change',()=>{effects=e.checked;store();if(effects)clickSound()});v.addEventListener('input',()=>{volume=Number(v.value)/100;store()});
document.addEventListener('click',ev=>{if(!panel.hidden&&!panel.contains(ev.target)&&!toggle.contains(ev.target))panel.hidden=true},true);
document.addEventListener('click',ev=>{const button=ev.target.closest?.('button');if(!button||button.disabled||button===toggle||panel.contains(button))return;unlock();clickSound()},true);
document.addEventListener('pointerdown',()=>{unlock()},{once:true,passive:true});
document.addEventListener('visibilitychange',updateMusic);window.addEventListener('pagehide',()=>{if(musicTimer){clearInterval(musicTimer);musicTimer=null}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
