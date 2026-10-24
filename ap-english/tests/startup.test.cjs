const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function boot(saved=null){
 const elements=new Map();
 const element=()=>({children:[],textContent:'',style:{},disabled:false,value:'',classList:{values:new Set(),toggle(c,on){if(on)this.values.add(c);else this.values.delete(c)}},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(){}});
 for(const tag of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const el=element();if(/class="[^"]*\bhidden\b/.test(tag[0]))el.classList.values.add('hidden');elements.set(tag[1],el)}
 elements.get('category').value='all';elements.get('mode').value='en-ja';elements.get('count').value='10';
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:id=>elements.get(id),createElement:element},localStorage:{getItem:()=>saved,setItem(){}},alert:message=>{throw Error(message)}});
 return elements;
}
test('startup shows home and initializes the word bank',()=>{const e=boot();assert.equal(e.get('home').classList.values.has('hidden'),false);assert.ok(Number(e.get('total').textContent)>0);for(const id of ['game','result','groupsPage','starPage'])assert.equal(e.get(id).classList.values.has('hidden'),true)});
test('quiz starts and returns to home',()=>{const e=boot();e.get('start').onclick();assert.equal(e.get('game').classList.values.has('hidden'),false);assert.equal(e.get('answers').children.length,4);e.get('quit').onclick();assert.equal(e.get('home').classList.values.has('hidden'),false)});
test('saved progress is retained',()=>{const e=boot(JSON.stringify({starred:['convert'],missed:['invert'],answered:4,correct:3}));assert.equal(e.get('doneStat').textContent,'3 / 4');assert.equal(e.get('starReview').disabled,false)});
