/* Static editor fixture. It never creates a room or sends gameplay requests. */
document.body.classList.add('layout-preview');
const demoMembers=[{id:'demo-me',name:'偷鸡大王',avatar:'fox',ready:true,online:true,timeCards:5},{id:'demo-friend',name:'小林',avatar:'cat',ready:true,online:true,timeCards:5}];
const demoStats={completed:5,started:6,players:demoMembers.map((m,i)=>({...m,hands:5,vpip:4,pfr:3,threeBet:1,threeBetOpp:3,flops:4,showdowns:2,showdownWins:1,postAgg:4,postCalls:2,wins:2,net:i?400:-400})),history:[]};
const demoRoom={id:'layout-preview',version:1,seats:2,stackBB:100,you:'demo-me',host:'demo-me',members:demoMembers,practice:true,serverNow:Date.now(),turnSeq:1,turnSeconds:30,deadline:Date.now()+26000,stats:demoStats,emotes:[],game:{hand:6,phase:'flop',board:[{r:4,s:2},{r:11,s:3},{r:4,s:3}],pot:800,bet:400,minRaise:800,canRaise:true,call:400,actor:0,youIndex:0,dealer:0,result:'',revealed:[],showRequests:[],players:demoMembers.map((m,i)=>({...m,stack:i?9500:9900,street:i?400:0,cards:i?null:[{r:6,s:3},{r:7,s:1}]})),lastAction:{id:'demo-friend',name:'小林',phase:'flop',type:'raise',amount:400}}};
request=async()=>({room:demoRoom,stats:demoStats});command=async()=>{};
apply(demoRoom);document.querySelector('#connection').textContent='布局预览';document.querySelector('#roomCode').textContent='示例牌桌 · 第 6 手';
setInterval(()=>{state.deadline=Date.now()+26000;},500);
