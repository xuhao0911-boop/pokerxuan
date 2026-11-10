import {test} from 'node:test';import assert from 'node:assert/strict';import '../public/layout-config.js';
const L=globalThis.PokerLayout;
test('the app edition uses a fresh layout namespace and leaves the old custom layout available',()=>{
 const old={...L.defaults(),font:'arial'},storage=new Map([['px-layout-v1',JSON.stringify(old)]]);
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 assert.equal(L.key,'px-layout-v2');assert.deepEqual(L.load(),L.defaults());L.save(L.defaults());assert.equal(storage.get('px-layout-v1'),JSON.stringify(old));assert(storage.has('px-layout-v2'));
});
test('layout profiles retain independent offsets and shared palette',()=>{const c=L.defaults();c.profiles.desktop.elements.hand={x:8,y:-4,scale:1.2,fontSize:0};c.profiles.mobile.elements.hand={x:0,y:5,scale:.9,fontSize:0};c.colors.table='#123456';const clean=L.parse(JSON.stringify(c));assert.equal(clean.profiles.desktop.elements.hand.x,8);assert.equal(clean.profiles.mobile.elements.hand.y,5);assert.equal(clean.colors.table,'#123456');});
test('import rejects invalid versions and limits untrusted values to known targets',()=>{assert.throws(()=>L.parse('{"version":2}'));assert.throws(()=>L.parse(' '.repeat(65537)));const c=L.defaults();c.colors.table='red;display:none';c.font='evil';c.profiles.desktop.elements['body']= {x:10};c.profiles.desktop.elements.hand={x:Infinity,y:-999,scale:100,fontSize:-3};const clean=L.normalize(c);assert.equal(clean.colors.table,L.colors.table);assert.equal(clean.font,'system');assert.equal(clean.profiles.desktop.elements.body,undefined);assert.deepEqual(clean.profiles.desktop.elements.hand,{x:0,y:-100,scale:2,fontSize:0});});
test('saving settings round-trips and corrupt storage falls back to defaults',()=>{let saved;globalThis.localStorage={setItem:(k,v)=>{assert.equal(k,L.key);saved=v;},getItem:()=>saved};const c=L.defaults();c.profiles.mobile.elements.pot={x:3,y:2,scale:1.5,fontSize:24};L.save(c);assert.deepEqual(L.load(),c);saved='broken';assert.deepEqual(L.load(),L.defaults());});
test('new visitors and untouched old settings use the published default; personal changes remain local',()=>{
 const published=L.defaults(),factory=L.defaults();published.font='hei';published.profiles.desktop.elements.board={x:-2,y:16,scale:1,fontSize:0};globalThis.POKER_LAYOUT_DEFAULTS=published;
 let stored=null;globalThis.localStorage={getItem:()=>stored,setItem:(k,v)=>stored=v};
 try{assert.deepEqual(L.load(),published);L.save(factory);assert.deepEqual(L.load(),published);const own=L.defaults();own.profiles.mobile.elements.hand={x:4,y:3,scale:1.1,fontSize:0};L.save(own);assert.deepEqual(L.load(),own);stored='bad json';assert.deepEqual(L.load(),published);const reset=L.defaults();reset.profiles.desktop.elements.board.x=99;assert.equal(L.defaults().profiles.desktop.elements.board.x,-2);}finally{delete globalThis.POKER_LAYOUT_DEFAULTS;}
});
