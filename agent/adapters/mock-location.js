'use strict';
// Original adapter. Hides spoofed locations from native code: JNI boolean
// calls of android.location.Location.isFromMockProvider()/isMock() return
// false. Uses only the published JNI invocation and JNIEnv function-table slot
// numbers (a public ABI, not game offsets), so it is not version gated.
globalThis.PgqlMockLocationBypass = class PgqlMockLocationBypass {
  constructor(ctx) {
    this.ctx=ctx;this.listeners=[];this.methods=[];this.hidden=0;
  }
  static get version(){return 0x10006;}
  // A JNIEnv for the calling thread, attaching it to the VM if needed.
  static env(callback) {
    const art=Process.findModuleByName('libart.so');
    const created=art?art.findExportByName('JNI_GetCreatedJavaVMs'):Module.findGlobalExportByName('JNI_GetCreatedJavaVMs');
    if(!created)throw Error('JNI_GetCreatedJavaVMs unavailable');
    const vms=Memory.alloc(Process.pointerSize),count=Memory.alloc(4);
    if(new NativeFunction(created,'int',['pointer','int','pointer'])(vms,1,count)!==0||count.readS32()<1)throw Error('Java VM unavailable');
    const vm=vms.readPointer(),invoke=vm.readPointer(),slot=index=>invoke.add(index*Process.pointerSize).readPointer();
    const env=Memory.alloc(Process.pointerSize);
    let attached=false,result=new NativeFunction(slot(6),'int',['pointer','pointer','int'])(vm,env,PgqlMockLocationBypass.version);
    if(result===-2) {
      result=new NativeFunction(slot(4),'int',['pointer','pointer','pointer'])(vm,env,ptr(0));
      attached=result===0;
    }
    if(result!==0)throw Error('JNIEnv unavailable');
    try{return callback(env.readPointer());}
    finally{if(attached)new NativeFunction(slot(5),'int',['pointer'])(vm);}
  }
  start() {
    if(this.listeners.length)return;
    const table=PgqlMockLocationBypass.env(address=>{
      const jni=new PgqlJniHelper(address);
      const location=jni.findClass('android/location/Location');
      if(!location)throw Error('android.location.Location unavailable');
      for(const name of ['isFromMockProvider','isMock']) {
        try{const id=jni.getMethodID(location,name,'()Z');if(id&&!id.isNull())this.methods.push(id);}
        catch(_){/* isMock only exists from API 31 */}
      }
      jni.fn(23,'void',['pointer','pointer'])(jni.env,location);
      return jni.table;
    });
    if(!this.methods.length)throw Error('Mock location checks unavailable');
    const self=this,methods=this.methods;
    // CallBooleanMethod, CallBooleanMethodV and CallBooleanMethodA.
    for(const index of [37,38,39]) {
      this.listeners.push(Interceptor.attach(table.add(index*Process.pointerSize).readPointer(),{
        onEnter(args){this.mock=methods.some(id=>args[2].equals(id));},
        onLeave(result){if(this.mock){result.replace(ptr(0));self.hidden++;}}
      }));
    }
    this.ctx.log('Mock location hidden',{checks:methods.length});
  }
  stop() {
    for(const listener of this.listeners.splice(0))listener.detach();
    this.methods=[];
  }
  get active(){return this.listeners.length>0;}
};
