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
    this.connected=false;
    this.reconnecting=false;
    this.reconnectTimer=null;
    this.reconnectSession=null;
    this.counters={advertisements:0,pairings:0,catchRequests:0,spinRequests:0,disconnects:0,reconnectAttempts:0};
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
    // The sfida stack lives in the game's :pgp service process, which has no
    // Unity/il2cpp; gate on the installed package version instead.
    if(Process.pointerSize!==8)throw Error('Virtual GO Plus requires Android arm64');
    const version=await PgqlPackageVersion();
    this.version=version;
    if(version!=='0.431.0')throw Error('Virtual GO Plus supports game 0.431.0; found '+version);
    this.lib=Process.getModuleByName('libholoholo.so');
    if(!this.lib)throw Error('libholoholo.so is not loaded');
    const sym=name=>{const address=this.lib.findExportByName(name);if(!address)throw Error('Unsupported export: '+name);return address;};
    this.catchPokemon=new NativeFunction(sym('_ZN3pgp5sfida6Module12CatchPokemonENSt6__ndk112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEl13EncounterType'),'void',['pointer','pointer','uint64','uint32']);
    this.searchPokestop=new NativeFunction(sym('_ZN3pgp5sfida6Module14SearchPokestopERK19SfidaUpdateResponse'),'void',['pointer','pointer']);
    this.handleUpdate=new NativeFunction(sym('_ZN3pgp5sfida6Module12HandleUpdateEv'),'void',['pointer']);
    this.deviceConnectComplete=new NativeFunction(sym('_ZN3pgp5sfida6Device18ConnectionCompleteENS0_15PairingResponseENS_14BluetoothErrorE'),'void',['pointer','int','int']);
    this.sessionStart=sym('_ZN3pgp5sfida6Module12StartSessionERKNSt6__ndk112basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEESA_bSA_li');
    this.startSession=new NativeFunction(this.sessionStart,'void',['pointer','pointer','pointer','uint8','pointer','int64','int']);
    this.moduleDestructor=sym('_ZN3pgp5sfida6ModuleD2Ev');
    this.pgp=new PgqlPgpManager(this.lib);
    this.startScanning=sym('_ZN3pgp7android22AndroidBluetoothDriver23StartScanningWithFilterENSt6__ndk16vectorINS2_12basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEENS7_IS9_EEEES9_NS2_8functionIFvNS2_10shared_ptrINS_10PeripheralEEEEEE');
    this.peripheralConnect=sym('_ZN3pgp7android17AndroidPeripheral7ConnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE');
    this.deviceConnect=sym('_ZN3pgp5sfida6Device7ConnectENSt6__ndk18functionIFvNS0_15PairingResponseENS_14BluetoothErrorEEEE');
    this.finishDisconnect=sym('_ZN3pgp5sfida6Device22FinishDeviceDisconnectENSt6__ndk18functionIFvbNS_14BluetoothErrorEEEE');
    this.processPokemonNearby=sym('_ZN3pgp5sfida6Module20ProcessPokemonNearbyERK19SfidaUpdateResponse');
    this.processPokestopNearby=sym('_ZN3pgp5sfida6Module21ProcessPokestopNearbyERK19SfidaUpdateResponse');
    this.processCaptureResponse=sym('_ZN3pgp5sfida6Module22ProcessCaptureResponseERK20SfidaCaptureResponse');
  }
  async install(feature) {
    this.feature=feature;
    await this.initialize();
    if(this.closed)return;
    try {
      this.setupScanningHooks();
      this.setupPairingHooks();
      this.setupReconnectHooks();
      this.setupEncounterHooks();
      this.setupStopHooks();
      this.setupCaptureHook();
      Interceptor.flush();
      this.ctx.log('Virtual GO Plus armed',{game:this.version});
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
          if(!this.simulator.simulateDeviceFound(this.jni,this.bluetoothDriverRef))throw Error('GO Plus advertisement failed');
          this.counters.advertisements++;
          this.ctx.log('Virtual GO Plus advertised to the game',this.status());
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
      if(this.closed || this.failed || !this.deviceNative || this.deviceNative.isNull()){this.originalPeripheralConnect(peripheralPtr,callbackPtr);return;}
      try {
        if(this.deviceNative && !this.deviceNative.isNull()){
          // Mark the peripheral connected and complete pairing immediately.
          this.deviceNative.add(528).writeInt(8);
          this.deviceConnectComplete(this.deviceNative,0,0);
          this.connected=true;this.cancelReconnect();this.counters.pairings++;
          this.ctx.log('Virtual GO Plus paired',this.status());
        }
      }catch(error){this.problem(error);}
      return ptr(0);
    });
    this.originalFinishDisconnect=this.replace(this.finishDisconnect,'void',['pointer','pointer'],(peripheralPtr,callbackPtr)=>{
      if(this.closed || this.failed || this.reconnecting){this.originalFinishDisconnect(peripheralPtr,callbackPtr);return;}
      try {
        for(const timer of this.timeouts.splice(0))clearTimeout(timer);
        this.connected=false;this.deviceNative=null;this.counters.disconnects++;
        this.ctx.log('Virtual GO Plus disconnected',this.status());
        // Finish the game's teardown once. Reconnect starts a fresh session
        // on the accessory service's main thread, using owned parameter copies.
        this.reconnecting=true;
        try {this.originalFinishDisconnect(peripheralPtr,callbackPtr);}
        finally {this.reconnecting=false;}
        this.scheduleReconnect();
      }catch(error){this.problem(error);}
    });
  }
  // libc++ std::string on the pinned arm64 build: 24 bytes, short flag in
  // byte zero, long length at +8 and data pointer at +16. Const-reference
  // session parameters must be owned beyond the original native call's frame.
  copySessionString(source) {
    const flag=source.readU8(),long=!!(flag&1);
    const length=long?Number(source.add(8).readU64().toString()):flag>>>1;
    if(!Number.isSafeInteger(length) || length<0 || length>4096 || (!long && length>22))
      throw Error('Unsupported GO Plus session string layout');
    const value=Memory.alloc(24);
    value.writeByteArray(source.readByteArray(24));
    let data=null;
    if(long) {
      data=Memory.alloc(length+1);
      data.writeByteArray(source.add(16).readPointer().readByteArray(length));
      data.add(length).writeU8(0);
      value.add(16).writePointer(data);
    }
    return {value,data};
  }
  setupReconnectHooks() {
    this.attach(this.sessionStart,{onEnter:args=>{
      if(this.closed || this.failed)return;
      try {
        // These are private, in-memory copies. Never log/persist session values.
        this.reconnectSession={module:args[0],strings:[args[1],args[2],args[4]].map(p=>this.copySessionString(p)),
          reconnect:args[3].toInt32()!==0,number:int64(args[5].toString()),mode:args[6].toInt32()};
      }catch(error){this.problem(error);}
    }});
    this.attach(this.moduleDestructor,{onEnter:args=>{
      if(this.reconnectSession && this.reconnectSession.module.equals(args[0])) {
        this.cancelReconnect();this.reconnectSession=null;this.connected=false;this.deviceNative=null;
        for(const timer of this.timeouts.splice(0))clearTimeout(timer);
      }
    }});
  }
  cancelReconnect() {
    if(this.reconnectTimer!==null)clearTimeout(this.reconnectTimer);
    this.reconnectTimer=null;
  }
  scheduleReconnect(delay=1000) {
    if(this.closed || this.failed || this.connected || !this.autoReconnect || !this.reconnectSession || this.reconnectTimer!==null)return;
    const session=this.reconnectSession;
    this.reconnectTimer=setTimeout(()=>{
      this.reconnectTimer=null;
      if(this.closed || this.failed || this.connected || !this.autoReconnect || this.reconnectSession!==session)return;
      try {
        Java.scheduleOnMainThread(()=>{
          if(this.closed || this.failed || this.connected || !this.autoReconnect || this.reconnectSession!==session)return;
          try {
            this.counters.reconnectAttempts++;
            this.ctx.log('Virtual GO Plus reconnect requested',this.status());
            this.startSession(session.module,session.strings[0].value,session.strings[1].value,session.reconnect?1:0,
              session.strings[2].value,session.number,session.mode);
            this.scheduleReconnect(Math.min(delay*2,30000));
          }catch(error){this.problem(error);}
        });
      }catch(error){this.problem(error);}
    },delay);
  }
  // Lightning-fast native catch when a Pokemon appears.
  setupEncounterHooks() {
    const adapter=this;
    this.attach(this.processPokemonNearby,{
      onEnter(args){this.module=args[0];this.response=args[1];},
      onLeave(){
        if(adapter.closed || adapter.failed || !adapter.autoCatch)return;
        try {
          const module=this.module,response=this.response;
          const spawnpoint=response.add(16).readPointer().sub(2);
          const id=response.add(40).readU64();
          const type=response.add(48).readU32();
          adapter.pgp.reportEncounterId(module.add(16).readPointer(),id);
          adapter.catchPokemon(module,spawnpoint,id,type);
          adapter.counters.catchRequests++;
          adapter.ctx.log('Virtual GO Plus catch requested',{encounterId:String(id),type,...adapter.status()});
        }catch(error){adapter.problem(error);}
      }
    });
  }
  setupStopHooks() {
    const adapter=this;
    this.attach(this.processPokestopNearby,{
      onEnter(args){this.module=args[0];this.response=args[1];},
      onLeave(){
        if(adapter.closed || adapter.failed || !adapter.autoSpin)return;
        try {
          adapter.searchPokestop(this.module,this.response);
          adapter.scheduleHandleUpdate(this.module);
          adapter.counters.spinRequests++;
          adapter.ctx.log('Virtual GO Plus spin requested',adapter.status());
        }catch(error){adapter.problem(error);}
      }
    });
  }
  setupCaptureHook() {
    const adapter=this;
    this.attach(this.processCaptureResponse,{
      onEnter(args){this.module=args[0];},
      onLeave(){
        if(adapter.closed || adapter.failed)return;
        try {
          adapter.scheduleHandleUpdate(this.module);
          const manager=this.module.add(16).readPointer();
          if(manager && !manager.isNull())adapter.pgp.sendTimestamp(manager,Date.now());
        }catch(error){adapter.problem(error);}
      }
    });
  }
  setAutoCatch(value){this.autoCatch=!!value;}
  setAutoSpin(value){this.autoSpin=!!value;}
  setAutoReconnect(value){this.autoReconnect=!!value;if(this.autoReconnect)this.scheduleReconnect();else this.cancelReconnect();}
  status() {
    return {
      connected:this.connected,
      counters:{...this.counters},
      device:this.deviceNative&&!this.deviceNative.isNull()?this.deviceNative.toString():null,
      autoCatch:this.autoCatch,
      autoSpin:this.autoSpin,
      autoReconnect:this.autoReconnect
    };
  }
  dispose() {
    if(this.closed)return;
    this.closed=true;
    this.cancelReconnect();this.reconnectSession=null;
    for(const timer of this.timeouts.splice(0))clearTimeout(timer);
    for(const undo of this.undo.reverse())try{undo();}catch(error){this.ctx.log('Virtual GO Plus cleanup failed',{error:String(error)});}
    this.undo=[];
    Interceptor.flush();
    if(this.jni){
      // JNIEnv belongs to the current native thread, never reuse the scan
      // thread's environment from a controller command or timer.
      this.jni=PgqlJniHelper.getEnv(this.lib);
      this.releaseDriverRef();
      this.simulator.releaseAll(this.jni);
    }
    this.jni=null;this.deviceNative=null;this.connected=false;
  }
};