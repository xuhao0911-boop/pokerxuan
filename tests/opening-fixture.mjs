import {route} from '../worker/api.js';
import {dealerDrawRound} from '../worker/dealer.js';
// Legacy hand-level regression fixtures explicitly choose seat zero as the first
// button. Opening selection itself is exercised without this helper in dealer-draw.test.mjs.
export async function completeOpeningFixture(DB,result,token){
 if(!result.room?.dealerDraw?.active)return result;
 const id=result.room.id,row=DB.sql.prepare('SELECT state FROM poker_rooms WHERE id=?').get(id),r=JSON.parse(row.state);
 const round=dealerDrawRound(r.order,1,r.order.map((_,i)=>({r:14-i,s:0})));
 r.dealerDraw={active:true,rounds:[round],contenders:round.leaders,winner:round.winner,nextAt:Date.now()-1};
 DB.sql.prepare('UPDATE poker_rooms SET state=? WHERE id=?').run(JSON.stringify(r),id);
 const response=await route(new Request('https://test/api/rooms/'+id,{headers:{'X-Player-Token':token||result.token}}),{DB});
 return {...result,...await response.json(),status:response.status};
}
