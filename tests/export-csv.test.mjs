import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/export-data.js';
const {csv,handRows,actionRows}=globalThis.PokerExport;
test('CSV is UTF-8 BOM, quoted, formula-safe, and keeps numeric losses numeric',()=>{
 const result=csv([{name:'=HYPERLINK("bad")',negative:-50,unknown:null,comma:'甲,乙',line:'a\nb',plus:'+1',at:' @sum(A1)',minus:'-2'}]);
 assert(result.startsWith('\uFEFF'));assert(result.includes('"\'=HYPERLINK(""bad"")"'));assert(result.includes('"-50",,"甲,乙"'));assert(result.includes('"a\nb"'));assert(result.includes('"\'+1"'));assert(result.includes('"\' @sum(A1)"'));assert(result.includes('"\'-2"'));
});
test('CSV rows keep decision opportunities separate from unknown legacy contexts',()=>{
 const d={exportedAt:'2026-11-06T00:00:00.000Z',room:{id:'room'},player:{id:'p',name:'测试'},hands:[{id:'room:1',handNumber:1,hero:{holeCards:['As','Kh'],net:-50,position:'BTN/SB'},players:[{id:'p',position:'BTN/SB'}],board:[],smallBlind:50,bigBlind:100,playerCount:2,tableType:'heads-up',dataQuality:{completeContext:false,actionsTruncated:null,unknownFields:['startedAt']},myDecisionsByStreet:{preflop:{checks:1,checksWithKnownOpportunity:0,checkOpportunities:0,manualChecks:0,manualCheckOpportunities:0,unknownOpportunityActions:1}},actions:[{sequence:1,playerId:'p',playerName:'测试',isYou:true,phase:'preflop',type:'check',board:null,toCallBefore:null}]}]};
 const h=handRows(d)[0],a=actionRows(d)[0];assert.equal(h.net_bb,-.5);assert.equal(h.preflop_checks,1);assert.equal(h.preflop_check_opportunities,0);assert.equal(h.preflop_unknown_opportunity_actions,1);assert.equal(a.actor_position,'BTN/SB');assert.equal(a.board_before,null);assert.equal(a.to_call_before,null);assert(!Object.hasOwn(a,'opponent_hole_cards'));
});
