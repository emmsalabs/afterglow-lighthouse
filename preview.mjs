import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_rooms.sql','utf8'));
const adapter={prepare(q){let a=[];return {bind(...x){a=x;return this},async first(){return db.prepare(q).get(...a)||null},async run(){const r=db.prepare(q).run(...a);return {meta:{changes:r.changes}}}}}};
const worker=(await import('./dist/server/index.js')).default;
http.createServer(async(req,res)=>{try{let body='';for await(const b of req)body+=b;const response=await worker.fetch(new Request('http://127.0.0.1:5173'+req.url,{method:req.method,headers:req.headers,...(body?{body}:{})}),{DB:adapter});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(e){res.writeHead(500);res.end('Preview failed: '+e.message)}}).listen(5173,'127.0.0.1',()=>console.log('Afterglow preview: http://127.0.0.1:5173'));
