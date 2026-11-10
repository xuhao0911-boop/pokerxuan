import fs from 'node:fs/promises';
let a=await fs.readFile('public/app.js','utf8');
a=a.replace('${bb(p.stack)}','${stackAmount(p.stack)}');
a=a.replace("'<span class=\"dealer\">D</span>'","'<span class=\"dealer\" role=\"img\" aria-label=\"庄家按钮位\" title=\"庄家按钮位\"><b>D</b><small>庄</small></span>'");
a+=`\nfunction stackAmount(n){return '<span class="stack-digits">'+(unit==='bb'?Number((n/100).toFixed(2)).toLocaleString('en-US'):fmt(n))+'</span>'+(unit==='bb'?'<small class="stack-bb">BB</small>':'');}\n`;
await fs.writeFile('public/app.js',a);
let h=await fs.readFile('public/index.html','utf8');h=h.replace('<script src="/app.js">','<script src="/rank-paths.js"></script><script src="/app.js">');
await fs.writeFile('public/index.html',h);
