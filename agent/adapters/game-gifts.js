'use strict';
// Original adapter. Native method/field contracts verified from live metadata.
globalThis.PgqlGameGifts = class PgqlGameGifts {
  constructor(ctx) {
    this.ctx=ctx;this.jobs=[];this.hook=null;this.closed=false;this.types=new Map();this.consumed=new Set();this.pins=new Set();
    ctx.cleanup(()=>{this.closed=true;for(const job of this.jobs.splice(0))job.reject(Error('Module disabled'));if(this.hook)this.hook.detach();});
  }
  type(name) {
    if(this.types.has(name))return this.types.get(name);
    for(const assembly of Il2Cpp.domain.assemblies){const type=assembly.image.tryClass(name);if(type){this.types.set(name,type);return type;}}
    throw Error('Unsupported game metadata: '+name);
  }
  async initialize() {
    if(this.closed)throw Error('Module disabled');
    if(this.hook)return;
    if(this.initializing)return this.initializing;
    if(globalThis.PgqlLoadIl2cpp)PgqlLoadIl2cpp();
    this.initializing=Il2Cpp.perform(()=>{
      if(this.closed)throw Error('Module disabled');
      const execute=this.type('UnityEngine.UnitySynchronizationContext').method('ExecuteTasks',0);
      const library=Process.getModuleByName('libil2cpp.so');
      this.handleNew=new NativeFunction(library.getExportByName('il2cpp_gchandle_new'),'pointer',['pointer','bool']);
      this.handleTarget=new NativeFunction(library.getExportByName('il2cpp_gchandle_get_target'),'pointer',['pointer']);
      this.handleFree=new NativeFunction(library.getExportByName('il2cpp_gchandle_free'),'void',['pointer']);
      this.hook=this.ctx.hook(execute.virtualAddress,{onLeave:()=>{
        if(this.closed)return;
        const jobs=this.jobs.splice(0);
        for(const job of jobs)try{job.resolve(job.fn());}catch(error){job.reject(error);}
      }});
      this.ctx.log('Unity frame scheduler ready',{unity:Il2Cpp.unityVersion});
    },'free');
    return this.initializing;
  }
  async main(fn) {
    await this.initialize();
    if(this.closed)throw Error('Module disabled');
    return new Promise((resolve,reject)=>{
      const job={fn,resolve,reject};this.jobs.push(job);
      const timer=setTimeout(()=>{const index=this.jobs.indexOf(job);if(index>=0){this.jobs.splice(index,1);reject(Error('Game frame unavailable'));}},15000);
      job.resolve=value=>{clearTimeout(timer);resolve(value);};job.reject=error=>{clearTimeout(timer);reject(error);};
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
