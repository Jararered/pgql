'use strict';
// Original JNIEnv wrapper. The JNI function table slot numbers are a fixed,
// published JNI/ART ABI (not game-specific offsets); libholoholo's own
// pgp::android::jni::GetEnv export supplies a valid JNIEnv* for the game.
globalThis.PgqlJniHelper = class PgqlJniHelper {
  constructor(env) {
    this.env=env;
    this.table=env.readPointer();
    if(!this.table || this.table.isNull())throw Error('Unsupported JNIEnv table');
    this.cache=new Map();
    this.errors=[];
  }
  // Resolve one JNIEnv function from the fixed-slot table.
  fn(index,ret,args) {
    let entry=this.cache.get(index);
    if(!entry) {
      const address=this.table.add(index*Process.pointerSize).readPointer();
      if(!address || address.isNull())throw Error('Unsupported JNI slot '+index);
      entry=new NativeFunction(address,ret,args);
      this.cache.set(index,entry);
    }
    return entry;
  }
  exceptionCheck() { return this.fn(228,'bool',['pointer'])(this.env); }
  exceptionDescribe() { this.fn(16,'void',['pointer'])(this.env); }
  exceptionClear() { this.fn(17,'void',['pointer'])(this.env); }
  // Log and clear a pending JNI exception; use defensively after fabrications.
  clearException() {
    if(!this.exceptionCheck())return;
    try { this.exceptionDescribe(); } catch(_) { /* describe must not mask the failure */ }
    try { this.exceptionClear(); } catch(_) { /* clear must not mask the failure */ }
    return true;
  }
  findClass(name) {
    const address=this.fn(6,'pointer',['pointer','pointer'])(this.env,Memory.allocUtf8String(name));
    return this.clearException()||!address||address.isNull()?null:address;
  }
  getObjectClass(object) { return this.fn(31,'pointer',['pointer','pointer'])(this.env,object); }
  getMethodID(clazz,name,sig) { return this.fn(33,'pointer',['pointer','pointer','pointer','pointer'])(this.env,clazz,Memory.allocUtf8String(name),Memory.allocUtf8String(sig)); }
  getStaticMethodID(clazz,name,sig) { return this.fn(113,'pointer',['pointer','pointer','pointer','pointer'])(this.env,clazz,Memory.allocUtf8String(name),Memory.allocUtf8String(sig)); }
  newObject(clazz,ctor,args=[]) { return this.fn(28,'pointer',['pointer','pointer','pointer','...'])(this.env,clazz,ctor,...args); }
  callVoidMethod(object,method,args=[]) { this.fn(61,'void',['pointer','pointer','pointer','...'])(this.env,object,method,...args); }
  callObjectMethod(object,method,args=[]) { return this.fn(34,'pointer',['pointer','pointer','pointer','...'])(this.env,object,method,...args); }
  callStaticObjectMethod(clazz,method,args=[]) { return this.fn(114,'pointer',['pointer','pointer','pointer','...'])(this.env,clazz,method,...args); }
  newByteArray(length) { return this.fn(176,'pointer',['pointer','int'])(this.env,length); }
  // Copy bytes from Frida memory into a fresh jbyteArray.
  setByteArrayRegion(array,bytes) {
    const buffer=Memory.alloc(bytes.length);
    buffer.writeByteArray(bytes);
    this.fn(208,'void',['pointer','pointer','int','int','pointer'])(this.env,array,0,bytes.length,buffer);
    Memory.free(buffer);
  }
  newStringUTF(value) { return this.fn(167,'pointer',['pointer','pointer'])(this.env,Memory.allocUtf8String(value)); }
  // Build a Java String[] from plain strings.
  createStringArray(values) {
    const stringClass=this.findClass('java/lang/String');
    if(!stringClass)return null;
    const array=this.fn(172,'pointer',['pointer','int','pointer','pointer'])(this.env,values.length,stringClass,ptr(0));
    if(this.clearException()||!array||array.isNull())return null;
    for(let index=0;index<values.length;index++) {
      const value=this.newStringUTF(values[index]);
      if(!value)return null;
      this.fn(174,'void',['pointer','pointer','int','pointer'])(this.env,array,index,value);
      this.deleteLocalRef(value);
      if(this.clearException())return null;
    }
    return array;
  }
  newGlobalRef(object) { const ref=this.fn(21,'pointer',['pointer','pointer'])(this.env,object); return this.clearException()||!ref||ref.isNull()?null:ref; }
  deleteGlobalRef(object) { if(object && !object.isNull())this.fn(22,'void',['pointer','pointer'])(this.env,object); }
  deleteLocalRef(object) { if(object && !object.isNull())this.fn(23,'void',['pointer','pointer'])(this.env,object); }
};
// JNIEnv* for the game's main thread, resolved through libholoholo's own
// accessor so fabricated Java objects are always valid on the game VM.
PgqlJniHelper.getEnv = libholoholo => {
  const symbol=libholoholo.findExportByName('_ZN3pgp7android3jni6GetEnvEPKc');
  if(!symbol)throw Error('Unsupported pgp::android::jni::GetEnv export');
  const getEnv=new NativeFunction(symbol,'pointer',['pointer']);
  const env=getEnv(Memory.allocUtf8String('main'));
  if(!env || env.isNull())throw Error('Unsupported pgp JNI environment');
  return new PgqlJniHelper(env);
};