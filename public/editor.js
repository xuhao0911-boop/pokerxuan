'use strict';
const E=id=>document.getElementById(id),L=PokerLayout;
let draft=L.load(),profile='desktop',selected='hand',zoom=1,doc,drag=null,dirty=false;
const labels={background:'背景',table:'桌布',panel:'面板',text:'文字',accent:'边框',fold:'弃牌',call:'跟注',raise:'加注'};
E('element').innerHTML=Object.entries(L.targets).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('');
E('colors').innerHTML=Object.entries(labels).map(([k,v])=>'<label>'+v+'<input type="color" data-color="'+k+'" aria-label="'+v+'颜色"></label>').join('');
function status(text,error=false){E('status').textContent=text;E('status').classList.toggle('error',error);}
function settings(){return draft.profiles[profile].elements[selected]||{x:0,y:0,scale:1,fontSize:0};}
function fields(){const p=settings();E('element').value=selected;E('x').value=p.x;E('y').value=p.y;E('scale').value=Math.round(p.scale*100);E('scaleValue').value=Math.round(p.scale*100)+'%';E('fontSize').value=p.fontSize;E('font').value=draft.font;document.querySelectorAll('[data-color]').forEach(e=>e.value=draft.colors[e.dataset.color]);}
function highlight(){if(!doc)return;doc.querySelectorAll('[data-layout-selected]').forEach(e=>e.removeAttribute('data-layout-selected'));doc.querySelectorAll(L.targets[selected].selector).forEach(e=>e.setAttribute('data-layout-selected',''));}
function paint(changed=true){if(changed){dirty=true;status('未保存');}if(E('preview').contentWindow.PokerLayout)E('preview').contentWindow.PokerLayout.apply(draft);highlight();}
function select(k){selected=k;if(k==='stats'&&E('preview').contentWindow.openDataPanel)E('preview').contentWindow.openDataPanel();fields();highlight();}
function fit(){const mobile=profile==='mobile',w=mobile?390:1280,h=mobile?844:960;const box=E('canvas');zoom=Math.min(1,(box.clientWidth-24)/w,(box.clientHeight-24)/h);zoom=Math.max(.15,zoom);E('preview').style.cssText='width:'+w+'px;height:'+h+'px;transform:scale('+zoom+')';E('frameBox').style.width=w*zoom+'px';E('frameBox').style.height=h*zoom+'px';}
function endDrag(e){if(!drag)return;drag=null;try{doc.documentElement.releasePointerCapture(e.pointerId);}catch{}fields();}
function attach(){doc=E('preview').contentDocument;const style=doc.createElement('style');style.textContent='[data-layout-selected]{outline:2px dashed #ffdc76!important;outline-offset:4px}body{user-select:none}#arena,.action-dock,.under-table,.stats-panel{touch-action:none}header .editor-entry{display:none!important}';doc.head.append(style);
 doc.addEventListener('pointerdown',e=>{
  const order=['hand','board','pot','phase','action','logo','hero','opponent','controls','tools','stats','table'];
  const k=order.find(k=>e.target.closest(L.targets[k].selector));if(!k)return;
  e.preventDefault();e.stopImmediatePropagation();select(k);const p=settings();drag={x:e.clientX,y:e.clientY,start:{...p},w:doc.getElementById('arena').offsetWidth,h:doc.getElementById('arena').offsetHeight};doc.documentElement.setPointerCapture(e.pointerId);
 },true);
 doc.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();let p={...drag.start,x:Math.round((drag.start.x+(e.clientX-drag.x)/drag.w*100)*10)/10,y:Math.round((drag.start.y+(e.clientY-drag.y)/drag.h*100)*10)/10};draft.profiles[profile].elements[selected]=p;draft=L.normalize(draft);paint();fields();},true);
 doc.addEventListener('pointerup',endDrag,true);doc.addEventListener('pointercancel',endDrag,true);
 doc.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
 doc.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}},true);
 fit();paint(false);fields();
}
E('preview').addEventListener('load',attach);
E('element').onchange=e=>select(e.target.value);
for(const id of ['x','y','scale','fontSize'])E(id).oninput=()=>{const p={...settings()};p[id]=Number(E(id).value)/(id==='scale'?100:1);draft.profiles[profile].elements[selected]=p;draft=L.normalize(draft);E('scaleValue').value=Math.round(settings().scale*100)+'%';paint();};
document.querySelectorAll('[data-color]').forEach(e=>e.oninput=()=>{draft.colors[e.dataset.color]=e.value;paint();});
E('font').onchange=e=>{draft.font=e.target.value;paint();};
document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{profile=b.dataset.profile;document.querySelectorAll('[data-profile]').forEach(q=>q.classList.toggle('selected',q===b));fit();fields();paint(false);});
E('fit').onclick=fit;new ResizeObserver(fit).observe(E('canvas'));
E('resetElement').onclick=()=>{const p=L.defaults().profiles[profile].elements[selected];if(p)draft.profiles[profile].elements[selected]={...p};else delete draft.profiles[profile].elements[selected];fields();paint();};
E('reset').onclick=()=>{draft=L.defaults();fields();paint();};
E('save').onclick=()=>{try{draft=L.save(draft);dirty=false;status('已保存 ✓');paint(false);}catch{status('浏览器无法保存，请导出配置',true);}};
E('export').onclick=()=>{const blob=new Blob([JSON.stringify(L.normalize(draft),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PokerXuan-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(dirty?'已导出 · 尚未保存':'已导出');};
E('importBtn').onclick=()=>E('import').click();E('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>65536)throw Error('配置文件过大');draft=L.parse(await file.text());fields();paint();status('已导入 · 点击保存应用');}catch(err){status('导入失败：'+err.message,true);}e.target.value='';};
fields();
