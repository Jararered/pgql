const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({send:()=>{},setTimeout,clearTimeout});
for(const file of ['runtime.js','core/feature-catalog.js','core/game-adapters.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
const {Qol,PgqlFeatures:Features,PgqlGameAdapters:Adapters}=context;
Qol.register({id:'mass-gift',name:'Existing Mass Gift',enable(){}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/modules/zz-feature-catalog.js'),'utf8'),context);
assert.equal(Features.list().length,32);
assert.equal(Qol.describe().length,32);
assert.equal(Qol.describe().find(x=>x.id==='mass-gift').name,'Existing Mass Gift');
Qol.enable('mass-gift');
for(const feature of Qol.describe().filter(x=>x.availability==='planned')) {
  assert.throws(()=>Qol.enable(feature.id),/not implemented/);
  assert.equal(feature.enabled,false);
  assert(feature.requires.length>0);
}
const row=Qol.describe().find(x=>x.id==='magic-bag');row.requires.push('mutated');
assert.equal(Qol.describe().find(x=>x.id==='magic-bag').requires.includes('mutated'),false);
assert.equal(Adapters.has('buddy'),false);
Adapters.register('buddy','0.431.0',ctx=>({ctx}));
assert.equal(Adapters.has('buddy'),true);
assert.throws(()=>Adapters.create('buddy','0.432.0',{}),/No verified/);
assert.throws(()=>Adapters.register('buddy','0.431.0',()=>{}),/Duplicate/);
const owner={};assert.equal(Adapters.create('buddy','0.431.0',owner).ctx,owner);
console.log('All 32 feature slots, availability gates, metadata isolation and adapter version gates passed.');
