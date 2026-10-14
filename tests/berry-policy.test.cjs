const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/berry-policy.js'),'utf8'),context);
const policy=context.PgqlBerryPolicy;

// Setting names map to the game's berry items; anything else is rejected.
assert.deepEqual([...policy.berries.map(b=>b.key)],['pinap','razz','nanab','golden-razz','silver-pinap']);
assert.deepEqual([...policy.berries.map(b=>b.id)],[705,701,703,706,708]);
assert.equal(policy.parse('pinap').item,'PinapBerry');
assert.equal(policy.parse(' Silver-Pinap ').item,'GoldenPinapBerry');
assert.equal(policy.parse('off'),null);assert.equal(policy.parse('OFF'),null);
for(const bad of ['','pinap berry','bluk','705','golden-nanab'])assert.throws(()=>policy.parse(bad),/Unknown berry/,bad);
assert.equal(policy.label('golden-razz'),'Golden Razz Berry');assert.equal(policy.label('off'),'Off');

// Cycling walks every berry, then off, then wraps.
const seen=[];let key='pinap';
for(let i=0;i<6;i++){key=policy.next(key);seen.push(key);}
assert.deepEqual(seen,['razz','nanab','golden-razz','silver-pinap','off','pinap']);

// A berry is fed only into an eligible encounter with stock and nothing pending.
const ready={selected:'pinap',activeBerry:0,canUseBerry:true,special:false,count:3,pending:false,sinceLast:5000};
assert.deepEqual({...policy.decide(ready)},{item:705});
assert.deepEqual({...policy.decide({...ready,selected:'razz'})},{item:701});
assert.deepEqual({...policy.decide({...ready,sinceLast:undefined})},{item:705});
for(const [change,reason] of [
  [{selected:'off'},'off'],[{special:true},'special'],[{activeBerry:705},'active'],[{canUseBerry:false},'unavailable'],
  [{pending:true},'pending'],[{sinceLast:1999},'throttled'],[{count:0},'empty'],[{count:undefined},'empty']])
  assert.deepEqual({...policy.decide({...ready,...change})},{item:null,reason},reason);
// Raid and Rocket encounters are skipped even with stock.
assert.equal(policy.decide({...ready,special:true,count:50}).reason,'special');
console.log('Berry policy parse, cycling and feeding decision tests passed.');
