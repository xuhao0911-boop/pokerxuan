import {completeOpeningFixture} from './opening-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../worker/api.js';
import {database} from '../scripts/local-db.mjs';

async function table(t){
 const DB=database();t.after(()=>DB.close());
 const req=async(path,data,token)=>{const res=await route(new Request('https://test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},...(data===undefined?{}:{body:JSON.stringify({requestId:crypto.randomUUID(),...data})})}),{DB});return completeOpeningFixture(DB,{status:res.status,...await res.json()},token);};
 const a=await req('',{name:'甲',seats:2,stackBB:100}),id=a.room.id,b=await req('/'+id+'/join',{name:'乙'});
 const cmd=(op,token,extra={})=>req('/'+id+'/'+op,extra,token),get=token=>req('/'+id,undefined,token);
 await cmd('ready',b.token,{ready:true});let r=await cmd('start',a.token);
 const edit=fn=>{const row=DB.sql.prepare('SELECT state FROM poker_rooms WHERE id=?').get(id),x=JSON.parse(row.state);fn(x);DB.sql.prepare('UPDATE poker_rooms SET state=? WHERE id=?').run(JSON.stringify(x),id);};
 const fold=()=>cmd('action',a.token,{type:'fold',turnSeq:r.room.turnSeq});
 return {a,b,cmd,get,edit,fold,r};
}

test('normal river showdown reveals both live hands and all-in showdown still reveals',async t=>{
 for(const allIn of [false,true]){const h=await table(t);let r=h.r;
  if(allIn){r=await h.cmd('action',h.a.token,{type:'raise',amount:10000,turnSeq:r.room.turnSeq});r=await h.cmd('action',h.b.token,{type:'call',turnSeq:r.room.turnSeq});}
  else for(let n=0;r.room.game.phase!=='done'&&n<10;n++)r=await h.cmd('action',r.room.game.actor===0?h.a.token:h.b.token,{type:'call',turnSeq:r.room.turnSeq});
  assert.equal(r.status,200);assert.equal(r.room.game.phase,'done');assert.equal(r.room.game.showdown,true);assert.equal(r.room.game.board.length,5);
  for(const token of [h.a.token,h.b.token]){const seen=await h.get(token);assert(seen.room.game.players.every(p=>p.cards?.length===2));}
 }
});

test('fold finish hides opponent cards, waits three seconds and voluntary reveal exposes only owner',async t=>{
 const h=await table(t);let r=await h.fold();assert.equal(r.room.game.showdown,false);assert.equal(r.room.game.players[1].cards,null);assert(Math.abs(r.room.game.nextHandAt-r.room.serverNow-3000)<100);
 let b=await h.get(h.b.token);assert.equal(b.room.game.players[0].cards,null);assert.equal((await h.cmd('start',h.a.token)).status,409);
 r=await h.cmd('reveal',h.a.token,{hand:1,target:h.b.room.you});assert.equal(r.status,200);b=await h.get(h.b.token);assert.equal(b.room.game.players[0].cards.length,2);assert.equal(r.room.game.players[1].cards,null);
 h.edit(x=>x.nextHandAt=0);r=await h.cmd('start',h.a.token);assert.equal(r.status,200);assert.deepEqual(r.room.game.revealed,[]);assert.deepEqual(r.room.game.showRequests,[]);assert.equal((await h.cmd('reveal',h.a.token,{hand:1})).status,409);
});

test('five-second request requires target consent, denial and timeout preserve privacy',async t=>{
 for(const answer of ['accept','decline','timeout']){const h=await table(t);await h.fold();let r=await h.cmd('request-show',h.a.token,{target:h.b.room.you,hand:1});assert.equal(r.status,200);const q=r.room.game.showRequests[0];assert(Math.abs(q.expiresAt-r.room.serverNow-5000)<100);assert.equal(r.room.game.players[1].cards,null);
  assert.equal((await h.cmd('respond-show',h.a.token,{showRequestId:q.id,accept:true,hand:1})).status,403);
  assert.equal((await h.cmd('request-show',h.a.token,{target:h.b.room.you,hand:1})).status,400);
  h.edit(x=>x.nextHandAt=0);assert.equal((await h.cmd('start',h.a.token)).status,409);
  if(answer==='timeout'){h.edit(x=>x.showRequests[0].expiresAt=Date.now()-1);assert.equal((await h.cmd('respond-show',h.b.token,{showRequestId:q.id,accept:true,hand:1})).status,409);h.edit(x=>x.nextHandAt=Date.now()+3000);r=await h.get(h.a.token);assert.equal(r.room.game.showRequests[0].status,'expired');}
  h.edit(x=>x.nextHandAt=Date.now()+3000);if(answer!=='timeout'){r=await h.cmd('respond-show',h.b.token,{showRequestId:q.id,accept:answer==='accept',hand:1});assert.equal(r.status,200);}
  const a=await h.get(h.a.token),b=await h.get(h.b.token);assert.equal(!!a.room.game.players[1].cards,answer==='accept');assert.equal(b.room.game.players[0].cards,null);
 }
});

test('three-second automatic next hand is server-owned and concurrent polls deal once',async t=>{
 const h=await table(t);await h.fold();let r=await h.get(h.b.token);assert.equal(r.room.game.hand,1);assert.equal(r.room.game.phase,'done');
 h.edit(x=>x.nextHandAt=Date.now()-1);
 const replies=await Promise.all([h.get(h.a.token),h.get(h.b.token),h.get(h.a.token)]);
 assert(replies.every(x=>x.status===200));r=await h.get(h.b.token);assert.equal(r.room.game.hand,2);assert.equal(r.room.game.phase,'preflop');assert.equal(r.room.game.dealer,1);assert.equal(r.room.game.players[0].cards,null);assert.deepEqual(r.room.game.revealed,[]);
});

test('automatic dealing waits for pending five-second consent and does not rebuy a completed match',async t=>{
 const h=await table(t);await h.fold();let r=await h.cmd('request-show',h.a.token,{target:h.b.room.you,hand:1});const q=r.room.game.showRequests[0];h.edit(x=>x.nextHandAt=Date.now()-1);
 r=await h.get(h.b.token);assert.equal(r.room.game.phase,'done');assert.equal(r.room.game.nextHandAt,q.expiresAt);
 await h.cmd('respond-show',h.b.token,{showRequestId:q.id,accept:false,hand:1});r=await h.get(h.a.token);assert.equal(r.room.game.hand,2);
 r=await h.cmd('action',h.b.token,{type:'raise',amount:10050,turnSeq:r.room.turnSeq});r=await h.cmd('action',h.a.token,{type:'call',turnSeq:r.room.turnSeq});
 // A split pot is possible, so explicitly model a finished match for this guard.
 h.edit(x=>{x.matchOver=true;x.nextHandAt=Date.now()-1;});r=await h.get(h.a.token);assert.equal(r.room.game.hand,2);assert.equal(r.room.game.phase,'done');
});

test('automatic dealing waits for absent players, then resumes when both are present',async t=>{
 const h=await table(t);await h.fold();h.edit(x=>{x.nextHandAt=Date.now()-1;x.members[0].seen=Date.now()-31000;});let r=await h.get(h.b.token);assert.equal(r.room.game.phase,'done');
 r=await h.get(h.a.token);assert.equal(r.room.game.hand,2);assert.equal(r.room.game.phase,'preflop');
});

test('a revealed player can advance once without host privilege, stale hands and hidden players cannot',async t=>{
 const h=await table(t);await h.fold();
 assert.equal((await h.cmd('next-hand',h.b.token,{hand:1})).status,403);
 await h.cmd('reveal',h.b.token,{hand:1});
 assert.equal((await h.cmd('next-hand',h.b.token,{hand:0})).status,409);
 const replies=await Promise.all([h.cmd('next-hand',h.b.token,{hand:1}),h.cmd('next-hand',h.b.token,{hand:1})]);
 assert.equal(replies.filter(r=>r.status===200).length,1);
 const r=await h.get(h.a.token);assert.equal(r.room.game.hand,2);assert.equal(r.room.game.phase,'preflop');assert.equal(r.room.game.dealer,1);assert.deepEqual(r.room.game.revealed,[]);assert.equal(r.room.game.players[1].cards,null);
});

test('early next hand honors pending consent, online players and completed match guards',async t=>{
 const h=await table(t);await h.fold();await h.cmd('reveal',h.a.token,{hand:1});
 let r=await h.cmd('request-show',h.a.token,{target:h.b.room.you,hand:1});const q=r.room.game.showRequests[0];
 assert.equal((await h.cmd('next-hand',h.a.token,{hand:1})).status,409);
 await h.cmd('respond-show',h.b.token,{showRequestId:q.id,accept:false,hand:1});
 h.edit(x=>x.members[1].seen=Date.now()-31000);assert.equal((await h.cmd('next-hand',h.a.token,{hand:1})).status,400);
 h.edit(x=>{x.members[1].seen=Date.now();x.matchOver=true;});assert.equal((await h.cmd('next-hand',h.a.token,{hand:1})).status,409);
 h.edit(x=>x.matchOver=false);r=await h.cmd('next-hand',h.a.token,{hand:1});assert.equal(r.status,200);assert.equal(r.room.game.hand,2);
});
