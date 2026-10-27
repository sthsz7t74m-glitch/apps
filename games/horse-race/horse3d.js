/* GameBOX race: lightweight procedural 3D horses and broadcast follow camera.
 * Falls back to existing SVG view if Three.js or WebGL cannot initialize. */
(function(){
'use strict';
const T=window.THREE;
if(!T){window.Race3D={available:false};return}
const $=id=>document.getElementById(id), smooth=(a,b,k)=>a+(b-a)*k;
let scene,camera,renderer,host,models=[],labels=[],oval,active=false,lastMode='',camAt=new T.Vector3(),aimAt=new T.Vector3(),lastFrame=0,wideTriggered=false;
const material=(color)=>new T.MeshStandardMaterial({color,roughness:.86,metalness:0});
const natural=material('#493021'),hoof=material('#2c2725'),eye=material('#121a20'),white=material('#ffffff'),skin=material('#e6b998'),saddle=material('#3b2925');
const HALF=55,RADIUS=9,TRACK_WIDTH=4.5;
const ARC=Math.PI*RADIUS,LONG=HALF*2,LAP=ARC*2+LONG*2;
// Stadium geometry: two real straights joined by two semicircular bends.
// Final portion of the lap is the home straight.
function stadiumPoint(p,offset=0){const rad=RADIUS+offset,d=((p%1)+1)%1*LAP;
let x,y,dx,dy;
if(d<ARC){const t=Math.PI/2-d/ARC*Math.PI;x=HALF+rad*Math.cos(t);y=rad*Math.sin(t);dx=Math.sin(t);dy=-Math.cos(t)}
else if(d<ARC+LONG){const q=(d-ARC)/LONG;x=HALF-2*HALF*q;y=-rad;dx=-1;dy=0}
else if(d<ARC+LONG+ARC){const q=(d-ARC-LONG)/ARC,t=-Math.PI/2-q*Math.PI;x=-HALF+rad*Math.cos(t);y=rad*Math.sin(t);dx=Math.sin(t);dy=-Math.cos(t)}
else{const q=(d-ARC*2-LONG)/LONG;x=-HALF+2*HALF*q;y=rad;dx=1;dy=0}
return {x,y,yaw:Math.atan2(dy,dx)}}
function boundary(rad){const pts=[];for(let i=0;i<=240;i++){const p=stadiumPoint(i/240,rad-RADIUS);pts.push(new T.Vector2(p.x,p.y))}return pts}
function stadiumShape(outer,inner){const outerPts=boundary(outer),innerPts=boundary(inner).reverse(),sh=new T.Shape();sh.moveTo(outerPts[0].x,outerPts[0].y);outerPts.slice(1).forEach(p=>sh.lineTo(p.x,p.y));sh.closePath();const hole=new T.Path();hole.moveTo(innerPts[0].x,innerPts[0].y);innerPts.slice(1).forEach(p=>hole.lineTo(p.x,p.y));hole.closePath();sh.holes.push(hole);return sh}
function ball(g,m,x,y,z,sx,sy,sz){const p=new T.Mesh(new T.SphereGeometry(1,12,10),m);p.position.set(x,y,z);p.scale.set(sx,sy,sz);p.castShadow=true;p.receiveShadow=true;g.add(p);return p}
function tube(g,m,a,b,r){const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start);const obj=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),8),m);obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());obj.position.copy(start).add(end).multiplyScalar(.5);obj.castShadow=true;g.add(obj);return obj}
function makeLabel(txt,color){const cvs=document.createElement('canvas');cvs.width=256;cvs.height=120;const c=cvs.getContext('2d');c.fillStyle='rgba(255,255,255,.97)';c.beginPath();c.roundRect(5,5,246,110,20);c.fill();c.lineWidth=9;c.strokeStyle=color;c.stroke();c.fillStyle='#172c4b';c.font='bold 55px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,128,64);const map=new T.CanvasTexture(cvs);map.colorSpace=T.SRGBColorSpace;const obj=new T.Sprite(new T.SpriteMaterial({map,depthTest:false,transparent:true}));obj.scale.set(1.35,.64,1);obj.renderOrder=99;return obj}
function buildHorse(h){
 const group=new T.Group(),coat=material(h.color),silk=material(h.color),
 dark=material('#32251f'),leather=material('#493026'),cream=material('#eee9df'),
 pants=material('#f5f4ee'),boot=material('#20252d'),skin=material('#e5b996');
 const torso=ball(group,coat,-.10,0,1.12,.77,.34,.39);
 ball(group,coat,-.61,0,1.12,.35,.34,.37);
 ball(group,coat,.43,0,1.15,.34,.31,.39);
 const neck=ball(group,coat,.61,0,1.52,.25,.24,.51);neck.rotation.y=.35;
 ball(group,coat,.83,0,1.84,.29,.23,.27).rotation.y=-.25;
 const muzzle=ball(group,coat,1.09,0,1.70,.27,.19,.145);
 ball(group,material('#bd967d'),1.23,0,1.66,.11,.18,.105);
 for(const side of [-1,1]){
  const ear=ball(group,coat,.78,side*.17,2.09,.075,.065,.19);ear.rotation.y=-.20;
  ball(group,dark,.98,side*.217,1.88,.037,.020,.039);
  ball(group,boot,1.30,side*.10,1.66,.025,.022,.027);
  tube(group,leather,[1.01,side*.205,1.79],[1.19,side*.15,1.67],.017);
  tube(group,leather,[.99,side*.21,1.79],[.69,side*.23,1.48],.014);
 }
 for(let j=0;j<7;j++){const t=j/6;const seg=ball(group,dark,.54-t*.35,0,1.96-t*.42,.095,.115,.12);seg.rotation.y=.3}
 const legs=[];
 for(const front of [false,true])for(const side of [-1,1]){
  const pivot=new T.Group();pivot.position.set(front?.47:-.61,side*.25,.95);group.add(pivot);
  const upper=front?-.43:-.48;
  tube(pivot,coat,[0,0,0],[front?.03:-.10,0,upper],front?.105:.13);
  const knee=new T.Group();knee.position.set(front?.03:-.10,0,upper);pivot.add(knee);
  ball(knee,coat,0,0,0,.105,.11,.12);
  tube(knee,coat,[0,0,0],[.055,0,-.43],.073);
  ball(knee,boot,.105,0,-.45,.16,.105,.075);
  legs.push({pivot,knee,front,side});
 }
 const tail=new T.Group();tail.position.set(-.77,0,1.37);group.add(tail);
 for(let i=0;i<4;i++){const t=ball(tail,dark,-.20-i*.12,(i-1.5)*.028,-.10-i*.045,.24-i*.035,.06,.09);t.rotation.y=-.20}
 // Saddle cloth, with number visible on both sides.
 ball(group,leather,-.23,0,1.47,.43,.34,.11);
 const cloth=ball(group,silk,-.25,0,1.40,.34,.354,.24);
 for(const side of [-1,1]){
  const cvs=document.createElement('canvas');cvs.width=128;cvs.height=128;
  const ctx=cvs.getContext('2d');ctx.fillStyle='white';ctx.font='900 95px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(h.num),64,70);
  const tex=new T.CanvasTexture(cvs);tex.colorSpace=T.SRGBColorSpace;
  const badge=new T.Mesh(new T.PlaneGeometry(.32,.32),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide}));
  badge.position.set(-.24,side*.365,1.39);badge.rotation.x=Math.PI/2;group.add(badge);
 }
 // Jockey body and forward-leaning arms.
 const rider=new T.Group();rider.position.set(-.20,0,1.52);group.add(rider);
 const chest=ball(rider,silk,.17,0,.37,.23,.21,.29);chest.rotation.y=.78;
 ball(rider,pants,-.15,0,.14,.22,.21,.18);
 const helmet=ball(rider,silk,.39,0,.77,.17,.16,.12);
 ball(rider,skin,.41,0,.65,.125,.12,.115);
 ball(rider,boot,.45,0,.64,.12,.125,.045);
 for(const side of [-1,1]){
  tube(rider,silk,[.17,side*.16,.48],[.41,side*.23,.30],.074);
  tube(rider,skin,[.41,side*.23,.30],[.66,side*.21,.20],.049);
  tube(rider,pants,[-.18,side*.16,.13],[-.22,side*.32,-.14],.095);
  tube(rider,boot,[-.22,side*.32,-.14],[-.13,side*.31,-.42],.076);
  tube(group,leather,[.71,side*.19,1.76],[.47,side*.20,1.40],.012);
 }
 return {group,legs,tail,rider,horse:h};
}
function clearScene(){for(const m of models){scene.remove(m.group)}models=[];for(const obj of [...scene.children])if(obj.userData.track)scene.remove(obj)}
function trackPlane(type){const ground=new T.Mesh(new T.PlaneGeometry(260,260),material('#88bb70'));ground.receiveShadow=true;ground.userData.track=true;scene.add(ground);
if(type==='loop'){const base=new T.Mesh(new T.ShapeGeometry(stadiumShape(RADIUS+TRACK_WIDTH/2,RADIUS-TRACK_WIDTH/2)),material('#ad8052'));base.position.z=.025;base.userData.track=true;scene.add(base);
for(const off of [-TRACK_WIDTH/2+.15,TRACK_WIDTH/2-.15]){const pts=[];for(let i=0;i<=240;i++){const p=stadiumPoint(i/240,off);pts.push(new T.Vector3(p.x,p.y,.13))}const rail=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#f9fbf6'}));rail.userData.track=true;scene.add(rail)}
const finishPoint=stadiumPoint(.94);const goal=new T.Mesh(new T.PlaneGeometry(.18,TRACK_WIDTH),white);goal.position.set(finishPoint.x,finishPoint.y,.065);goal.userData.track=true;scene.add(goal);
}else{const lane=new T.Mesh(new T.PlaneGeometry(110,22),material('#b18a5b'));lane.position.set(38,0,.03);lane.userData.track=true;scene.add(lane);const fin=new T.Mesh(new T.PlaneGeometry(.12,22),white);fin.position.set(64,0,.08);fin.userData.track=true;scene.add(fin);
for(let i=0;i<9;i++){const p=new T.Mesh(new T.PlaneGeometry(100,.045),white);p.position.set(38,-10+i*2.5,.08);p.userData.track=true;scene.add(p)}}}
function initialize(){try{host=$('threeMount');if(!host)return false;renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#91bf73');renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(renderer.domElement);scene=new T.Scene();scene.background=new T.Color('#a8d393');camera=new T.PerspectiveCamera(48,1,.05,250);camera.up.set(0,0,1);
const ambient=new T.HemisphereLight('#ffffff','#537747',2.4);scene.add(ambient);const sun=new T.DirectionalLight('#fff4df',2.0);sun.position.set(-9,-12,20);scene.add(sun);scene.add(new T.AmbientLight('#ffffff',.55));active=true;return true}catch(err){console.warn('3D unavailable:',err);window.Race3D.available=false;return false}}
function reset(horses,type){if(!active&&!initialize())return false;clearScene();lastMode=type;trackPlane(type);models=horses.map(h=>{const m=buildHorse(h);scene.add(m.group);return m});lastFrame=0;wideTriggered=false;resize();return true}
function resize(){if(!active)return;const w=host.clientWidth,h=host.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function update(horses,type,time){if(!active||type!==lastMode||models.length!==horses.length){if(!reset(horses,type))return false}
resize();const n=horses.length;const lead=[...horses].sort((a,b)=>b.pos-a.pos)[0];let center=new T.Vector3(),ahead=new T.Vector3(),dir=new T.Vector3(1,0,0);const ordered=[...horses].sort((a,b)=>b.pos-a.pos);
for(const m of models){const h=horses.find(a=>a.num===m.horse.num);if(!h)continue;let x,y,yaw;if(type==='loop'){const p=stadiumPoint(.94+h.pos,(h.num-(n+1)/2)*.19);x=p.x;y=p.y;yaw=p.yaw}
else{x=1+h.pos*63;y=(h.num-(n+1)/2)*2.25;yaw=0}
m.group.position.set(x,y,0);m.group.rotation.z=yaw;
const motion=Math.sin(time/115+h.num);m.group.position.z=.022*Math.abs(motion);
m.legs.forEach((leg,i)=>{const phase=time/115+h.num*.6+(i%2?Math.PI:0)+(leg.front?0:Math.PI*.72);leg.pivot.rotation.y=Math.sin(phase)*.48;leg.knee.rotation.y=.25+Math.max(0,Math.sin(phase+1.1))*.65});m.tail.rotation.y=Math.sin(time/200+h.num)*.18;m.rider.rotation.y=Math.sin(time/115+h.num)*.025;

if(h.num===lead.num){center.set(x,y,0);dir.set(Math.cos(yaw),Math.sin(yaw),0)}
}
const side=new T.Vector3(-dir.y,dir.x,0);
// Anchor the shot to the actual horse meshes, never to a separate track coordinate.
// The follow point is the centroid of the visible field, keeping the leader in frame.
const pts=models.map(m=>m.group.position.clone());
const mid=new T.Vector3();
pts.forEach(p=>mid.add(p));mid.multiplyScalar(1/Math.max(1,pts.length));
// The leading horse crosses one fixed course marker (400m remaining).
// The switch is latched; changing leaders never returns to a close shot.
const WIDE_MARK=0.75;
if(lead.pos>=WIDE_MARK)wideTriggered=true;
const goalShot=wideTriggered;
let focus,targetPos;
if(goalShot){
  // Hold a finish-line broadcast shot from 400m out. The horses move across
  // a stationary frame at full pace; a camera chasing them near the line
  // previously made their forward motion appear to slow down.
  const finish=type==='loop'?stadiumPoint(.94):{x:64,y:0};
  const anchor=new T.Vector3(finish.x-9,finish.y,1.2);
  const fixedCamera=new T.Vector3(finish.x-25,finish.y-39,29);
  // On oval races align the shot with the final straight as well.
  focus=anchor;
  targetPos=fixedCamera;
}else{
  focus=mid.clone().lerp(center,.45).add(new T.Vector3(0,0,1.3));
  const spread=Math.max(5,...pts.map(p=>p.distanceTo(focus)));
  // Account for portrait aspect ratio; keep a close race-camera until the finish.
  const dist=Math.max(16,Math.min(54,spread*2.1+14));
  targetPos=focus.clone().addScaledVector(dir,-dist*.38)
    .addScaledVector(side,-dist*.76).add(new T.Vector3(0,0,dist*.48));
}
const k=lastFrame===0?1:(goalShot?.18:.16);
camera.position.lerp(targetPos,k);aimAt.lerp(focus,k);camera.lookAt(aimAt);
camera.updateMatrixWorld();
// Protect against the camera drifting away from every horse: correct framing
// using the same world positions as the horse models.
let visible=0;
for(const p of pts){const v=p.clone().add(new T.Vector3(0,0,1.1)).project(camera);
  if(Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<.88&&Math.abs(v.y)<.88&&v.z<1)visible++;
}
if(!goalShot && visible===0){
  camera.position.copy(targetPos);aimAt.copy(focus);camera.lookAt(aimAt);
}
lastFrame=time||1;
renderer.render(scene,camera);return goalShot || visible>0}
window.Race3D={available:true,reset,update};
})();
