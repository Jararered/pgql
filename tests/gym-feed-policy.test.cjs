const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
for(const file of ['berry-policy.js','gym-feed-policy.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core',file),'utf8'),context);
const policy=context.PgqlGymFeedPolicy;

// Every 0.433.0 result name has an outcome; unknown names stop the visit.
const names=['Unset','Success','ErrorCannotUse','ErrorNotInRange','ErrorPokemonNotThere','ErrorPokemonFull','ErrorNoBerriesLeft','ErrorWrongTeam',
  'ErrorWrongCount','ErrorTooFast','ErrorTooFrequent','ErrorGymBusy','ErrorRaidActive','ErrorGymClosed'];
assert.deepEqual(Object.keys(policy.outcomes).sort(),[...names].sort());
assert.equal(policy.classify('Success'),'fed');
for(const name of ['ErrorPokemonFull','ErrorTooFrequent','ErrorPokemonNotThere'])assert.equal(policy.classify(name),'defender-done',name);
assert.equal(policy.classify('ErrorTooFast'),'retry');
for(const name of ['ErrorWrongTeam','ErrorNotInRange','ErrorNoBerriesLeft','ErrorRaidActive','Unset','SomethingNew'])assert.equal(policy.classify(name),'stop',name);

// The per-visit cap is a whole number from 1 to 100.
assert.equal(policy.parseCap('20'),20);assert.equal(policy.parseCap(' 1 '),1);assert.equal(policy.parseCap('100'),100);
for(const bad of ['0','101','','1.5','-3','ten'])assert.throws(()=>policy.parseCap(bad),/whole number from 1 to 100/,bad);

// Only in-range gyms of the player's own team are fed.
const gym={selected:'razz',playerTeam:2,gymTeam:2,inRange:true};
assert.equal(policy.eligible(gym).ok,true);assert.equal(policy.eligible(gym).berry.id,701);
for(const [change,reason] of [[{selected:'off'},'off'],[{gymTeam:0},'neutral'],[{gymTeam:1},'rival'],[{playerTeam:0},'rival'],[{inRange:false},'out-of-range']])
  assert.deepEqual({...policy.eligible({...gym,...change})},{ok:false,reason},reason);

// One defender: fed until the server says it is full.
const ready={now:10000,count:5};
let v=policy.visit({cap:20,defenders:[{id:'a',motivation:0}]});
assert.deepEqual({...policy.next(v,ready)},{id:'a'});
policy.started(v,'a',10000);
assert.equal(policy.next(v,ready).reason,'pending');
assert.equal(policy.answered(v,'a','Success',10500),'fed');
assert.equal(v.fed,1);assert.equal(v.defenders[0].fed,1);
// Requests are spaced out.
assert.deepEqual({...policy.next(v,{now:10600,count:5})},{reason:'wait',waitMs:900});
assert.deepEqual({...policy.next(v,{now:11500,count:5})},{id:'a'});
policy.started(v,'a',11500);policy.answered(v,'a','ErrorPokemonFull',12000);
assert.equal(v.defenders[0].done,'ErrorPokemonFull');
assert.equal(policy.next(v,{now:20000,count:5}).reason,'done');

// Six defenders: everyone gets one before anyone gets two, lowest motivation first.
v=policy.visit({cap:20,defenders:[0.5,0.1,0.3,0,0.9,0.2].map((motivation,i)=>({id:'d'+i,motivation}))});
const order=[];let now=0;
const feed=(result='Success')=>{now+=2000;const d=policy.next(v,{now,count:50});if(!d.id)return d.reason;order.push(d.id);policy.started(v,d.id,now);policy.answered(v,d.id,result,now);return d.id;};
for(let i=0;i<6;i++)feed();
assert.deepEqual(order,['d3','d1','d5','d2','d0','d4']);
// Fresh motivation from the game reorders the second round; full ones are skipped.
policy.refresh(v,[{id:'d0',motivation:1},{id:'d1',motivation:0.25},{id:'d2',motivation:0.5},{id:'d3',motivation:0.15},{id:'d4',motivation:0.99},{id:'d5',motivation:0.35}]);
assert.equal(feed(),'d3');assert.equal(feed(),'d1');
// A defender that hit its limit is not offered again this visit.
assert.equal(feed('ErrorTooFrequent'),'d5');assert.equal(v.defenders.find(d=>d.id==='d5').done,'ErrorTooFrequent');
assert.equal(feed(),'d2');assert.equal(feed(),'d4');
assert.equal(v.fed,10);
// A defender that left is dropped; a new one joins with no feeds.
policy.refresh(v,[{id:'d1',motivation:0.4},{id:'d7',motivation:0.6}]);
assert.deepEqual(v.defenders.map(d=>[d.id,d.fed]),[['d1',2],['d7',0]]);
assert.equal(feed(),'d7');

// The cap and an empty bag end the visit.
v=policy.visit({cap:2,defenders:[{id:'a',motivation:0},{id:'b',motivation:0}]});now=0;
feed();feed();assert.equal(feed(),'cap');
v=policy.visit({cap:5,defenders:[{id:'a',motivation:0}]});
assert.equal(policy.next(v,{now:0,count:0}).reason,'empty');
assert.equal(policy.next(v,{now:0,count:undefined}).reason,'empty');
// Nothing to do in a full gym or an empty one.
assert.equal(policy.next(policy.visit({cap:5,defenders:[{id:'a',motivation:1}]}),ready).reason,'done');
assert.equal(policy.next(policy.visit({cap:5}),ready).reason,'done');

// Too fast backs off, and stops after repeated refusals.
v=policy.visit({cap:20,defenders:[{id:'a',motivation:0}]});now=0;
assert.equal(feed('ErrorTooFast'),'a');assert.equal(v.retryAt,now+policy.retryMs);
assert.equal(policy.next(v,{now:now+policy.gapMs,count:5}).reason,'wait');
for(let i=0;i<policy.maxRetries;i++){now+=policy.retryMs;feed('ErrorTooFast');}
assert.equal(v.stopped,'too-fast');assert.equal(policy.next(v,ready).reason,'too-fast');
// A success resets the retry count.
v=policy.visit({cap:20,defenders:[{id:'a',motivation:0}]});now=0;
feed('ErrorTooFast');now+=policy.retryMs;feed();assert.equal(v.retries,0);

// Gym-level refusals and failures stop the visit.
v=policy.visit({cap:20,defenders:[{id:'a',motivation:0},{id:'b',motivation:0}]});now=0;
assert.equal(feed('ErrorNotInRange'),'a');assert.equal(v.stopped,'ErrorNotInRange');assert.equal(feed(),'ErrorNotInRange');
v=policy.visit({cap:20,defenders:[{id:'a',motivation:0}]});
policy.started(v,'a',0);policy.failed(v,'error');
assert.equal(v.pending,false);assert.equal(policy.next(v,ready).reason,'error');
console.log('Gym feed policy result mapping, eligibility, round-robin order, limits and back-off tests passed.');
