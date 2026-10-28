import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {newRound,apply,view} from './worker/engine.mjs';
for(let n=2;n<=6;n++)for(let k=0;k<100;k++){
 const s={players:Array.from({length:n},(_,i)=>({id:String(i),token:'secret'+i,name:'Crew '+i})),round:0,duration:90,messages:[],votes:{},host:'0',score:0,misses:0};
 newRound(s,1000);
 const intersection=s.puzzle.clues[0].filter(t=>s.puzzle.clues.every(c=>c.includes(t)));
 assert.deepEqual(intersection,[s.puzzle.target]);
 const v=view(s,s.players[0]);assert.equal('puzzle' in v,false);assert.equal('token' in v.players[0],false);assert.equal(v.result,null);assert.equal(v.clue.length,6);
 assert.throws(()=>apply(s,'lock',{},s.players[1],1001),/keeper/);
 assert.throws(()=>apply(s,'vote',{tile:1,round:99},s.players[0],1001),/changed/);
 for(const p of s.players)apply(s,'vote',{tile:s.puzzle.target,round:s.round},p,1002);
 apply(s,'lock',{},s.players[0],1003);assert.equal(s.score,1);assert.equal(s.stage,'reveal');
 newRound(s,2000);apply(s,'state',{},s.players[0],100000);assert.equal(s.misses,1);
 newRound(s,200000);apply(s,'state',{},s.players[0],300000);assert.equal(s.stage,'finished');
}
console.log('PASS: 500 generated puzzles have a unique shared solution; private clues and tokens stay private; keeper permissions, stale votes, scoring and timeout rules work.');
const sql=new DatabaseSync(':memory:');sql.exec(await readFile('drizzle/0000_rooms.sql','utf8'));
export const dbAdapter=db=>({prepare(q){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(q).get(...args)||null},async run(){const r=db.prepare(q).run(...args);return {meta:{changes:r.changes}}}}}});
const env={DB:dbAdapter(sql)};
const worker=(await import('./dist/server/index.js')).default;
async function api(b){return (await worker.fetch(new Request('http://localhost/api/game',{method:'POST',headers:{'content-type':'application/json','origin':'http://localhost'},body:JSON.stringify(b)}),env)).json()}
const a=await api({action:'create',name:'Keeper',duration:90});assert.ok(a.session);assert.equal(a.state.players.length,1);
const b=await api({action:'join',code:a.session.code,name:'Navigator'});assert.ok(b.session);assert.equal(b.state.players.length,2);
let r=await api({...a.session,action:'start'});assert.equal(r.state.stage,'playing');
assert.equal((await api({...a.session,token:'invalid',action:'state'})).error,'Your crew pass was not found. Rejoin with the room code.');
assert.ok((await api({code:a.session.code,action:'join',name:'Late'})).error.includes('already begun'));
const vb=await api({...b.session,action:'state'});const target=r.state.clue.find(t=>vb.state.clue.includes(t));assert.equal(typeof target,'number');
await Promise.all([api({...a.session,action:'vote',tile:target,round:1}),api({...b.session,action:'vote',tile:target,round:1})]);
r=await api({...a.session,action:'lock'});assert.equal(r.state.score,1);assert.equal(r.state.result.target,target);
await api({...b.session,action:'chat',text:'<script>alert(1)</script>'});
r=await api({...a.session,action:'next'});assert.equal(r.state.round,2);
const html=await(await worker.fetch(new Request('http://localhost/'),env)).text();assert.ok(html.includes('Afterglow'));const client=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(client);
console.log('PASS: hosted API creation, joining, separate identities, concurrent voting, clue isolation, consensus, radio, next round, and client syntax.');
