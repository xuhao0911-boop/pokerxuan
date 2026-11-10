// Opening button draw uses its own deck. Hole cards are dealt from a fresh deck later.
export const DEALER_DRAW_MS=6500;
function dealerDeck(){
 const deck=[];for(let s=0;s<4;s++)for(let r=2;r<=14;r++)deck.push({r,s});
 for(let i=deck.length-1;i>0;i--){
  // Rejection sampling avoids modulo bias in the draw.
  const limit=Math.floor(4294967296/(i+1))*(i+1);let value;
  do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=limit);
  const j=value%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];
 }
 return deck;
}
export function dealerDrawRound(contenders,number=1,deck=dealerDeck()){
 if(contenders.length<2||contenders.length>6||new Set(contenders).size!==contenders.length)throw new Error('Invalid dealer draw participants');
 // Keep visual picks server-owned too, so both screens pull the same cards from the row.
 const positions=dealerDeck().map(c=>c.s*13+c.r-2);
 const cards=contenders.map((id,i)=>({id,card:{...deck[i]},pick:positions[i]}));
 const high=Math.max(...cards.map(p=>p.card.r));
 const leaders=cards.filter(p=>p.card.r===high).map(p=>p.id);
 return {number,cards,high,leaders,winner:leaders.length===1?leaders[0]:null};
}
export function openDealerDraw(order,now){
 const first={...dealerDrawRound(order),startedAt:now};
 return {active:true,rounds:[first],contenders:first.leaders,winner:first.winner,nextAt:now+DEALER_DRAW_MS};
}
export function repeatDealerDraw(draw,now){
 const round={...dealerDrawRound(draw.contenders,draw.rounds.length+1),startedAt:now};
 draw.rounds.push(round);draw.contenders=round.leaders;draw.winner=round.winner;draw.nextAt=now+DEALER_DRAW_MS;
}
