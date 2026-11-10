// Always export the authenticated player, regardless of the statistics tab selection.
let exportBusy=false;
function downloadPokerFile(data,format){
 const name='PokerXuan_'+data.room.id+'_'+data.exportedAt.replaceAll(':','-').replace(/\.\d+Z$/,'Z');
 let text,type,suffix;
 if(format==='json'){text=JSON.stringify(data,null,2);type='application/json';suffix='_my-data.json';}
 else {const rows=format==='hands'?PokerExport.handRows(data):PokerExport.actionRows(data);if(!rows.length){toast('没有可导出的行动记录');return;}text=PokerExport.csv(rows);type='text/csv;charset=utf-8';suffix=format==='hands'?'_my-hands.csv':'_actions.csv';}
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+suffix;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('文件已生成，请查看浏览器下载或保存到文件');
}
async function openPokerExport(){
 if(!roomId||exportBusy)return;exportBusy=true;const id=roomId;
 dialog('导出我的数据','<p role="status">正在读取已结算的手牌…</p>');
 try{
  const result=await request('rooms/'+id+'/export');if(id!==roomId)return;const data=result.export,c=data.coverage;
  const info='<p class="export-summary"><strong>'+esc(data.player.name)+'</strong> · '+c.exportedHands+' 手可导出</p><p>只包含本房间里你参与的已结束手牌。正在打的这一手请结束后再导出。打开导出窗口不会暂停牌局。</p>';
  const buttons=c.exportedHands?'<div class="export-options"><button data-export-format="json"><strong>完整数据 JSON <small>推荐给 AI 评测</small></strong><span>底牌、位置、逐街行动、筹码、统计口径</span></button><button data-export-format="hands"><strong>每手汇总 CSV</strong><span>用 Excel 查看输赢、VPIP 与过牌机会</span></button><button data-export-format="actions"><strong>逐次行动 CSV</strong><span>包含自己与对手的公开行动，便于复盘</span></button></div>':'<p>完成第一手后，就能在这里下载。</p>';
  const notes='<p class="export-note">最近 100 手明细 · 全部金额为虚拟筹码<br>JSON 的累计统计可能覆盖更多手牌，CSV 仅包含文件内的明细。旧记录缺失项在 JSON 中为 null、CSV 中为空；未公开的对手底牌不会导出。<br>过牌率 = 过牌次数 ÷ 当时允许过牌的决策次数，另列本人手动操作口径。</p><details class="export-details"><summary>保存范围与注意事项</summary><ul>'+c.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p>下载文件不会上传给其他人。你可以之后把 JSON 发给评测者。离开房间或关闭标签页前请保存。</p></details>';
  if($('#dialogTitle').textContent==='导出我的数据'){$('#dialogBody').innerHTML=info+buttons+notes;$$('[data-export-format]').forEach(b=>b.onclick=()=>downloadPokerFile(data,b.dataset.exportFormat));}
 }catch(e){if(id===roomId&&$('#dialogTitle').textContent==='导出我的数据')$('#dialogBody').innerHTML='<p role="alert">'+esc(e.message||'读取失败，请关闭后重试。')+'</p>';}
 finally{exportBusy=false;}
}
$('#exportDataBtn').onclick=openPokerExport;
$('#leaveBtn').onclick=()=>{
 dialog('离开房间','<p>进行中的牌局会在轮到你时自动弃牌。离开后当前身份将无法再导出，请先保存需要的数据。</p><div class="leave-export-actions"><button id="exportBeforeLeave" class="secondary">先导出我的数据 ↓</button><button id="confirmLeave" class="primary">离开房间 <span>→</span></button></div>');
 $('#exportBeforeLeave').onclick=openPokerExport;$('#confirmLeave').onclick=()=>{$('#dialog').close();command('leave');};
};
