// One server timestamp drives the sequence; room polling never restarts it.
function dealerDrawUI(){
 const d=state?.dealerDraw,panel=$('#dealerDrawPanel');
 panel.hidden=!d?.active||!!d.cancelled;
 if(panel.hidden){panel.replaceChildren();delete panel.dataset.drawKey;delete panel.dataset.stage;return;}
 const round=d.rounds.at(-1),key=state.id+':'+round.number+':'+(round.startedAt||d.nextAt);
 if(panel.dataset.drawKey!==key){
  const elapsed=Math.max(0,Date.now()+offset-(round.startedAt||d.nextAt-6500));
  const duration=round.startedAt?Math.max(1,d.nextAt-round.startedAt):6500;
  const picks=round.cards.map((p,i)=>Number.isInteger(p.pick)&&p.pick>=0&&p.pick<52?p.pick:Math.round((i+1)*51/(round.cards.length+1)));
  panel.style.setProperty('--draw-delay',-elapsed+'ms');panel.style.setProperty('--draw-duration',duration+'ms');
  panel.innerHTML='<div class="draw-title">抽牌定庄</div><div class="draw-stage"><div class="draw-rail" aria-hidden="true">'+Array.from({length:52},(_,i)=>'<div class="draw-rail-card '+(picks.includes(i)?'draw-picked':'')+'" style="--slot:'+i/51+'">'+card(null)+'</div>').join('')+'</div><div class="draw-choices">'+round.cards.map((p,i)=>'<div class="draw-choice '+(round.leaders.includes(p.id)?'draw-leader':'')+'" style="--target:'+(i+.5)/round.cards.length+';--origin:'+picks[i]/51+'"><div class="draw-flight"><div class="draw-flip"><div class="draw-back" aria-hidden="true">'+card(null)+'</div><div class="draw-face" aria-hidden="true">'+card(p.card)+'</div></div></div><span class="draw-name">'+esc(state.members.find(m=>m.id===p.id)?.name||'玩家')+'</span></div>').join('')+'</div></div><div class="draw-outcome" role="status" aria-live="polite"></div>';
  panel.dataset.drawKey=key;
 }
 dealerDrawClock();
}
function dealerDrawClock(){
 const d=state?.dealerDraw,panel=$('#dealerDrawPanel');if(!d?.active||d.cancelled||panel.hidden)return;
 const round=d.rounds.at(-1),elapsed=Date.now()+offset-(round.startedAt||d.nextAt-6500),stage=elapsed<1300?'spread':elapsed<3100?'pick':elapsed<3800?'flip':'result';
 panel.dataset.stage=stage;
 const name=id=>state.members.find(m=>m.id===id)?.name||'玩家';
 let text='';if(stage==='result')text=d.winner?name(d.winner)+' · 庄':'同点重抽';
 if(Date.now()+offset>=d.nextAt&&state.members.some(m=>!m.ready||!m.online))text='等待玩家回到牌桌';
 const status=panel.querySelector('.draw-outcome');if(status&&status.textContent!==text)status.textContent=text;
}
