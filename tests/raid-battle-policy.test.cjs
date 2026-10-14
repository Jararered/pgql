const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/raid-battle-policy.js'),'utf8'),context);
const P=context.PgqlRaidBattlePolicy;
const config={autoAttack:true,autoDodge:true,manualMaxBattles:false};
const fast={slot:1,move:214,type:12,energy:5,turns:1};
const water={slot:2,move:105,type:11,energy:-50,turns:4,effectiveness:1.6};
const fire={slot:3,move:103,type:10,energy:-33,turns:3,effectiveness:0.625};
const input=(extra={})=>({turn:10,now:1000,energy:0,fast,charged:[fire,water],isMax:false,inputBlocked:false,config,...extra});

// Fast attack without energy, charged attack with the best effectiveness once there is energy for it.
let s=P.battle();
assert.deepEqual(JSON.parse(JSON.stringify(P.decide(s,input()))),{kind:'fast',move:fast});
assert.equal(P.decide(s,input({energy:40})).kind,'fast','the best charged move needs 50 energy');
const charged=P.decide(s,input({energy:50}));
assert.equal(charged.kind,'charged');assert.equal(charged.move.move,105);
assert.equal(P.bestCharged([fire,{...water,effectiveness:0.625}]).move,103,'ties keep the first move');

// One action per turn; the next waits until the move has finished.
P.submitted(s,charged,10);
assert.equal(P.decide(s,input({turn:10,energy:100})).reason,'busy');
assert.equal(P.decide(s,input({turn:13,energy:100})).reason,'busy');
assert.equal(P.decide(s,input({turn:14})).kind,'fast');
assert.equal(s.stats.charged,1);
// A refused attack may be retried on the next turn.
s=P.battle();P.submitted(s,{kind:'fast',move:{...fast,turns:3}},20);
assert.equal(P.decide(s,input({turn:21})).reason,'busy');
P.answered(s,false);
assert.equal(P.decide(s,input({turn:21})).kind,'fast');assert.equal(s.stats.rejected,1);
P.answered(s,true);assert.equal(s.stats.rejected,1);

// Dodge window from the move damage window; each attack is dodged once.
assert.deepEqual(JSON.parse(JSON.stringify(P.dodgeWindow({turn:100,msPerTurn:500,startMs:2150,endMs:2800}))),{start:104,end:106});
assert.equal(P.dodgeWindow({turn:1,msPerTurn:0,startMs:1,endMs:2}),null);
s=P.battle();
assert.equal(P.bossAttack(s,{key:'a',turn:100,msPerTurn:500,startMs:2150,endMs:2800}),true);
assert.equal(P.bossAttack(s,{key:'a',turn:100,msPerTurn:500,startMs:2150,endMs:2800}),false,'the same attack is seen once');
assert.equal(P.decide(s,input({turn:103})).kind,'fast','before the window');
const dodge=P.decide(s,input({turn:104,energy:100}));
assert.equal(dodge.kind,'dodge','dodging wins over attacking');
P.submitted(s,dodge,104);
assert.equal(s.stats.dodges,1);
assert.notEqual(P.decide(s,input({turn:105})).kind,'dodge','one dodge per attack');
P.decide(s,input({turn:107}));assert.equal(s.dodge,null,'the window expires');
// No dodging in Max Battles or with the setting off.
s=P.battle();P.bossAttack(s,{key:'b',turn:0,msPerTurn:500,startMs:0,endMs:1000});
assert.equal(P.decide(s,input({turn:1,isMax:true})).kind,'fast');
assert.equal(P.decide(s,input({turn:1,config:{...config,autoDodge:false}})).kind,'fast');
assert.equal(P.decide(s,input({turn:1})).kind,'dodge');

// Settings and game state that keep automation quiet.
s=P.battle();
assert.equal(P.decide(s,input({config:{...config,autoAttack:false}})).reason,'off');
assert.equal(P.decide(s,input({isMax:true,config:{...config,manualMaxBattles:true}})).reason,'max');
assert.equal(P.decide(s,input({isMax:true})).kind,'fast','Max Battles are auto-attacked unless disabled');
assert.equal(P.decide(s,input({inputBlocked:true})).reason,'blocked');
assert.equal(P.decide(s,input({fast:null,charged:[]})).reason,'no-moves');
// A manual tap pauses automation so the game's own action goes first.
P.manual(s,1000);
assert.equal(P.decide(s,input({now:1000+P.manualPauseMs-1})).reason,'manual');
assert.equal(P.decide(s,input({now:1000+P.manualPauseMs})).kind,'fast');
assert.equal(s.stats.manual,1);
// Consecutive errors stop automation for the battle; a good step resets the count.
s=P.battle();
for(let i=1;i<P.maxErrors;i++)assert.equal(P.error(s),false);
P.ok(s);assert.equal(P.error(s),false);
for(let i=2;i<P.maxErrors;i++)P.error(s);
assert.equal(P.error(s),true);
console.log('Raid battle policy: attack choice, pacing, refusals, dodge windows, Max Battle gating, manual pause and error limit passed.');
