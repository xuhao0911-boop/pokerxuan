import fs from 'node:fs/promises';let p=await fs.readFile('worker/poker.js','utf8');
p=p.replace("actionable[0].street>=this.bet","actionable[0].street>=Math.max(...this.alive.filter(p=>p!==actionable[0]).map(p=>p.street))");
await fs.writeFile('worker/poker.js',p);
