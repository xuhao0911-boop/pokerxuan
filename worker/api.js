import {Poker,labels} from './poker.js';
import {beginStats,actionStats,settleStats,revealStats,statsView} from './stats.js';
import {exportData} from './export.js';
import {openDealerDraw,repeatDealerDraw} from './dealer.js';
const DAY=86400000,TURN=30000;
export const EMOTES=['rose','money','egg','nuke','tomato'];
export const AVATARS=['panda','cat','fox','dog','rabbit','tiger','mooncat','naiwa','nailoong','meituan','doubao'];
function avatarOf(value){if(value===undefined)return 'panda';if(!AVATARS.includes(value))fail('请选择列表中的动物头像');return value;}
export const PHRASES=['这你也能fold啊','先call住再想办法','你来咯你来咯','下把等着','瓜爷来全杀了','怎么有小黑子啊','这一枪call住还有两枪','这你也能call啊','不好意思我是nuts'];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const uid=()=>crypto.randomUUID().replaceAll('-','');
async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function pack(g){if(!g)return null;return {...g,acted:[...g.acted||[]],pending:[...g.pending||[]]};}
function unpack(g){if(!g)return null;const p=Object.assign(new Poker(g.players.length),g);p.acted=new Set(g.acted);p.pending=new Set(g.pending);return p;}
function nameOf(n){if(typeof n!=='string'||!n.trim()||[...n.trim()].length>12)fail('请输入 1–12 字的昵称');return n.trim();}
function member(r,key){const m=r.members.find(m=>m.key===key&&!m.left);if(!m)fail('请重新通过邀请链接加入房间',401);return m;}
function stamp(r,g,now){r.game=pack(g);r.turnSeq++;r.deadline=now+TURN;r.botAt=now+850;r.updated=now;r.matchOver=g.phase==='done'&&r.seats===2&&g.players.some(p=>p.stack===0);if(g.phase==='done'&&r.settledHand!==g.hand){r.settledHand=g.hand;r.nextHandAt=now+(g.alive.length>1?8000:3000);settleStats(r,g,now);r.revealed=[];r.showRequests=[];}}
function beforeAction(g){return {phase:g.phase,actor:g.actor,bet:g.bet,minRaise:g.minRaise,pot:g.pot,board:g.board.map(c=>({...c})),canRaise:!!g.canRaise,players:g.players.map(p=>({street:p.street,total:p.total,stack:p.stack,folded:p.folded}))};}
function remember(r,g,before,now,source='player'){const i=before.actor,p=g.players[i],paid=p.total-before.players[i].total,to=before.players[i].street+paid;const type=p.folded?'fold':to>before.bet?'raise':paid?'call':'check';r.lastAction={eventId:uid(),id:r.order[i],name:p.name,phase:before.phase,type,sound:paid>0&&paid>=before.players[i].stack?'allin':type==='raise'&&before.bet===0?'bet':type,amount:to,paid,at:now,source};actionStats(r,g,before,r.lastAction);if(before.phase!==g.phase){r.previousBets={phase:before.phase,hand:g.hand,items:before.players.map((p,j)=>({id:r.order[j],amount:p.street+(j===i?paid:0)}))};}}
function tick(r,now){if(r.dealerDraw?.active)return tickDealerDraw(r,now);let g=unpack(r.game);if(!g)return false;if(g.phase==='done'){const waitUntil=Math.max(r.nextHandAt||0,...(r.showRequests||[]).filter(q=>q.status==='pending'&&q.expiresAt>now).map(q=>q.expiresAt));const seated=r.members.filter(p=>!p.left);if(now<waitUntil||r.matchOver||seated.length<2||seated.length!==r.order.length||!r.order.every(id=>seated.some(p=>p.id===id))||seated.some(p=>!p.ready||!p.bot&&now-p.seen>=30000))return false;start(r,r.members.find(p=>p.id===r.host),now);return true;}let who=r.members.find(m=>m.id===r.order[g.actor]);let due=who.bot?now>=r.botAt:who.left||now>=r.deadline;if(!due)return false;const before=beforeAction(g);if(who.bot&&!who.left)g.bot();else {g.log(who.name+' · '+(who.left?'已离桌':'行动超时'));g.act(g.bet===g.players[g.actor].street?'call':'fold');}remember(r,g,before,now,who.left?'leave':who.bot?'bot':'timeout');stamp(r,g,now);return true;}
export function view(r,m,now=Date.now()){
 const g=unpack(r.game),my=g?r.order.indexOf(m.id):-1,done=g?.phase==='done';
 const showdown=done&&g.alive.length>1,revealed=r.revealed||[],requests=(r.showRequests||[]).map(q=>({...q,status:q.status==='pending'&&q.expiresAt<=now?'expired':q.status}));
 const nextHandAt=Math.max(r.nextHandAt||0,...requests.filter(q=>q.status==='pending').map(q=>q.expiresAt));
 return {id:r.id,mode:r.seats===2?'heads-up':'six-max',seats:r.seats,stackBB:r.stackBB,host:r.host,you:m.id,version:r.version,turnSeq:r.turnSeq,deadline:r.deadline,turnSeconds:TURN/1000,serverNow:now,matchOver:!!r.matchOver,practice:r.practice,dealerDraw:r.dealerDraw?{active:r.dealerDraw.active,cancelled:!!r.dealerDraw.cancelled,rounds:r.dealerDraw.rounds,winner:r.dealerDraw.winner,nextAt:r.dealerDraw.nextAt}:null,stats:statsView(r,m),emotes:(r.emotes||[]).filter(e=>now-e.at<6000),
 members:r.members.filter(m=>!m.left||g&&!done).map(p=>({id:p.id,name:p.name,avatar:p.avatar||'panda',ready:p.ready,bot:p.bot,left:!!p.left,timeCards:p.timeCards??5,speech:p.speech&&now-p.speech.at<6500?p.speech:null,online:p.bot||now-p.seen<30000})),
 game:g?{phase:g.phase,hand:g.hand,dealer:g.dealer,actor:g.actor,board:g.board,pot:done?g.paidPot:g.pot,result:g.result,history:g.history.slice(0,35),bb:g.bb,bet:g.bet,showdown:!!showdown,nextHandAt,revealed,showRequests:requests.filter(q=>q.from===m.id||q.to===m.id),lastAction:r.lastAction||null,previousBets:r.previousBets||null,players:g.players.map((p,i)=>({id:r.order[i],name:p.name,stack:p.stack,total:p.total,street:p.street,folded:p.folded,status:p.status,won:p.won,cards:i===my||showdown&&!p.folded||done&&revealed.includes(r.order[i])?p.cards:null,handName:(showdown&&!p.folded||done&&revealed.includes(r.order[i]))&&p.score?labels[p.score[0]]:null})),youIndex:my,call:my===g.actor?g.call:0,minRaise:g.minRaise,canRaise:my===g.actor&&g.canRaise}:null};
}
async function getRow(db,id){const row=await db.prepare('SELECT state, version, expires_at FROM poker_rooms WHERE id = ?').bind(id).first();if(!row||row.expires_at<Date.now())fail('房间不存在或已过期，请重新创建',404);let r=JSON.parse(row.state);r.version=row.version;return r;}
async function change(db,id,fn){for(let n=0;n<10;n++){const r=await getRow(db,id),before=r.version;const result=await fn(r);if(result?.noWrite)return result.value;r.version=before+1;const now=Date.now();const out=await db.prepare('UPDATE poker_rooms SET state = ?, version = ?, updated_at = ?, expires_at = ? WHERE id = ? AND version = ?').bind(JSON.stringify(r),r.version,now,now+DAY,id,before).run();if(out.meta.changes===1)return typeof result==='function'?result(r):result;}fail('牌局刚刚更新，请重试',409);}
async function body(req){let text=await req.text();if(text.length>4096)fail('请求过大',413);try{return JSON.parse(text||'{}');}catch{fail('请求格式错误');}}
async function api(request,env){if(!env.DB)fail('房间服务正在配置，请稍后重试',503);const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/rooms'&&request.method==='POST'){
  const b=await body(request),name=nameOf(b.name);if(![2,6].includes(b.seats)||![50,100,200].includes(b.stackBB))fail('请选择有效的模式和筹码深度');
  const now=Date.now(),token=uid()+uid(),id=uid().slice(0,16),host={id:uid(),key:await hash(token),name,avatar:avatarOf(b.avatar),ready:true,seen:now,bot:false,timeCards:5};
  const r={id,seats:b.seats,stackBB:b.stackBB,host:host.id,members:[host],game:null,order:[],turnSeq:0,version:0,updated:now,practice:!!b.practice,requests:[]};
  if(r.practice){for(let i=1;i<r.seats;i++)r.members.push({id:uid(),key:'',name:['','小林','Alex','Sofia','Maverick','James'][i],avatar:['panda','cat','fox','dog','mooncat','naiwa'][i],ready:true,seen:now,bot:true});start(r,host,now);}
  await db.prepare('INSERT INTO poker_rooms (id,state,version,updated_at,expires_at) VALUES (?,?,0,?,?)').bind(id,JSON.stringify(r),now,now+DAY).run();return {token,room:view(r,host,now)};
 }
 const match=path.match(/^\/api\/rooms\/([a-f0-9]{16})(?:\/(join|ready|start|next-hand|action|leave|time|speech|emote|stats|export|reveal|request-show|respond-show))?$/);if(!match)fail('接口不存在',404);const [,id,op]=match;
 if(op==='join'&&request.method==='POST'){
  const b=await body(request),name=nameOf(b.name),avatar=avatarOf(b.avatar),token=uid()+uid(),key=await hash(token);return change(db,id,r=>{if(r.practice)fail('人机对战不能邀请，请创建好友房');if(r.dealerDraw?.active)fail('正在抽牌定庄，请等本手结束再加入',409);if(r.game&&r.game.phase!=='done')fail('这手牌进行中，请等本手结束再加入');r.members=r.members.filter(p=>!p.left);if(r.members.length>=r.seats)fail('房间已满');const m={id:uid(),key,name,avatar,ready:false,seen:Date.now(),bot:false,timeCards:5};r.members.push(m);return r=>({token,room:view(r,m)});});
 }
 const token=request.headers.get('X-Player-Token');if(!token||token.length>150)fail('请先加入房间',401);const key=await hash(token);
 if(op==='export'&&request.method==='GET'){const r=await getRow(db,id),m=member(r,key);return {export:exportData(r,m)};}
 if(op==='stats'&&request.method==='GET'){const r=await getRow(db,id),m=member(r,key);return {stats:statsView(r,m,true)};}
 if(!op&&request.method==='GET')return change(db,id,r=>{let m=member(r,key),now=Date.now(),changed=false;if(now-m.seen>10000){m.seen=now;changed=true;}changed=tick(r,now)||changed;if(!changed)return {noWrite:true,value:{room:view(r,m,now)}};return r=>({room:view(r,m,now)});});
 if(request.method!=='POST')fail('请求方法不支持',405);const b=await body(request);if(typeof b.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(b.requestId))fail('缺少操作编号');
 return change(db,id,r=>{let m=member(r,key),now=Date.now();if(r.requests.includes(m.id+':'+b.requestId))return {noWrite:true,value:{room:view(r,m)}};m.seen=now;
  if(['reveal','request-show','respond-show'].includes(op)){
   const g=unpack(r.game);if(!g||g.phase!=='done'||!r.order.includes(m.id))fail('本手结束后才能亮牌',409);if(b.hand!==g.hand)fail('请求对应的手牌已经结束',409);if(g.alive.length>1)fail('本手已按 Showdown 规则摊牌');r.revealed??=[];r.showRequests??=[];
   if(op==='reveal'){if(!r.revealed.includes(m.id)){r.revealed.push(m.id);revealStats(r,m.id);r.nextHandAt=Math.max(r.nextHandAt||0,now+8000);}}
   else if(op==='request-show'){const target=r.members.find(p=>p.id===b.target&&!p.left);if(!target||target.id===m.id||!r.order.includes(target.id))fail('请选择本手的其他玩家');if(r.revealed.includes(target.id))fail('对方已经亮牌');if(r.showRequests.some(q=>q.from===m.id))fail('本手已经请求过摊牌');if(r.showRequests.some(q=>q.to===target.id&&q.status==='pending'&&q.expiresAt>now))fail('对方正在处理另一个请求');let status=target.bot?'accepted':'pending';r.showRequests.push({id:uid(),from:m.id,to:target.id,status,expiresAt:now+5000});if(target.bot&&!r.revealed.includes(target.id)){r.revealed.push(target.id);revealStats(r,target.id);r.nextHandAt=Math.max(r.nextHandAt||0,now+8000);}}
   else {const q=r.showRequests.find(q=>q.id===b.showRequestId);if(!q||q.to!==m.id)fail('你不能替对方决定是否亮牌',403);if(q.status!=='pending'||now>=q.expiresAt)fail('该请求已经结束',409);if(typeof b.accept!=='boolean')fail('请选择同意或拒绝');q.status=b.accept?'accepted':'declined';if(b.accept&&!r.revealed.includes(m.id)){r.revealed.push(m.id);revealStats(r,m.id);r.nextHandAt=Math.max(r.nextHandAt||0,now+8000);}}
  }else if(op==='emote'){if(!EMOTES.includes(b.type))fail('请选择列表中的表情');const target=r.members.find(p=>p.id===b.target&&!p.left&&p.id!==m.id);if(!target)fail('请选择在桌上的其他玩家');if(m.emoteAt&&now-m.emoteAt<1800)fail('稍等一下再送');m.emoteAt=now;r.emotes=(r.emotes||[]).filter(e=>now-e.at<6000);r.emotes.push({id:uid(),from:m.id,to:target.id,type:b.type,at:now});r.emotes=r.emotes.slice(-30);}else if(op==='time'){if(!r.game||r.game.phase==='done'||r.order[r.game.actor]!==m.id||b.turnSeq!==r.turnSeq)fail('只有在你的行动回合可以使用时间卡',409);if(now>=r.deadline)fail('本次行动时间已结束',409);if(!m.timeCards)fail('时间卡已用完');m.timeCards--;r.deadline+=20000;}else if(op==='speech'){if(!PHRASES.includes(b.text))fail('请选择快捷语句');if(m.speech&&now-m.speech.at<2500)fail('稍等一下再说');m.speech={text:b.text,at:now};}else if(op==='ready'){if(r.dealerDraw?.active)fail('正在抽牌定庄',409);if(r.game&&r.game.phase!=='done')fail('牌局进行中');m.ready=b.ready===true;}
  else if(op==='next-hand'){
   if(r.game?.phase!=='done'||b.hand!==r.game.hand)fail('这手牌已经更新，请刷新牌桌',409);
   if(!(r.revealed||[]).includes(m.id))fail('亮出自己的底牌后才能提前进入下一手',403);
   if(r.matchOver)fail('本场已结束，请由房主开始新一场',409);
   if((r.showRequests||[]).some(q=>q.status==='pending'&&q.expiresAt>now))fail('请等待摊牌请求处理完毕',409);
   r.nextHandAt=0;start(r,r.members.find(p=>p.id===r.host),now);
  }
  else if(op==='start')start(r,m,now);
  else if(op==='action'){
   let g=unpack(r.game);if(!g||g.phase==='done')fail('这手牌已结束',409);if(r.turnSeq!==b.turnSeq)fail('牌局已更新，请重新行动',409);if(r.order[g.actor]!==m.id)fail('还没轮到你',409);
   if(now>=r.deadline){tick(r,now);return r=>({room:view(r,m),notice:'行动已超时，系统已自动处理'});}
   if(!['fold','call','raise'].includes(b.type)||b.type==='raise'&&(!Number.isInteger(b.amount)||b.amount<0))fail('无效的下注');
   const before=beforeAction(g);if(!g.act(b.type,b.amount))fail('加注金额不符合规则');remember(r,g,before,now);stamp(r,g,now);
  }else if(op==='leave'){m.left=true;m.ready=false;const rest=r.members.filter(p=>!p.left&&!p.bot);if(r.host===m.id&&rest.length)r.host=rest[0].id;tick(r,now);}
  else fail('接口不存在',404);
  r.requests.push(m.id+':'+b.requestId);r.requests=r.requests.slice(-60);return r=>({room:op==='leave'?null:view(r,m)});
 });
}
function start(r,m,now){if(m.id!==r.host)fail('只有房主可以开始',403);if(r.dealerDraw?.active)fail('正在抽牌定庄',409);if(r.game&&r.game.phase!=='done')fail('当前这手还没结束',409);if(r.game?.phase==='done'&&Math.max(r.nextHandAt||0,...(r.showRequests||[]).filter(q=>q.status==='pending'&&q.expiresAt>now).map(q=>q.expiresAt))>now)fail('亮牌阶段尚未结束',409);r.members=r.members.filter(m=>!m.left);if(r.members.length<2)fail('至少需要两位玩家入座');if(r.members.some(p=>!p.ready))fail('等待所有玩家准备');if(r.members.some(p=>!p.bot&&now-p.seen>30000))fail('有玩家暂时离线，请等朋友回来');
 let old=unpack(r.game),g;if(old&&r.order.length===r.members.length&&r.order.every(id=>r.members.some(m=>m.id===id))&&!r.matchOver)g=old;else {r.members.forEach(p=>p.timeCards=5);r.order=r.members.map(m=>m.id);r.game=null;r.matchOver=false;r.dealerDraw=openDealerDraw(r.order,now);r.turnSeq++;r.deadline=0;r.lastAction=null;r.previousBets=null;r.revealed=[];r.showRequests=[];r.nextHandAt=0;r.settledHand=null;return;}
 beginHand(r,g,now);
}
function beginHand(r,g,now){g.start();beginStats(r,g,now);r.lastAction=null;r.previousBets=null;r.revealed=[];r.showRequests=[];r.nextHandAt=0;r.settledHand=null;stamp(r,g,now);
}
function tickDealerDraw(r,now){
 const draw=r.dealerDraw,seated=r.members.filter(m=>!m.left);
 // A changed roster cancels this draw rather than awarding a departed player's button.
 if(seated.length!==r.order.length||!r.order.every(id=>seated.some(m=>m.id===id))){
  draw.active=false;draw.cancelled=true;r.members=seated;r.order=[];r.turnSeq++;return true;
 }
 if(now<draw.nextAt)return false;
 if(draw.winner===null){repeatDealerDraw(draw,now);r.turnSeq++;return true;}
 // Keep the result visible while an offline participant reconnects.
 if(seated.some(m=>!m.ready||!m.bot&&now-m.seen>=30000))return false;
 const g=new Poker(r.order.length);g.buyIn=r.stackBB*100;
 g.players.forEach((p,i)=>{p.stack=g.buyIn;p.name=seated.find(m=>m.id===r.order[i]).name;});
 g.dealer=(r.order.indexOf(draw.winner)+r.order.length-1)%r.order.length;
 draw.active=false;beginHand(r,g,now);return true;
}
export async function route(request,env,assets={}){
 const url=new URL(request.url);try{
  if(url.pathname.startsWith('/api/'))return Response.json(await api(request,env),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});let path=url.pathname==='/'?'/index.html':url.pathname;if(!Object.hasOwn(assets,path))return new Response('Not found',{status:404});let type=path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.webmanifest')?'application/manifest+json':'text/html';
  const asset=assets[path];if(asset&&typeof asset==='object'&&asset.base64)return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'public, max-age=86400'}});
  // Sites adds a per-response inline iframe bridge after Worker rendering.
  return new Response(request.method==='HEAD'?null:asset,{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'self'"}});
 }catch(e){if(!e.status)console.error('PokerXuan service error',e.message);return Response.json({error:e.status?e.message:'服务暂时不可用，请稍后重试'},{status:e.status||503,headers:{'Cache-Control':'no-store'}});}
}
