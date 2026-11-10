import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/dealer-draw.js',import.meta.url),'utf8');
const draw=()=>({active:true,cancelled:false,rounds:[{number:1,startedAt:100000,cards:[{id:'a',card:{r:14,s:0},pick:8},{id:'b',card:{r:2,s:1},pick:41}],leaders:['a'],winner:'a'}],winner:'a',nextAt:106500});
function ui(dealerDraw=draw(),now=100000){
 const outcome={textContent:''},properties={},panel={hidden:true,dataset:{},innerHTML:'',style:{setProperty:(k,v)=>properties[k]=v},querySelector:()=>outcome,replaceChildren(){this.innerHTML='';outcome.textContent='';}};
 let time=now;
 const context=vm.createContext({state:{id:'room-a',members:[{id:'a',name:'甲',ready:true,online:true},{id:'b',name:'乙',ready:true,online:true}],dealerDraw},$:()=>panel,esc:s=>String(s).replaceAll('<','&lt;'),card:c=>c?'<i>face</i>':'<i>back</i>',offset:0,Date:{now:()=>time}});
 vm.runInContext(source,context);
 const render=()=>vm.runInContext('dealerDrawUI()',context),clock=n=>{time=n;vm.runInContext('dealerDrawClock()',context);};
 return {context,panel,outcome,properties,render,clock};
}

test('row spreads, picks and flips before showing the winner; polling preserves the animation',()=>{
 const u=ui();u.render();assert.equal(u.panel.hidden,false);assert.equal((u.panel.innerHTML.match(/class="draw-rail-card/g)||[]).length,52);
 assert.equal(u.panel.dataset.stage,'spread');assert.equal(u.outcome.textContent,'');assert.equal(u.properties['--draw-delay'],'0ms');
 const markup=u.panel.innerHTML;
 u.clock(102000);u.render();assert.equal(u.panel.dataset.stage,'pick');assert.equal(u.outcome.textContent,'');assert.equal(u.panel.innerHTML,markup);assert.equal(u.properties['--draw-delay'],'0ms');
 u.clock(103200);assert.equal(u.panel.dataset.stage,'flip');assert.equal(u.outcome.textContent,'');
 u.clock(104000);assert.equal(u.panel.dataset.stage,'result');assert.equal(u.outcome.textContent,'甲 · 庄');
 u.context.state.dealerDraw.active=false;u.context.state.game={hand:1,phase:'preflop'};u.render();assert.equal(u.panel.hidden,true);assert.equal(u.panel.innerHTML,'');assert.equal(u.panel.dataset.drawKey,undefined);
 for(const hand of [1,2,3]){u.context.state.game.hand=hand;u.render();assert.equal(u.panel.hidden,true);assert.equal(u.panel.innerHTML,'');}
});

test('reconnect resumes the server timeline and refreshing an ended draw keeps all records absent',()=>{
 const u=ui(draw(),104500);u.render();assert.equal(u.properties['--draw-delay'],'-4500ms');assert.equal(u.panel.dataset.stage,'result');
 const d=draw();d.active=false;const ended=ui(d);ended.render();assert.equal(ended.panel.hidden,true);assert.equal(ended.panel.innerHTML,'');
});

test('missing and cancelled draws clear the stage and a new match starts a fresh animation',()=>{
 for(const d of [null,{...draw(),active:false,cancelled:true},{...draw(),cancelled:true}]){const u=ui(d);u.render();assert.equal(u.panel.hidden,true);assert.equal(u.panel.innerHTML,'');}
 const u=ui();u.render();u.context.state.dealerDraw.active=false;u.render();
 u.context.state.dealerDraw=draw();u.context.state.dealerDraw.rounds[0].startedAt=108000;u.context.state.dealerDraw.nextAt=114500;u.clock(108000);u.render();assert.equal(u.panel.hidden,false);assert.equal(u.panel.dataset.stage,'spread');assert.equal(u.outcome.textContent,'');
});

test('ties animate a fresh row, old cards disappear, and offline players wait without dealing',()=>{
 const d=draw();d.winner=null;d.rounds[0].winner=null;d.rounds[0].leaders=['a','b'];d.rounds[0].cards[1].card.r=14;
 const u=ui(d,104000);u.render();assert.equal(u.outcome.textContent,'同点重抽');
 d.rounds.push({...draw().rounds[0],number:2,startedAt:106500});d.nextAt=113000;d.winner='a';u.clock(106500);u.render();assert.equal(u.panel.dataset.stage,'spread');assert.equal(u.outcome.textContent,'');assert.equal(u.properties['--draw-delay'],'0ms');
 u.context.state.members[1].online=false;u.clock(113100);assert.equal(u.outcome.textContent,'等待玩家回到牌桌');assert.equal(u.panel.hidden,false);
 d.active=false;u.render();assert.equal(u.panel.hidden,true);
});

test('player names are escaped and older in-progress draws still display without visual pick metadata',()=>{
 const d=draw();delete d.rounds[0].startedAt;d.rounds[0].cards.forEach(p=>delete p.pick);
 const u=ui(d);u.context.state.members[0].name='<img src=x>';u.render();assert(!u.panel.innerHTML.includes('<img'));assert(u.panel.innerHTML.includes('&lt;img'));
});
