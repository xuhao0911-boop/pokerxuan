const GIFTS={rose:['🌹','玫瑰花','💕'],money:['💸','送钱','💵'],egg:['🥚','鸡蛋','🍳'],nuke:['🚀','核弹','💥'],tomato:['🍅','番茄','🍅']};
let statsTab='overview',statsPlayer=null,statsHistory=[],statsHistoryCount=-1,statsRoom=null,statsFetching=false,statsSignature='',statsHistoryStamp='',giftRoom=null;
const seenGifts=new Set();
let dataLayoutRoom=null;const desktopStats=matchMedia('(min-width:1051px)');desktopStats.addEventListener('change',e=>{if(state)e.matches?openDataPanel():closeDataPanel();});

function positionClock(){
 const player=$('.player.active'),arena=$('#arena'),timer=$('#timer');if(!player||!arena||timer.hidden)return;
 const a=arena.getBoundingClientRect(),p=player.getBoundingClientRect(),size=timer.getBoundingClientRect();
 let x=p.right-a.left+9;if(x+size.width>a.width-4)x=p.left-a.left-size.width-9;
 x=Math.max(4,Math.min(a.width-size.width-4,x));const y=Math.max(0,Math.min(a.height-size.height,p.top-a.top+(p.height-size.height)/2));
 timer.style.setProperty('--clock-left',x+'px');timer.style.setProperty('--clock-top',y+'px');
}
window.addEventListener('resize',positionClock);

function openDataPanel(tab='overview'){
 statsTab=tab;$('#statsPanel').hidden=false;$('.play-layout').classList.add('with-stats');$('#historyBtn').setAttribute('aria-expanded','true');if(matchMedia('(max-width:680px)').matches){$('#statsPanel').setAttribute('role','dialog');$('#statsPanel').setAttribute('aria-modal','true');$('#closeStats').focus({preventScroll:true});}else{$('#statsPanel').removeAttribute('role');$('#statsPanel').removeAttribute('aria-modal');}statsSignature='';renderDataPanel();loadStatsHistory();positionClock();
}
function closeDataPanel(){ const wasModal=$('#statsPanel').getAttribute('aria-modal')==='true';$('#statsPanel').hidden=true;$('#statsPanel').removeAttribute('role');$('#statsPanel').removeAttribute('aria-modal');$('.play-layout').classList.remove('with-stats');$('#historyBtn').setAttribute('aria-expanded','false');if(wasModal)$('#historyBtn').focus({preventScroll:true});positionClock(); }
$('#historyBtn').onclick=()=>$('#statsPanel').hidden?openDataPanel():closeDataPanel();$('#historyBtn').setAttribute('aria-controls','statsPanel');$('#closeStats').onclick=closeDataPanel;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#dialog').open)closeDataPanel();if(e.key==='Tab'&&!$('#statsPanel').hidden&&$('#statsPanel').getAttribute('aria-modal')==='true'){const nodes=$$('#statsPanel button:not([disabled]),#statsPanel input,#statsPanel select,#statsPanel summary'),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!$('#statsPanel').contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!$('#statsPanel').contains(document.activeElement))){e.preventDefault();first?.focus();}}});
$$('[data-stats-tab]').forEach(b=>b.onclick=()=>{statsTab=b.dataset.statsTab;statsSignature='';renderDataPanel();if(statsTab==='history')loadStatsHistory();});
async function loadStatsHistory(){
 if(!state||statsFetching||$('#statsPanel').hidden)return;const id=roomId,stamp=(state?.stats?.completed||0)+':'+(state?.game?.revealed||[]).join(',');statsFetching=true;
 try{const data=await request('rooms/'+id+'/stats');if(roomId!==id)return;statsHistory=data.stats.history||[];statsHistoryCount=data.stats.completed;statsHistoryStamp=stamp;statsSignature='';renderDataPanel();}
 catch(e){if(roomId===id)$('#statsBody').textContent='数据读取失败，切换标签重试。';}finally{statsFetching=false;}
}
function metric(label,n,d,description){return '<div class="metric" title="'+esc(description)+'"><span>'+label+'</span><strong>'+(d?Math.round(n/d*100)+'<small>%</small>':'—')+'</strong><small>'+n+' / '+d+'</small></div>';}
function renderDataPanel(){
 if($('#statsPanel').hidden||!state)return;
 if(statsRoom!==roomId){statsRoom=roomId;statsPlayer=state.you;statsHistory=[];statsHistoryCount=-1;statsSignature='';}
 const s=state.stats||{completed:0,players:[],started:0},signature=JSON.stringify([s,statsTab,statsPlayer,statsHistoryCount,unit,state.game?.hand]);if(statsSignature===signature)return;statsSignature=signature;
 $$('[data-stats-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.statsTab===statsTab));
 let html='<div class="stats-summary"><div><span>当前手牌</span><strong>第 '+(state.game?.hand||0)+' 手</strong></div><div><span>已统计</span><strong>'+s.completed+' 手</strong></div></div>';
 if(statsTab==='overview'){
  const players=s.players.length?s.players:state.members.map(m=>({...m,hands:0}));if(!players.some(p=>p.id===statsPlayer))statsPlayer=players[0]?.id;
  html+='<div class="stats-players">'+players.map(p=>'<button data-stats-player="'+p.id+'" class="'+(p.id===statsPlayer?'selected':'')+'">'+esc(p.name)+'</button>').join('')+'</div>';
  const p=players.find(p=>p.id===statsPlayer)||{},h=p.hands||0;
  html+='<div class="stats-profit"><span>净输赢</span><strong class="'+((p.net||0)>=0?'positive':'negative')+'">'+((p.net||0)>0?'+':'')+bb(p.net||0)+'</strong><small>'+h+' 手 · 净赢 '+(p.wins||0)+' 手</small></div><div class="metrics">';
  html+=metric('VPIP',p.vpip||0,h,'翻牌前自愿投入筹码的手数 / 已完成手数；盲注不计入');
  html+=metric('PFR',p.pfr||0,h,'翻牌前至少加注一次的手数 / 已完成手数');
  html+=metric('3-bet',p.threeBet||0,p.threeBetOpp||0,'面对一次翻牌前加注且允许再加注时，实际再加注的手数 / 机会手数');
  html+=metric('WTSD',p.showdowns||0,p.flops||0,'到达摊牌的手数 / 未弃牌进入翻牌的手数');
  html+=metric('W$SD',p.showdownWins||0,p.showdowns||0,'摊牌后分得底池的手数 / 摊牌手数，包含平分底池');
  html+='<div class="metric" title="翻牌后下注与加注次数 / 跟注次数"><span>AF</span><strong>'+(p.postCalls?((p.postAgg||0)/p.postCalls).toFixed(1):(p.postAgg?'∞':'—'))+'</strong><small>'+(p.postAgg||0)+' / '+(p.postCalls||0)+'</small></div></div><p class="stats-note">本房间累计 · 每手结算后更新<br>从新版开始记录，旧手牌不补算。</p>';
 }else{
  html+='<div class="hand-history">'+(statsHistory.length?statsHistory.map(h=>{
   const mine=h.players.find(p=>p.id===state.you),net=mine?.net||0;
   return '<details class="hand-entry" data-history-id="'+h.id+'"><summary><span>第 '+h.hand+' 手 <small>#'+h.id+'</small></span><b class="'+(net>=0?'positive':'negative')+'">'+(net>0?'+':'')+bb(net)+'</b></summary><div class="hand-body"><div class="history-board">'+h.board.map(c=>card(c)).join('')+'</div><p>'+esc(logUnits(h.result))+'</p>'+h.players.map(p=>'<div class="history-player"><span>'+esc(p.name)+'</span><div class="history-cards">'+(p.cards?p.cards.map(c=>card(c)).join(''):'<small>未亮牌</small>')+'</div><b class="'+(p.net>=0?'positive':'negative')+'">'+(p.net>0?'+':'')+bb(p.net)+'</b></div>').join('')+'<details class="hand-actions"><summary>行动记录</summary>'+h.actions.map(a=>'<p><small>'+({preflop:'翻牌前',flop:'翻牌',turn:'转牌',river:'河牌'})[a.phase]+'</small> '+esc(a.name)+' · '+esc(({fold:'弃牌',check:'过牌',call:'跟注 '+bb(a.paid),raise:'加注至 '+bb(a.amount)})[a.type])+'</p>').join('')+'</details></div></details>';
  }).join(''):'<p class="stats-empty">本手结束后，这里会留下记录。</p>')+'</div><p class="stats-note">已结束 '+s.completed+' 手 · 保留最近 100 手<br>未公开的对手底牌始终隐藏。</p>';
 }
 const openHands=$$('#statsBody .hand-entry[open]').map(e=>e.dataset.historyId),openActions=$$('#statsBody .hand-entry:has(.hand-actions[open])').map(e=>e.dataset.historyId);$('#statsBody').innerHTML=html;$$('#statsBody .hand-entry').forEach(e=>{if(openHands.includes(e.dataset.historyId))e.open=true;if(openActions.includes(e.dataset.historyId))e.querySelector('.hand-actions').open=true;});$$('[data-stats-player]').forEach(b=>b.onclick=()=>{statsPlayer=b.dataset.statsPlayer;statsSignature='';renderDataPanel();});
}

function showGiftPicker(target){
 if(!state)return;const others=state.members.filter(m=>m.id!==state.you&&!m.left);if(!others.length){toast('等朋友入座后再送表情');return;}
 let selected=others.find(m=>m.id===target)?.id||others[0].id;
 dialog('互动表情','<div class="gift-targets">'+others.map(m=>'<button data-gift-target="'+m.id+'" class="'+(m.id===selected?'selected':'')+'">'+esc(m.name)+'</button>').join('')+'</div><div class="gift-picker">'+Object.entries(GIFTS).map(([id,[icon,name]])=>'<button data-gift="'+id+'"><span>'+icon+'</span><strong>'+name+'</strong></button>').join('')+'</div>');
 $$('[data-gift-target]').forEach(b=>b.onclick=()=>{selected=b.dataset.giftTarget;$$('[data-gift-target]').forEach(q=>q.classList.toggle('selected',q===b));});
 $$('[data-gift]').forEach(b=>b.onclick=()=>{if(busy)return;$('#dialog').close();command('emote',{type:b.dataset.gift,target:selected});});
}
$('#giftBtn').onclick=()=>showGiftPicker();
$('#players').addEventListener('click',e=>{const avatar=e.target.closest('.avatar'),player=avatar?.closest('[data-player-id]');if(player&&player.dataset.playerId!==state?.you)showGiftPicker(player.dataset.playerId);});
function animateGift(event){
 const from=$('[data-player-id="'+event.from+'"] .avatar'),to=$('[data-player-id="'+event.to+'"] .avatar'),arena=$('#arena'),layer=$('#giftLayer');if(!from||!to)return;
 const box=arena.getBoundingClientRect(),a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),x=a.left+a.width/2-box.left,y=a.top+a.height/2-box.top,tx=b.left+b.width/2-box.left,ty=b.top+b.height/2-box.top;
 const gift=GIFTS[event.type];if(!gift)return;const flight=document.createElement('span');flight.className='gift-flight gift-'+event.type;flight.textContent=gift[0];flight.style.cssText='left:'+x+'px;top:'+y+'px;--dx:'+(tx-x)+'px;--dy:'+(ty-y)+'px';layer.append(flight);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 setTimeout(()=>{flight.remove();const impact=document.createElement('span');impact.className='gift-impact impact-'+event.type;impact.textContent=gift[2];impact.style.cssText='left:'+tx+'px;top:'+ty+'px';layer.append(impact);const p=to.closest('.player');p.classList.add('gift-hit');setTimeout(()=>{impact.remove();p.classList.remove('gift-hit');},1600);},reduced?80:850);
}
function extrasRender(){
 if(state&&dataLayoutRoom!==roomId){dataLayoutRoom=roomId;if(desktopStats.matches)openDataPanel();}
 if(giftRoom!==roomId){giftRoom=roomId;seenGifts.clear();$('#giftLayer').replaceChildren();}
 for(const e of state?.emotes||[]){if(!seenGifts.has(e.id)){seenGifts.add(e.id);if(Date.now()+offset-e.at<5500)animateGift(e);}}
 if(seenGifts.size>160){const ids=[...seenGifts];ids.slice(0,100).forEach(id=>seenGifts.delete(id));}
 renderDataPanel();if(!$('#statsPanel').hidden&&(statsHistoryCount!==(state?.stats?.completed||0)||statsHistoryStamp!==((state?.stats?.completed||0)+':'+(state?.game?.revealed||[]).join(','))))loadStatsHistory();
}
if(state){extrasRender();positionClock();}
