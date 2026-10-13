const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/gift-queue.js'),'utf8'),context);
const Queue=context.PgqlGiftQueue;
function adapter(codes,giftCount=10) {
  const calls=[];
  return {calls,preview:async()=>({friendIds:codes.map((_,i)=>String(i)),giftCount}),
    open:async id=>{calls.push(id);return codes[Number(id)];},
    send:async id=>{calls.push(id);return codes[Number(id)];}};
}
(async()=>{
  const a=adapter([1,1,1]);const progress=[];const q=new Queue(a,s=>progress.push(s));
  const summary=await q.run('open');
  assert.equal(summary.phase,'completed');assert.equal(summary.succeeded,3);assert.equal(summary.completed,3);
  assert.deepEqual(a.calls,['0','1','2']);
  assert.equal(progress[0].phase,'previewing');assert.equal(progress.at(-1).phase,'completed');
  summary.succeeded=99;assert.equal(q.status().succeeded,3);
  let refreshes=0;a.preview=async()=>{refreshes++;return {friendIds:['0'],giftCount:1};};
  await q.preview();await q.run('send');assert.equal(refreshes,2);
  for(const [mode,codes,skipped] of [['open',[5,1],1],['send',[3,5,6,1],3]]) {
    const a=adapter(codes);const s=await new Queue(a).run(mode);
    assert.equal(s.skipped,skipped);assert.equal(s.succeeded,1);assert.equal(s.phase,'completed');
  }
  for(const [mode,code,reason] of [['open',3,'Bag is full'],['open',4,'Daily gift'],['open',2,'unsuccessful'],['open',99,'Unrecognized'],['send',4,'No gifts'],... [2,7,8,99].map(code=>['send',code,'unsuccessful'])]) {
    const a=adapter([code,1]);const s=await new Queue(a).run(mode);
    assert.equal(s.phase,'stopped');assert.equal(s.failed,1);assert(s.reason.includes(reason));assert.equal(a.calls.length,1);
  }
  const empty=adapter([1,1],0);assert.equal((await new Queue(empty).run('send')).phase,'stopped');assert.equal(empty.calls.length,0);
  const depleted=adapter([1,1],1);const depletedStatus=await new Queue(depleted).run('send');
  assert.equal(depletedStatus.succeeded,1);assert.equal(depletedStatus.phase,'stopped');assert.equal(depleted.calls.length,1);
  const openingPreview=adapter([1,1]);const preflight=[];
  openingPreview.prepare=async(mode,ids)=>{preflight.push(mode);assert.equal(ids.length,2);};
  openingPreview.incomingCount=async()=>{preflight.push('count');return 1;};
  const previewQueue=new Queue(openingPreview);const openPreview=await previewQueue.preview('open');
  assert.equal(openPreview.incomingGifts,1);assert.deepEqual(preflight,['open','count']);assert.equal(openingPreview.calls.length,0);
  await previewQueue.preview('send');assert.equal(preflight.length,2);
  // Cancellation must wait for the current request and prevent the next call.
  const delayed=adapter([1,1]);let settle,started;
  const began=new Promise(resolve=>{started=resolve;});
  delayed.open=id=>{delayed.calls.push(id);started();return new Promise(resolve=>{settle=resolve;});};
  const cancellable=new Queue(delayed);const running=cancellable.run('open');await began;
  await assert.rejects(cancellable.run('send'),/busy/);await assert.rejects(cancellable.preview(),/busy/);
  cancellable.cancel();assert.equal(cancellable.status().phase,'running');settle(1);
  const cancelled=await running;assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.succeeded,1);assert.equal(delayed.calls.length,1);
  delayed.open=async()=>1;assert.equal((await cancellable.run('open')).phase,'completed');
  // Read-only preparation must finish before any mutating action, and cancellation
  // during preparation must leave every friend untouched.
  const preparing=adapter([1,1]);let finishPrepare,prepareStarted;
  const preparationBegan=new Promise(resolve=>{prepareStarted=resolve;});
  preparing.prepare=(mode,ids)=>{assert.equal(mode,'open');assert.equal(ids.length,2);prepareStarted();return new Promise(resolve=>{finishPrepare=resolve;});};
  const prepareQueue=new Queue(preparing);const preparingRun=prepareQueue.run('open');
  await preparationBegan;assert.equal(preparing.calls.length,0);prepareQueue.cancel();finishPrepare();
  assert.equal((await preparingRun).phase,'cancelled');assert.equal(preparing.calls.length,0);
  const failed=adapter([1,1]);failed.send=async id=>{failed.calls.push(id);throw Error('transport');};
  const exception=await new Queue(failed).run('send');assert.equal(exception.ambiguousAction,true);assert.equal(exception.failed,1);assert.equal(failed.calls.length,1);assert(exception.reason.includes('without retry'));
  const timed=adapter([1,1]);timed.open=id=>{timed.calls.push(id);return new Promise(()=>{});};
  const timedQueue=new Queue(timed,()=>{},{timeoutMs:5});const timeout=await timedQueue.run('open');
  assert.equal(timeout.ambiguousAction,true);assert(timeout.reason.includes('timed out'));assert.equal(timed.calls.length,1);
  await assert.rejects(timedQueue.run('open'),/still be settling/);
  const invalid=adapter([1]);invalid.preview=async()=>({friendIds:['duplicate','duplicate'],giftCount:1});
  const invalidQueue=new Queue(invalid);assert.equal((await invalidQueue.run('open')).phase,'stopped');assert.equal(invalid.calls.length,0);
  invalid.preview=async()=>({friendIds:['0'],giftCount:1});assert.equal((await invalidQueue.run('open')).phase,'completed');
  await assert.rejects(q.run('resolve'),/mode/);
  console.log('Gift queue sequential results, limits, cancellation, busy guard, failures and timeout tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
