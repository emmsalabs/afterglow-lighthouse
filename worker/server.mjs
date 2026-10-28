import {apply,view} from './engine.mjs';
const json = (v,status=200) => Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uid = () => crypto.randomUUID().replaceAll('-','');
const cleanName = v => String(v||'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,18);
function player(name) {return {id:uid().slice(0,12),token:uid()+uid(),name:cleanName(name)||'Wanderer'};}
export default {async fetch(req,env) {
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/') return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com"}});
  if(req.method==='GET'&&url.pathname==='/favicon.svg') return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0b202b"/><path d="M24 53L28 22h8l4 31z" fill="#f2c97b"/><path d="M21 22h22l-11-12z" fill="#e9a55d"/><circle cx="32" cy="28" r="4" fill="#fff"/></svg>',{headers:{'Content-Type':'image/svg+xml'}});
  if(url.pathname!=='/api/game'||req.method!=='POST') return json({error:'Not found'},404);
  if(req.headers.get('origin') && req.headers.get('origin')!==url.origin) return json({error:'Please use the game page.'},403);
  try {
    if(Number(req.headers.get('content-length')||0)>4096) return json({error:'Message too large'},413);
    const raw=await req.text();if(raw.length>4096)return json({error:'Message too large'},413);
    const b=JSON.parse(raw), action=b.action;
    if(!['create','join','state','start','vote','lock','next','chat'].includes(action)) return json({error:'Unknown action'},400);
    const db=env.DB;if(!db) throw Error('The lighthouse is temporarily offline. Please try again shortly.');
    const now=Date.now();
    if(action==='create') {
      const p=player(b.name); const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>chars[x%chars.length]).join('');
      const s={code,host:p.id,stage:'lobby',players:[p],round:0,score:0,misses:0,duration:[60,90,150].includes(b.duration)?b.duration:90,deadline:0,votes:{},messages:[{name:'LIGHTHOUSE',text:'Welcome aboard. Invite your crew to begin.',system:true}]};
      await db.prepare('INSERT INTO rooms (code,state,revision,expires) VALUES (?,?,0,?)').bind(code,JSON.stringify(s),now+86400000).run();
      // Bounded cleanup of expired rooms; no active room data is affected.
      await db.prepare('DELETE FROM rooms WHERE code IN (SELECT code FROM rooms WHERE expires < ? LIMIT 20)').bind(now).run();
      return json({session:{code,token:p.token},state:view(s,p)});
    }
    const code=String(b.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(code.length!==6)return json({error:'Enter the six-character room code.'},400);
    for(let attempt=0;attempt<6;attempt++) {
      const row=await db.prepare('SELECT state,revision FROM rooms WHERE code=? AND expires>?').bind(code,now).first();
      if(!row)return json({error:'That room is not on the chart. Check the code, or create a new voyage.'},404);
      const s=JSON.parse(row.state);let p=s.players.find(p=>p.token===b.token);let session;
      if(action==='join'&&!p) {
        if(s.stage!=='lobby') return json({error:'This voyage has already begun. Ask the keeper for a new room.'},409);
        if(s.players.length>=6)return json({error:'The crew is full (six players).'},409);
        p=player(b.name);s.players.push(p);session={code,token:p.token};
      } else if(!p) return json({error:'Your crew pass was not found. Rejoin with the room code.'},401);
      const before=JSON.stringify(s);
      apply(s,action,b,p,now);
      if(action==='state'&&before===JSON.stringify(s))return json({state:view(s,p,now)});
      const saved=await db.prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').bind(JSON.stringify(s),code,row.revision).run();
      if(saved.meta.changes)return json({state:view(s,p,now),...(session?{session}:{})});
    }
    return json({error:'The radio is busy. Please try once more.'},409);
  } catch(e) {return json({error:e instanceof SyntaxError?'The radio could not read that request.':e.message||'Connection interrupted.'},400);}
}};
