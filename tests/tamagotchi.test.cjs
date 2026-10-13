const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup() {
  const timers=new Map();let serial=0,probes=0;
  const context=vm.createContext({send:()=>{},setTimeout,clearTimeout,
    setInterval:fn=>{const id=++serial;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id),
    Il2Cpp:{perform:async fn=>{probes++;return fn();},application:{version:'0.431.0'}}});
  for(const file of ['runtime.js','core/automation.js','core/buddy-care.js','core/game-adapters.js','adapters/game-buddy.js','modules/tamagotchi.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
  return {context,timers,get probes(){return probes;}};
}
const defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
(async()=>{
  const f=setup(),{Qol,PgqlGameAdapters:Adapters}=f.context;
  Qol.enable('tamagotchi');
  const metadata=Qol.describe()[0];assert.equal(metadata.config.battle,false);assert.equal(metadata.config.usePinap,false);
  assert.equal(metadata.availability,'experimental');
  const unavailable=await Qol.invoke('tamagotchi',{action:'preview'});
  assert.equal(unavailable.ready,false);assert.match(unavailable.reason,/not verified/);
  await Qol.invoke('tamagotchi',{action:'run'});assert.equal(f.probes,0,'unbound adapter must not probe managed runtime');
  Qol.disable('tamagotchi');assert.equal(f.timers.size,0);

  let writes=0,cleanup=0;
  const entered=defer(),settle=defer();
  Adapters.register('buddy','0.431.0',ctx=>{
    ctx.cleanup(()=>cleanup++);
    return {snapshot:async()=>({ready:true,identity:'private-account/buddy/day',actions:{play:{supported:true,eligible:true,key:'one'}}}),
      execute:async(action,request)=>{assert.equal(action,'play');assert.equal(request.identity,'private-account/buddy/day');writes++;entered.resolve();return settle.promise;}};
  });
  Qol.enable('tamagotchi');
  const preview=await Qol.invoke('tamagotchi',{action:'preview'});
  assert(!JSON.stringify(preview).includes('private-account'));
  const running=Qol.invoke('tamagotchi',{action:'run'});await entered.promise;
  Qol.disable('tamagotchi');assert.equal(cleanup,1);
  assert.throws(()=>Qol.enable('tamagotchi'),/settling/);
  settle.resolve({outcome:'success'});assert.equal((await running).phase,'cancelled');
  Qol.enable('tamagotchi');await Qol.invoke('tamagotchi',{action:'run'});
  assert.equal(writes,1,'receipt survives module re-enable');
  await Qol.invoke('tamagotchi',{action:'cancel'});
  await [...f.timers.values()][0]();
  assert.equal((await Qol.invoke('tamagotchi',{action:'status'})).phase,'cancelled');
  Qol.disable('tamagotchi');assert.equal(f.timers.size,0);

  const g=setup();g.context.PgqlRole='pgp';assert.throws(()=>g.context.Qol.enable('tamagotchi'),/main game/);
  const h=setup();h.context.PgqlGameAdapters.register('buddy','0.430.0',()=>{throw Error('must not run');});
  h.context.Qol.enable('tamagotchi');
  const wrongVersion=await h.context.Qol.invoke('tamagotchi',{action:'run'});
  assert.equal(wrongVersion.phase,'stopped');assert.match(wrongVersion.reason,/No verified/);
  h.context.Qol.disable('tamagotchi');
  console.log('Tamagotchi settings, unbound/version gates, preview privacy, pause and re-enable lifecycle tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
