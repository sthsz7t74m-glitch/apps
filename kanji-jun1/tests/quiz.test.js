import test from 'node:test';import assert from 'node:assert/strict';import {questions,readings,idioms,isCorrect,shuffle} from '../questions.js';
test('Every question has exactly one valid four-choice answer',()=>{assert.equal(questions.length,120);assert.equal(readings.length,80);assert.equal(idioms.length,40);assert.equal(new Set(questions.map(q=>q.id)).size,120);for(const q of questions){const opts=[q.answer,...q.distractors];assert.equal(new Set(opts).size,4);assert.equal(opts.filter(o=>isCorrect(q,o)).length,1);assert(q.meaning&&q.word);}});
test('Kana input handles width, spaces, katakana and permitted alternatives',()=>{assert(isCorrect(readings[0],' アッセン '));assert(isCorrect(readings[0],'ｱｯｾﾝ'));assert(isCorrect(readings[3],'きんじ'));assert(!isCorrect(readings[0],'あつせん'));assert(!isCorrect(readings[0],''));});
test('Shuffle preserves the pool without mutating it',()=>{const original=questions.map(q=>q.id);const shuffled=shuffle(original,()=>0.3);assert.deepEqual([...shuffled].sort(),[...original].sort());assert.deepEqual(original,questions.map(q=>q.id));assert.notDeepEqual(shuffled,original);});

test('Question expansion preserves original IDs and accepts dictionary alternate readings',()=>{
 assert.equal(readings[0].id,'r1');assert.equal(readings[0].word,'斡旋');assert.equal(readings[29].id,'r30');assert.equal(readings[29].word,'逼迫');
 assert.equal(idioms[0].id,'i1');assert.equal(idioms[11].word,'融通無碍');assert.equal(new Set(questions.map(q=>q.word)).size,120);
 assert(isCorrect(questions.find(q=>q.word==='憧憬'),'どうけい'));assert(isCorrect(questions.find(q=>q.word==='憧憬'),'しょうけい'));
 assert(isCorrect(questions.find(q=>q.word==='呵責'),'かしゃく'));assert(isCorrect(questions.find(q=>q.word==='呵責'),'かせき'));
});

test('Dictionary alternate readings are accepted and never used as wrong choices',()=>{
 for(const [word,reading] of [['捏造','でつぞう'],['絆','ほだし'],['憐憫','れんみん']]){
 const q=questions.find(q=>q.word===word);assert(isCorrect(q,reading));assert(!q.distractors.includes(reading));
 }
});
