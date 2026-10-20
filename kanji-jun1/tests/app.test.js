import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {questions,readings,idioms,shuffle,isCorrect} from '../questions.js';
function app(){const listeners={},saved=new Map(),nodes=new Map();const node=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},blur(){},scrollIntoView(){throw new Error("quiz must not auto-scroll");},showModal(){this.open=true;},close(){this.open=false;}});const classes=new Map(),styles=new Map(),events={};const document={documentElement:{classList:{toggle:(name,on)=>classes.set(name,on)},style:{setProperty:(name,value)=>styles.set(name,value)}},querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return[];},addEventListener(name,fn){listeners[name]=fn;}};const context=vm.createContext({questions,readings,idioms,shuffle,isCorrect,document,window:{scrollTo(){},innerHeight:844,visualViewport:{height:844,offsetTop:0,addEventListener:(name,fn)=>events[name]=fn},addEventListener(){}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},setTimeout(){},clearTimeout(){},console});vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/,''),context);return {run:s=>vm.runInContext(s,context),saved,nodes,classes,styles,events,context};}
test('Quiz scores once, completes, persists and clears mastered review items',()=>{const a=app();a.run("count=5;start(readings);answer('wrong');answer('wrong')");assert.equal(a.run('data.answered'),1);assert.equal(a.run('wrongQuestions().length'),1);for(let i=1;i<5;i++)a.run('quiz.index++;quiz.answered=false;answer(quiz.queue[quiz.index].answer)');a.run('finish();finish()');assert.equal(a.run('data.answered'),5);assert.equal(a.run('data.correct'),4);assert.equal(a.run('data.sessions.length'),1);assert.equal(JSON.parse(a.saved.get('kanji-no-ma-v1')).answered,5);a.run("start(wrongQuestions(),'review','choice');answer(quiz.queue[0].answer)");assert.equal(a.run('wrongQuestions().length'),0);});
test('Leaving an active session opens confirmation and does not silently discard it',()=>{const a=app();a.run("start(idioms);go('records')");assert.equal(a.run('screen'),'quiz');assert.equal(a.run('pendingScreen'),'records');assert.equal(a.nodes.get('#leave-dialog').open,true);});
test('Input answers use the same grading and count limit never duplicates questions',()=>{const a=app();a.run("count=20;start(idioms)");assert.equal(a.run('quiz.queue.length'),20);assert.equal(a.run('new Set(quiz.queue.map(q=>q.id)).size'),20);a.run("start([readings[0]],'home','input');answer(' ｱｯｾﾝ ')");assert.equal(a.run('quiz.results[0].correct'),true);});

test('Quiz uses one visible response panel and unlocks normal pages on completion',()=>{
 const a=app();a.run("start([readings[0]])");assert.equal(a.classes.get('quiz-mode'),true);
 assert.match(a.nodes.get('#app').innerHTML,/class="choices /);assert.doesNotMatch(a.nodes.get('#app').innerHTML,/id="feedback"/);
 a.run("answer('wrong')");const html=a.nodes.get('#app').innerHTML;
 assert.match(html,/id="feedback"/);assert.match(html,/data-action="next"/);assert.doesNotMatch(html,/data-answer=/);
 a.run('finish()');assert.equal(a.classes.get('quiz-mode'),false);
});
test('Visible play area follows the software keyboard and viewport panning',()=>{
 const a=app();a.run("start(readings,'home','input')");
 a.context.window.visualViewport.height=300;a.context.window.visualViewport.offsetTop=24;a.events.resize();
 assert.equal(a.styles.get('--quiz-height'),'300px');assert.equal(a.styles.get('--quiz-top'),'24px');assert.equal(a.classes.get('quiz-short'),true);
 a.context.window.visualViewport.height=844;a.context.window.visualViewport.offsetTop=0;a.events.resize();
 assert.equal(a.styles.get('--quiz-height'),'844px');assert.equal(a.classes.get('quiz-short'),false);
});

test('Home has compact setup and its start button without promotional headings',()=>{
 const a=app();assert.equal(a.classes.get('home-mode'),true);const html=a.nodes.get('#app').innerHTML;
 assert.match(html,/全120問/);assert.match(html,/80問/);assert.match(html,/40問/);assert.match(html,/data-action="start"/);
 assert.doesNotMatch(html,/一日十問|intro-stamp|class="intro"|<details/);
 a.run('start(readings)');assert.equal(a.classes.get('home-mode'),false);a.run('screen="home";render()');assert.equal(a.classes.get('home-mode'),true);
});
