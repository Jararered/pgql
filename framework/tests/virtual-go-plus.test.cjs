const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sessions=[],events=[],timers=[];
const context=vm.createContext({PgqlRole:'pgp',send:e=>events.push(e),setTimeout:fn=>{timers.push(fn);return fn;},clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1);},
  PgqlGameGoPlus:class {
    constructor(ctx){this.disposed=false;this.autoCatch=true;this.autoSpin=true;this.autoReconnect=true;ctx.cleanup(()=>{this.disposed=true;});sessions.push(this);}
    install(feature){this.feature=feature;return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
    setAutoCatch(v){this.autoCatch=!!v;}
    setAutoSpin(v){this.autoSpin=!!v;}
    setAutoReconnect(v){this.autoReconnect=!!v;}
    status(){return {connected:true,autoCatch:this.autoCatch,autoSpin:this.autoSpin,autoReconnect:this.autoReconnect};}
  }
});
for(const file of ['runtime.js','core/go-plus-module.js','modules/virtual-go-plus.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
const tick=()=>new Promise(setImmediate),runTimers=()=>{for(const fn of timers.splice(0))fn();};
(async()=>{
 const q=context.Qol;
 const moduleId='virtual-go-plus';
 assert.equal(JSON.stringify(Array.from(q.describe(),m=>String(m.id))),JSON.stringify([moduleId]));
 const module=q.describe()[0];
 assert.equal(module.name,'Virtual GO Plus');
 assert.equal(JSON.stringify(module.settings.map(s=>[String(s.key),Boolean(s.default)])),JSON.stringify([['auto-catch',true],['auto-spin',true],['auto-reconnect',true]]));
 assert.equal(JSON.stringify(module.actions.map(a=>String(a.id))),JSON.stringify(['status']));
 assert(!module.enabled);
 // Enable applies default settings to the adapter before install resolves.
 q.enable(moduleId);runTimers();assert.equal(sessions.length,1);
 assert.equal(sessions[0].autoCatch,true);assert.equal(sessions[0].autoSpin,true);assert.equal(sessions[0].autoReconnect,true);
 assert.equal((await q.invoke(moduleId,{action:'status'})).phase,'initializing');
 sessions[0].resolve();await tick();
 const ready=await q.invoke(moduleId,{action:'status'});
 assert.equal(ready.phase,'ready');assert.equal(ready.connected,true);
 // Live config changes reach the adapter; a rejected config does not disable.
 q.setConfig(moduleId,'auto-catch',false);assert.equal(sessions[0].autoCatch,false);
 q.setConfig(moduleId,'auto-spin',false);assert.equal(sessions[0].autoSpin,false);
 assert(q.describe().find(m=>m.id===moduleId).enabled);
 // Disable releases the adapter.
 q.disable(moduleId);assert(sessions[0].disposed);
 // Disable before installation must not install hooks later.
 q.enable(moduleId);q.disable(moduleId);runTimers();assert.equal(sessions.length,1);
 // A rejected old generation cannot disable a newly enabled instance.
 q.enable(moduleId);runTimers();const old=sessions[1];
 q.disable(moduleId);q.enable(moduleId);runTimers();
 old.reject(Error('old failure'));await tick();assert(q.describe().find(m=>m.id===moduleId).enabled);
 sessions[2].resolve();await tick();assert.equal((await q.invoke(moduleId,{action:'status'})).phase,'ready');
 // Failed install rolls back the current generation and exposes a log.
 q.disable(moduleId);
 q.enable(moduleId);runTimers();sessions[3].reject(Error('Unsupported game'));
 await tick();assert(!q.describe().find(m=>m.id===moduleId).enabled);assert(sessions[3].disposed);
 assert(events.some(e=>e.message==='Virtual GO Plus unavailable'&&e.details.error.includes('Unsupported game')));
 q.disable(moduleId);
 // In the main game process the module is a front: no adapter, companion status relayed.
 context.PgqlRole=undefined;
 q.enable(moduleId);runTimers();assert.equal(sessions.length,4);
 assert.equal((await q.invoke(moduleId,{action:'status'})).phase,'companion');
 await q.invoke(moduleId,{action:'companion',message:'Virtual GO Plus ready',details:{}});
 assert.equal((await q.invoke(moduleId,{action:'status'})).companion.message,'Virtual GO Plus ready');
 q.disable(moduleId);
 console.log('Virtual GO Plus module settings, live config, async cancellation, failure rollback and stale-generation tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});