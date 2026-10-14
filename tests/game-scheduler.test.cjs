const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Shared Unity frame scheduler: one hook, per-frame budget, off-frame metadata,
// version capture, map gate and il2cpp readiness after an early attach.
let clock=1000,corlib=false,map=false,inFrame=false,versionReads=0,classScans=0;
const timers=[],hooks=new Map(),performs=[];
const fire=ms=>{for(const timer of timers.splice(0))if(timer.ms===ms)timer.fn();else timers.push(timer);};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const klass=(name,extra={})=>({name,type:{name,object:{name}},methods:[],method:()=>({virtualAddress:'execute'}),...extra});
const types={
  'UnityEngine.UnitySynchronizationContext':klass('UnitySynchronizationContext'),
  'UnityEngine.Object':klass('Object',{methods:[{name:'FindObjectOfType',parameterCount:1,parameters:[{type:{name:'System.Type'}}],
    invoke:()=>({isNull:()=>!map})}]}),
  'Niantic.Holoholo.MapSceneContext':klass('MapSceneContext'),
};
const image={tryClass:name=>types[name]||null,get classes(){classScans++;return [klass('AaBb'),klass('CcDd'),klass('AaBb')];}};
const application={get version(){versionReads++;assert(inFrame,'version must be read on the game thread');return '0.433.0';}};
const context=vm.createContext({
  Date:{now:()=>clock},
  setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},
  clearTimeout:timer=>{const index=timers.indexOf(timer);if(index>=0)timers.splice(index,1);},
  Process:{
    findModuleByName:name=>name==='libil2cpp.so'?{findExportByName:()=> 'il2cpp_get_corlib'}:null,
    getModuleByName:()=>({getExportByName:name=>name}),
  },
  NativeFunction:function(address){return address==='il2cpp_get_corlib'?()=>({isNull:()=>!corlib}):()=>null;},
  Interceptor:{attach:(address,callbacks)=>{hooks.set(address,callbacks);return {detach:()=>hooks.delete(address)};}},
  Il2Cpp:{application,domain:{assemblies:[{image}]},perform:async(fn,flag)=>{performs.push({flag,inFrame});return fn();}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-gifts.js'),'utf8'),context);
const Game=context.PgqlGameGifts;
function module() {
  const cleanups=[],logs=[];
  return {logs,close:()=>{for(const fn of cleanups.reverse())fn();},ctx:{cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details})}};
}
function frame(){inFrame=true;try{hooks.get('execute').onLeave();}finally{inFrame=false;}}
(async()=>{
  const a=module(),b=module();
  const first=new Game(a.ctx),second=new Game(b.ctx);
  const results=[];
  first.main(()=>results.push('a1'));
  await settle();
  assert.equal(hooks.size,0,'nothing binds before il2cpp_init finishes');
  assert.equal(performs.length,0);
  corlib=true;fire(250);await settle();await settle();
  assert.equal(hooks.size,1);
  assert(performs.every(call=>call.flag==='free' && !call.inFrame));
  second.main(()=>results.push('b1'));
  await settle();await settle();
  assert.equal(hooks.size,1,'every adapter shares one frame hook');
  // Budget: jobs that take 4 ms each; the second crosses 6 ms and ends the frame.
  const slow=label=>()=>{clock+=4;results.push(label);};
  first.main(slow('a2'));second.main(slow('b2'));
  await settle();
  frame();
  assert.deepEqual(results,['a1','b1','a2','b2']);
  assert.equal(versionReads,1,'version is captured once, on the game thread');
  assert.equal(context.Il2Cpp.application.version,'0.433.0');assert.equal(versionReads,1);
  results.length=0;
  first.main(slow('a3'));second.main(slow('b3'));first.main(slow('a4'));
  await settle();
  frame();
  assert.deepEqual(results,['a3','b3']);
  frame();
  assert.deepEqual(results,['a3','b3','a4']);
  // A job over one frame is reported.
  first.main(()=>{clock+=20;});await settle();frame();
  assert(a.logs.some(entry=>entry.message==='Slow game-thread job' && entry.details.ms===20));
  // Metadata binding runs off the frame and returns thrown errors as rejections.
  const before=performs.length;
  assert.equal(await first.metadata(()=>{assert(!inFrame);return 'bound';}),'bound');
  await assert.rejects(first.metadata(()=>{throw Error('Unsupported game metadata');}),/Unsupported game metadata/);
  assert(performs.slice(before).every(call=>call.flag==='free' && !call.inFrame));
  // The short-name class index is built once and shared.
  assert.equal(first.named('AaBb').length,2);assert.equal(second.named('CcDd').length,1);assert.equal(first.named('Missing').length,0);
  assert.equal(classScans,1);
  // Map gate polls at most once a second and resolves once the map scene exists.
  let ready=false;second.mapReady().then(()=>{ready=true;});
  await settle();await settle();
  clock+=1000;frame();await settle();assert.equal(ready,false);
  map=true;clock+=500;frame();await settle();assert.equal(ready,false);
  clock+=500;frame();await settle();assert.equal(ready,true);
  // Closing one module rejects its queued jobs and keeps the hook for the other.
  const orphan=first.main(()=>results.push('never'));await settle();
  a.close();
  await assert.rejects(orphan,/Module disabled/);
  assert.equal(hooks.size,1);
  frame();assert(!results.includes('never'));
  await assert.rejects(first.main(()=>{}),/Module disabled/);
  b.close();
  assert.equal(hooks.size,0,'last module detaches the shared hook');
  // A new module rejoins with a fresh hook.
  const c=module(),third=new Game(c.ctx);
  const late=third.main(()=>'again');await settle();await settle();
  assert.equal(hooks.size,1);frame();assert.equal(await late,'again');
  c.close();assert.equal(hooks.size,0);
  console.log('Game scheduler il2cpp wait, shared hook, frame budget, version capture, metadata, class index, map gate and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
