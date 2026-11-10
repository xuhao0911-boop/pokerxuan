import test from 'node:test';
import assert from 'node:assert/strict';
import {dealerDrawRound,openDealerDraw,repeatDealerDraw,DEALER_DRAW_MS} from '../worker/dealer.js';
import {route} from '../worker/api.js';
import {database} from '../scripts/local-db.mjs';
const cards=(...ranks)=>ranks.map((r,i)=>({r,s:i%4}));

test('A is highest, suits never break a tie, and only highest equal ranks redraw until decided',()=>{
 const ids=['a','b','c','d','e','f'];
 const first=dealerDrawRound(ids,1,cards(14,14,13,14,2,2));
 assert.deepEqual(first.leaders,['a','b','d']);assert.equal(first.winner,null);
 const second=dealerDrawRound(first.leaders,2,cards(10,7,10));
 assert.deepEqual(second.leaders,['a','d']);assert.equal(second.winner,null);
 const third=dealerDrawRound(second.leaders,3,cards(11,11));assert.equal(third.winner,null);
 const final=dealerDrawRound(third.leaders,4,cards(13,14));assert.equal(final.winner,'d');
 assert.deepEqual(final.cards.map(p=>p.id),['a','d']);
 const equal=dealerDrawRound(['a','b'],1,[{r:2,s:3},{r:2,s:0}]);assert.equal(equal.winner,null);
});

test('fresh shuffled draw decks cover two through six seats without duplicate cards or an arbitrary tie winner',()=>{
 for(let seats=2;seats<=6;seats++)for(let n=0;n<100;n++){
  const ids=Array.from({length:seats},(_,i)=>'p'+i),draw=openDealerDraw(ids,100);
  assert.equal(draw.nextAt,100+DEALER_DRAW_MS);assert.equal(draw.rounds[0].cards.length,seats);
  assert.equal(draw.rounds[0].startedAt,100);
  for(const p of draw.rounds[0].cards)assert(Number.isInteger(p.pick)&&p.pick>=0&&p.pick<52);
  assert.equal(new Set(draw.rounds[0].cards.map(p=>p.pick)).size,seats);
  for(let count=0;draw.winner===null&&count<100;count++){const eligible=[...draw.contenders];repeatDealerDraw(draw,200+count);assert.deepEqual(draw.rounds.at(-1).cards.map(p=>p.id),eligible);}
  assert(draw.winner);for(const round of draw.rounds){assert.equal(new Set(round.cards.map(p=>p.card.r+':'+p.card.s)).size,round.cards.length);assert(round.cards.every(p=>p.card.r>=2&&p.card.r<=14&&p.card.s>=0&&p.card.s<=3));}
 }
});

async function setup(t,{count=2,seats=count===2?2:6,practice=false}={}){
 const DB=database();t.after(()=>DB.close());
 const req=async(path,data,token)=>{const response=await route(new Request('https://test/api/rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},...(data===undefined?{}:{body:JSON.stringify({requestId:crypto.randomUUID(),...data})})}),{DB});return {status:response.status,...await response.json()};};
 const host=await req('',{name:'玩家0',seats,stackBB:100,practice}),id=host.room.id,users=[host];
 const cmd=(op,user=host,data={})=>req('/'+id+'/'+op,data,user.token),get=(user=host)=>req('/'+id,undefined,user.token);
 if(!practice)for(let i=1;i<count;i++){const user=await req('/'+id+'/join',{name:'玩家'+i});users.push(user);await cmd('ready',user,{ready:true});}
 const read=()=>JSON.parse(DB.sql.prepare('SELECT state FROM poker_rooms WHERE id=?').get(id).state);
 const edit=fn=>{const r=read();fn(r);DB.sql.prepare('UPDATE poker_rooms SET state=? WHERE id=?').run(JSON.stringify(r),id);};
 const forceWinner=index=>edit(r=>{const round=dealerDrawRound(r.order,1,r.order.map((_,i)=>({r:i===index?14:2+i,s:i%4})));r.dealerDraw={active:true,rounds:[round],contenders:round.leaders,winner:round.winner,nextAt:Date.now()-1};});
 const start=()=>cmd('start');return {DB,host,id,users,cmd,get,req,read,edit,forceWinner,start};
}

test('friend tables expose each opening draw to every player before hole cards, blinds, stats or clocks begin',async t=>{
 for(let count=2;count<=6;count++){
  const h=await setup(t,{count});assert.equal((await h.cmd('start',h.users[1])).status,403);
  const r=await h.start(),draw=r.room.dealerDraw;assert.equal(r.status,200);assert.equal(r.room.game,null);assert.equal(draw.active,true);assert.equal(draw.rounds[0].cards.length,count);assert.equal(r.room.stats.started,0);assert.equal(r.room.deadline,0);
  for(const user of h.users){const other=await h.get(user);assert.deepEqual(other.room.dealerDraw,draw);assert.equal(other.room.game,null);}
  assert(!JSON.stringify(r.room).includes('deck'));assert(h.read().members.every(m=>!JSON.stringify(r.room).includes(m.key)));
  assert.equal((await h.cmd('action',h.host,{type:'call',turnSeq:r.room.turnSeq})).status,409);
  assert.equal((await h.cmd('time',h.host,{turnSeq:r.room.turnSeq})).status,409);
  assert.equal((await h.cmd('ready',h.users[1],{ready:false})).status,409);
  assert.equal((await h.req('/'+h.id+'/join',{name:'新朋友'})).status,409);
  assert.equal((await h.start()).status,409);
  const before=h.read();const exported=await h.req('/'+h.id+'/export',undefined,h.host.token);assert.equal(exported.status,200);assert.deepEqual(exported.export.hands,[]);assert.deepEqual(h.read(),before);
 }
});

test('tied rounds are retained, only tied leaders enter the next round, and concurrent polls advance once',async t=>{
 const h=await setup(t,{count:6});await h.start();
 h.edit(r=>{const round=dealerDrawRound(r.order,1,cards(3,14,8,14,5,6));r.dealerDraw={active:true,rounds:[round],contenders:round.leaders,winner:null,nextAt:Date.now()-1};});
 const order=h.read().order,first=h.read().dealerDraw.rounds[0];
 const results=await Promise.all(h.users.map(user=>h.get(user)));assert(results.every(r=>r.status===200));
 let r=await h.get();assert.equal(r.room.dealerDraw.rounds.length,2);assert.deepEqual(r.room.dealerDraw.rounds[0],first);assert.deepEqual(r.room.dealerDraw.rounds[1].cards.map(p=>p.id),[order[1],order[3]]);assert.equal(r.room.game,null);
 // A second tie remains a tie: the service draws again, never falls back to suit or seat order.
 h.edit(x=>{const round=dealerDrawRound([order[1],order[3]],2,cards(2,2));x.dealerDraw.rounds[1]=round;x.dealerDraw.winner=null;x.dealerDraw.contenders=round.leaders;x.dealerDraw.nextAt=Date.now()-1;});
 r=await h.get();assert.equal(r.room.dealerDraw.rounds.length,3);assert.deepEqual(r.room.dealerDraw.rounds[2].cards.map(p=>p.id),[order[1],order[3]]);
});

test('actual draw winner takes the first button, normal rotation resumes, fresh hole-card deck and exports remain correct',async t=>{
 for(let count=2;count<=6;count++){
  const h=await setup(t,{count});await h.start();h.forceWinner(count-1);
  const replies=await Promise.all(h.users.map(u=>h.get(u)));assert(replies.every(r=>r.status===200));let r=await h.get();
  let g=r.room.game;assert.equal(g.phase,'preflop');assert.equal(g.hand,1);assert.equal(g.dealer,count-1);assert.equal(r.room.dealerDraw.active,false);assert.equal(r.room.stats.started,1);
  assert(!g.history.some(line=>/定庄|首手庄位/.test(line)));
  assert.equal(g.players[(g.dealer+(count===2?0:1))%count].street,50);assert.equal(g.players[(g.dealer+(count===2?1:2))%count].street,100);
  assert.equal(g.actor,(g.dealer+(count===2?0:3))%count);assert.equal(h.read().game.deck.length,52-count*2);assert.equal(h.read().game.players.reduce((s,p)=>s+p.stack+p.total,0),count*10000);
  assert(g.players[0].cards?.length===2);assert(g.players.slice(1).every(p=>p.cards===null));assert(Math.abs(r.room.deadline-r.room.serverNow-30000)<100);
  const oldDraw=r.room.dealerDraw;for(let n=0;r.room.game.phase!=='done'&&n<6;n++)r=await h.cmd('action',h.users[r.room.game.actor],{type:'fold',turnSeq:r.room.turnSeq});
  assert.equal(r.room.game.phase,'done');assert.equal(r.room.stats.completed,1);
  const out=await h.req('/'+h.id+'/export',undefined,h.host.token);assert.equal(out.export.hands.length,1);assert.equal(out.export.hands[0].dealerSeat,count-1);
  h.edit(x=>x.nextHandAt=0);r=await h.start();assert.equal(r.room.game.hand,2);assert.equal(r.room.game.dealer,0);assert.deepEqual(r.room.dealerDraw,oldDraw);assert.equal(r.room.stats.started,2);
 }
});

test('practice AI participants follow the same draw before any AI hand action',async t=>{
 for(const seats of [2,6]){const h=await setup(t,{practice:true,seats});const r=h.host;assert.equal(r.room.game,null);assert.equal(r.room.dealerDraw.rounds[0].cards.length,seats);assert.equal(r.room.members.filter(m=>m.bot).length,seats-1);assert.equal((await h.get()).room.game,null);h.forceWinner(0);const first=await h.get();assert.equal(first.room.game.hand,1);assert.equal(first.room.game.dealer,0);assert.equal(first.room.stats.started,1);assert.equal(first.room.game.lastAction,null);}
});

test('leaving cancels an opening draw, offline participants delay dealing, and new matches draw afresh',async t=>{
 const h=await setup(t);await h.start();h.forceWinner(1);h.edit(r=>r.members[1].seen=Date.now()-31000);
 let r=await h.get();assert.equal(r.room.game,null);assert.equal(r.room.dealerDraw.active,true);
 r=await h.get(h.users[1]);assert.equal(r.room.game.hand,1);assert.equal(r.room.game.dealer,1);
 r=await h.cmd('action',h.users[1],{type:'fold',turnSeq:r.room.turnSeq});h.edit(x=>{x.matchOver=true;x.nextHandAt=0;});
 r=await h.start();assert.equal(r.room.game,null);assert.equal(r.room.dealerDraw.active,true);assert.equal(r.room.dealerDraw.rounds.length,1);assert.equal(r.room.stats.started,1);
 await h.cmd('leave',h.users[1]);r=await h.get();assert.equal(r.room.dealerDraw.active,false);assert.equal(r.room.dealerDraw.cancelled,true);assert.equal(r.room.game,null);assert.equal((await h.start()).status,400);
});

test('legacy already-running games do not gain a new draw or lose their button rotation',async t=>{
 const h=await setup(t);await h.start();h.forceWinner(1);let r=await h.get();
 h.edit(x=>delete x.dealerDraw);r=await h.get();assert.equal(r.room.game.phase,'preflop');assert.equal(r.room.dealerDraw,null);
 r=await h.cmd('action',h.users[1],{type:'fold',turnSeq:r.room.turnSeq});h.edit(x=>x.nextHandAt=0);r=await h.start();assert.equal(r.room.game.hand,2);assert.equal(r.room.game.dealer,0);assert.equal(r.room.dealerDraw,null);
});
