const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/catch-policy.js'),'utf8'),context);
const policy=context.PgqlCatchPolicy;
const plain=value=>JSON.parse(JSON.stringify(value));

// Ordinary balls only, mapped to the game's item numbers.
assert.deepEqual(plain(policy.balls.map(b=>[b.key,b.item,b.id])),[['poke','PokeBall',1],['great','GreatBall',2],['ultra','UltraBall',3]]);
assert.equal(policy.parse(' Great ').id,2);
for(const bad of ['master','premier','','off'])assert.throws(()=>policy.parse(bad),/Unknown ball/);
assert.equal(policy.key(3),'ultra');assert.equal(policy.key(4),null,'Master Ball is never remembered');assert.equal(policy.key(5),null);

// The preferred ball when in stock, otherwise the cheapest one in stock.
const pick=(preferred,counts)=>{const r=policy.pickBall({preferred,counts});return r.ball?[r.ball.key,r.fallback]:[null,r.reason];};
assert.deepEqual(pick('great',{1:5,2:1,3:9}),['great',false]);
assert.deepEqual(pick('great',{1:5,2:0,3:9}),['poke',true]);
assert.deepEqual(pick('poke',{1:0,2:0,3:2}),['ultra',true]);
assert.deepEqual(pick('ultra',{1:0,2:0,3:0,4:7}),[null,'empty'],'Master Ball is never a fallback');
assert.deepEqual(pick('ultra',{}),[null,'empty']);

// The throw mirrors Perfect Throw and Headshot.
assert.deepEqual(plain(policy.throwFor({})),{reticle:1,bullseye:false,spinning:false,missed:false,ar:null});
assert.deepEqual(plain(policy.throwFor({headshot:true})),{reticle:1,bullseye:true,spinning:false,missed:false,ar:null});
const excellent={reticle:0.05,bullseye:true,spinning:true,missed:false,ar:{proximity:0.475,awareness:0,frightened:false}};
assert.deepEqual(plain(policy.throwFor({perfectThrow:true})),excellent);
assert.deepEqual(plain(policy.throwFor({perfectThrow:true,headshot:true})),excellent);

// Catch status names.
assert.equal(policy.outcome('CatchSuccess'),'caught');assert.equal(policy.outcome('CatchFlee'),'fled');
assert.equal(policy.outcome('CatchEscape'),'escaped');assert.equal(policy.outcome('CatchMissed'),'missed');
assert.equal(policy.outcome('CatchError'),'error');assert.equal(policy.outcome('7'),'error');
console.log('Catch policy ball choice, fallback, throw bonuses and outcomes passed.');
