/* Original horse-racing score: 30s, 160 BPM. WebAudio arrangement. */
(function(){
'use strict';
const B=60/160, BAR=B*4;
const chords=[[62,66,69],[67,71,74],[59,62,66],[69,73,76]];
const roots=[38,43,35,45];
const progression=[0,3,1,0,0,1,2,3,0,1,2,3,2,1,0,3,0,1,3,0];
const melodies=[
[74,-1,78,-1,81,78,74,-1],[76,-1,81,-1,85,81,76,-1],
[79,78,76,74,79,-1,78,-1],[81,-1,78,-1,74,-1,69,-1],
[74,76,78,81,78,76,74,69],[74,76,79,81,83,81,79,76],
[78,79,81,78,76,74,73,71],[73,76,81,83,81,76,73,69],
[74,76,78,81,86,81,78,76],[79,81,83,86,83,81,79,76],
[78,81,83,85,86,83,81,78],[76,81,85,88,85,81,76,73],
[78,81,86,85,83,81,78,74],[79,83,86,88,86,83,81,79],
[81,83,86,90,88,86,83,81],[85,88,90,88,85,81,78,76],
[86,88,90,93,90,88,86,81],[91,90,88,86,91,88,86,83],
[88,90,93,95,93,90,88,85],[93,90,86,81,86,90,93,98]];
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
   if(b<3){for(const k of [0,2])note(t+k*B,B*1.75,notes[k%3]+12,'sawtooth',.065,.18)}
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