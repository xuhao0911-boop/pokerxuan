import {completeOpeningFixture} from './opening-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {route,EMOTES} from '../worker/api.js';import {database} from '../scripts/local-db.mjs';
async function setup(t){const DB=database();t.after(()=>DB.close());const req=async(path,data,token)=>{const res=await route(new Request('https://test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},...(data===undefined?{}:{body:JSON.stringify({requestId:crypto.randomUUID(),...data})})}),{DB});return completeOpeningFixture(DB,{status:res.status,...await res.json()},token);};const a=await req('',{name:'甲',seats:2,stackBB:100}),id=a.room.id,b=await req('/'+id+'/join',{name:'乙'});const cmd=(op,token,body={})=>req('/'+id+'/'+op,body,token),get=token=>req('/'+id,undefined,token),stats=token=>req('/'+id+'/stats',undefined,token);await cmd('ready',b.token,{ready:true});let r=await cmd('start',a.token);const edit=fn=>{const x=JSON.parse(DB.sql.prepare('SELECT state FROM poker_rooms WHERE id=?').get(id).state);fn(x);DB.sql.prepare('UPDATE poker_rooms SET state=? WHERE id=?').run(JSON.stringify(x),id);};return {a,b,id,req,cmd,get,stats,edit,r};}

test('VPIP excludes blinds and checks; PFR, 3-bet opportunities and settled hand counts are accurate',async t=>{
 const h=await setup(t);let r=h.r;while(r.room.game.phase!=='done')r=await h.cmd('action',r.room.game.actor===0?h.a.token:h.b.token,{type:'call',turnSeq:r.room.turnSeq});
 assert.equal(r.room.stats.completed,1);assert(Math.abs(r.room.game.nextHandAt-r.room.serverNow-8000)<100);
 let [a,b]=r.room.stats.players;assert.equal(a.vpip,1);assert.equal(b.vpip,0);assert.equal(a.pfr,0);assert.equal(b.pfr,0);assert.equal(a.flops,1);assert.equal(b.flops,1);assert.equal(a.showdowns,1);assert.equal(b.showdowns,1);assert.equal(a.net+b.net,0);
 h.edit(x=>x.nextHandAt=0);r=await h.get(h.a.token);assert.equal(r.room.game.hand,2);
 r=await h.cmd('action',h.b.token,{type:'raise',amount:300,turnSeq:r.room.turnSeq});r=await h.cmd('action',h.a.token,{type:'raise',amount:900,turnSeq:r.room.turnSeq});r=await h.cmd('action',h.b.token,{type:'call',turnSeq:r.room.turnSeq});
 assert.equal(r.room.stats.completed,1);r=await h.cmd('action',h.a.token,{type:'call',turnSeq:r.room.turnSeq});r=await h.cmd('action',h.b.token,{type:'fold',turnSeq:r.room.turnSeq});
 [a,b]=r.room.stats.players;assert.equal(a.hands,2);assert.equal(a.vpip,2);assert.equal(a.pfr,1);assert.equal(a.threeBet,1);assert.equal(a.threeBetOpp,1);assert.equal(b.vpip,1);assert.equal(b.pfr,1);assert.equal(b.threeBet,0);assert.equal(a.net+b.net,0);assert.equal(r.room.stats.completed,2);
 await h.get(h.a.token);await h.get(h.b.token);assert.equal((await h.stats(h.a.token)).stats.completed,2);
});

test('history never leaks folded/unrevealed cards; voluntary reveal updates only that owner and gives eight seconds',async t=>{
 const h=await setup(t);let r=await h.cmd('action',h.a.token,{type:'fold',turnSeq:h.r.room.turnSeq});let a=await h.stats(h.a.token),b=await h.stats(h.b.token);assert.equal(a.stats.history[0].players[1].cards,null);assert.equal(b.stats.history[0].players[0].cards,null);assert(a.stats.history[0].players[0].cards);assert.equal(a.stats.history[0].actions[0].type,'fold');
 r=await h.cmd('reveal',h.a.token,{hand:1});assert(Math.abs(r.room.game.nextHandAt-r.room.serverNow-8000)<100);const deadline=r.room.game.nextHandAt;b=await h.stats(h.b.token);assert(b.stats.history[0].players[0].cards);a=await h.stats(h.a.token);assert.equal(a.stats.history[0].players[1].cards,null);
 r=await h.cmd('reveal',h.a.token,{hand:1});assert.equal(r.room.game.nextHandAt,deadline);assert.equal(r.room.stats.completed,1);
 assert.equal((await h.req('/'+h.id+'/stats',undefined,'invalid')).status,401);assert(!JSON.stringify(a.stats).includes('base'));assert(!JSON.stringify(a.stats).includes('deck'));
});

test('normal showdown history reveals both live hands; consent reveal is retained in history',async t=>{
 const h=await setup(t);let r=await h.cmd('action',h.a.token,{type:'fold',turnSeq:h.r.room.turnSeq});r=await h.cmd('request-show',h.a.token,{target:h.b.room.you,hand:1});r=await h.cmd('respond-show',h.b.token,{showRequestId:r.room.game.showRequests[0].id,accept:true,hand:1});assert(Math.abs(r.room.game.nextHandAt-r.room.serverNow-8000)<100);assert((await h.stats(h.a.token)).stats.history[0].players[1].cards);
 h.edit(x=>x.nextHandAt=0);r=await h.get(h.a.token);while(r.room.game.phase!=='done')r=await h.cmd('action',r.room.game.actor===0?h.a.token:h.b.token,{type:'call',turnSeq:r.room.turnSeq});
 const data=await h.stats(h.a.token);assert(data.stats.history[0].players.every(p=>p.cards?.length===2));assert.equal(data.stats.history.length,2);
});

test('emotes synchronize both directions, validate targets/types, preserve chips and clock, and deduplicate',async t=>{
 const h=await setup(t),before=h.r.room;for(const type of EMOTES){h.edit(x=>x.members[0].emoteAt=0);const requestId=crypto.randomUUID(),payload={type,target:h.b.room.you,requestId};let r=await h.cmd('emote',h.a.token,payload);assert.equal(r.status,200);const id=r.room.emotes.at(-1).id;r=await h.cmd('emote',h.a.token,payload);assert.equal(r.room.emotes.filter(e=>e.id===id).length,1);const other=await h.get(h.b.token);assert.equal(other.room.emotes.at(-1).type,type);assert.equal(other.room.emotes.at(-1).from,h.a.room.you);assert.equal(other.room.emotes.at(-1).to,h.b.room.you);assert.equal(other.room.deadline,before.deadline);assert.equal(other.room.turnSeq,before.turnSeq);assert.deepEqual(other.room.game.players.map(p=>p.stack),before.game.players.map(p=>p.stack));}
 assert.equal((await h.cmd('emote',h.a.token,{type:'rose',target:h.b.room.you})).status,400);h.edit(x=>x.members[0].emoteAt=0);assert.equal((await h.cmd('emote',h.a.token,{type:'invalid',target:h.b.room.you})).status,400);assert.equal((await h.cmd('emote',h.a.token,{type:'rose',target:h.a.room.you})).status,400);assert.equal((await h.cmd('emote',h.a.token,{type:'rose',target:'stranger'})).status,400);
 h.edit(x=>x.emotes.forEach(e=>e.at=Date.now()-6001));assert.deepEqual((await h.get(h.a.token)).room.emotes,[]);
});

test('legacy incomplete hands are not guessed into VPIP or history',async t=>{
 const h=await setup(t);h.edit(x=>delete x.stats);let r=await h.cmd('action',h.a.token,{type:'fold',turnSeq:h.r.room.turnSeq});assert.equal(r.room.stats.completed,0);assert.deepEqual((await h.stats(h.a.token)).stats.history,[]);h.edit(x=>x.nextHandAt=0);r=await h.get(h.a.token);assert.equal(r.room.stats.started,1);assert.equal(r.room.stats.completed,0);
});
