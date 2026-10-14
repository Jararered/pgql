const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/cooldown-policy.js'),'utf8'),context);
const P=context.PgqlCooldownPolicy;

// The distance-to-time curve, in seconds.
for(const [meters,seconds] of [[0,0],[49.9,0],[50,5],[100,8],[250,15],[500,27],[1000,49],[2000,90],[5000,206],[10000,389],
  [29999,1073],[30000,1078],[100000,1708],[299999,2816],[300000,2806],[1000000,6015],[1306000,7199],[1307000,7200],[5000000,7200]])
  assert.equal(P.seconds(meters),seconds,meters+' m');

// Haversine distance.
const london={lat:51.5074,lon:-0.1278},paris={lat:48.8566,lon:2.3522};
assert(Math.abs(P.distance(london,paris)-343556)<500);
assert.equal(P.distance(london,london),0);

// Remaining time from the record, the player and the clock.
const record={trigger:'catch',label:null,lat:0.01,lon:0.01,ts:1000000};
const at=meters=>({lat:0.01+meters/111195,lon:0.01});
assert.equal(P.remaining(record,at(0),1000000),0,'no distance, no cooldown');
assert(Math.abs(P.remaining(record,at(5000),1000000)-206000)<2000);
assert(Math.abs(P.remaining(record,at(5000),1100000)-106000)<2000);
assert.equal(P.remaining(record,at(5000),1300000),0,'never negative');
assert.equal(P.remaining(null,at(5000),0),0);
assert.equal(P.remaining(record,null,0),0);
assert.equal(P.outOfCooldown(record,1000000+7199999),false);
assert.equal(P.outOfCooldown(record,1000000+7200000),true);
assert.equal(P.outOfCooldown(null,0),true);

// Formats.
assert.equal(P.formatTime(0),'0s');
assert.equal(P.formatTime(59999),'59s');
assert.equal(P.formatTime(60000),'1m 0s');
assert.equal(P.formatTime(3723000),'1h 2m 3s');
assert.equal(P.formatTime(3*3600000+5000),'3h');
assert.equal(P.formatShort(0),'0s');assert.equal(P.formatShort(45000),'45s');
assert.equal(P.formatShort(3720000),'1h2m');assert.equal(P.formatShort(3600000),'1h');
assert.equal(P.formatDistance(999.2),'1000m');assert.equal(P.formatDistance(1499),'1km');
assert.equal(P.toast(record,at(5000),1000000),'Cooldown: 3m 26s\n(Distance: 5km)');
assert.equal(P.toast(record,at(10),1000000),null);
assert.equal(P.title({trigger:'pokestop',label:'Fountain'}),'Pokéstop Fountain');
assert.equal(P.describe({...record,trigger:'manual'},at(500),1000000+125000),'Manual — 2m ago · 500m · 0.010000,0.010000');
assert.equal(P.describe(record,null,1000000+5000),'Catch Attempt — 5s ago · 0.010000,0.010000');

// What counts.
assert.equal(P.catchCounts({status:1,hasScores:false,exempt:false}),true);
assert.equal(P.catchCounts({status:2,hasScores:true,exempt:false}),true,'an escape with scores counts');
assert.equal(P.catchCounts({status:0,hasScores:false,exempt:false}),false,'no scores: already on a cooldown');
assert.equal(P.catchCounts({status:1,hasScores:true,exempt:true}),false);
assert.equal(P.spinCounts({result:1,xp:50}),true);
assert.equal(P.spinCounts({result:1,xp:0}),false,'success with no XP: already on a cooldown');
assert.equal(P.spinCounts({result:2,xp:0}),false,'out of range');
assert.equal(P.spinCounts({result:3,xp:0}),true,'the stop is cooling down but the action counts');
assert.deepEqual([0,1,2,3,4].map(P.catchEnds),[true,true,false,true,false]);
assert(P.exemptEncounters.includes('QuestMapPokemon'));assert.equal(P.shadowEncounter,'IncidentMapPokemon');

// History: newest first, four previous records kept.
const history=new P.History();
assert.equal(history.list().length,0);
for(let i=1;i<=6;i++)history.save('catch',null,{lat:i,lon:i},i*1000);
assert.equal(history.current.lat,6);
assert.deepEqual([...history.previous.map(r=>r.lat)],[5,4,3,2]);
assert.equal(history.list().length,5);
assert.throws(()=>history.save('catch',null,null,1),/No valid player location/);
assert.throws(()=>history.save('catch',null,{lat:0,lon:0},1),/No valid player location/);
assert.throws(()=>history.save('bogus',null,{lat:1,lon:1},1),/No valid player location/);
const copy=P.History.fromJSON(JSON.parse(JSON.stringify(history)));
assert.deepEqual(JSON.parse(JSON.stringify(copy)),JSON.parse(JSON.stringify(history)));
// Corrupt entries are dropped one by one.
const mixed=P.History.fromJSON({current:{trigger:'nope',lat:1,lon:1,ts:1},previous:[{trigger:'manual',lat:1,lon:2,ts:5,label:'x'},null,
  {trigger:'catch',lat:200,lon:0,ts:1},{trigger:'pgp',lat:3,lon:4,ts:7},{trigger:'catch',lat:1,lon:1,ts:-1},'junk',
  {trigger:'catch',lat:5,lon:5,ts:9},{trigger:'catch',lat:6,lon:6,ts:9},{trigger:'catch',lat:7,lon:7,ts:9}]});
assert.equal(mixed.current,null);assert.deepEqual([...mixed.previous.map(r=>r.lat)],[1,3,5,6]);
for(const bad of [null,'x',42,[],{previous:'x'}])assert.equal(P.History.fromJSON(bad).list().length,0);
console.log('Cooldown curve, distance, remaining time, formats, counting rules and history tests passed.');
