// Room-scoped statistics. Incomplete legacy hands are deliberately not backfilled.
function seatPosition(i,dealer,count){const offset=(i-dealer+count)%count;return count===2?['BTN/SB','BB'][offset]:({3:['BTN','SB','BB'],4:['BTN','SB','BB','CO'],5:['BTN','SB','BB','UTG','CO'],6:['BTN','SB','BB','UTG','HJ','CO']})[count]?.[offset]||null;}
export function beginStats(r,g,now){
 const s=r.stats??={since:now,started:0,completed:0,players:{},history:[]};s.started++;
 const flags={};g.players.forEach((p,i)=>{const id=r.order[i];s.players[id]??={id,name:p.name,hands:0,vpip:0,pfr:0,threeBet:0,threeBetOpp:0,flops:0,showdowns:0,showdownWins:0,wins:0,net:0,postAgg:0,postCalls:0};flags[id]={base:p.stack+p.total,vpip:false,pfr:false,threeBet:false,threeBetOpp:false,flop:false,postAgg:0,postCalls:0};});
 s.current={seq:s.started,hand:g.hand,recordVersion:2,startedAt:now,sb:g.sb,bb:g.bb,dealer:g.dealer,table:g.players.map((p,i)=>({id:r.order[i],seat:i,position:seatPosition(i,g.dealer,g.players.length),startingStack:p.stack+p.total,blindPaid:p.total})),raises:0,flags,actions:[],actionsTruncated:false,settled:false};
}
export function actionStats(r,g,before,action){
 const c=r.stats?.current;if(!c||c.settled)return;const id=r.order[before.actor],f=c.flags[id];if(!f)return;
 if(before.phase==='preflop'){
  if(c.raises===1&&before.canRaise)f.threeBetOpp=true;
  if(action.paid>0)f.vpip=true;
  if(action.type==='raise'){f.pfr=true;if(c.raises===1&&before.canRaise)f.threeBet=true;c.raises++;}
 }else if(action.type==='raise')f.postAgg++;else if(action.type==='call')f.postCalls++;
 if(before.phase==='preflop'&&g.board.length>=3)g.players.forEach((p,i)=>{if(!p.folded)c.flags[r.order[i]].flop=true;});
 if(c.actions.length<250){const p=before.players[before.actor],stackAfter=p.stack-action.paid;c.actions.push({id,name:action.name,phase:before.phase,type:action.type,amount:action.amount,paid:action.paid,at:action.at,sequence:c.actions.length+1,board:before.board,potBefore:before.pot,toCallBefore:Math.min(p.stack,Math.max(0,before.bet-p.street)),betBefore:before.bet,minRaiseBefore:before.minRaise,canRaise:before.canRaise,stackBefore:p.stack,stackAfter,streetTotalAfter:p.street+action.paid,allIn:action.paid>0&&stackAfter===0,source:action.source||'player'});}else c.actionsTruncated=true;
}
export function settleStats(r,g,now){
 const s=r.stats,c=s?.current;if(!c||c.settled)return;c.settled=true;s.completed++;
 const showdown=g.alive.length>1,players=g.players.map((p,i)=>{const id=r.order[i],f=c.flags[id],q=s.players[id],net=p.stack-f.base;
  q.hands++;q.vpip+=+f.vpip;q.pfr+=+f.pfr;q.threeBet+=+f.threeBet;q.threeBetOpp+=+f.threeBetOpp;q.flops+=+f.flop;q.showdowns+=+(showdown&&!p.folded);q.showdownWins+=+(showdown&&!p.folded&&p.won>0);q.wins+=+(net>0);q.net+=net;q.postAgg+=f.postAgg;q.postCalls+=f.postCalls;
  return {id,name:p.name,net,cards:p.cards,folded:p.folded,...(c.recordVersion===2?{...c.table.find(q=>q.id===id),endingStack:p.stack,totalCommitted:p.total,payout:p.stack-f.base+p.total,vpip:f.vpip,pfr:f.pfr,threeBet:f.threeBet,threeBetOpportunity:f.threeBetOpp,sawFlop:f.flop,reachedShowdown:showdown&&!p.folded}: {})};
 });
 s.history.unshift({id:c.seq,hand:g.hand,at:now,...(c.recordVersion===2?{recordVersion:2,startedAt:c.startedAt,endedAt:now,sb:c.sb,bb:c.bb,dealer:c.dealer,actionsTruncated:c.actionsTruncated}:{}),board:g.board,pot:g.paidPot,showdown,result:g.result,players,revealed:showdown?players.filter(p=>!p.folded).map(p=>p.id):[],actions:c.actions});s.history=s.history.slice(0,100);
}
export function revealStats(r,id){const s=r.stats,h=s?.history[0];if(h&&s.current?.settled&&h.id===s.current.seq&&!h.revealed.includes(id))h.revealed.push(id);}
export function statsView(r,m,history=false){
 const s=r.stats;const out={since:s?.since||null,started:s?.started||0,completed:s?.completed||0,currentHand:r.game?.hand||0,players:Object.values(s?.players||{})};
 if(history)out.history=(s?.history||[]).map(h=>({...h,players:h.players.map(p=>({...p,cards:p.id===m.id||h.revealed.includes(p.id)?p.cards:null}))}));
 return out;
}
