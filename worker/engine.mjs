export const labels = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4'];
export const names = ['Northstar','Wanderer','Crescent','Driftwood','Sparrow','Ember','Mariner','Solstice','Whisper','Coral','Horizon','Firefly','Anchor','Juniper','Echo','Aurora'];
const shuffle = a => [...a].sort(() => Math.random() - .5);
export function newRound(s, now = Date.now()) {
  const target = Math.floor(Math.random()*16);
  const others = shuffle(labels.map((_,i)=>i).filter(i=>i!==target));
  s.puzzle = {target, clues:s.players.map((_,i)=>shuffle([target,...(i<2 ? others.slice(i*5,i*5+5) : shuffle(others).slice(0,5))]))};
  s.votes = {}; s.stage = 'playing'; s.deadline = now + s.duration*1000; s.round++;
  s.messages.push({name:'LIGHTHOUSE',text:'Signal '+s.round+' is drifting. Compare your private clues.',system:true});
}
export function resolveRound(s, now = Date.now()) {
  if(s.stage!=='playing') return;
  const choices = s.players.map(p=>s.votes[p.id]);
  const unanimous = choices.every(v=>Number.isInteger(v)&&v===choices[0]);
  const success = unanimous && choices[0]===s.puzzle.target;
  s.result={success,target:s.puzzle.target,choices,reason:success?'The signal is home.':unanimous?'That was a decoy signal.':'The crew did not reach a shared decision.'};
  s.score += success?1:0; s.misses += success?0:1;
  s.stage = s.round>=5 || s.misses>=2 ? 'finished' : 'reveal'; s.deadline=0;
  s.messages.push({name:'LIGHTHOUSE',text:success?'Beacon restored. One step closer to dawn.':'The fog thickens. Listen to every clue.',system:true});
}
export function apply(s, action, b, who, now=Date.now()) {
  if(s.stage==='playing' && now>=s.deadline) resolveRound(s,now);
  const host = who && who.id===s.host;
  if(action==='start') {
    if(!host) throw Error('Only the keeper can begin.');
    if(s.stage!=='lobby'&&s.stage!=='finished') throw Error('A voyage is already underway.');
    if(s.players.length<2) throw Error('Invite at least one crewmate first.');
    s.round=0;s.score=0;s.misses=0;newRound(s,now);
  } else if(action==='vote') {
    if(s.stage!=='playing') throw Error('This signal has already closed.');
    if(b.round!==s.round) throw Error('The signal changed. Try your vote again.');
    if(!Number.isInteger(b.tile)||b.tile<0||b.tile>15) throw Error('Choose a tile on the chart.');
    s.votes[who.id]=b.tile;
  } else if(action==='lock') {
    if(!host) throw Error('Only the keeper can lock the signal.');
    if(s.stage!=='playing') throw Error('There is no active signal.');
    const votes=s.players.map(p=>s.votes[p.id]);
    if(!votes.every(v=>Number.isInteger(v)&&v===votes[0])) throw Error('Every crewmate must vote for the same tile first.');
    resolveRound(s,now);
  } else if(action==='next') {
    if(!host || s.stage!=='reveal') throw Error('Wait for the keeper to start the next signal.');
    newRound(s,now);
  } else if(action==='chat') {
    const text=String(b.text||'').trim().slice(0,180);
    if(!text) throw Error('Write a radio message first.');
    if(now-(who.lastChat||0)<900) throw Error('Give the radio a moment.');
    who.lastChat=now;s.messages.push({name:who.name,text,system:false});s.messages=s.messages.slice(-30);
  }
  return s;
}
export function view(s, who, now=Date.now()) {
  return {code:s.code,stage:s.stage,host:s.host,players:s.players.map(p=>({id:p.id,name:p.name})),you:who.id,round:s.round,score:s.score,misses:s.misses,duration:s.duration,deadline:s.deadline,now,votes:s.votes,messages:s.messages.slice(-25),clue:s.stage==='playing'?s.puzzle.clues[s.players.findIndex(p=>p.id===who.id)]:[],result:s.stage==='reveal'||s.stage==='finished'?s.result:null};
}
