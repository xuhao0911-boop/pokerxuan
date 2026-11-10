import fs from 'node:fs/promises';
const assets={};for(const name of await fs.readdir('public')){if(name.startsWith('__'))continue;const bytes=await fs.readFile('public/'+name);assets['/'+name]=(/\.(jpg|png|webp|woff2|ttf|wav)$/i.test(name))?{base64:bytes.toString('base64'),type:({'jpg':'image/jpeg','png':'image/png','webp':'image/webp','woff2':'font/woff2','ttf':'font/ttf','wav':'audio/wav'})[name.split('.').at(-1)]}:bytes.toString('utf8');}
assets["/layout-preview.html"]=assets["/index.html"].replace("</body>",'<script src="/layout-demo.js"></script></body>');
let engine=await fs.readFile('worker/poker.js','utf8');engine=engine.replace('export const {Poker,evaluate,compare,labels}=globalThis.PokerEngine;','');
let api=await fs.readFile('worker/api.js','utf8');api=api.replace("import {beginStats,actionStats,settleStats,revealStats,statsView} from './stats.js';",'');
api=api.replace("import {exportData} from './export.js';",'');
api=api.replace("import {openDealerDraw,repeatDealerDraw} from './dealer.js';",'');
const dealer=(await fs.readFile('worker/dealer.js','utf8')).replaceAll('export function ','function ').replaceAll('export const ','const ');
const exporting=(await fs.readFile('worker/export.js','utf8')).replaceAll('export function ','function ');
const stats=(await fs.readFile('worker/stats.js','utf8')).replaceAll('export function ','function ');
api=api.replace("import {Poker,labels} from './poker.js';","const {Poker,labels}=globalThis.PokerEngine;");
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js',engine+'\n'+dealer+'\n'+stats+'\n'+exporting+'\n'+api+'\nconst ASSETS='+JSON.stringify(assets)+';\nexport default {fetch:(request,env)=>route(request,env,ASSETS)};\n');
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');console.log('Built PokerXuan Worker with '+Object.keys(assets).length+' assets');
