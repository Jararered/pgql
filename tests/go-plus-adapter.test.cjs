const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// ---- mocked Frida globals -------------------------------------------------
const events=[],nativeCalls=[],timers=[];
const attachments=new Map(),replacements=new Map(),presets=new Map();
let uid=0,gameVersion='0.431.0';
const storage=new Map(); // absolute offset -> scalar register value
function mkPtr(base=0){
  const p={base};
  p.isNull=()=>base===0;
  p.toString=()=>'0x'+Number(base).toString(16);
  p.add=n=>mkPtr(base+n);
  p.sub=n=>mkPtr(base-n);
  p.readPointer=()=>mkPtr(storage.get(base)||0);
  p.readU64=()=>storage.get(base)||0;
  p.readU32=()=>(storage.get(base)||0)>>>0;
  p.writeU8=v=>{storage.set(base,v&0xff);return p;};
  p.writeInt=v=>{storage.set(base,v|0);return p;};
  p.writeByteArray=bytes=>{p.bytes=[...(bytes||[])];return p;};
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
    nativeCalls.push({address,ret,callArgs});
    if(presets.has(address.base))return presets.get(address.base);
    if(ret==='pointer')return mkPtr(++uid);
    if(ret==='bool')return false;
    return undefined;
  };
  const fn=invoke;
  fn.address=address;fn.ret=ret;fn.args=args;
  fn.call=invoke;
  return fn;
};
const context=vm.createContext({
  ptr,
  Process:{pointerSize:8,getModuleByName:name=>name==='libholoholo.so'?LIB:null},
  NativeFunction,
  NativeCallback:function(fn,ret,args){const wrapped=(...a)=>{if(wrapped.impl)return wrapped.impl(...a);};wrapped.impl=fn;wrapped.address=mkPtr(++uid);wrapped.ret=ret;wrapped.args=args;return wrapped;},
  Interceptor:{
    attach:(address,callbacks)=>{attachments.set(address.base,callbacks);return {detach:()=>attachments.delete(address.base)}},
    replace:(address,replacement)=>{replacements.set(address.base,replacement)},
    revert:address=>replacements.delete(address.base),
    flush(){events.push({flush:true})}
  },
  Memory:{allocUtf8String:()=>mkPtr(++uid),alloc:n=>mkPtr(++uid)},
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
for(const slot of [6,16,17,21,22,23,28,31,33,34,61,113,114,167,172,174,176,208,228])storage.set(table.base+slot*8,++uid);

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
  assert.equal(attachments.size,5); // scanning, pokemon nearby, pokestop nearby, capture, distance (pairing uses replace)

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
  assert(logs.some(log=>log.message==='Virtual GO Plus caught'));
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
  assert(logs.some(log=>log.message==='Virtual GO Plus spun'));

  // ---- capture response flush + timestamp --------------------------------
  const captureCb=attachments.get(symbolId('_ZN3pgp5sfida6Module22ProcessCaptureResponseERK20SfidaCaptureResponse'));
  assert(captureCb,'capture hook installed');
  captureCb.onEnter([modulePtr]);
  captureCb.onLeave();
  assert(timers.length===1);
  timers.shift()();
  assert(nativeCalls.some(call=>call.address.base===symbolId('_ZN3pgp7android17PgpManagerAndroid26SendUpdateTimestampMessageEl')));
  assert.equal(storage.get(modulePtr.base+270),1);

  // ---- distance floor ----------------------------------------------------
  const distanceCb=attachments.get(symbolId('_ZN4util8location8Location10DistanceToERS1_'));
  assert(distanceCb,'distance hook installed');
  const near={toInt32:()=>5,replaced:null,replace:v=>{near.replaced=v}};
  distanceCb.onLeave(near);assert.equal(near.replaced,20.1);
  const far={toInt32:()=>900,replaced:null,replace:v=>{far.replaced=v}};
  distanceCb.onLeave(far);assert.equal(far.replaced,null);

  // ---- reconnect off routes through the original finish-disconnect -------
  adapter.setAutoReconnect(false);
  const finishDisconnectSymbol='_ZN3pgp5sfida6Device22FinishDeviceDisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE';
  const finishCb=replacements.get(symbolId(finishDisconnectSymbol));
  finishCb(peripheralPtr,ptr(0));
  assert(nativeCalls.some(call=>call.address.base===symbolId(finishDisconnectSymbol)));
  // With reconnect on, disconnect teardown goes through Device::Disconnect.
  const beforeDisconnect=nativeCalls.filter(call=>call.address.base===symbolId('_ZN3pgp5sfida6Device10DisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE')).length;
  adapter.setAutoReconnect(true);
  finishCb(peripheralPtr,ptr(0));
  assert.equal(nativeCalls.filter(call=>call.address.base===symbolId('_ZN3pgp5sfida6Device10DisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE')).length,beforeDisconnect+1);

  // ---- dispose reverts and releases --------------------------------------
  adapter.dispose();
  assert.equal(attachments.size,0);
  assert.equal(replacements.size,0);
  assert.equal(timers.length,0);
  assert(events.some(event=>event.flush===true));
  // global refs handed to the game were released
  const freedRefs=nativeCalls.filter(call=>call.address.base&&call.address.base===symbolId('')||false);
  assert.equal(freedRefs.length,0);

  // ---- status action -----------------------------------------------------
  const statusAdapter=new Adapter(loggedCtx());
  await statusAdapter.install('virtual-go-plus');
  const status=statusAdapter.status();
  assert.equal(status.autoCatch,true);
  assert.equal(status.autoSpin,true);
  assert.equal(status.autoReconnect,true);
  assert.equal(status.connected,false);
  statusAdapter.dispose();

  console.log('Virtual GO Plus adapter hook installation, advertisement, pairing, catch, spin, capture, distance, reconnect and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});