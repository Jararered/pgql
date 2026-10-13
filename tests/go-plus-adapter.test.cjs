const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// ---- mocked Frida globals -------------------------------------------------
const events=[],nativeCalls=[],timers=[],mainJobs=[];
const bytesByAddress=new Map();
const attachments=new Map(),replacements=new Map(),presets=new Map();
let uid=0,gameVersion='0.431.0';
const storage=new Map(); // absolute offset -> scalar register value
function mkPtr(base=0){
  const p={base};
  p.isNull=()=>base===0;
  p.toInt32=()=>base|0;
  p.readU8=()=>bytesByAddress.get(base)||0;
  p.readByteArray=n=>Uint8Array.from({length:n},(_,i)=>bytesByAddress.get(base+i)||0).buffer;
  p.toString=()=>'0x'+Number(base).toString(16);
  p.add=n=>mkPtr(base+n);
  p.sub=n=>mkPtr(base-n);
  p.readPointer=()=>mkPtr(storage.get(base)||0);
  p.readU64=()=>storage.get(base)||0;
  p.readU32=()=>(storage.get(base)||0)>>>0;
  p.writePointer=v=>{storage.set(base,v.base);return p;};
  p.writeU8=v=>{storage.set(base,v&0xff);bytesByAddress.set(base,v&0xff);return p;};
  p.writeInt=v=>{storage.set(base,v|0);return p;};
  p.writeByteArray=bytes=>{p.bytes=[...new Uint8Array(bytes instanceof ArrayBuffer?bytes:Uint8Array.from(bytes||[]).buffer)];p.bytes.forEach((v,i)=>bytesByAddress.set(base+i,v));return p;};
  p.equals=o=>!!(o&&o.base===base);
  return p;
}
const ptr=v=>mkPtr(Number(v));
const ids=new Map();
function symbolId(name){if(!ids.has(name))ids.set(name,++uid);return ids.get(name);}
// libholoholo exports -> stable unique addresses
const LIB={findExportByName:name=>mkPtr(symbolId(name))};
const NativeFunction=function(address,ret,args){
  // Real Frida rejects untyped variadic tails and mismatched argument counts.
  assert(!args.includes('...')||args.indexOf('...')<args.length-1,'variadic NativeFunction needs typed arguments');
  const invoke=(...callArgs)=>{
    assert.equal(callArgs.length,args.filter(a=>a!=='...').length,'bad argument count');
    args.forEach((type,index)=>{if(['int','uint8','uint32','bool'].includes(type))assert.equal(typeof callArgs[index],'number','native integer argument required');});
    nativeCalls.push({address,ret,callArgs});
    if(presets.has(address.base)){const value=presets.get(address.base);return typeof value==='function'?value(...callArgs):value;}
    if(ret==='pointer')return mkPtr(++uid);
    if(ret==='bool')return false;
    if(ret==='int')return 0;
    return undefined;
  };
  const fn=invoke;
  fn.address=address;fn.ret=ret;fn.args=args;
  fn.call=invoke;
  return fn;
};
const context=vm.createContext({
  ptr,int64:value=>value,Java:{scheduleOnMainThread:fn=>mainJobs.push(fn)},
  Process:{pointerSize:8,getModuleByName:name=>name==='libholoholo.so'?LIB:null},
  NativeFunction,
  NativeCallback:function(fn,ret,args){const wrapped=(...a)=>{if(wrapped.impl)return wrapped.impl(...a);};wrapped.impl=fn;wrapped.address=mkPtr(++uid);wrapped.ret=ret;wrapped.args=args;return wrapped;},
  Interceptor:{
    attach:(address,callbacks)=>{attachments.set(address.base,callbacks);return {detach:()=>attachments.delete(address.base)}},
    replace:(address,replacement)=>{replacements.set(address.base,replacement)},
    revert:address=>replacements.delete(address.base),
    flush(){events.push({flush:true})}
  },
  Memory:{allocUtf8String:()=>mkPtr(++uid),alloc:n=>mkPtr(uid+=n+32)},
  PgqlPackageVersion:async()=>gameVersion,
  Qol:{disable:feature=>events.push({disable:feature})},
  setTimeout:(fn)=>{timers.push(fn);return fn;},
  clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1);}
});
const base=path.join(__dirname,'../agent');
for(const file of ['core/jni-helper.js','core/device-simulator.js','core/pgp-manager.js','adapters/game-go-plus.js'])
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
const Adapter=context.PgqlGameGoPlus;
// JNIEnv for the "main" thread: env.readPointer() must yield the function table.
const table=mkPtr(++uid);
const env=mkPtr(++uid);storage.set(env.base,table.base);
presets.set(symbolId('_ZN3pgp7android3jni6GetEnvEPKc'),env);
// table slots used by the helper: fixed, published JNI indices
for(const slot of [6,16,17,19,20,21,22,23,30,31,33,36,63,113,116,167,172,174,176,208,228])storage.set(table.base+slot*8,++uid);

function loggedCtx(logs=[]){return {log:(message,details)=>logs.push({message,details}),cleanup:()=>{}};}
function newAdapter(){
  const adapter=new Adapter({ctxLog:[]});
  return adapter;
}
const tick=()=>new Promise(setImmediate);
(async()=>{
  const logs=[];
  const adapter=new Adapter(loggedCtx(logs));
  assert.equal(adapter.autoCatch,true);
  assert.equal(adapter.autoSpin,true);
  assert.equal(adapter.autoReconnect,true);
  adapter.setAutoCatch(false);adapter.setAutoSpin(false);
  assert.equal(adapter.autoCatch,false);assert.equal(adapter.autoSpin,false);
  adapter.setAutoCatch(true);adapter.setAutoSpin(true);

  // Version gate fails cleanly before any hook is installed.
  const gated=new Adapter(loggedCtx());
  gameVersion='9.9.9';
  await assert.rejects(()=>gated.install('virtual-go-plus'),/0\.431\.0/);
  assert.equal(attachments.size,0);assert.equal(replacements.size,0);
  gameVersion='0.431.0';
  gated.dispose();

  await adapter.install('virtual-go-plus');
  assert(logs.some(log=>log.message==='Virtual GO Plus armed'));
  assert.equal(attachments.size,6); // scanning, pokemon nearby, pokestop nearby, capture

  // ---- device advertisement ---------------------------------------------
  const driverPtr=mkPtr(++uid);
  storage.set(driverPtr.base+176,++uid); // SfidaBluetoothDriver jobject offset
  const scanCb=attachments.get(symbolId('_ZN3pgp7android22AndroidBluetoothDriver23StartScanningWithFilterENSt6__ndk16vectorINS2_12basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEENS7_IS9_EEEES9_NS2_8functionIFvNS2_10shared_ptrINS_10PeripheralEEEEEE'));
  assert(scanCb,'scanning hook installed');
  scanCb.onEnter([driverPtr]);
  scanCb.onLeave();
  assert(logs.some(log=>log.message==='Virtual GO Plus advertised to the game'));
  const scanResults=nativeCalls.filter(call=>call.address.base&&(call.callArgs||[]).length>=4);
  assert(scanResults.length>0);

  // ---- instant pairing ----------------------------------------------------
  const devicePtr=mkPtr(++uid),peripheralPtr=mkPtr(++uid);
  const connectCb=replacements.get(symbolId('_ZN3pgp5sfida6Device7ConnectENSt6__ndk18functionIFvNS0_15PairingResponseENS_14BluetoothErrorEEEE'));
  assert(connectCb,'device connect replacement installed');
  connectCb(devicePtr,ptr(0));
  assert.equal(adapter.deviceNative.base,devicePtr.base);
  const peripheralCb=replacements.get(symbolId('_ZN3pgp7android17AndroidPeripheral7ConnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE'));
  assert(peripheralCb,'peripheral connect replacement installed');
  peripheralCb(peripheralPtr,ptr(0));
  assert.equal(storage.get(devicePtr.base+528),8); // connected state
  assert(nativeCalls.some(call=>call.address.base===symbolId('_ZN3pgp5sfida6Device18ConnectionCompleteENS0_15PairingResponseENS_14BluetoothErrorE')&&call.callArgs[0].base===devicePtr.base));
  assert(logs.some(log=>log.message==='Virtual GO Plus paired'));

  // ---- autocatch ---------------------------------------------------------
  const modulePtr=mkPtr(++uid),responsePtr=mkPtr(++uid);
  storage.set(modulePtr.base+16,++uid); // PgpManagerAndroid pointer
  storage.set(responsePtr.base+16,++uid); // spawnpoint std::string data pointer
  storage.set(responsePtr.base+40,1234); // encounter id u64
  storage.set(responsePtr.base+48,13);   // encounter type
  const encounterCb=attachments.get(symbolId('_ZN3pgp5sfida6Module20ProcessPokemonNearbyERK19SfidaUpdateResponse'));
  assert(encounterCb,'encounter hook installed');
  encounterCb.onEnter([modulePtr,responsePtr]);
  encounterCb.onLeave();
  const catchCall=nativeCalls.find(call=>call.address.base===symbolId('_ZN3pgp5sfida6Module12CatchPokemonENSt6__ndk112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEl13EncounterType'));
  assert(catchCall,'CatchPokemon invoked');
  assert.equal(catchCall.callArgs[0].base,modulePtr.base);
  assert.equal(catchCall.callArgs[1].base,storage.get(responsePtr.base+16)-2);
  assert.equal(catchCall.callArgs[2],1234);
  assert.equal(catchCall.callArgs[3],13);
  assert(nativeCalls.some(call=>call.address.base===symbolId('_ZN3pgp7android17PgpManagerAndroid22SendEncounterIdMessageEl')&&call.callArgs[1]===1234));
  assert(logs.some(log=>log.message==='Virtual GO Plus catch requested'));
  // auto-catch off suppresses the native catch
  const before=nativeCalls.length;
  adapter.setAutoCatch(false);
  encounterCb.onEnter([modulePtr,responsePtr]);
  encounterCb.onLeave();
  assert.equal(nativeCalls.length,before);
  adapter.setAutoCatch(true);

  // ---- autospin ----------------------------------------------------------
  const stopCb=attachments.get(symbolId('_ZN3pgp5sfida6Module21ProcessPokestopNearbyERK19SfidaUpdateResponse'));
  assert(stopCb,'pokestop hook installed');
  stopCb.onEnter([modulePtr,responsePtr]);
  stopCb.onLeave();
  assert(nativeCalls.some(call=>call.address.base===symbolId('_ZN3pgp5sfida6Module14SearchPokestopERK19SfidaUpdateResponse')&&call.callArgs[0].base===modulePtr.base));
  assert(timers.length===1,'handle update scheduled');
  timers.shift()();
  assert.equal(storage.get(modulePtr.base+270),1);
  assert.equal(storage.get(modulePtr.base+268),0);
  assert(nativeCalls.some(call=>call.address.base===symbolId('_ZN3pgp5sfida6Module12HandleUpdateEv')&&call.callArgs[0].base===modulePtr.base));
  assert(logs.some(log=>log.message==='Virtual GO Plus spin requested'));

  // ---- capture response flush + timestamp --------------------------------
  const captureCb=attachments.get(symbolId('_ZN3pgp5sfida6Module22ProcessCaptureResponseERK20SfidaCaptureResponse'));
  assert(captureCb,'capture hook installed');
  captureCb.onEnter([modulePtr]);
  captureCb.onLeave();
  assert(timers.length===1);
  timers.shift()();
  assert(nativeCalls.some(call=>call.address.base===symbolId('_ZN3pgp7android17PgpManagerAndroid26SendUpdateTimestampMessageEl')));
  assert.equal(storage.get(modulePtr.base+270),1);

  // Interleaved/reentrant calls keep each invocation's response and module.
  const invocationA={},invocationB={},invocationStop={};
  const otherModule=mkPtr(++uid),otherResponse=mkPtr(++uid);
  storage.set(otherModule.base+16,++uid);
  storage.set(otherResponse.base+16,++uid);
  storage.set(otherResponse.base+40,5678);
  storage.set(otherResponse.base+48,2);
  encounterCb.onEnter.call(invocationA,[modulePtr,responsePtr]);
  encounterCb.onEnter.call(invocationB,[otherModule,otherResponse]);
  stopCb.onEnter.call(invocationStop,[otherModule,otherResponse]);
  encounterCb.onLeave.call(invocationB);
  stopCb.onLeave.call(invocationStop);
  encounterCb.onLeave.call(invocationA);
  const catches=nativeCalls.filter(call=>call.address.base===catchCall.address.base).slice(-2);
  assert.equal(catches[0].callArgs[2],5678);
  assert.equal(catches[1].callArgs[2],1234);
  assert.equal(catches[1].callArgs[0].base,modulePtr.base);
  timers.shift()();
  assert.equal(adapter.status().counters.catchRequests,3);
  assert.equal(adapter.status().counters.spinRequests,2);
  assert.equal(adapter.status().connected,true);
  // Missing device state must pass peripheral connection to the original.
  adapter.deviceNative=null;
  const peripheralSymbol='_ZN3pgp7android17AndroidPeripheral7ConnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE';
  peripheralCb(peripheralPtr,ptr(0));
  assert(nativeCalls.some(call=>call.address.base===symbolId(peripheralSymbol)));

  // Capture a native StartSession call, including an owned long string.
  const sessionSymbol='_ZN3pgp5sfida6Module12StartSessionERKNSt6__ndk112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEESA_bSA_li';
  const sessionCb=attachments.get(symbolId(sessionSymbol));
  function shortString(text){const value=context.Memory.alloc(24);value.writeByteArray([text.length*2,...Buffer.from(text),0]);return value;}
  const token=context.Memory.alloc(24),tokenData=context.Memory.alloc(32);
  token.writeU8(1);storage.set(token.base+8,31);token.add(16).writePointer(tokenData);
  tokenData.writeByteArray(Buffer.alloc(31,65));
  const mac=shortString('98:B6:E9:11:E1:46'),extra=shortString('test');
  sessionCb.onEnter([modulePtr,token,mac,ptr(1),extra,ptr(0),ptr(3)]);
  const saved=adapter.reconnectSession;
  assert.equal(saved.strings[0].data.readU8(),65);
  tokenData.writeU8(66);mac.add(1).writeU8(67);
  assert.equal(saved.strings[0].data.readU8(),65,'long data must be owned');
  assert.equal(saved.strings[1].value.add(1).readU8(),57,'short data must be owned');

  // Reconnect off finishes teardown and schedules nothing.
  adapter.setAutoReconnect(false);
  const finishDisconnectSymbol='_ZN3pgp5sfida6Device22FinishDeviceDisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE';
  const finishCb=replacements.get(symbolId(finishDisconnectSymbol));
  finishCb(peripheralPtr,ptr(0));
  assert(nativeCalls.some(call=>call.address.base===symbolId(finishDisconnectSymbol)));
  assert.equal(timers.length,0);
  assert.equal(adapter.status().connected,false);

  // Turning reconnect on while disconnected schedules on the service thread.
  adapter.setAutoReconnect(true);
  assert.equal(timers.length,1);
  timers.shift()();assert.equal(mainJobs.length,1);
  assert(!nativeCalls.some(c=>c.address.base===symbolId(sessionSymbol)));
  mainJobs.shift()();
  const sessionCall=nativeCalls.find(c=>c.address.base===symbolId(sessionSymbol));
  assert.equal(sessionCall.callArgs[0].base,modulePtr.base);
  assert.equal(sessionCall.callArgs[1].base,saved.strings[0].value.base);
  assert.equal(sessionCall.callArgs[3],1);
  assert.equal(sessionCall.callArgs[6],3);
  assert.equal(adapter.status().counters.reconnectAttempts,1);
  assert.equal(timers.length,1,'retry until pairing completes');
  adapter.deviceNative=devicePtr;peripheralCb(peripheralPtr,ptr(0));
  assert.equal(timers.length,0,'pairing cancels retries');

  // A setting change cancels even a retry already queued on the main thread.
  finishCb(peripheralPtr,ptr(0));timers.shift()();
  adapter.setAutoReconnect(false);
  const callsBefore=nativeCalls.length;mainJobs.shift()();
  assert.equal(nativeCalls.length,callsBefore);
  // Native module destruction invalidates saved handles and pending retries.
  adapter.setAutoReconnect(true);assert.equal(timers.length,1);
  attachments.get(symbolId('_ZN3pgp5sfida6ModuleD2Ev')).onEnter([modulePtr]);
  assert.equal(timers.length,0);assert.equal(adapter.reconnectSession,null);

  // ---- dispose reverts and releases --------------------------------------
  adapter.dispose();
  assert.equal(attachments.size,0);
  assert.equal(replacements.size,0);
  assert.equal(timers.length,0);
  assert(events.some(event=>event.flush===true));
  // Every retained global JNI ref is released, and locals live inside a frame.
  const jniSlot=slot=>storage.get(table.base+slot*8);
  assert.equal(nativeCalls.filter(c=>c.address.base===jniSlot(21)).length,nativeCalls.filter(c=>c.address.base===jniSlot(22)).length);
  assert.equal(nativeCalls.filter(c=>c.address.base===jniSlot(19)).length,1);
  assert.equal(nativeCalls.filter(c=>c.address.base===jniSlot(20)).length,1);
  // JNI A calls always receive a jvalue array, including primitive arguments.
  const scanResultCall=nativeCalls.find(c=>c.address.base===jniSlot(30)&&c.callArgs[3].base&&storage.get(c.callArgs[3].base+16)===-51);
  assert(scanResultCall,'ScanResult uses jvalue slots for RSSI and timestamp');
  assert.equal(storage.get(scanResultCall.callArgs[3].base+24),0);

  // ---- status action -----------------------------------------------------
  const statusAdapter=new Adapter(loggedCtx());
  await statusAdapter.install('virtual-go-plus');
  const status=statusAdapter.status();
  assert.equal(status.autoCatch,true);
  assert.equal(status.autoSpin,true);
  assert.equal(status.autoReconnect,true);
  assert.equal(status.connected,false);
  statusAdapter.dispose();

  // Failed JNI fabrication must unwind its frame, report failure and disable;
  // it must never log a successful advertisement.
  const failureLogs=[],failed=new Adapter(loggedCtx(failureLogs));
  await failed.install('virtual-go-plus');
  const failedScan=attachments.get(adapter.startScanning.base);
  const framesBefore=nativeCalls.filter(c=>c.address.base===jniSlot(20)).length;
  presets.set(jniSlot(6),ptr(0));
  failedScan.onEnter([driverPtr]);failedScan.onLeave();
  presets.delete(jniSlot(6));
  assert(failureLogs.some(l=>l.message==='Virtual GO Plus hook failed; disabling feature'));
  assert(!failureLogs.some(l=>l.message==='Virtual GO Plus advertised to the game'));
  assert.equal(nativeCalls.filter(c=>c.address.base===jniSlot(20)).length,framesBefore+1);
  timers.shift()();
  assert(events.some(e=>e.disable==='virtual-go-plus'));
  failed.dispose();

  console.log('Virtual GO Plus adapter hook installation, advertisement, pairing, catch, spin, capture, reentrancy, reconnect and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});