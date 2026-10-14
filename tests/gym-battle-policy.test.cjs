const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/gym-battle-policy.js'),'utf8'),context);
const P=context.PgqlGymBattlePolicy;
const config={autoAttack:true,autoDodge:true,autoSwap:true};
const weak={id:'a',index:0,score:0.6,energy:0,fainted:false,health:1};
const strong={id:'b',index:1,score:2.5,energy:0,fainted:false,health:1};
const plain={id:'c',index:2,score:0.8,energy:0,fainted:false,health:1};
const charged=[{move3:false,energy:-50,effectiveness:1},{move3:true,energy:-33,effectiveness:1.6}];
const input=(extra={})=>({now:1000,status:1,busy:false,queued:false,enemy:null,active:weak,bench:[strong,plain],charged,config,...extra});
const kind=(s,extra)=>P.decide(s,input(extra)).kind;

// Scores: offence weighs the fast move most; resisted defender moves raise the score.
assert.equal(P.score({fast:1,charged:[1],defence:[1]}),1);
assert.ok(Math.abs(P.score({fast:1.6,charged:[1.6],defence:[]})-1.6)<1e-9);
assert.ok(P.score({fast:1,charged:[1],defence:[0.625]})>1.5,'resisting the defender counts');
assert.ok(P.score({fast:0.625,charged:[0.625],defence:[1.6]})<0.5);
assert.equal(P.score({fast:0,charged:[],defence:[]}),1,'unknown moves are neutral');

// Rival gate: only gyms of another team.
assert.deepEqual({...P.rival({gymTeam:1,playerTeam:2})},{ok:true});
assert.equal(P.rival({gymTeam:2,playerTeam:2}).reason,'friendly');
assert.equal(P.rival({gymTeam:0,playerTeam:2}).reason,'neutral');
assert.equal(P.rival({gymTeam:3,playerTeam:0}).reason,'unknown-team');

// A much better bench member is swapped in once per defender.
let s=P.battle();P.observe(s,{defender:'d1',activeId:'a',activeFainted:false});
let d=P.decide(s,input());
assert.equal(d.kind,'swap');assert.equal(d.member.id,'b');assert.ok(Math.abs(d.ratio-2.5/0.6)<1e-9);
P.tried(s,d,true);
P.observe(s,{defender:'d1',activeId:'b',activeFainted:false});
assert.equal(kind(s,{active:strong,bench:[weak,plain]}),'fast','no second swap against the same defender');
assert.equal(kind(s,{active:weak,bench:[strong]}),'fast','the lock holds even if the game swaps back');
// The next defender allows another swap.
P.observe(s,{defender:'d2',activeId:'a',activeFainted:false});
assert.equal(kind(s),'swap');
// A refused swap does not lock.
s=P.battle();P.observe(s,{defender:'d1',activeId:'a',activeFainted:false});
P.tried(s,P.decide(s,input()),false,1000);
assert.equal(s.stats.rejected,1);
assert.equal(kind(s,{now:1000+P.swapRetryMs-1}),'fast','a refused swap waits before retrying');
assert.equal(kind(s,{now:1000+P.swapRetryMs}),'swap','retried after a refusal');

// The threshold, health and fainted members.
s=P.battle();P.observe(s,{defender:'d1',activeId:'a',activeFainted:false});
assert.equal(kind(s,{bench:[{...strong,score:0.8}]}),'fast','below 1.5x is not worth a swap');
assert.equal(kind(s,{bench:[{...strong,score:0.9}]}),'swap','exactly 1.5x swaps');
assert.equal(kind(s,{bench:[{...strong,health:0.2}]}),'fast','low health is not swapped in');
assert.equal(kind(s,{bench:[{...strong,fainted:true}]}),'fast');
assert.equal(kind(s,{config:{...config,autoSwap:false}}),'fast');

// After the active member faints, its replacement may be swapped again.
s=P.battle();P.observe(s,{defender:'d1',activeId:'a',activeFainted:false});
P.tried(s,P.decide(s,input()),true);
P.observe(s,{defender:'d1',activeId:'b',activeFainted:true});
P.observe(s,{defender:'d1',activeId:'c',activeFainted:false});
assert.equal(kind(s,{active:plain,bench:[{...strong,score:3}]}),'swap','a fainted active member frees the lock');

// Dodge only charged attacks, once each, just before they land; dodge beats swap.
s=P.battle();P.observe(s,{defender:'d1',activeId:'a',activeFainted:false});
const special={key:'d1:500',type:P.actionTypes.special,landsInSec:0.3};
assert.equal(kind(s,{enemy:{...special,landsInSec:1.2}}),'swap','too early to dodge');
d=P.decide(s,input({enemy:special}));assert.equal(d.kind,'dodge');
P.tried(s,d,true);assert.equal(s.stats.dodges,1);
assert.equal(kind(s,{enemy:special}),'swap','each attack is dodged once');
assert.equal(kind(s,{enemy:{...special,key:'d1:900',type:P.actionTypes.attack}}),'swap','fast attacks are not dodged');
assert.equal(kind(s,{enemy:{...special,key:'d1:900',type:P.actionTypes.special2}}),'dodge');
assert.equal(kind(s,{enemy:{...special,key:'d1:900',landsInSec:-1}}),'swap','unknown timing is not dodged');
assert.equal(kind(s,{enemy:{...special,key:'d1:900'},config:{...config,autoDodge:false}}),'swap');
// A new defender clears the dodged attacks.
P.observe(s,{defender:'d2',activeId:'a',activeFainted:false});
assert.equal(s.dodged.size,0);

// Attacks: fast by default, the most effective charged move with enough energy, nothing while queued.
const noSwap={config:{...config,autoSwap:false}};
s=P.battle();P.observe(s,{defender:'d1',activeId:'a',activeFainted:false});
assert.equal(kind(s,noSwap),'fast');
assert.equal(kind(s,{...noSwap,active:{...weak,energy:32}}),'fast');
d=P.decide(s,input({...noSwap,active:{...weak,energy:33}}));
assert.equal(d.kind,'charged');assert.equal(d.move.move3,true);
assert.equal(P.decide(s,input({...noSwap,active:{...weak,energy:33},charged:[{move3:false,energy:-50,effectiveness:1.6},{move3:true,energy:-33,effectiveness:1.6}]})).move.move3,true,
  'equally effective: the cheaper charged move');
assert.equal(kind(s,{...noSwap,queued:true}),'none');
assert.equal(kind(s,{config:{autoAttack:false,autoDodge:true,autoSwap:false}}),'none');
P.tried(s,{kind:'fast'},true);P.tried(s,d,true);
assert.deepEqual({...s.stats},{fast:1,charged:1,dodges:0,swaps:0,rejected:0,manual:0});

// Nothing outside an active battle, while busy, after a faint or during a manual pause.
assert.equal(P.decide(s,input({status:2})).reason,'inactive');
assert.equal(P.decide(s,input({busy:true})).reason,'busy');
assert.equal(P.decide(s,input({active:{...weak,fainted:true}})).reason,'fainted');
P.manual(s,1000);
assert.equal(P.decide(s,input({now:1000+P.manualPauseMs-1})).reason,'manual');
assert.notEqual(P.decide(s,input({now:1000+P.manualPauseMs})).kind,'none');
assert.equal(s.stats.manual,1);

// Five consecutive errors stop a battle; a good step resets the count.
s=P.battle();
for(let i=0;i<P.maxErrors-1;i++)assert.equal(P.error(s),false);
P.ok(s);assert.equal(P.error(s),false);
for(let i=0;i<P.maxErrors-2;i++)P.error(s);
assert.equal(P.error(s),true);

console.log('Gym battle policy scoring, rival gate, swap lock, dodge timing, attacks and pauses tests passed.');
