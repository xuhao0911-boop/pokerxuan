import test from 'node:test';import assert from 'node:assert/strict';import '../public/bet-sizing.js';
const {range,snap}=globalThis.BetSizing;
test('normal slider steps and pot presets use exactly half-BB sizes',()=>{
 assert.deepEqual(range(200,10000),{min:200,max:10000,first:200,end:10000,step:50});
 assert.deepEqual([200,250,300,350,400].map(n=>snap(n,200,10000)),[200,250,300,350,400]);
 assert.equal(snap(333,200,10000),350);assert.equal(snap(875,200,10000),900);assert.equal(snap(12,200,10000),200);
});
test('legacy odd-sized raises never create an illegal under-raise',()=>{
 assert.equal(range(376,1123).first,400);for(let n=0;n<=1200;n++){const size=snap(n,376,1123);assert(size>=376&&size<=1123);assert(size===1123||size%50===0);}
});
test('exact all-in remains reachable when the stack is not a multiple of half a BB',()=>{
 assert.equal(range(200,1123).end,1150);assert.equal(snap(1150,200,1123),1123);assert.equal(snap(1123,200,1123),1123);
 assert.equal(snap(100,123,123),123);assert.equal(snap(150,123,123),123);assert.deepEqual(range(123,123),{min:123,max:123,first:150,end:150,step:50});
 assert.equal(snap(951,951,973),973);
});
