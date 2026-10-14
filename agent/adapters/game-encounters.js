'use strict';
// Original PGQL implementation of the static contracts in encounter-contract.md.
// Resolve the complete feature contract before modifying any game method.
globalThis.PgqlGameEncounters = class PgqlGameEncounters {
  constructor(ctx) {
    this.ctx=ctx;this.schedulerCleanup=[];this.closed=false;
    const track=fn=>{this.schedulerCleanup.push(fn);return fn;};
    this.scheduler=new PgqlGameGifts({...ctx,cleanup:track,hook:(address,callbacks)=>{
      const listener=Interceptor.attach(address,callbacks);track(()=>listener.detach());return listener;
    }});
    this.undo=[];this.pins=new Set();this.callbacks=[];this.failed=false;this.restoreActions=null;
    ctx.cleanup(()=>this.dispose());
  }
  type(name) {
    if(name.includes('.'))return this.scheduler.type(name);
    const matches=[];
    for(const assembly of Il2Cpp.domain.assemblies)for(const type of assembly.image.classes)if(type.name===name)matches.push(type);
    if(matches.length!==1)throw Error('Expected one managed class: '+name);
    return matches[0];
  }
  method(type,name,count,returns,parameters) {
    const matches=[];
    for(const klass of type.hierarchy({includeCurrent:true})) {
      for(const method of klass.methods)if((method.name===name || method.name.endsWith('.'+name)) && (count===undefined || method.parameterCount===count) && (!parameters || parameters.every((type,i)=>method.parameters[i]?.type.name===type)))matches.push(method);
      if(matches.length)break;
    }
    if(matches.length!==1 || (returns && matches[0].returnType.name!==returns))throw Error('Unsupported encounter method: '+type.fullName+'.'+name);
    const method=matches[0];
    if(method.virtualAddress.isNull())throw Error('Encounter method has no code: '+name);
    return method;
  }
  field(type,names,predicate=()=>true) {
    const matches=[];
    for(const klass of type.hierarchy({includeCurrent:true}))for(const field of klass.fields)
      if(!field.isStatic && names.includes(field.name) && predicate(field.type))matches.push(field);
    if(matches.length!==1)throw Error('Unsupported encounter field: '+type.fullName+'.'+names.join('/'));
    return matches[0];
  }
  // Obfuscated member names change between builds; these fields are the only
  // instance fields of their declared type, so resolve them by that type.
  typedField(type,typeName) {
    const matches=[];
    for(const klass of type.hierarchy({includeCurrent:true}))for(const field of klass.fields)
      if(!field.isStatic && field.type.name===typeName)matches.push(field);
    if(matches.length!==1)throw Error('Unsupported encounter field: '+type.fullName+' of type '+typeName);
    return matches[0];
  }
  protoField(type,name) {
    const fields=type.fields.filter(f=>!f.isStatic && f.name.replace(/^_|_$/g,'').toLowerCase()===name.toLowerCase());
    if(fields.length!==1)throw Error('Unsupported proto field: '+type.fullName+'.'+name+'; fields: '+type.fields.map(f=>f.name).join(','));
    return fields[0];
  }
  get(object,field){return field.bind(object).value;}
  set(object,field,value){field.bind(object).value=value;}
  pin(object) {
    if(!object || object.isNull())return null;
    const handle=this.scheduler.handleNew(object.handle,1);
    if(handle.isNull())throw Error('Cannot retain encounter object');
    if(!this.scheduler.handleTarget(handle).equals(object.handle)){this.scheduler.handleFree(handle);throw Error('Unsupported managed handle ABI');}
    this.pins.add(handle);return handle;
  }
  object(handle){return handle?new Il2Cpp.Object(this.scheduler.handleTarget(handle)):new Il2Cpp.Object(NULL);}
  release(handle){if(handle && this.pins.delete(handle))this.scheduler.handleFree(handle);}
  unwrap(object) {
    if(object.isNull())throw Error('Encounter state unavailable');
    if(!object.class.name.startsWith('LazyInject'))return object;
    const field=this.field(object.class,['_value','eaky']);
    const value=this.get(object,field);
    return value.isNull()?this.method(object.class,'get_Value',0).bind(object).invoke():value;
  }
  problem(error) {
    if(this.closed || this.failed)return;
    this.failed=true;this.ctx.log('Encounter hook failed; disabling feature',{error:String(error)});
    setTimeout(()=>{if(!this.closed)Qol.disable(this.feature);},0);
  }
  replace(method,callback) {
    const wrapped=method.wrap(function(...args){return callback(this,args,()=>method.bind(this).invoke(...args));});
    Interceptor.replace(method.virtualAddress,wrapped);this.callbacks.push(wrapped);
    this.undo.push(()=>Interceptor.revert(method.virtualAddress));
  }
  before(method,callback) {
    this.replace(method,(object,args,original)=>{
      if(!this.closed && !this.failed)try{callback(object,args);}catch(error){this.problem(error);}
      return original();
    });
  }
  after(method,callback) {
    this.replace(method,(object,args,original)=>{
      const result=original();
      if(!this.closed && !this.failed)try{callback(object,args,result);}catch(error){this.problem(error);}
      return result;
    });
  }
  async install(feature) {
    this.feature=feature;
    await (PgqlGameEncounters.pendingRestore || Promise.resolve());
    if(this.closed)return;
    await this.scheduler.main(()=>{
      if(this.closed)return;
      PgqlGameVersion.require(Il2Cpp.application.version,'Encounter features require');
      try {
        if(feature==='instant-catch')this.instantCatch();
        else if(feature==='perfect-throw')this.perfectThrow();
        else if(feature==='headshot')this.headshot();
        else if(feature==='skip-encounter-intro')this.skipIntro();
        else throw Error('Unknown encounter feature');
        Interceptor.flush();
      }catch(error){this.dispose();throw error;}
    });
  }
  dispose() {
    if(this.closed)return;this.closed=true;
    // Restore fields and native entry points before releasing retained objects.
    for(const undo of this.undo.reverse())try{undo();}catch(error){this.ctx.log('Encounter cleanup failed',{error:String(error)});}
    this.undo=[];Interceptor.flush();
    const finish=()=>{
      for(const handle of [...this.pins])this.release(handle);
      for(const cleanup of (this.schedulerCleanup || []).reverse())try{cleanup();}catch(error){this.ctx.log('Scheduler cleanup failed',{error:String(error)});}
      this.schedulerCleanup=[];
    };
    if(this.restoreActions) {
      // Unity state restoration must run on its frame thread, including when the
      // toggle was changed from Android's UI thread. Re-enable waits for this.
      const pending=this.scheduler.main(this.restoreActions).catch(error=>{
        this.ctx.log('Action state restore unavailable; leave the encounter',{error:String(error)});
      }).finally(finish);
      PgqlGameEncounters.pendingRestore=Promise.all([PgqlGameEncounters.pendingRestore,pending]);
    } else finish();
    // Keep NativeCallbacks referenced for any native invocation already in flight.
  }
  instantCatch() {
    const interaction=this.type('Niantic.Holoholo.Encounter.EncounterInteractionState');
    const intro=this.method(interaction,'IntroCompleted',0);
    const stateField=this.typedField(interaction,'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>');
    const output=this.type('CatchPokemonOutProto');
    const status=this.protoField(output,'Status');
    const parse=output.methods.filter(m=>!m.isStatic && m.parameterCount===1 && m.returnType.name==='System.Void' && /(?:ParseContext|CodedInputStream)/.test(m.parameters[0].type.name));
    // Prefer the low-level reader, not the wrapper which may call it again.
    const low=parse.filter(m=>m.parameters[0].type.name.includes('ParseContext'));
    if((low.length?low:parse).length!==1)throw Error('Unsupported catch result parser');
    const merge=(low.length?low:parse)[0];
    const stateType=this.type('Niantic.Holoholo.Encounter.EncounterState');
    const complete=this.method(stateType,'EncounterStateComplete',1,'System.Void');
    let retained=null,generation=0,scheduled=false;
    const endListener=Interceptor.attach(complete.virtualAddress,{onEnter:args=>{
      if(retained && this.object(retained).handle.equals(args[0])){this.release(retained);retained=null;generation++;scheduled=false;}
    }});
    this.undo.push(()=>endListener.detach());
    this.before(intro,object=>{
      const state=this.unwrap(this.get(object,stateField));
      if(!stateType.isAssignableFrom(state.class))throw Error('Unexpected encounter state class');
      const next=this.pin(state);
      this.release(retained);retained=next;generation++;scheduled=false;
    });
    this.after(merge,object=>{
      const result=this.get(object,status);
      const code=typeof result==='number'?result:result.field('value__').value;
      if(code!==1 || !retained || scheduled)return;
      scheduled=true;const ticket=generation;
      this.scheduler.main(()=>{
        if(this.closed || this.failed || ticket!==generation || !retained)return;
        const state=this.object(retained);
        if(!state.isNull()){
          const parameter=complete.parameters[0].type;
          const reason=parameter.class.isEnum?new Il2Cpp.ValueType(Memory.alloc(parameter.class.valueTypeSize),parameter):0;
          complete.bind(state).invoke(reason);
          this.ctx.log('Successful catch: encounter closed');
        }
        this.release(retained);retained=null;
      }).catch(error=>this.problem(error));
    });
    this.ctx.log('Instant Catch armed for the next encounter');
  }
  perfectThrow() {
    const pokemon=this.type('Niantic.Holoholo.Encounter.EncounterPokemon');
    const actions=this.method(pokemon,'SetCanPerformActions',1,'System.Void');
    if(actions.parameters[0].type.name!=='System.Boolean')throw Error('Unsupported Pokemon actions argument');
    const invulnerable=this.method(pokemon,'get_Invulnerable',0,'System.Boolean');
    const reticle=this.type('Niantic.Holoholo.Encounter.Reticle');
    const normalized=this.method(reticle,'get_NormalizedSize',0,'System.Single');
    const bullseye=this.method(reticle,'ScreenPositionOverBullseye',undefined,'System.Boolean');
    const ball=this.type('Niantic.Holoholo.Encounter.Pokeball');
    const initialize=this.method(ball,'Initialize');
    const launch=this.method(ball,'Launch');
    const activate=this.method(ball,'SetActive',1,'System.Void',['System.Boolean']);
    const ground=this.field(ball,['HitGround'],t=>t.name==='System.Action');
    const kill=this.field(ball,['HitKillZone'],t=>t.name==='System.Action');
    const stateField=this.typedField(ball,'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>');
    const stateType=this.type('Niantic.Holoholo.Encounter.EncounterState');
    const raidCount=this.field(stateType,['<RaidBallCount>k__BackingField'],t=>t.name==='System.Int32');
    const complete=this.method(stateType,'EncounterStateComplete',1,'System.Void');
    const request=this.type('CatchPokemonProto'),ar=this.type('ARPlusEncounterValuesProto');
    const calculate=this.method(request,'CalculateSize',0,'System.Int32');
    const spin=this.protoField(request,'SpinModifier');
    const arValues=this.protoField(request,'ArPlusValues');
    const arCtor=this.method(ar,'.ctor',0),proximity=this.protoField(ar,'Proximity');
    const awareness=this.protoField(ar,'Awareness'),frightened=this.protoField(ar,'PokemonFrightened');
    for(const f of [spin,proximity,awareness])if(!['System.Single','System.Double'].includes(f.type.name))throw Error('Unsupported numeric field: '+f.name);
    if(frightened.type.name!=='System.Boolean' || arValues.type.name!==ar.fullName)throw Error('Unsupported AR+ fields');
    const balls=new Map();
    const actionStates=new Map();
    this.restoreActions=()=>{
      for(const entry of actionStates.values())actions.bind(this.object(entry.handle)).invoke(entry.requested);
      actionStates.clear();
    };
    this.before(actions,(object,args)=>{
      const key=object.handle.toString();let entry=actionStates.get(key);
      if(!entry){
        if(actionStates.size>=128)throw Error('Encounter retention limit reached');
        entry={handle:this.pin(object)};actionStates.set(key,entry);
      }
      entry.requested=args[0];args[0]=false;
    });
    this.replace(invulnerable,()=>false);
    this.replace(normalized,()=>0.05);
    this.replace(bullseye,()=>true);
    this.after(initialize,object=>{
      const key=object.handle.toString();
      const previous=balls.get(key);if(previous)restore(previous);
      if(!previous && balls.size>=128)throw Error('Encounter ball retention limit reached; re-enable outside an encounter');
      const entry={ball:this.pin(object),ground:this.pin(this.get(object,ground)),kill:this.pin(this.get(object,kill)),callback:null,recovered:false,active:true};
      balls.set(key,entry);
      const recovery=Il2Cpp.delegate(ground.type.class,()=>{
        if(this.closed || this.failed || !entry.active || entry.recovered)return;
        try {
          entry.recovered=true;
          const current=this.object(entry.ball),state=this.unwrap(this.get(current,stateField));
          if(!stateType.isAssignableFrom(state.class))throw Error('Unexpected encounter state class');
          const count=this.get(state,raidCount);
          if(count>0)this.set(state,raidCount,count+1);
          activate.bind(current).invoke(true);
          this.ctx.log('Missed ball reactivated');
        }catch(error){this.problem(error);}
      });
      entry.callback=this.pin(recovery);
      this.set(object,ground,recovery);this.set(object,kill,recovery);
    });
    // Each new launch permits one recovery, even if both miss events fire.
    // Headshot also observes Launch, so use an attach listener rather than replace.
    const listener=Interceptor.attach(launch.virtualAddress,{onEnter:args=>{const entry=balls.get(args[0].toString());if(entry)entry.recovered=false;}});
    this.undo.push(()=>listener.detach());
    const restore=entry=>{
      entry.active=false;
      const object=this.object(entry.ball),replacement=this.object(entry.callback);
      if(!object.isNull()){
        if(this.get(object,ground).handle.equals(replacement.handle))this.set(object,ground,this.object(entry.ground));
        if(this.get(object,kill).handle.equals(replacement.handle))this.set(object,kill,this.object(entry.kill));
      }
      for(const key of ['ball','ground','kill','callback'])this.release(entry[key]);
    };
    this.undo.push(()=>{for(const entry of balls.values())restore(entry);balls.clear();});
    const end=Interceptor.attach(complete.virtualAddress,{onEnter:()=>{
      if(this.closed)return;
      try {
        for(const entry of balls.values())restore(entry);balls.clear();
        for(const entry of actionStates.values())this.release(entry.handle);actionStates.clear();
      }catch(error){this.problem(error);}
    }});
    this.undo.push(()=>end.detach());
    this.before(calculate,object=>{
      let values=this.get(object,arValues);
      if(values.isNull()){values=ar.alloc();arCtor.bind(values).invoke();this.set(object,arValues,values);}
      this.set(values,proximity,0.475);this.set(values,awareness,0);this.set(values,frightened,false);
      this.set(object,spin,1);
    });
  }
  // The intro is the encounter camera's tween-in. Its two durations live on a
  // controller that outlives encounters, so the originals are kept and restored.
  skipIntro() {
    const interaction=this.type('Niantic.Holoholo.Encounter.EncounterInteractionState');
    const enter=this.method(interaction,'EnterState',0,'System.Void');
    const stateField=this.typedField(interaction,'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>');
    const cameraField=this.field(interaction,['parkCameraController'],t=>t.name==='Niantic.Holoholo.Encounter.EncounterParkCameraController');
    const tween=this.field(cameraField.type.class,['tweenDurationSeconds'],t=>t.name==='System.Single');
    const intro=this.field(cameraField.type.class,['introDurationSeconds'],t=>t.name==='System.Single');
    const stateType=this.type('Niantic.Holoholo.Encounter.EncounterState');
    const special=this.field(stateType,['<IsRaidOrIncidentEncounter>k__BackingField'],t=>t.name==='System.Boolean');
    const cameras=new Map();
    this.restoreActions=()=>{
      for(const entry of cameras.values()) {
        const camera=this.object(entry.handle);
        if(!camera.isNull()){this.set(camera,tween,entry.tween);this.set(camera,intro,entry.intro);}
      }
      cameras.clear();
    };
    this.after(enter,object=>{
      const camera=this.get(object,cameraField);if(camera.isNull())return;
      const key=camera.handle.toString();let entry=cameras.get(key);
      if(!entry) {
        if(cameras.size>=8)throw Error('Encounter camera retention limit reached');
        entry={handle:this.pin(camera),tween:this.get(camera,tween),intro:this.get(camera,intro)};cameras.set(key,entry);
      }
      const state=this.unwrap(this.get(object,stateField));
      if(!stateType.isAssignableFrom(state.class))throw Error('Unexpected encounter state class');
      // Raid and Team GO Rocket encounters keep the game's own intro.
      const keep=this.get(state,special)===true;
      this.set(camera,tween,keep?entry.tween:0);this.set(camera,intro,keep?entry.intro:0);
    });
    this.ctx.log('Skip Encounter Intro armed for the next encounter');
  }
  headshot() {
    const ball=this.type('Niantic.Holoholo.Encounter.Pokeball');
    const launch=this.method(ball,'Launch'),collision=this.method(ball,'OnCollisionEnter',1,'System.Void');
    const pokemonField=this.typedField(ball,'Niantic.Holoholo.Encounter.IEncounterPokemon');
    const reticleField=this.typedField(ball,'Niantic.Holoholo.Encounter.IReticle');
    const ballType=this.field(ball,['<BallType>k__BackingField']);
    const transform=this.method(ball,'get_Transform',0);
    const reticleTransform=this.method(this.type('Niantic.Holoholo.Encounter.Reticle'),'get_Transform',0);
    const pokemon=this.type('Niantic.Holoholo.Encounter.EncounterPokemon');
    const invulnerable=this.method(pokemon,'set_Invulnerable',1,'System.Void');
    const gameObject=this.method(pokemon,'get_GameObject',0);
    const component=this.method(gameObject.returnType.class,'GetComponentInChildren',1,undefined,['System.Type']);
    if(component.parameters[0].type.name!=='System.Type')throw Error('Unsupported collider lookup');
    const collider=this.type('UnityEngine.Collider'),entity=this.method(collider,'GetEntityId',0);
    const pairField=this.field(collision.parameters[0].type.class,['m_Pair']);
    const otherCollider=this.field(pairField.type.class,['m_OtherColliderID']);
    if(otherCollider.type.name!==entity.returnType.name)throw Error('Unsupported collision entity ID');
    const position=this.method(transform.returnType.class,'get_position',0);
    const setPosition=this.method(transform.returnType.class,'set_position',1,'System.Void');
    const vector=this.type('UnityEngine.Vector3'),lerp=this.method(vector,'Lerp',3);
    const owner=this;
    // Attach preserves independence from Perfect Throw's Launch observer.
    const listener=Interceptor.attach(launch.virtualAddress,{onEnter(args){
      if(owner.closed || owner.failed)return;
      try {
        const object=new Il2Cpp.Object(args[0]),target=owner.get(object,pokemonField);
        if(target.isNull())return;
        invulnerable.bind(target).invoke(false);
        const item=owner.get(object,ballType),kind=typeof item==='number'?item:item.field('value__').value;
        if(kind===4)return;
        const aim=owner.get(object,reticleField);if(aim.isNull())return;
        const from=transform.bind(object).invoke(),to=reticleTransform.bind(aim).invoke();
        const value=lerp.invoke(position.bind(from).invoke(),position.bind(to).invoke(),0.9);
        setPosition.bind(from).invoke(value);
      }catch(error){owner.problem(error);}
    }});
    this.undo.push(()=>listener.detach());
    this.before(collision,(object,args)=>{
      const target=this.get(object,pokemonField);if(target.isNull() || args[0].isNull())return;
      const go=gameObject.bind(target).invoke();if(go.isNull())return;
      const hit=component.bind(go).invoke(collider.type.object);if(hit.isNull())return;
      // Preserve the rest of the actual contact pair instead of zeroing it.
      const pair=this.get(args[0],pairField);
      this.set(pair,otherCollider,entity.bind(hit).invoke());
      this.set(args[0],pairField,pair);
    });
  }
};
