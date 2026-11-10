/* Portrait rendering is local; the server accepts only a fixed character key. */
(function(root){
 const labels={mooncat:'月半猫',naiwa:'奶蛙',nailoong:'奶龙',meituan:'美团袋鼠',doubao:'豆包',panda:'熊猫',fox:'狐狸',dog:'柴犬',cat:'橘猫',rabbit:'兔子',tiger:'老虎'};
 const html=id=>'<span class="avatar-image avatar-'+(Object.hasOwn(labels,id)?id:'panda')+'" aria-hidden="true">'+({rabbit:'🐰',tiger:'🐯'}[id]||'')+'</span>';
 root.PokerAvatars={labels,html,choices:Object.fromEntries(Object.entries(labels).map(([id,name])=>[id,[html(id),name]])),visible:Object.keys(labels).filter(id=>!['rabbit','tiger'].includes(id))};
})(globalThis);
