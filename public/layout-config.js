(function(root){
 'use strict';
 const key='px-layout-v2';
 const targets={
  board:{label:'公共牌',selector:'#board'},hand:{label:'我的手牌',selector:'#arena .player.mine .hole-cards'},
  hero:{label:'我的头像和名字',selector:'#arena .player.mine'},opponent:{label:'对手头像和名字',selector:'#arena .player:not(.mine)'},
  pot:{label:'底池',selector:'#arena .pot'},phase:{label:'翻牌阶段',selector:'#phase'},action:{label:'行动记录',selector:'#lastAction'},
  logo:{label:'PokerXuan 标志',selector:'.table-brand'},controls:{label:'操作按钮区',selector:'.action-dock'},
  tools:{label:'表情和时间卡',selector:'.under-table'},stats:{label:'数据面板',selector:'#statsPanel'},table:{label:'牌桌',selector:'.table-rim'}
 };
 const colors={background:'#f4f5f1',table:'#14634f',panel:'#192a23',text:'#f3f4ee',accent:'#bba77e',fold:'#2b68ac',call:'#25844f',raise:'#c74b3e'};
 const fonts={system:'"Segoe UI","Microsoft YaHei",sans-serif',hei:'"Microsoft YaHei",sans-serif',arial:'Arial,"Microsoft YaHei",sans-serif'};
 const builtins=()=>({version:1,font:'system',colors:{...colors},profiles:{desktop:{elements:{}},mobile:{elements:{}}}});
 const defaults=()=>normalize(root.POKER_LAYOUT_DEFAULTS);
 const num=(v,d,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(min,v)):d;
 function normalize(input){
  const c=builtins();if(!input||input.version!==1)return c;
  if(Object.hasOwn(fonts,input.font))c.font=input.font;
  for(const k of Object.keys(colors))if(/^#[a-f\d]{6}$/i.test(input.colors?.[k]||''))c.colors[k]=input.colors[k];
  for(const profile of ['desktop','mobile'])for(const k of Object.keys(targets)){
   const p=input.profiles?.[profile]?.elements?.[k];if(!p||typeof p!=='object')continue;
   c.profiles[profile].elements[k]={x:num(p.x,0,-100,100),y:num(p.y,0,-100,100),scale:num(p.scale,1,.35,2),fontSize:num(p.fontSize,0,0,42)};
  }return c;
 }
 function parse(text){if(typeof text!=='string'||text.length>65536)throw Error('配置文件过大');const c=JSON.parse(text);if(c?.version!==1)throw Error('不支持的配置版本');return normalize(c);}
 function load(){try{const c=parse(root.localStorage.getItem(key));
  // Previously saved, unedited defaults should follow the published design.
  const untouched=c.font==='system'&&Object.keys(colors).every(k=>c.colors[k]===colors[k])&&['desktop','mobile'].every(p=>Object.values(c.profiles[p].elements).every(v=>!v.x&&!v.y&&v.scale===1&&!v.fontSize));
  return untouched?defaults():c;
 }catch{return defaults();}}
 function save(c){const clean=normalize(c);root.localStorage.setItem(key,JSON.stringify(clean));return clean;}
 let current=defaults();
 function apply(input){
  current=normalize(input);if(!root.document)return current;
  const d=root.document;let s=d.getElementById('customLayout');if(!s){s=d.createElement('style');s.id='customLayout';d.head.append(s);}
  let css='';
  for(const profile of ['desktop','mobile']){
   css+='@media '+(profile==='desktop'?'(min-width: 1051px) and (min-height: 501px)':'(max-width: 1050px), (max-height: 500px)')+'{';
   for(const [k,p] of Object.entries(current.profiles[profile].elements)){
    css+=targets[k].selector+'{translate:calc(var(--layout-w,100vw) * '+p.x/100+') calc(var(--layout-h,100vh) * '+p.y/100+') !important;scale:'+p.scale+' !important;transform-origin:center;'+(p.fontSize?'font-size:'+p.fontSize+'px !important;':'')+'}';
    if(p.fontSize&&['hero','opponent'].includes(k))css+=targets[k].selector+' .player-name{font-size:'+p.fontSize+'px!important}';
    if(p.fontSize&&k==='pot')css+='#pot{font-size:'+p.fontSize+'px!important}';
    if(p.fontSize&&k==='controls')css+='.action-buttons button,.action-buttons button strong,.action-buttons button span{font-size:'+p.fontSize+'px!important}';
   }css+='}';
  }
  if(current.font!=='system')css+='body,button,input{font-family:'+fonts[current.font]+'!important}';
  const rules={background:v=>'body[data-scene="studio"]{background:'+v+'!important}',table:v=>'.felt{background:'+v+'!important}',panel:v=>'.player-info,.pot,.phase,.stats-panel,.presets,.raise-control,.last-action{background:'+v+'!important}',text:v=>'.player-name,.table-brand,.phase,.action-buttons button,.stats-panel{color:'+v+'!important}',accent:v=>'.table-rim,.player-info,.pot,.phase,.stats-panel{border-color:'+v+'!important}',fold:v=>'.action-buttons .fold{background:'+v+'!important}',call:v=>'.action-buttons .call{background:'+v+'!important}',raise:v=>'.action-buttons .raise{background:'+v+'!important}'};
  for(const k of Object.keys(colors))if(current.colors[k]!==colors[k])css+=rules[k](current.colors[k]);
  s.textContent=css;return current;
 }
 root.PokerLayout={key,targets,colors,fonts,defaults,normalize,parse,load,save,apply};
 if(root.document){
  const init=()=>{apply(load());const arena=root.document.getElementById('arena');if(arena)new ResizeObserver(()=>{root.document.documentElement.style.setProperty('--layout-w',arena.offsetWidth+'px');root.document.documentElement.style.setProperty('--layout-h',arena.offsetHeight+'px');}).observe(arena);};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init);else init();
  root.addEventListener('storage',e=>{if(e.key===key||e.key===null)apply(load());});
 }
})(globalThis);
