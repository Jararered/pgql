const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/transfer-policy.js'),'utf8'),context);
const policy=context.PgqlTransferPolicy,plain=value=>JSON.parse(JSON.stringify(value));

// Minimum IV: empty means 100%, a percentage, or attack/defense/stamina minimums.
assert.deepEqual(plain(policy.parseMinIv('')),{percent:100});
assert.deepEqual(plain(policy.parseMinIv(' 90 ')),{percent:90});
assert.deepEqual(plain(policy.parseMinIv('0')),{percent:0});
assert.deepEqual(plain(policy.parseMinIv('15/14/13')),{attack:15,defense:14,stamina:13});
assert.deepEqual(plain(policy.parseMinIv('0/0/0')),{percent:0});
for(const bad of ['101','-1','abc','9.5','1/2','1/2/3/4','a/b/c'])assert.throws(()=>policy.parseMinIv(bad),/Invalid IV/,bad);
assert.throws(()=>policy.parseMinIv('16/0/0'),/greater than 15/);
assert.deepEqual(plain(policy.parseIgnoreList('132, 201 352,132')),[132,201,352]);
assert.deepEqual(plain(policy.parseIgnoreList('')),[]);
for(const bad of ['ditto','1;2','0','-4','12345'])assert.throws(()=>policy.parseIgnoreList(bad),/Pokédex numbers/,bad);

const defaults={showToast:true,minIv:'100',keepXxs:false,keepXxl:false,transferShiny:false,transferBackground:false,transferShadow:false,ignoreList:'132,201,352,570,999'};
const common={attack:10,defense:10,stamina:10,species:16,size:'other',shiny:false,background:false,shadow:false,wildOrigin:true,specialBall:false,normalClass:true,transferable:true};
const decide=(pokemon={},config={},options)=>policy.decide({...common,...pokemon},{...defaults,...config},options);
const outcome=(...args)=>decide(...args).outcome;

assert.equal(outcome(),'transferred');
// User preferences are checked first and reported separately.
assert.equal(outcome({attack:14,defense:14,stamina:13},{minIv:'90'}),'kept-preference');
assert.equal(outcome({attack:14,defense:13,stamina:13},{minIv:'90'}),'transferred');
assert.equal(outcome({attack:15,defense:1,stamina:1},{minIv:'15/0/0'}),'kept-preference');
assert.equal(outcome({attack:14,defense:15,stamina:15},{minIv:'15/0/0'}),'transferred');
assert.equal(outcome({attack:1,defense:1,stamina:1},{minIv:'0'}),'transferred','0 turns the IV rule off');
assert.equal(outcome({size:'XXS'}),'transferred');
assert.equal(outcome({size:'XXS'},{keepXxs:true}),'kept-preference');
assert.equal(outcome({size:'XXL'},{keepXxs:true}),'transferred');
assert.equal(outcome({size:'XXL'},{keepXxl:true}),'kept-preference');
assert.equal(outcome({species:132}),'kept-preference');
assert.equal(outcome({species:132},{ignoreList:''}),'transferred');
assert.equal(decide({attack:15,defense:15,stamina:15}).reason,'meets minimum IV');
// Built-in protections.
assert.deepEqual(plain(decide({attack:15,defense:15,stamina:15},{minIv:'0'})),{outcome:'kept-protected',reason:'100% IV'});
assert.deepEqual(plain(decide({attack:0,defense:0,stamina:0})),{outcome:'kept-protected',reason:'0% IV'});
assert.equal(outcome({shadow:true}),'kept-protected');
assert.equal(outcome({shadow:true},{transferShadow:true}),'transferred');
assert.equal(outcome({shadow:true,specialBall:true},{transferShadow:true}),'transferred','shadows are always caught with Premier Balls');
assert.equal(outcome({shiny:true}),'kept-protected');
assert.equal(outcome({shiny:true},{transferShiny:true}),'transferred');
assert.equal(outcome({shiny:true,shadow:true},{transferShiny:true,transferShadow:true}),'kept-protected','shiny shadows are always kept');
assert.equal(outcome({background:true}),'kept-protected');
assert.equal(outcome({background:true},{transferBackground:true}),'transferred');
assert.equal(decide({specialBall:true}).reason,'caught with a special ball');
assert.equal(decide({normalClass:false}).reason,'legendary, mythical or ultra beast');
assert.equal(decide({transferable:false}).reason,'not transferable');
assert.equal(decide({wildOrigin:false}).reason,'not a wild catch');
assert.equal(decide({},{},{bypassed:true}).reason,'disabled for this encounter');
assert.equal(outcome({},{},{bypassed:false}),'transferred');
// A stored value that no longer parses stops the decision instead of guessing.
assert.throws(()=>decide({},{minIv:'nope'}),/Invalid IV/);
console.log('Transfer policy IV parsing, ignore list, preference and protection rule tests passed.');
