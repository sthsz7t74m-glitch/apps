/* Offenbach: Orpheus in the Underworld, Infernal Galop (Can-can), public-domain melody; custom 30s WebAudio arrangement. */
(function(){
'use strict';
const B=60/160, BAR=B*4;
// D major, brisk gallop. 20 bars x 1.5s = 30s.
const chords=[[62,66,69],[67,71,74],[69,73,76],[64,67,71]];
const roots=[38,43,45,40];
const progression=[0,0,2,2,0,0,2,0,1,1,0,2,0,1,2,0,0,2,0,0];
// Fast can-can refrain, arranged in short repeated and answering phrases.
const melodies=[
[74,74,74,74,78,81,79,78],
[76,76,76,76,79,83,81,79],
[78,78,78,78,81,85,83,81],
[79,78,76,74,73,74,76,73],
[74,74,74,74,78,81,79,78],
[76,76,76,76,79,83,81,79],
[81,79,78,76,74,73,74,76],
[78,74,78,81,86,81,78,74],
[79,79,79,79,83,86,85,83],
[81,81,81,81,85,88,86,85],
[86,85,83,81,79,78,76,74],
[81,85,88,85,81,78,73,76],
[74,74,74,74,78,81,79,78],
[79,79,79,79,83,86,85,83],
[81,79,78,76,74,73,74,76],
[78,81,86,88,90,88,86,81],
[86,86,86,86,90,93,91,90],
[88,88,88,88,91,95,93,91],
[90,88,86,85,83,81,78,76],
[86,81,78,74,78,81,86,86]];
let ctx=null,active=[],master=null;
const hz=m=>440*Math.pow(2,(m-69)/12);
function note(start,dur,m,type,vol,pan=0){
 const t=ctx.currentTime+start;
 const o=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner();
 o.type=type;o.frequency.value=hz(m);
 p.pan.value=pan;
 const a=Math.min(type==='sawtooth'?.055:.016,dur/3),end=t+dur;
 g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+a);
 g.gain.setValueAtTime(vol*.8,Math.max(t+a,end-.09));
 g.gain.exponentialRampToValueAtTime(.0001,end);
 o.connect(g);g.connect(p);p.connect(master);o.start(t);o.stop(end+.01);active.push(o);
}
function drum(start,kind,vol){
 const t=ctx.currentTime+start,o=ctx.createOscillator(),g=ctx.createGain();
 o.type=kind==='kick'?'sine':'triangle';o.frequency.setValueAtTime(kind==='kick'?130:kind==='snare'?190:7300,t);
 if(kind==='kick')o.frequency.exponentialRampToValueAtTime(55,t+.12);
 g.gain.setValueAtTime(Math.max(.0001,vol*(kind==='hat'?.012:.055)),t);
 g.gain.exponentialRampToValueAtTime(.0001,t+(kind==='hat'?.045:.14));
 o.connect(g);g.connect(master);o.start(t);o.stop(t+.17);active.push(o);
}
function stop(){
 active.forEach(o=>{try{o.stop()}catch{}try{o.disconnect()}catch{}});active=[];
 if(master){try{master.disconnect()}catch{}master=null}
}
function start(){
 stop();
 try {
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  ctx=ctx||new AC();if(ctx.state==='suspended')ctx.resume();
  master=ctx.createGain();master.gain.value=.42;master.connect(ctx.destination);
  for(let b=0;b<20;b++){
   const t=b*BAR,c=progression[b],notes=chords[c],s=b<3?.52:b<10?.68:b<15?.84:1;
   notes.forEach((m,j)=>{note(t,BAR*.98,m-12,'sawtooth',.012*s,(j-1)*.35);if(b>=10)note(t,BAR*.97,m,'sawtooth',.006*s,(1-j)*.4)});
   if(b<3){for(const k of [0,2])note(t+k*B,B*.8,notes[k%3]+12,'sawtooth',.026,.18)}
   else{
    for(let k=0;k<8;k+=2)note(t+k*B/2,B*.47,notes[k/2%3]+12,'triangle',.026*s,-.2);
    for(const k of [0,2,4,6])note(t+k*B/2,B*.7,roots[c],'sine',.12*s);
   }
   melodies[b].forEach((m,k)=>{if(m<0)return;const d=B*(b<3?.78:.43);note(t+k*B/2,d,m,'sawtooth',.063*s,.06);if(b>=15&&k%2===0)note(t+k*B/2,d,m-12,'sawtooth',.027*s,-.2)});
   if(b>=3){for(let k=0;k<4;k++){drum(t+k*B,'kick',s);if(k%2)drum(t+k*B,'snare',s);drum(t+k*B,'hat',s);drum(t+(k+.5)*B,'hat',s)}}
   else if(b===0)drum(t,'snare',.7);
   if([3,10,15,19].includes(b))drum(t,'snare',1.1);
  }
  // The score is exactly twenty 1.5-second bars. End at the 30-second finish.
  master.gain.setValueAtTime(.42,ctx.currentTime+29.7);
  master.gain.linearRampToValueAtTime(.0001,ctx.currentTime+30);
 }catch(e){console.warn('Race BGM unavailable',e);stop()}
}
window.RaceMusic={start,stop};
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
})();