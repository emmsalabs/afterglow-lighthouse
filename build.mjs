import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
const engine=await readFile('worker/engine.mjs','utf8');
const server=(await readFile('worker/server.mjs','utf8')).replace("import {apply,view} from './engine.mjs';",'');
const html=await readFile('web/index.html','utf8');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',engine+'\nconst PAGE='+JSON.stringify(html)+';\n'+server);
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Afterglow: dependency-free Worker, embedded client, D1 migrations.');
