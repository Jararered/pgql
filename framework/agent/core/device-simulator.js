'use strict';
// Original virtual GO Plus advertisement fabricator. Creates the exact Java
// objects the game's Sfida bluetooth layer expects for a discovered device.
// Scan results cross the Interceptor callback boundary, so the fabricated
// objects are retained as global refs owned by this instance until the next
// scan cycle or dispose.
globalThis.PgqlDeviceSimulator = class PgqlDeviceSimulator {
  constructor(options={}) {
    // BLE advertising payload observed for a genuine Pokemon GO Plus; the
    // name "Pokemon GO Plus" plus flags/services is what the game filters on.
    this.scanRecordBytes=(options.scanRecordBytes||[2,1,6,16,9,80,111,107,101,109,111,110,32,71,79,32,80,108,117,115,6,32,98,4,-59,33,0,2,1,6,2,10,-21,3,3,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]).slice();
    this.macAddress=options.macAddress||'98:B6:E9:11:E1:46';
    this.rssi=options.rssi===undefined?-51:options.rssi;
    this.timestampNanos=options.timestampNanos===undefined?Date.now()*1000000:options.timestampNanos;
    this.globalRefs=[];
  }
  retain(jni,object) {
    if(!object || object.isNull())return null;
    const ref=jni.newGlobalRef(object);
    if(ref)this.globalRefs.push(ref);
    return ref;
  }
  releaseAll(jni) {
    for(const ref of this.globalRefs.splice(0))jni.deleteGlobalRef(ref);
  }
  createSfidaScanCallback(jni,driver) {
    const clazz=jni.findClass('com/nianticlabs/pokemongoplus/SfidaBluetoothDriver$SfidaScanCallback');
    if(!clazz)return null;
    const ctor=jni.getMethodID(clazz,'<init>','(Lcom/nianticlabs/pokemongoplus/SfidaBluetoothDriver;[Ljava/lang/String;)V');
    if(!ctor)return null;
    const names=jni.createStringArray(['Pokemon GO Plus']);
    if(!names)return null;
    const callback=jni.newObject(clazz,ctor,[driver,names]);
    jni.deleteLocalRef(clazz);jni.deleteLocalRef(names);
    return this.valid(callback);
  }
  createScanRecord(jni) {
    const clazz=jni.findClass('android/bluetooth/le/ScanRecord');
    if(!clazz)return null;
    const parse=jni.getStaticMethodID(clazz,'parseFromBytes','([B)Landroid/bluetooth/le/ScanRecord;');
    if(!parse)return null;
    const array=jni.newByteArray(this.scanRecordBytes.length);
    if(!array)return null;
    jni.setByteArrayRegion(array,this.scanRecordBytes);
    const record=jni.callStaticObjectMethod(clazz,parse,[array]);
    jni.deleteLocalRef(clazz);jni.deleteLocalRef(array);
    return this.valid(record);
  }
  createBluetoothDevice(jni) {
    const clazz=jni.findClass('android/bluetooth/BluetoothAdapter');
    if(!clazz)return null;
    const getDefault=jni.getStaticMethodID(clazz,'getDefaultAdapter','()Landroid/bluetooth/BluetoothAdapter;');
    const adapter=getDefault?jni.callStaticObjectMethod(clazz,getDefault):null;
    let device=null;
    if(adapter && !adapter.isNull()) {
      const getRemote=jni.getMethodID(jni.getObjectClass(adapter),'getRemoteDevice','(Ljava/lang/String;)Landroid/bluetooth/BluetoothDevice;');
      const address=jni.newStringUTF(this.macAddress);
      device=getRemote?jni.callObjectMethod(adapter,getRemote,[address]):null;
      if(address)jni.deleteLocalRef(address);
      jni.deleteLocalRef(adapter);
    }
    if(clazz)jni.deleteLocalRef(clazz);
    return this.valid(device);
  }
  createScanResult(jni,device,record) {
    const clazz=jni.findClass('android/bluetooth/le/ScanResult');
    if(!clazz)return null;
    const ctor=jni.getMethodID(clazz,'<init>','(Landroid/bluetooth/BluetoothDevice;Landroid/bluetooth/le/ScanRecord;IJ)V');
    if(!ctor)return null;
    // jint/jlong primitive args are passed as pointer-sized values.
    const result=jni.newObject(clazz,ctor,[device,record,ptr(this.rssi),ptr(this.timestampNanos)]);
    jni.deleteLocalRef(clazz);
    return this.valid(result);
  }
  callOnScanResult(jni,callback,result) {
    const clazz=jni.findClass('com/nianticlabs/pokemongoplus/SfidaBluetoothDriver$SfidaScanCallback');
    if(!clazz)return false;
    const onScan=jni.getMethodID(clazz,'onScanResult','(ILandroid/bluetooth/le/ScanResult;)V');
    jni.deleteLocalRef(clazz);
    if(!onScan)return false;
    jni.callVoidMethod(callback,onScan,[ptr(1),result]);
    return true;
  }
  valid(object) { return object && !object.isNull()?object:null; }
  // Present the virtual device to the game's active scan callback. Global refs
  // handed to the game are tracked here and released on the next cycle/dispose.
  simulateDeviceFound(jni,driverRef) {
    this.releaseAll(jni);
    const callback=this.createSfidaScanCallback(jni,driverRef);
    if(!callback)return false;
    const record=this.createScanRecord(jni);
    const device=record?this.createBluetoothDevice(jni):null;
    const result=device?this.createScanResult(jni,device,record):null;
    const callbackRef=this.retain(jni,callback);
    const resultRef=result?this.retain(jni,result):null;
    let ok=false;
    if(callbackRef && resultRef)ok=this.callOnScanResult(jni,callbackRef,resultRef);
    if(callback && !callback.isNull())jni.deleteLocalRef(callback);
    if(result && !result.isNull())jni.deleteLocalRef(result);
    return ok;
  }
};