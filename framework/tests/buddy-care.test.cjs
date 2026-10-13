const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({setTimeout,clearTimeout});
for(const file of ['automation','buddy-care'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/'+file+'.js'),'utf8'),context);
const {PgqlBuddyCare:Care,PgqlAutomation:Automation}=context;
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const config=()=>({feed:true,souvenir:true,play:true,snapshot:true,battle:true});
const snapshot=()=>({ready:true,identity:'account/buddy/day',actions:Object.fromEntries(['feed','souvenir','play','snapshot','battle'].map(name=>[name,{supported:true,eligible:true,key:'daily-1'}]))});
function fixture(options={}) {
  const calls=[],state=snapshot();
  const adapter={async snapshot(){return state;},async execute(name){calls.push(name);return {outcome:'success'};}};
  return {state,calls,adapter,care:new Care(adapter,config,()=>{},options)};
}
(async()=>{
  // Stale snapshots cannot repeat a completed interaction, including feeding.
  let f=fixture();let result=await f.care.run();
  assert.equal(result.phase,'waiting');assert.equal(result.busy,false);assert.equal(result.completed,5);
  assert.deepEqual(f.calls,['souvenir','feed','play','snapshot','battle']);
  await f.care.run();assert.equal(f.calls.length,5);
  f.state.identity='account/new-buddy/day';await f.care.run();assert.equal(f.calls.length,10);
  f.state.identity='account/buddy/day';await f.care.run();assert.equal(f.calls.length,10);

  // Feeding is bounded even if every new inventory snapshot supplies a new key.
  f=fixture();let serial=0;
  f.adapter.snapshot=async()=>{f.state.actions.feed.key=String(serial++);return f.state;};
  await f.care.run();assert.equal(f.calls.filter(x=>x==='feed').length,3);

  // A confirmed pre-dispatch skip can retry next pass, never three times in one.
  f=fixture();f.care.config=()=>({feed:true});
  f.adapter.execute=async name=>{f.calls.push(name);return {outcome:'skipped'};};
  await f.care.run();assert.equal(f.calls.length,1);
  f.adapter.execute=async name=>{f.calls.push(name);return {outcome:'success'};};
  await f.care.run();assert.equal(f.calls.length,2);
  await f.care.run();assert.equal(f.calls.length,2);

  // Per-action configuration and unsupported or ineligible capabilities.
  f=fixture();f.care.config=()=>({...config(),feed:false,battle:false});
  f.state.actions.souvenir={supported:false,eligible:false};f.state.actions.play.eligible=false;
  await f.care.run();assert.deepEqual(f.calls,['snapshot']);
  f=fixture();f.adapter.snapshot=async()=>({ready:false,reason:'No buddy'});
  result=await f.care.run();assert.equal(result.reason,'No buddy');assert.equal(result.busy,false);assert.equal(f.calls.length,0);
  f=fixture();f.state.actions.feed.key=null;
  result=await f.care.run();assert.equal(result.phase,'stopped');assert.equal(f.calls.length,0);

  // Buddy/account changes between planning and dispatch stop the current pass.
  f=fixture();let reads=0;
  f.adapter.snapshot=async()=>({...f.state,identity:++reads===1?'one':'two'});
  result=await f.care.run();assert.match(result.reason,/changed/);assert.equal(f.calls.length,0);

  // Configuration is checked anew after a previously submitted action settles.
  f=fixture();const options=config();f.care.config=()=>options;
  f.adapter.execute=async name=>{f.calls.push(name);options.feed=false;options.play=false;options.snapshot=false;options.battle=false;return {outcome:'success'};};
  await f.care.run();assert.deepEqual(f.calls,['souvenir']);

  // Cancelling cannot retract a submitted request; no subsequent action runs.
  f=fixture();const began=deferred(),settle=deferred();
  f.adapter.execute=async name=>{f.calls.push(name);began.resolve();return settle.promise;};
  const run=f.care.run();await began.promise;
  await assert.rejects(f.care.preview(),/busy/);
  await assert.rejects(f.care.run(),/busy/);
  f.care.cancel();settle.resolve({outcome:'success'});
  result=await run;assert.equal(result.phase,'cancelled');assert.equal(result.completed,1);
  await f.care.run();assert.equal(f.calls.length,1);

  // Timeout keeps the global lease until the original operation settles.
  f=fixture({timeoutMs:10});const late=deferred();
  f.adapter.execute=()=>late.promise;
  result=await f.care.run();assert.equal(result.phase,'stopped');assert.match(result.reason,/unknown/);
  assert.equal(Automation.busy('buddy-care'),true);
  await assert.rejects(fixture().care.run(),/busy/);
  late.resolve({outcome:'success'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(Automation.busy('buddy-care'),false);
  const receipts=f.care.receipts;
  f.care.close();await assert.rejects(f.care.run(),/disabled/);
  const resumed=fixture({receipts});await resumed.care.run();
  assert.equal(resumed.calls.includes('souvenir'),false,'ambiguous action must not be replayed by a replacement engine');

  // A rejected/unknown result halts automatic care; explicit resume skips its key.
  f=fixture();f.adapter.execute=async name=>{f.calls.push(name);return {outcome:'unknown'};};
  result=await f.care.run();assert.equal(result.phase,'stopped');assert.equal(f.calls.length,1);
  await f.care.run();assert.equal(f.calls.length,1);
  f.adapter.execute=async name=>{f.calls.push(name);return {outcome:'success'};};
  await f.care.run({resume:true});assert.equal(f.calls.filter(x=>x==='souvenir').length,1);

  // Disabling while a snapshot is pending must never dispatch an action.
  f=fixture();const read=deferred();f.adapter.snapshot=()=>read.promise;
  const closedRun=f.care.run();f.care.close();read.resolve(snapshot());
  result=await closedRun;assert.equal(result.phase,'cancelled');assert.equal(f.calls.length,0);

  // Request cancellation before dispatch and observer errors do not corrupt locks.
  let dispatched=false;
  await assert.rejects(Automation.request('test',()=>{dispatched=true;},{cancelled:()=>true}),/Cancelled/);
  assert.equal(dispatched,false);assert.equal(Automation.busy('test'),false);
  f=fixture();f.care.onProgress=()=>{throw Error('UI gone');};
  assert.equal((await f.care.run()).completed,5);
  console.log('Buddy care eligibility, deduplication, bounds, cancellation, ambiguity and lifecycle tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
