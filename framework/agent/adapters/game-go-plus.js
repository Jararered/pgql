'use strict';
// Original Virtual GO Plus adapter. Reproduces the recovered device-simulation
// behavior against the live game through libholoholo.so exports only; the
// struct offsets and mangled names are version-pinned to GO 0.431.0 and
// documented in GOPLUS.md. No recovered code is loaded.
globalThis.PgqlGameGoPlus = class PgqlGameGoPlus {
  constructor(ctx) {
    this.ctx=ctx;
    this.undo=[];
    this.timeouts=[];
    this.closed=false;
    this.failed=false;
    this.autoCatch=true;
    this.autoSpin=true;
    this.autoReconnect=true;
    this.lib=null;
    this.jni=null;
    this.simulator=new PgqlDeviceSimulator();
    this.pgp=null;
    this.bluetoothDriverRef=null;
    this.deviceNative=null;
    this.args0=null;
    this.args1=null;
    ctx.cleanup(()=>this.dispose());
  }
  problem(error) {
    if(this.closed || this.failed)return;
    this.failed=true;
    this.ctx.log('Virtual GO Plus hook failed; disabling feature',{error:String(error)});
    setTimeout(()=>{if(!this.closed)Qol.disable(this.feature);},0);
  }
  attach(address,callbacks) {
    const listener=Interceptor.attach(address,callbacks);
    this.undo.push(()=>listener.detach());
    return listener;
  }
  // Replace a native export; returns the original as a callable NativeFunction.
  replace(address,ret,args,callback) {
    const original=new NativeFunction(address,ret,args);
    Interceptor.replace(address,new NativeCallback(callback,ret,args));
    this.undo.push(()=>Interceptor.revert(address));
    return original;
  }
  releaseDriverRef() {
    if(this.bluetoothDriverRef && this.jni){this.jni.deleteGlobalRef(this.bluetoothDriverRef);}
    this.bluetoothDriverRef=null;
  }
  scheduleHandleUpdate(module) {
    const timer=setTimeout(()=>{
      const index=this.timeouts.indexOf(timer);
      if(index>=0)this.timeouts.splice(index,1);
      if(this.closed || this.failed)return;
      try {
        // Force the sfida module to process pending state changes.
        module.add(270).writeU8(1);
        module.add(268).writeU8(0);
        this.handleUpdate(module);
      }catch(error){this.problem(error);}
    },1500);
    this.timeouts.push(timer);
  }
  async initialize() {
    if(globalThis.PgqlLoadIl2cpp)PgqlLoadIl2cpp();
    const version=Il2Cpp.application.version;
    if(version!=='0.431.0')throw Error('Virtual GO Plus supports game 0.431.0; found '+version);
    this.lib=Process.getModuleByName('libholoholo.so');
    if(!this.lib)throw Error('libholoholo.so is not loaded');
    const sym=name=>{const address=this.lib.findExportByName(name);if(!address)throw Error('Unsupported export: '+name);return address;};
    this.catchPokemon=new NativeFunction(sym('_ZN3pgp5sfida6Module12CatchPokemonENSt6__ndk112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEl13EncounterType'),'void',['pointer','pointer','uint64','uint32']);
    this.searchPokestop=new NativeFunction(sym('_ZN3pgp5sfida6Module14SearchPokestopERK19SfidaUpdateResponse'),'void',['pointer','pointer']);
    this.handleUpdate=new NativeFunction(sym('_ZN3pgp5sfida6Module12HandleUpdateEv'),'void',['pointer']);
    this.deviceConnectComplete=new NativeFunction(sym('_ZN3pgp5sfida6Device18ConnectionCompleteENS0_15PairingResponseENS_14BluetoothErrorE'),'void',['pointer','int','int']);
    this.deviceDisconnect=new NativeFunction(sym('_ZN3pgp5sfida6Device10DisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE'),'void',['pointer','pointer']);
    this.pgp=new PgqlPgpManager(this.lib);
    this.startScanning=sym('_ZN3pgp7android22AndroidBluetoothDriver23StartScanningWithFilterENSt6__ndk16vectorINS2_12basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEENS7_IS9_EEEES9_NS2_8functionIFvNS2_10shared_ptrINS_10PeripheralEEEEEE');
    this.peripheralConnect=sym('_ZN3pgp7android17AndroidPeripheral7ConnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE');
    this.deviceConnect=sym('_ZN3pgp5sfida6Device7ConnectENSt6__ndk18functionIFvNS0_15PairingResponseENS_14BluetoothErrorEEEE');
    this.finishDisconnect=sym('_ZN3pgp5sfida6Device22FinishDeviceDisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE');
    this.processPokemonNearby=sym('_ZN3pgp5sfida6Module20ProcessPokemonNearbyERK19SfidaUpdateResponse');
    this.processPokestopNearby=sym('_ZN3pgp5sfida6Module21ProcessPokestopNearbyERK19SfidaUpdateResponse');
    this.processCaptureResponse=sym('_ZN3pgp5sfida6Module22ProcessCaptureResponseERK20SfidaCaptureResponse');
    this.distanceTo=sym('_ZN4util8location8Location10DistanceToERS1_');
  }
  async install(feature) {
    this.feature=feature;
    await this.initialize();
    if(this.closed)return;
    try {
      this.setupScanningHooks();
      this.setupPairingHooks();
      this.setupEncounterHooks();
      this.setupStopHooks();
      this.setupCaptureHook();
      this.setupDistanceHook();
      Interceptor.flush();
      this.ctx.log('Virtual GO Plus armed',{game:Il2Cpp.application.version});
    }catch(error){this.dispose();throw error;}
  }
  // When the game scans, fabricate a discovered GO Plus device.
  setupScanningHooks() {
    this.attach(this.startScanning,{
      onEnter:args=>{
        if(this.closed || this.failed)return;
        try {
          this.jni=PgqlJniHelper.getEnv(this.lib);
          const driver=args[0].add(176).readPointer();
          if(!driver || driver.isNull())throw Error('Unsupported Sfida bluetooth driver object');
          this.releaseDriverRef();
          this.bluetoothDriverRef=this.jni.newGlobalRef(driver);
          if(!this.bluetoothDriverRef)throw Error('Cannot retain Sfida bluetooth driver');
        }catch(error){this.problem(error);}
      },
      onLeave:()=>{
        if(this.closed || this.failed)return;
        try {
          if(!this.jni || !this.bluetoothDriverRef)return;
          this.simulator.simulateDeviceFound(this.jni,this.bluetoothDriverRef);
          this.ctx.log('Virtual GO Plus advertised to the game');
        }catch(error){this.problem(error);}
      }
    });
  }
  // Instant pairing and the disconnect/reconnect path.
  setupPairingHooks() {
    this.originalDeviceConnect=this.replace(this.deviceConnect,'void',['pointer','pointer'],(devicePtr,callbackPtr)=>{
      if(!this.closed && !this.failed)this.deviceNative=devicePtr;
      this.originalDeviceConnect(devicePtr,callbackPtr);
    });
    this.originalPeripheralConnect=this.replace(this.peripheralConnect,'void',['pointer','pointer'],(peripheralPtr,callbackPtr)=>{
      if(this.closed || this.failed)return ptr(0);
      try {
        if(this.deviceNative && !this.deviceNative.isNull()){
          // Mark the peripheral connected and complete pairing immediately.
          this.deviceNative.add(528).writeInt(8);
          this.deviceConnectComplete(this.deviceNative,0,0);
          this.ctx.log('Virtual GO Plus paired');
        }
      }catch(error){this.problem(error);}
      return ptr(0);
    });
    this.originalFinishDisconnect=this.replace(this.finishDisconnect,'void',['pointer','pointer'],(peripheralPtr,callbackPtr)=>{
      if(this.closed || this.failed){this.originalFinishDisconnect(peripheralPtr,callbackPtr);return;}
      try {
        if(this.autoReconnect){
          // Route the disconnect teardown through the peripheral so the next
          // scan re-pairs the virtual device automatically.
          this.deviceDisconnect(peripheralPtr,callbackPtr);
        }else{
          this.originalFinishDisconnect(peripheralPtr,callbackPtr);
        }
      }catch(error){this.problem(error);}
    });
  }
  // Lightning-fast native catch when a Pokemon appears.
  setupEncounterHooks() {
    this.attach(this.processPokemonNearby,{
      onEnter:args=>{if(this.closed || this.failed)return;this.args0=args[0];this.args1=args[1];},
      onLeave:()=>{
        if(this.closed || this.failed || !this.autoCatch)return;
        try {
          const module=this.args0,response=this.args1;
          const spawnpoint=response.add(16).readPointer().sub(2);
          const id=response.add(40).readU64();
          const type=response.add(48).readU32();
          const manager=module.add(16).readPointer();
          this.pgp.reportEncounterId(manager,id);
          this.catchPokemon(module,spawnpoint,id,type);
          this.ctx.log('Virtual GO Plus caught',{encounterId:String(id),type});
        }catch(error){this.problem(error);}
      }
    });
  }
  // Direct stop interaction when a Pokestop appears.
  setupStopHooks() {
    this.attach(this.processPokestopNearby,{
      onEnter:args=>{if(this.closed || this.failed)return;this.args0=args[0];this.args1=args[1];},
      onLeave:()=>{
        if(this.closed || this.failed || !this.autoSpin)return;
        try {
          this.searchPokestop(this.args0,this.args1);
          this.scheduleHandleUpdate(this.args0);
          this.ctx.log('Virtual GO Plus spun');
        }catch(error){this.problem(error);}
      }
    });
  }
  // Flush module state and keep the accessory session timestamp fresh.
  setupCaptureHook() {
    this.attach(this.processCaptureResponse,{
      onEnter:args=>{if(this.closed || this.failed)return;this.args0=args[0];},
      onLeave:()=>{
        if(this.closed || this.failed)return;
        try {
          this.scheduleHandleUpdate(this.args0);
          const manager=this.args0.add(16).readPointer();
          if(manager && !manager.isNull())this.pgp.sendTimestamp(manager,Date.now());
        }catch(error){this.problem(error);}
      }
    });
  }
  // Keep nearby objects within the GO Plus actionable band.
  setupDistanceHook() {
    this.attach(this.distanceTo,{
      onLeave:retval=>{
        if(this.closed || this.failed)return;
        try {
          if(retval.toInt32()<=20)retval.replace(20.1);
        }catch(error){this.problem(error);}
      }
    });
  }
  setAutoCatch(value){this.autoCatch=!!value;}
  setAutoSpin(value){this.autoSpin=!!value;}
  setAutoReconnect(value){this.autoReconnect=!!value;}
  status() {
    return {
      connected:!!(this.deviceNative && !this.deviceNative.isNull()),
      device:this.deviceNative&&!this.deviceNative.isNull()?this.deviceNative.toString():null,
      autoCatch:this.autoCatch,
      autoSpin:this.autoSpin,
      autoReconnect:this.autoReconnect
    };
  }
  dispose() {
    if(this.closed)return;
    this.closed=true;
    for(const timer of this.timeouts.splice(0))clearTimeout(timer);
    for(const undo of this.undo.reverse())try{undo();}catch(error){this.ctx.log('Virtual GO Plus cleanup failed',{error:String(error)});}
    this.undo=[];
    Interceptor.flush();
    if(this.jni){
      this.releaseDriverRef();
      this.simulator.releaseAll(this.jni);
    }
    this.jni=null;this.deviceNative=null;this.args0=null;this.args1=null;
  }
};