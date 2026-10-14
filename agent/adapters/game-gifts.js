'use strict';
// Original adapter. Native method/field contracts verified from live metadata.
globalThis.PgqlGameGifts = class PgqlGameGifts {
  constructor(ctx) {
    this.ctx=ctx;this.jobs=[];this.closed=false;this.joined=false;this.consumed=new Set();this.pins=new Set();
    this.types=PgqlGameGifts.frame.types;
    ctx.cleanup(()=>{
      this.closed=true;
      for(const job of this.jobs.splice(0))job.reject(Error('Module disabled'));
      if(this.joined){this.joined=false;PgqlGameGifts.leave(this);}
    });
  }
  // Shared by every adapter instance: one ExecuteTasks hook, one type cache and
  // a per-frame time budget, so modules enabled together do not all run their
  // game-thread work in the same frame.
  static get frame() {
    if(!this.shared)this.shared={types:new Map(),named:null,members:new Set(),queue:[],hook:null,starting:null,loaded:null,
      execute:null,find:null,map:null,mapWaiters:[],mapChecked:0,version:undefined,firstFrame:null,frameSeen:null};
    return this.shared;
  }
  static lookup(name) {
    const types=this.frame.types;
    if(types.has(name))return types.get(name);
    for(const assembly of Il2Cpp.domain.assemblies){const type=assembly.image.tryClass(name);if(type){types.set(name,type);return type;}}
    throw Error('Unsupported game metadata: '+name);
  }
  // Attach may land while the game is still loading. Wait for il2cpp_init to
  // finish before using the bridge, whose own wait can miss an init in progress.
  static il2cppReady() {
    const frame=this.frame;
    if(!frame.loaded)frame.loaded=new Promise(resolve=>{
      const poll=()=>{
        const library=Process.findModuleByName('libil2cpp.so'),corlib=library && library.findExportByName('il2cpp_get_corlib');
        if(corlib && !new NativeFunction(corlib,'pointer',[])().isNull())resolve();
        else setTimeout(poll,250);
      };
      poll();
    });
    return frame.loaded;
  }
  static start() {
    const frame=this.frame;
    if(frame.starting)return frame.starting;
    frame.starting=(async()=>{
      await PgqlGameGifts.il2cppReady();
      if(globalThis.PgqlLoadIl2cpp)PgqlLoadIl2cpp();
      await Il2Cpp.perform(()=>{
        frame.execute=PgqlGameGifts.lookup('UnityEngine.UnitySynchronizationContext').method('ExecuteTasks',0).virtualAddress;
        const object=PgqlGameGifts.lookup('UnityEngine.Object');
        frame.find=object.methods.find(m=>m.name==='FindObjectOfType'&&m.parameterCount===1&&m.parameters[0].type.name==='System.Type') || null;
        frame.map=PgqlGameGifts.lookup('Niantic.Holoholo.MapSceneContext');
        const library=Process.getModuleByName('libil2cpp.so');
        frame.handleNew=new NativeFunction(library.getExportByName('il2cpp_gchandle_new'),'pointer',['pointer','bool']);
        frame.handleTarget=new NativeFunction(library.getExportByName('il2cpp_gchandle_get_target'),'pointer',['pointer']);
        frame.handleFree=new NativeFunction(library.getExportByName('il2cpp_gchandle_free'),'void',['pointer']);
      },'free');
      frame.firstFrame=new Promise(resolve=>{frame.frameSeen=resolve;});
    })();
    frame.starting.catch(()=>{frame.starting=null;});
    return frame.starting;
  }
  static join(member) {
    const frame=this.frame;
    frame.members.add(member);
    if(!frame.hook)frame.hook=Interceptor.attach(frame.execute,{onLeave:()=>PgqlGameGifts.tick()});
  }
  static leave(member) {
    const frame=this.frame;
    frame.members.delete(member);
    frame.queue=frame.queue.filter(job=>job.owner!==member);
    if(!frame.members.size && frame.hook){frame.hook.detach();frame.hook=null;}
  }
  static get budgetMs(){return 6;}
  static tick() {
    const frame=this.frame;
    if(frame.version===undefined) {
      // Application.version is a Unity call; read it on this thread once so
      // metadata binding can run on the agent thread.
      try{frame.version=Il2Cpp.application.version;Object.defineProperty(Il2Cpp.application,'version',{value:frame.version,configurable:true});}
      catch(error){frame.version=null;}
      if(frame.frameSeen)frame.frameSeen();
    }
    if(frame.mapWaiters.length && Date.now()-frame.mapChecked>=1000) {
      frame.mapChecked=Date.now();
      try {
        if(frame.find && !frame.find.invoke(frame.map.type.object).isNull())for(const waiter of frame.mapWaiters.splice(0))waiter.resolve();
      }catch(error){for(const waiter of frame.mapWaiters.splice(0))waiter.reject(error);}
    }
    const deadline=Date.now()+PgqlGameGifts.budgetMs;
    while(frame.queue.length) {
      const job=frame.queue.shift(),owner=job.owner;
      const index=owner.jobs.indexOf(job);if(index>=0)owner.jobs.splice(index,1);
      if(owner.closed){job.reject(Error('Module disabled'));continue;}
      const began=Date.now();
      try{job.resolve(job.fn());}catch(error){job.reject(error);}
      const spent=Date.now()-began;
      if(spent>16)try{owner.ctx.log('Slow game-thread job',{ms:spent,label:job.label});}catch(_){}
      if(Date.now()>=deadline)break;
    }
  }
  type(name){return PgqlGameGifts.lookup(name);}
  // Short class names (obfuscated protos) resolved from one shared index.
  named(name) {
    const frame=PgqlGameGifts.frame;
    if(!frame.named) {
      const index=new Map();
      for(const assembly of Il2Cpp.domain.assemblies)for(const type of assembly.image.classes) {
        const list=index.get(type.name);if(list)list.push(type);else index.set(type.name,[type]);
      }
      frame.named=index;
    }
    return frame.named.get(name) || [];
  }
  async initialize() {
    if(this.closed)throw Error('Module disabled');
    if(this.joined)return;
    if(!this.initializing)this.initializing=(async()=>{
      await PgqlGameGifts.start();
      if(this.closed)throw Error('Module disabled');
      const frame=PgqlGameGifts.frame;
      this.handleNew=frame.handleNew;this.handleTarget=frame.handleTarget;this.handleFree=frame.handleFree;
      this.joined=true;PgqlGameGifts.join(this);
      this.ctx.log('Unity frame scheduler ready',{sinceLoadMs:Date.now()-PgqlGameGifts.loadedAt});
    })();
    this.initializing.catch(()=>{this.initializing=null;});
    return this.initializing;
  }
  async main(fn,label) {
    await this.initialize();
    if(this.closed)throw Error('Module disabled');
    return new Promise((resolve,reject)=>{
      const job={fn,label:label || fn.name || 'job',owner:this,resolve,reject};
      this.jobs.push(job);PgqlGameGifts.frame.queue.push(job);
      const timer=setTimeout(()=>{
        const frame=PgqlGameGifts.frame,index=frame.queue.indexOf(job);
        if(index>=0){frame.queue.splice(index,1);this.jobs.splice(this.jobs.indexOf(job),1);reject(Error('Game frame unavailable'));}
      },15000);
      job.resolve=value=>{clearTimeout(timer);resolve(value);};job.reject=error=>{clearTimeout(timer);reject(error);};
    });
  }
  // Metadata-only work (type, method and field resolution) on the agent
  // thread, keeping it off the game's frame. Never touch scene objects here.
  async metadata(fn) {
    await this.initialize();
    const frame=PgqlGameGifts.frame;
    if(frame.version===undefined)await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Game frame unavailable')),15000);
      frame.firstFrame.then(()=>{clearTimeout(timer);resolve();});
    });
    if(this.closed)throw Error('Module disabled');
    // Return errors as values: Il2Cpp.perform also reports thrown errors as unhandled.
    const result=await Il2Cpp.perform(()=>{
      if(this.closed)return {error:Error('Module disabled')};
      try{return {value:fn()};}catch(error){return {error};}
    },'free');
    if(result.error)throw result.error;
    return result.value;
  }
  // Resolves once the map scene exists; startup work waits for it after an
  // attach during the loading screen.
  async mapReady() {
    await this.initialize();
    const frame=PgqlGameGifts.frame;
    return new Promise((resolve,reject)=>{
      const waiter={resolve,reject};frame.mapWaiters.push(waiter);
      this.ctx.cleanup(()=>{const index=frame.mapWaiters.indexOf(waiter);if(index>=0){frame.mapWaiters.splice(index,1);reject(Error('Module disabled'));}});
    });
  }
  services() {
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Mass Gift supports');
    const object=this.type('UnityEngine.Object');
    const find=object.methods.find(m=>m.name==='FindObjectOfType'&&m.parameterCount===1&&m.parameters[0].type.name==='System.Type');
    if(!find)throw Error('Map lookup unavailable');
    const map=find.invoke(this.type('Niantic.Holoholo.MapSceneContext').type.object);
    if(map.isNull())throw Error('Load the game map before using Mass Gift');
    const container=map.method('get_Container',0).invoke();
    const resolve=container.method('Resolve',1).overload('System.Type');
    const get=name=>{const service=resolve.invoke(this.type(name).type.object);if(service.isNull())throw Error('Service unavailable: '+name);return service;};
    return {friends:get('Niantic.Holoholo.Social.IFriendsRpcService'),inventory:get('Niantic.Holoholo.Social.Gifting.IGiftingService'),gifting:get('Niantic.Holoholo.Social.Gifting.IGiftingRpcService')};
  }
  method(object,name,count=0,optional=false) {
    const type=object.class || object.type.class;
    for(const klass of type.hierarchy({includeCurrent:true})) {
      const method=klass.methods.find(m=>!m.isStatic && m.parameterCount===count && (m.name===name || m.name.endsWith('.'+name)));
      if(method)return method.bind(object);
    }
    if(optional)return null;
    throw Error('Missing collection method '+name+' in '+type.type.name);
  }
  array(collection) {
    if(collection.isNull())return [];
    const iterator=this.method(collection,'GetEnumerator').invoke(),values=[];
    try {
      while(this.method(iterator,'MoveNext').invoke()) {
        if(values.length>=5000)throw Error('Collection exceeded expected bound');
        values.push(this.method(iterator,'get_Current').invoke());
      }
    } finally {const dispose=this.method(iterator,'Dispose',0,true);if(dispose)dispose.invoke();}
    return values;
  }
  value(object,name) {
    const getter='get_'+name.toLowerCase();
    for(const klass of object.class.hierarchy({includeCurrent:true})) {
      const method=klass.methods.find(m=>m.name.toLowerCase()===getter && m.parameterCount===0 && !m.isStatic);
      if(method)return object.method(method.name,0).invoke();
      const field=klass.fields.find(f=>f.name.replace(/^_|_$/g,'').toLowerCase()===name.toLowerCase() && !f.isStatic);
      if(field)return object.field(field.name).value;
    }
    throw Error('Missing '+name+' in '+object.class.type.name+'; properties: '+object.class.methods.filter(m=>m.parameterCount===0).map(m=>m.name).join(','));
  }
  promise(managed,convert) {
    return new Promise((resolve,reject)=>{
      const then=managed.class.methods.find(m=>m.name==='Then'&&m.parameterCount===1&&m.parameters[0].type.name.startsWith('System.Action<'));
      const error=managed.class.methods.find(m=>m.name==='Error'&&m.parameterCount===1&&m.parameters[0].type.name==='System.Action<System.String>');
      if(!then||!error){reject(Error('Unsupported game promise: '+managed.class.type.name));return;}
      const pins=[];
      const pin=object=>{
        const handle=this.handleNew(object.handle,1);
        if(handle.isNull())throw Error('Unable to retain managed callback');
        if(!this.handleTarget(handle).equals(object.handle)){this.handleFree(handle);throw Error('Unsupported managed handle ABI');}
        this.pins.add(handle);pins.push(handle);return object;
      };
      const release=()=>{for(const handle of pins){this.pins.delete(handle);this.handleFree(handle);}};
      let finished=false;
      const settle=(fn,value)=>{if(finished)return;finished=true;try{fn(value);}finally{this.main(release).catch(error=>this.ctx.log('Deferred handle cleanup failed',{error:String(error)}));}};
      try {
        pin(managed);
        const fail=pin(Il2Cpp.delegate(error.parameters[0].type.class,()=>settle(reject,Error('Game request failed; outcome may be unknown'))));
        const done=pin(Il2Cpp.delegate(then.parameters[0].type.class,value=>{
          if(this.closed){settle(reject,Error('Module disabled'));return;}
          try{settle(resolve,convert(value));}catch(problem){settle(reject,problem);}
        }));
        managed.method('Error',1).overload(error.parameters[0].type.name).invoke(fail);
        managed.method('Then',1).overload(then.parameters[0].type.name).invoke(done);
      }catch(problem){settle(reject,problem);}
    });
  }
  async preview() {
    return this.main(()=>{
      const services=this.services();
      this.ctx.log('Gift services ready');
      const gifts=this.array(services.inventory.method('get_SendableGiftsInInventory',0).invoke()).filter(g=>!this.consumed.has(this.value(g,'GiftboxId').toString()));
      this.ctx.log('Gift inventory read',{count:gifts.length});
      return this.promise(services.friends.method('GetFriendsList',0).invoke(),friends=>{
        const friendIds=this.array(friends).map(friend=>this.value(friend,'PlayerId').content).filter(Boolean);
        return {friendIds:[...new Set(friendIds)],giftCount:gifts.length};
      });
    });
  }
  async prepare(mode,friendIds) {
    if(mode!=='open' || !friendIds.length)return;
    return this.main(()=>{
      const services=this.services();
      const listClass=Il2Cpp.corlib.class('System.Collections.Generic.List`1').inflate(Il2Cpp.corlib.class('System.String'));
      const ids=listClass.alloc(),retained=this.handleNew(ids.handle,1);
      if(retained.isNull())throw Error('Unable to retain friend request');
      try {
        ids.method('.ctor',0).invoke();
        for(const id of friendIds)ids.method('Add',1).invoke(Il2Cpp.string(id));
        return this.promise(services.friends.method('GetFriendDetailsPaginated',2).invoke(ids,false),()=>null);
      }finally{this.handleFree(retained);}
    });
  }
  async incomingCount(friendIds) {
    return this.main(()=>{
      const services=this.services();let count=0;
      for(const id of friendIds)if(this.array(services.friends.method('GetGiftboxDetails',1).invoke(Il2Cpp.string(id))).length)count++;
      return count;
    });
  }
  async send(friendId) {
    return this.main(()=>{
      const services=this.services();
      const gift=this.array(services.inventory.method('get_SendableGiftsInInventory',0).invoke()).find(g=>!this.consumed.has(this.value(g,'GiftboxId').toString()));
      if(!gift)return 4;
      const giftId=this.value(gift,'GiftboxId'),friend=Il2Cpp.string(friendId);
      return this.promise(services.gifting.method('SendGift',5).invoke(giftId,friend,friend,new Il2Cpp.Object(NULL),false),output=>{
        const result=this.value(output,'Result').field('value__').value;
        if(result===1)this.consumed.add(giftId.toString());
        return result;
      });
    });
  }
  async open(friendId) {
    return this.main(()=>{
      const services=this.services(),friend=Il2Cpp.string(friendId);
      const gifts=this.array(services.friends.method('GetGiftboxDetails',1).invoke(friend));
      if(!gifts.length)return 5;
      const giftId=this.value(gifts[0],'GiftboxId');
      return this.promise(services.gifting.method('OpenGift',3).invoke(giftId,friend,friend),output=>this.value(output,'Result').field('value__').value);
    });
  }
};
PgqlGameGifts.loadedAt=Date.now();
