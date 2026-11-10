import test from 'node:test';
import assert from 'node:assert/strict';
import {route} from '../worker/api.js';
import {database} from '../scripts/local-db.mjs';

test('the five requested character identities persist and synchronize as allowlisted keys',async t=>{
 const DB=database();t.after(()=>DB.close());
 const request=async(path,data,token)=>{const r=await route(new Request('https://test/api/rooms'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},...(data?{body:JSON.stringify(data)}:{})}),{DB});return {status:r.status,...await r.json()};};
 for(const avatar of ['mooncat','naiwa','nailoong','meituan','doubao']){
  const host=await request('',{name:'甲',avatar,seats:2,stackBB:100});assert.equal(host.status,200);assert.equal(host.room.members[0].avatar,avatar);
  const friend=await request('/'+host.room.id+'/join',{name:'乙',avatar});assert.equal(friend.status,200);assert(friend.room.members.every(m=>m.avatar===avatar));
  const again=await request('/'+host.room.id,undefined,host.token);assert(again.room.members.every(m=>m.avatar===avatar));
 }
 for(const avatar of ['<img src=x>','/avatar-mooncat.png','fatcat'])assert.equal((await request('',{name:'甲',avatar,seats:2,stackBB:100})).status,400);
});
