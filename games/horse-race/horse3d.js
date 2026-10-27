/* GameBOX race: lightweight procedural 3D horses and broadcast follow camera.
 * Falls back to existing SVG view if Three.js or WebGL cannot initialize. */
(function(){
'use strict';
const T=window.THREE;
if(!T){window.Race3D={available:false};return}
const $=id=>document.getElementById(id), smooth=(a,b,k)=>a+(b-a)*k;
let scene,camera,renderer,host,models=[],labels=[],oval,active=false,lastMode='',camAt=new T.Vector3(),aimAt=new T.Vector3(),lastFrame=0;
const material=(color)=>new T.MeshStandardMaterial({color,roughness:.86,metalness:0});
const natural=material('#493021'),hoof=material('#2c2725'),eye=material('#121a20'),white=material('#ffffff'),skin=material('#e6b998'),saddle=material('#3b2925');
function ovalShape(rx,ry,irx,iry){const shape=new T.Shape();shape.absellipse(0,0,rx,ry,0,Math.PI*2,false);const hole=new T.Path();hole.absellipse(0,0,irx,iry,0,Math.PI*2,true);shape.holes.push(hole);return shape}
function ball(g,m,x,y,z,sx,sy,sz){const p=new T.Mesh(new T.SphereGeometry(1,12,10),m);p.position.set(x,y,z);p.scale.set(sx,sy,sz);p.castShadow=true;p.receiveShadow=true;g.add(p);return p}
function tube(g,m,a,b,r){const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start);const obj=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),8),m);obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());obj.position.copy(start).add(end).multiplyScalar(.5);obj.castShadow=true;g.add(obj);return obj}
function makeLabel(txt,color){const cvs=document.createElement('canvas');cvs.width=256;cvs.height=120;const c=cvs.getContext('2d');c.fillStyle='rgba(255,255,255,.97)';c.beginPath();c.roundRect(5,5,246,110,20);c.fill();c.lineWidth=9;c.strokeStyle=color;c.stroke();c.fillStyle='#172c4b';c.font='bold 55px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,128,64);const map=new T.CanvasTexture(cvs);map.colorSpace=T.SRGBColorSpace;const obj=new T.Sprite(new T.SpriteMaterial({map,depthTest:false,transparent:true}));obj.scale.set(1.35,.64,1);obj.renderOrder=99;return obj}
function buildHorse(h){const group=new T.Group(),flesh=material(h.body||'#a86435'),silk=material(h.color),mane=material('#30251f');
ball(group,flesh,0,0,1.03,.74,.32,.38);
ball(group,flesh,.43,0,1.36,.27,.26,.46).rotation.y=-.25;
ball(group,flesh,.82,0,1.65,.35,.23,.25);
ball(group,flesh,1.10,0,1.53,.25,.22,.14);
for(const side of [-1,1]){ball(group,flesh,.75,side*.15,1.94,.075,.075,.17);ball(group,eye,.98,side*.215,1.72,.038,.035,.04)}
for(let j=0;j<5;j++)ball(group,mane,.34-j*.10,0,1.72-j*.08,.10,.20,.13);
const limbs=[];for(const x of [-.47,.45])for(const y of [-.23,.23]){const leg=new T.Group();leg.position.set(x,y,.81);tube(leg,flesh,[0,0,0],[.06,0,-.54],.10);ball(leg,hoof,.09,0,-.57,.15,.105,.065);group.add(leg);limbs.push(leg)}
const tail=new T.Group();tail.position.set(-.70,0,1.16);ball(tail,mane,-.24,0,-.10,.31,.10,.13).rotation.y=.45;group.add(tail);
ball(group,saddle,-.16,0,1.37,.44,.32,.10);
ball(group,silk,-.16,0,1.66,.22,.20,.31).rotation.y=-.2;
ball(group,skin,-.03,0,1.98,.13,.13,.14);
ball(group,silk,-.04,0,2.11,.17,.17,.09);
for(const side of [-1,1]){tube(group,skin,[.00,side*.15,1.73],[.52,side*.19,1.43],.064);tube(group,hoof,[-.22,side*.11,1.48],[-.24,side*.32,1.06],.092)}
// 3D number plaque on saddle, not a rotated SVG character.
const number=makeLabel(String(h.num),h.color);number.scale.set(.75,.38,1);number.position.set(-.12,-.37,1.12);group.add(number);
return {group,limbs,tail,number,tag:makeLabel(String(h.num)+'番',h.color),horse:h}}
function clearScene(){for(const m of models){scene.remove(m.group);scene.remove(m.tag)}models=[];for(const obj of [...scene.children])if(obj.userData.track)scene.remove(obj)}
function trackPlane(type){const ground=new T.Mesh(new T.PlaneGeometry(160,160),material('#88bb70'));ground.receiveShadow=true;ground.userData.track=true;scene.add(ground);
if(type==='loop'){const base=new T.Mesh(new T.ShapeGeometry(ovalShape(15.3,10.8,11.2,6.6),90),material('#ad8052'));base.position.z=.025;base.userData.track=true;scene.add(base);
for(const [rX,rY] of [[15.05,10.55],[11.47,6.87]]){const pts=[];for(let i=0;i<=180;i++){const t=i*Math.PI*2/180;pts.push(new T.Vector3(rX*Math.cos(t),rY*Math.sin(t),.13))}const rail=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#f9fbf6'}));rail.userData.track=true;scene.add(rail)}
const line=new T.Mesh(new T.PlaneGeometry(.14,3.7),white);line.position.set(0,-8.75,.055);line.userData.track=true;scene.add(line);
}else{const lane=new T.Mesh(new T.PlaneGeometry(110,22),material('#b18a5b'));lane.position.set(38,0,.03);lane.userData.track=true;scene.add(lane);const fin=new T.Mesh(new T.PlaneGeometry(.12,22),white);fin.position.set(64,0,.08);fin.userData.track=true;scene.add(fin);
for(let i=0;i<9;i++){const p=new T.Mesh(new T.PlaneGeometry(100,.045),white);p.position.set(38,-10+i*2.5,.08);p.userData.track=true;scene.add(p)}}}
function initialize(){try{host=$('threeMount');if(!host)return false;renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor('#91bf73');renderer.outputColorSpace=T.SRGBColorSpace;host.appendChild(renderer.domElement);scene=new T.Scene();scene.background=new T.Color('#a8d393');camera=new T.PerspectiveCamera(48,1,.05,250);camera.up.set(0,0,1);
const ambient=new T.HemisphereLight('#ffffff','#537747',2.4);scene.add(ambient);const sun=new T.DirectionalLight('#fff4df',2.0);sun.position.set(-9,-12,20);scene.add(sun);scene.add(new T.AmbientLight('#ffffff',.55));active=true;return true}catch(err){console.warn('3D unavailable:',err);window.Race3D.available=false;return false}}
function reset(horses,type){if(!active&&!initialize())return false;clearScene();lastMode=type;trackPlane(type);models=horses.map(h=>{const m=buildHorse(h);scene.add(m.group);scene.add(m.tag);return m});lastFrame=0;resize();return true}
function resize(){if(!active)return;const w=host.clientWidth,h=host.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function update(horses,type,time){if(!active||type!==lastMode||models.length!==horses.length){if(!reset(horses,type))return false}
resize();const n=horses.length;const lead=[...horses].sort((a,b)=>b.pos-a.pos)[0];let center=new T.Vector3(),ahead=new T.Vector3(),dir=new T.Vector3(1,0,0);const ordered=[...horses].sort((a,b)=>b.pos-a.pos);
for(const m of models){const h=horses.find(a=>a.num===m.horse.num);if(!h)continue;let x,y,yaw;if(type==='loop'){const t=-Math.PI/2+h.pos*Math.PI*2,off=(h.num-(n+1)/2)*.17,rx=13.1+off,ry=8.7+off;x=rx*Math.cos(t);y=ry*Math.sin(t);yaw=Math.atan2(ry*Math.cos(t),-rx*Math.sin(t))}
else{x=1+h.pos*63;y=(h.num-(n+1)/2)*2.25;yaw=0}
m.group.position.set(x,y,0);m.group.rotation.z=yaw;
const motion=h.fin===null?Math.sin(time/115+h.num):0;m.group.position.z=.022*Math.abs(motion);
m.limbs.forEach((leg,i)=>{leg.rotation.y=h.fin===null?Math.sin(time/110+h.num+i*Math.PI)*.42:0});m.tail.rotation.y=Math.sin(time/210+h.num)*.22;
m.tag.position.set(x,y,3.17);m.tag.material.opacity=1;
if(h.num===lead.num){center.set(x,y,0);dir.set(Math.cos(yaw),Math.sin(yaw),0)}
}
const side=new T.Vector3(-dir.y,dir.x,0);
// A TV-style elevated 3/4 chase view: not a full-course map; keep pack within shot.
const back=type==='loop'?6.5:9;const lateral=type==='loop'?7.5:9;
const targetPos=center.clone().addScaledVector(dir,-back).addScaledVector(side,-lateral).add(new T.Vector3(0,0,type==='loop'?8.7:10.5));
const focus=center.clone().addScaledVector(dir,2.8).add(new T.Vector3(0,0,1.1));
// camera moves through bends continuously (no 180 degree sprite flipping).
const k=lastFrame===0?.96:.065;camera.position.lerp(targetPos,k);aimAt.lerp(focus,k);camera.lookAt(aimAt);lastFrame=time||1;
renderer.render(scene,camera);return true}
window.Race3D={available:true,reset,update};
})();
