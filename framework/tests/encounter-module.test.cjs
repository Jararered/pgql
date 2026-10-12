const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sessions=[],events=[],timers=[];
const context=vm.createContext({send:e=>events.push(e),setTimeout:fn=>{timers.push(fn);return fn;},clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1);},
  PgqlGameEncounters:class {
    constructor(ctx){this.disposed=false;ctx.cleanup(()=>{this.disposed=true;});sessions.push(this);}
    install(feature){this.feature=feature;return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
  }
});
for(const file of ['runtime.js','core/encounter-module.js','modules/instant-catch.js','modules/perfect-throw.js','modules/headshot.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
const tick=()=>new Promise(setImmediate),runTimers=()=>{for(const fn of timers.splice(0))fn();};
(async()=>{
 const q=context.Qol;
 assert.deepEqual(Array.from(q.describe(),m=>m.id),['instant-catch','perfect-throw','headshot']);
 assert(q.describe().every(m=>!m.enabled));
 q.enable('perfect-throw');runTimers();assert.equal(sessions[0].feature,'perfect-throw');
 assert.equal((await q.invoke('perfect-throw',{action:'status'})).phase,'initializing');
 sessions[0].resolve();await tick();assert.equal((await q.invoke('perfect-throw',{action:'status'})).phase,'ready');
 assert.equal(q.describe().find(m=>m.id==='headshot').enabled,false);
 q.enable('headshot');runTimers();sessions[1].resolve();await tick();
 q.disable('perfect-throw');assert(sessions[0].disposed);assert(q.describe().find(m=>m.id==='headshot').enabled);
 // Disable before installation must not install hooks later.
 q.enable('instant-catch');q.disable('instant-catch');runTimers();assert.equal(sessions.length,2);
 // A rejected old generation cannot disable a newly enabled instance.
 q.enable('instant-catch');runTimers();const old=sessions[2];
 q.disable('instant-catch');q.enable('instant-catch');runTimers();
 old.reject(Error('old failure'));await tick();assert(q.describe().find(m=>m.id==='instant-catch').enabled);
 sessions[3].resolve();await tick();assert.equal((await q.invoke('instant-catch',{action:'status'})).phase,'ready');
 // Failed metadata check rolls back the current generation and exposes a log.
 q.enable('perfect-throw');runTimers();sessions[4].reject(Error('Unsupported game'));
 await tick();assert(!q.describe().find(m=>m.id==='perfect-throw').enabled);assert(sessions[4].disposed);
 assert(events.some(e=>e.message==='Perfect Throw unavailable'&&e.details.error.includes('Unsupported game')));
 q.disable('headshot');q.disable('instant-catch');assert(sessions.every(s=>s.disposed));
 console.log('Encounter module independence, async cancellation, failure rollback and stale-generation tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
