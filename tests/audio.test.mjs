import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {route} from '../worker/api.js';
import {database} from '../scripts/local-db.mjs';
import {completeOpeningFixture} from './opening-fixture.mjs';
function audio(){const values=new Map(),c=vm.createContext({localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});vm.runInContext(fs.readFileSync(new URL('../public/poker-audio.js',import.meta.url),'utf8'),c);return {a:c.PokerAudio,values};}
const plain=x=>JSON.parse(JSON.stringify(x));
function room(version=1,extra={}){return {id:'room',version,serverNow:10000,game:{hand:1,board:[],lastAction:null},...extra};}
test('audio settings clamp corrupt input and persist independent channel preferences',()=>{
 const {a,values}=audio();const n=a.normalize({volume:150,musicVolume:-5,effectsVolume:NaN,enabled:'false'});assert.equal(n.volume,100);assert.equal(n.musicVolume,0);assert.equal(n.effectsVolume,70);assert.equal(n.enabled,true);
 a.setSettings({music:false,effectsVolume:42});a.setSettings({enabled:false});assert.equal(a.getSettings().effectsVolume,42);a.setSettings({enabled:true});assert.equal(a.getSettings().music,false);assert.equal(JSON.parse(values.get('px-audio-v1')).effectsVolume,42);
});
test('audio starts silently on connect and ignores repeated polling, stale states and old actions',()=>{
 const {a}=audio(),t=new a.Tracker();assert.deepEqual(plain(t.update(room())),[]);
 const r=room(2,{game:{hand:1,board:[],lastAction:{eventId:'one',at:9990,sound:'raise'}}});assert.deepEqual(plain(t.update(r)),[{type:'raise'}]);assert.deepEqual(plain(t.update(r)),[]);assert.deepEqual(plain(t.update(room())),[]);assert.deepEqual(plain(t.update({...r,version:3})),[]);
 assert.deepEqual(plain(t.update(room(4,{game:{hand:1,board:[],lastAction:{eventId:'old',at:1000,sound:'call'}}}))),[]);
 t.reset();assert.deepEqual(plain(t.update(r)),[]);assert.deepEqual(plain(t.update({...r,id:'another'})),[]);
});
test('audio follows new streets, opening redraws and new hands without replaying earlier calls',()=>{
 const {a}=audio(),t=new a.Tracker();t.update(room());
 assert.deepEqual(plain(t.update(room(2,{dealerDraw:{active:true,rounds:[{number:1}],nextAt:12000}}))),[{type:'shuffle'}]);
 assert.deepEqual(plain(t.update(room(3,{dealerDraw:{active:true,rounds:[{number:2}],nextAt:14000}}))),[{type:'shuffle'}]);
 assert.deepEqual(plain(t.update(room(4,{game:{hand:2,board:[],lastAction:null}}))),[{type:'deal'}]);
 assert.deepEqual(plain(t.update(room(5,{game:{hand:2,board:[{},{},{}],lastAction:null}}))),[{type:'flip',count:3}]);
 for(const [i,type] of ['bet','call','raise','allin','check','fold'].entries()){const r=room(6+i,{game:{hand:2,board:[{},{},{}],lastAction:{eventId:type,at:9999,sound:type}}});assert.deepEqual(plain(t.update(r)),[{type}]);assert.deepEqual(plain(t.update(r)),[]);}
});
test('server distinguishes bet, raise and all-in and sends the same event to both players',async t=>{
 const DB=database();t.after(()=>DB.close());
 const req=async(path,data,token)=>{const res=await route(new Request('https://test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},...(data===undefined?{}:{body:JSON.stringify({requestId:crypto.randomUUID(),...data})})}),{DB});assert.equal(res.status,200);return completeOpeningFixture(DB,await res.json(),token);};
 const a=await req('',{name:'甲',seats:2,stackBB:100}),id=a.room.id,b=await req('/'+id+'/join',{name:'乙'});
 const cmd=(op,token,data={})=>req('/'+id+'/'+op,data,token);
 await cmd('ready',b.token,{ready:true});let r=await cmd('start',a.token);
 const act=async(type,amount)=>{r=await cmd('action',r.room.game.actor===0?a.token:b.token,{type,amount,turnSeq:r.room.turnSeq});return r.room.game.lastAction;};
 assert.equal((await act('raise',300)).sound,'raise');assert.equal((await act('call')).sound,'call');assert.equal(r.room.game.phase,'flop');assert.equal((await act('raise',200)).sound,'bet');
 const event=r.room.game.lastAction,seen=await req('/'+id,undefined,a.token);assert.equal(seen.room.game.lastAction.eventId,event.eventId);assert.equal(seen.room.game.lastAction.sound,'bet');
 assert.equal((await act('raise',9700)).sound,'allin');assert.equal((await act('call')).sound,'allin');assert.equal(r.room.game.phase,'done');assert(r.room.game.players.some(p=>p.stack>0));
});
