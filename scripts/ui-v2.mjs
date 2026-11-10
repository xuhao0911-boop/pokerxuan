import fs from 'node:fs/promises';
let h=await fs.readFile('public/index.html','utf8');
h=h.replace('<link rel="stylesheet" href="/table.css">','<link rel="stylesheet" href="/table.css"><link rel="stylesheet" href="/clear.css">').replace('<title>PokerXuan · 和朋友，打下一手</title>','<title>PokerXuan</title>');
h=h.replace('<button id="help" class="icon-button" aria-label="玩法与规则">?</button>','<button id="unitToggle" class="unit-toggle" aria-label="切换 BB 或实际筹码" aria-pressed="true">BB <span>⇄</span></button>');
h=h.replace('<div id="players"></div>','<div id="players"></div><div id="tableBets" class="table-bets"></div>').replace('<span id="phase" class="phase">等待发牌</span>','<span id="phase" class="phase">等待发牌</span><div id="lastAction" class="last-action" hidden></div>');
h=h.replace('<button id="timeCard" hidden>⏱ +20s · <span>5</span></button><span id="timer"></span>','<button id="timeCard" class="time-card" hidden aria-label="使用时间卡延长20秒"><span class="time-card-icon">＋</span><span class="time-card-label">20<small>s</small></span><span id="timeCount" class="time-count">5</span></button><span id="timer" class="timer-ring" role="timer" aria-label="剩余行动时间"><span id="timerValue">20</span><small>s</small></span>');
h=h.replace('<input id="betValue" type="number" inputmode="numeric" aria-label="加注至" value="200">','<input id="betValue" type="number" inputmode="decimal" aria-label="加注至" value="2"><small id="betUnit">BB</small>');
h=h.replace('<p class="form-note" id="formNote">朋友无需注册，用邀请链接即可入座。</p>','<p class="form-note" id="formNote" hidden></p>').replace('<p id="readyHint"></p>','<p id="readyHint" hidden></p>');
h=h.replace('<span>1 BB = 100 筹码</span>','').replace('<p id="waitingText">复制邀请链接，让下一手开始。</p>','<p id="waitingText" hidden></p>');
await fs.writeFile('public/index.html',h);
let a=await fs.readFile('public/app.js','utf8');
a=a.replace("const bb=n=>Number((Number(n||0)/100).toFixed(2)).toLocaleString('en-US')+' BB';",`let unit='bb',betChips=200;try{unit=localStorage.getItem('px-unit')||'bb';}catch{}
const bb=n=>unit==='bb'?Number((Number(n||0)/100).toFixed(2)).toLocaleString('en-US')+' BB':fmt(n);
const logUnits=t=>String(t).replace(/(盲注 )(\\d+)\\/(\\d+)/g,(_,p,a,b)=>p+bb(a)+' / '+bb(b)).replace(/((?:跟注|加注至|加注|全下|补充) )([\\d,]+)/g,(_,p,n)=>p+bb(+n.replaceAll(',',''))).replace(/\\+([\\d,]+)/g,(_,n)=>'+'+bb(+n.replaceAll(',','')));
`);
a=a.replace("<div class=\"card ${c.s%2?'red':''}\">",'<div class="card suit-${c.s}">');
a=a.replace("esc(status)","esc(logUnits(status))").replace("${playing&&p.street?' <b>· '+bb(p.street)+'</b>':''}",'');
a=a.replace("$('#roomInfo').textContent=r.stackBB+' BB · 盲注 50 / 100'","$('#roomInfo').textContent=(unit==='bb'?r.stackBB+' BB':fmt(r.stackBB*100))+' · '+bb(50)+' / '+bb(100)");
a=a.replace("$('#result').textContent=g.result","$('#result').textContent=logUnits(g.result)");
a=a.replace("$('#timeCard span').textContent=me?.timeCards??5;","$('#timeCount').textContent=me?.timeCards??5;");
a=a.replace("$('#betSlider').min=$('#betValue').min=min;$('#betSlider').max=$('#betValue').max=max;if(lastTurn!==r.turnSeq){setBet(min);lastTurn=r.turnSeq;}","$('#betSlider').min=min;$('#betSlider').max=max;$('#betValue').min=unit==='bb'?min/100:min;$('#betValue').max=unit==='bb'?max/100:max;$('#betValue').step=unit==='bb'?'0.01':'1';if(lastTurn!==r.turnSeq){setBet(min);lastTurn=r.turnSeq;}");
a=a.replace('} clock();}','} drawBets();clock();}');
a=a.replace("$('#betValue').value=$('#betSlider').value=n;","betChips=n;$('#betSlider').value=n;$('#betValue').value=unit==='bb'?+(n/100).toFixed(2):n;");
a=a.replace("$('#betValue').onchange=e=>setBet(+e.target.value)","$('#betValue').onchange=e=>setBet(Math.round(+e.target.value*(unit==='bb'?100:1)))");
a=a.replace("amount:+$('#betValue').value","amount:Math.round(+$('#betValue').value*(unit==='bb'?100:1))");
a=a.replace("$('#timer').textContent='';return;","$('#timer').hidden=true;return;").replace("$('#timer').textContent=sec+'s';","$('#timer').hidden=false;$('#timerValue').textContent=sec;$('#timer').style.setProperty('--progress',Math.min(100,sec/20*100)+'%');$('#timer').setAttribute('aria-label','剩余 '+sec+' 秒');");
a=a.replace("esc(s)+'</p>'","esc(logUnits(s))+'</p>'");
a=a.replace(/\$\('#help'\)\.onclick=[\s\S]*?;\nasync function boot/, 'async function boot');
a=a.replace("const scenes=[[", "const scenes=[['studio','简洁牌桌'],[");
a=a.replace("id='sunset'","id='studio'").replace("try{setScene(localStorage.getItem('px-scene')||'sunset');}catch{setScene('sunset');}","try{if(!localStorage.getItem('px-clear-design')){setScene('studio');localStorage.setItem('px-clear-design','1');}else setScene(localStorage.getItem('px-scene')||'studio');}catch{setScene('studio');}");
a=a.replace("'<img src=", "'<img src=");
a=a.replace("<img src=\"/scene-'+id+'.jpg\" alt=\"'+name+'\">","'+(id==='studio'?'<div class=\"studio-thumb\"></div>':'<img src=\"/scene-'+id+'.jpg\" alt=\"'+name+'\">')+'");
a+=`\nfunction drawBets(){const g=state?.game;if(!g){$('#tableBets').innerHTML='';return;}let html=g.players.map((p,i)=>{let previous=g.previousBets?.hand===g.hand&&g.previousBets?.items?.find(b=>b.id===p.id)?.amount;let n=p.street||previous||0;if(!n||g.phase==='done')return '';let old=!p.street,stacks=Math.min(3,Math.max(1,Math.ceil(n/300)));return '<div class="wager wager-'+posFor(i,g.players.length,g.youIndex)+(old?' previous':'')+'"><div class="chip-stacks">'+Array.from({length:stacks},(_,s)=>'<span class="chip-stack stack-'+s+'">'+Array.from({length:Math.min(5,Math.max(2,Math.ceil(n/100/stacks)))},(_,j)=>'<i style="--level:'+j+'"></i>').join('')+'</span>').join('')+'</div><span class="wager-value">'+(old?'<small>上轮</small>':'')+bb(n)+'</span></div>';}).join('');if($('#tableBets').innerHTML!==html)$('#tableBets').innerHTML=html;const x=g.lastAction;$('#lastAction').hidden=!x||g.phase==='done';if(x)$('#lastAction').textContent=x.name+' · '+({raise:'加注至 '+bb(x.amount),call:'跟注 '+bb(x.paid),fold:'弃牌',check:'过牌'})[x.type];}
function unitUI(){const b=$('#unitToggle');b.innerHTML=(unit==='bb'?'BB':'筹码')+' <span>⇄</span>';b.setAttribute('aria-pressed',unit==='bb'?'true':'false');$('#betUnit').textContent=unit==='bb'?'BB':'筹码';$('#setupSummary').textContent=unit==='bb'?stackBB+' BB · '+bb(50)+' / '+bb(100):fmt(stackBB*100)+' · 50 / 100';}
$('#unitToggle').onclick=()=>{unit=unit==='bb'?'chips':'bb';try{localStorage.setItem('px-unit',unit);}catch{}unitUI();if(state){render();setBet(betChips);}};unitUI();
`;
await fs.writeFile('public/app.js',a);
