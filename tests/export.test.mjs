import {completeOpeningFixture} from './opening-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../worker/api.js';
import {database} from '../scripts/local-db.mjs';

async function table(t){
 const DB=database();t.after(()=>DB.close());
 const req=async(path,data,token)=>{const res=await route(new Request('https://test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},...(data===undefined?{}:{body:JSON.stringify({requestId:crypto.randomUUID(),...data})})}),{DB});return completeOpeningFixture(DB,{status:res.status,...await res.json()},token);};
 const a=await req('',{name:'甲',seats:2,stackBB:100}),id=a.room.id,b=await req('/'+id+'/join',{name:'乙'});
 const cmd=(op,token,extra={})=>req('/'+id+'/'+op,extra,token),get=token=>req('/'+id,undefined,token),download=token=>req('/'+id+'/export',undefined,token);
 const read=()=>JSON.parse(DB.sql.prepare('SELECT state FROM poker_rooms WHERE id=?').get(id).state);
 const edit=fn=>{const x=read();fn(x);DB.sql.prepare('UPDATE poker_rooms SET state=? WHERE id=?').run(JSON.stringify(x),id);};
 await cmd('ready',b.token,{ready:true});const r=await cmd('start',a.token);
 const action=(state,type,amount)=>cmd('action',state.room.game.actor===0?a.token:b.token,{type,amount,turnSeq:state.room.turnSeq});
 return {a,b,id,req,cmd,get,download,read,edit,r,action};
}

// Export is read-only: it must not tick a timed-out game or change room state.
test('export requires a current room member and excludes the unfinished hand',async t=>{
 const h=await table(t);
 assert.equal((await h.download()).status,401);
 assert.equal((await h.download('invalid')).status,401);
 h.edit(x=>x.deadline=Date.now()-1);const before=h.read();
 const out=await h.download(h.a.token);assert.equal(out.status,200);assert.deepEqual(out.export.hands,[]);assert.deepEqual(h.read(),before);
 const other=await h.req('',{name:'外人',seats:2,stackBB:100});assert.equal((await h.download(other.token)).status,401);
});

test('fold exports own cards only, and voluntary reveal changes only the owner visibility',async t=>{
 const h=await table(t);await h.action(h.r,'fold');
 let a=(await h.download(h.a.token)).export,b=(await h.download(h.b.token)).export;
 assert.equal(a.hands.length,1);assert.equal(b.hands.length,1);
 assert.equal(a.hands[0].players.find(p=>p.id===h.a.room.you).holeCards.length,2);
 assert.equal(a.hands[0].players.find(p=>p.id===h.b.room.you).holeCards,null);
 assert.equal(b.hands[0].players.find(p=>p.id===h.a.room.you).holeCards,null);
 await h.cmd('reveal',h.a.token,{hand:1});
 a=(await h.download(h.a.token)).export;b=(await h.download(h.b.token)).export;
 assert.equal(b.hands[0].players.find(p=>p.id===h.a.room.you).holeCards.length,2);
 assert.equal(a.hands[0].players.find(p=>p.id===h.b.room.you).holeCards,null);
});

test('normal showdown exports both live hands and conserves stacks, commitments and payouts',async t=>{
 const h=await table(t);let r=h.r;for(let n=0;r.room.game.phase!=='done'&&n<12;n++)r=await h.action(r,'call');
 assert.equal(r.room.game.phase,'done');const out=(await h.download(h.a.token)).export,hand=out.hands[0];
 assert(hand.players.every(p=>p.holeCards?.length===2));
 assert.equal(hand.players.reduce((sum,p)=>sum+p.net,0),0);
 for(const p of hand.players){assert.equal(p.startingStack,10000);assert.equal(p.endingStack-p.startingStack,p.net);assert.equal(p.payout-p.totalCommitted,p.net);assert.equal(p.reachedShowdown,true);assert.equal(p.sawFlop,true);}
});

test('export explicitly projects fields and never serializes authentication or hidden game state',async t=>{
 const h=await table(t);await h.action(h.r,'fold');
 const forbidden=['ROOM_SECRET','HAND_SECRET','PLAYER_SECRET','ACTION_SECRET','DECK_SECRET','FLAGS_SECRET'];
 h.edit(x=>{x.secret=forbidden[0];const hand=x.stats.history[0];hand.secret=forbidden[1];hand.players.forEach(p=>{p.key=forbidden[2];p.cardsSecret=forbidden[2];});hand.actions[0].secret=forbidden[3];x.game.deck=[forbidden[4]];x.stats.current.flags.secret=forbidden[5];});
 const out=(await h.download(h.a.token)).export,text=JSON.stringify(out);
 for(const secret of forbidden)assert(!text.includes(secret));
 for(const m of h.read().members)assert(!text.includes(m.key));
 assert(!text.includes(h.a.token));assert(!text.includes(h.b.token));
});

test('action contexts keep pre-action boards and pre-settlement stacks across street boundaries',async t=>{
 const h=await table(t);let r=await h.action(h.r,'raise',300);r=await h.action(r,'call');assert.equal(r.room.game.phase,'flop');r=await h.action(r,'fold');
 const hand=(await h.download(h.a.token)).export.hands[0],actions=hand.actions;
 assert.equal(actions.length,3);
 assert.deepEqual(actions.map(a=>a.sequence),[1,2,3]);
 assert.deepEqual(actions.map(a=>a.potBefore),[150,400,600]);
 assert.deepEqual(actions.map(a=>a.toCallBefore),[50,200,0]);
 assert.deepEqual(actions.map(a=>a.stackBefore),[9950,9900,9700]);
 assert.deepEqual(actions.map(a=>a.stackAfter),[9700,9700,9700]);
 assert.deepEqual(actions.map(a=>a.streetTotalAfter),[300,300,0]);
 assert.deepEqual(actions.map(a=>a.board.length),[0,0,3]);
 assert.deepEqual(actions.map(a=>a.source),['player','player','player']);
 assert(hand.players.every(p=>p.totalCommitted===300));
 assert.equal(hand.players.find(p=>p.id===h.a.room.you).net,300);
 assert.equal(hand.players.find(p=>p.id===h.b.room.you).net,-300);
});

test('all-in action captures zero stack before settlement distributes the pot',async t=>{
 const h=await table(t);let r=await h.action(h.r,'raise',10000);r=await h.action(r,'call');
 const hand=(await h.download(h.a.token)).export.hands[0];
 assert.equal(r.room.game.phase,'done');assert.equal(hand.actions.length,2);
 assert.deepEqual(hand.actions.map(a=>a.stackAfter),[0,0]);assert(hand.actions.every(a=>a.allIn));
 assert.deepEqual(hand.actions.map(a=>a.board.length),[0,0]);
 assert.equal(hand.players.reduce((sum,p)=>sum+p.payout,0),20000);
});

test('timeout and departure actions identify their source',async t=>{
 for(const source of ['timeout','leave']){
  const h=await table(t);if(source==='timeout'){h.edit(x=>x.deadline=Date.now()-1);await h.get(h.b.token);}else await h.cmd('leave',h.a.token);
  const hand=(await h.download(h.b.token)).export.hands[0];assert.equal(hand.actions[0].source,source);assert.equal(hand.actions[0].type,'fold');
  if(source==='leave')assert.equal((await h.download(h.a.token)).status,401);
 }
});

test('legacy hands preserve known information without guessing missing action context',async t=>{
 const h=await table(t);await h.action(h.r,'fold');h.edit(x=>{const hand=x.stats.history[0];delete hand.recordVersion;for(const key of ['startedAt','endedAt','sb','bb','dealer'])delete hand[key];for(const p of hand.players)for(const key of ['seat','position','startingStack','endingStack','totalCommitted','payout','vpip','pfr','threeBet','threeBetOpportunity','sawFlop','reachedShowdown'])delete p[key];for(const a of hand.actions)for(const key of ['sequence','board','potBefore','toCallBefore','stackBefore','stackAfter','streetTotalAfter','allIn','source'])delete a[key];});
 const hand=(await h.download(h.a.token)).export.hands[0];
 assert.equal(hand.players.find(p=>p.id===h.a.room.you).net,-50);
 assert.equal(hand.players.find(p=>p.id===h.b.room.you).holeCards,null);
 for(const p of hand.players)for(const key of ['startingStack','endingStack','totalCommitted','payout','vpip','pfr','threeBet','sawFlop','reachedShowdown'])assert.equal(p[key],null,key);
 for(const key of ['potBefore','toCallBefore','stackBefore','stackAfter','streetTotalAfter','allIn','source'])assert.equal(hand.actions[0][key],null,key);
});

test('newly joined member cannot export hands played before joining',async t=>{
 const h=await table(t);await h.action(h.r,'fold');await h.cmd('leave',h.b.token);
 const c=await h.req('/'+h.id+'/join',{name:'新玩家'});assert.equal(c.status,200);
 assert.deepEqual((await h.download(c.token)).export.hands,[]);
 assert.equal((await h.download(h.a.token)).export.hands.length,1);
});

test('retained-history coverage separates cumulative totals and reports omitted early hands',async t=>{
 const h=await table(t);await h.action(h.r,'fold');
 h.edit(x=>{const hand=x.stats.history[0];x.stats.history=Array.from({length:100},(_,i)=>({...structuredClone(hand),id:101-i,hand:101-i}));x.stats.completed=101;x.stats.players[h.a.room.you].hands=101;x.stats.players[h.a.room.you].net=-5050;});
 const out=(await h.download(h.a.token)).export;
 assert.equal(out.coverage.historyLimit,100);assert.equal(out.coverage.exportedHands,100);assert.equal(out.coverage.completedHandsForPlayer,101);assert.equal(out.coverage.omittedEarlierHands,1);
 assert(out.coverage.warnings.some(w=>w.includes('100')&&w.includes('1')));
 assert.equal(out.hands[0].sequence,2);assert.equal(out.hands.at(-1).sequence,101);
 assert.equal(out.summary.cumulative.netChips,-5050);assert.equal(out.summary.exported.netChips,-5000);assert.equal(out.summary.exported.netBB,-50);
});

test('check rates use decision opportunities and separate automatic from manual checks',async t=>{
 const h=await table(t);let r=await h.action(h.r,'call');r=await h.action(r,'call');assert.equal(r.room.game.phase,'flop');
 h.edit(x=>x.deadline=Date.now()-1);r=await h.get(h.b.token);
 while(r.room.game.phase!=='done')r=await h.action(r,'call');
 const a=(await h.download(h.a.token)).export,b=(await h.download(h.b.token)).export;
 assert.deepEqual(a.summary.exported.checkRateKnownContext,{count:3,opportunities:3,percent:100});
 assert.deepEqual(b.summary.exported.checkRateKnownContext,{count:4,opportunities:4,percent:100});
 assert.deepEqual(b.summary.exported.manualCheckRate,{count:3,opportunities:3,percent:100});
 assert.equal(b.summary.exported.byStreet.flop.automaticActions,1);
 assert.equal(a.summary.cumulative.vpip.count,1);assert.equal(b.summary.cumulative.vpip.count,0);
 assert.equal(a.summary.cumulative.wtsd.percent,100);
 assert.equal(a.hands[0].hero.position,'BTN/SB');assert.equal(b.hands[0].hero.position,'BB');
});

test('legacy action contexts do not enter opportunity denominators',async t=>{
 const h=await table(t);await h.action(h.r,'fold');h.edit(x=>{const hand=x.stats.history[0];delete hand.recordVersion;delete hand.actions[0].toCallBefore;delete hand.actions[0].source;});
 const out=(await h.download(h.a.token)).export;
 assert.deepEqual(out.summary.exported.checkRateKnownContext,{count:0,opportunities:0,percent:null});
 assert.equal(out.summary.exported.unknownOpportunityActions,1);assert.equal(out.summary.exported.netBB,null);assert.equal(out.coverage.fullContextHands,0);
});

test('accepted show request is public in the exported completed hand',async t=>{
 const h=await table(t);await h.action(h.r,'fold');const request=await h.cmd('request-show',h.a.token,{target:h.b.room.you,hand:1});
 await h.cmd('respond-show',h.b.token,{showRequestId:request.room.game.showRequests[0].id,accept:true,hand:1});
 const hand=(await h.download(h.a.token)).export.hands[0];const opponent=hand.players.find(p=>!p.isYou);
 assert.equal(opponent.holeCardsVisibility,'public');assert.equal(opponent.holeCards.length,2);assert(opponent.holeCards.every(c=>/^[2-9TJQKA][shcd]$/.test(c)));
});
