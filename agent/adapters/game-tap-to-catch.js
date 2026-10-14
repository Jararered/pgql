'use strict';
// Original adapter for Tap to Catch. Tapping a Pokémon on the map sends the
// game's own encounter request, feeds the Pinap Master berry when that module
// is on, and calls MapPokemon.TryCapture with a throw built from the enabled
// throw modules, without opening the encounter scene. Holding the Pokémon opens
// the normal encounter. PgqlCatchPolicy owns the rules. Names are verified from
// live managed metadata; there are no offsets. Hold-to-open, ball memory, map
// removal and toasts are optional parts: if one cannot be bound the catch still works.
globalThis.PgqlGameTapToCatch = class PgqlGameTapToCatch {
  constructor(ctx,{select,modules}={}) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.failed=false;this.limits={};
    this.select=select || (key=>Qol.setConfig('tap-to-catch','ball',key));
    this.modules=modules || (()=>Qol.describe());
    this.stats={taps:0,caught:0,fled:0,escaped:0,missed:0,errors:0,berries:0,blocked:0,empty:0,opened:0,last:null};
    this.pending=new Map();this.implementations=new Map();this.hold=null;this.holdOpening=false;this.undo=[];this.callbacks=[];
    ctx.cleanup(()=>this.close());
  }
  static get holdMs(){return 800;}
  static get timeoutMs(){return 15000;}
  static number(value){return typeof value==='number'?value:value.field('value__').value;}
  // Enum fields are value types to the bridge: a plain number cannot be written to them.
  static setEnum(field,object,value) {
    const cell=Memory.alloc(8);cell.writeS32(value);
    field.bind(object).value=new Il2Cpp.ValueType(cell,field.type);
  }
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Tap to Catch supports');
    const type=name=>this.game.type(name),number=PgqlGameTapToCatch.number;
    const args=m=>m.parameters.map(p=>p.type.name).join('|');
    const plain=(klass,name,params,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&args(m)===params.join('|'));
      if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))throw Error('Unsupported Tap to Catch method: '+klass.type.name+'.'+name);
      return matches[0];
    };
    // The nearest declaration in the class hierarchy.
    const inherited=(klass,name,params,returns)=>{
      for(const owner of klass.hierarchy({includeCurrent:true})) {
        const matches=owner.methods.filter(m=>m.name===name&&!m.isGeneric&&!m.isStatic&&args(m)===params.join('|'));
        if(matches.length>1)break;
        if(matches.length===1&&(!returns||matches[0].returnType.name===returns))return matches[0];
      }
      throw Error('Unsupported Tap to Catch method: '+klass.type.name+'.'+name);
    };
    const typed=(klass,typeName)=>{
      const matches=klass.fields.filter(f=>!f.isStatic&&f.type.name===typeName);
      if(matches.length!==1)throw Error('Unsupported Tap to Catch field: '+klass.type.name+' of type '+typeName);
      return matches[0];
    };
    // A throw field by name (or auto-property backing field) and type.
    const member=(klass,name,typeName)=>{
      const matches=klass.fields.filter(f=>!f.isStatic&&(f.name===name||f.name==='<'+name+'>k__BackingField'));
      if(matches.length!==1||matches[0].type.name!==typeName)throw Error('Unsupported throw field: '+name);
      return matches[0];
    };
    const constant=(klass,name)=>number(klass.field(name).value);
    const explore=type('Niantic.Holoholo.Map.MapExploreState'),map=type('Niantic.Holoholo.Map.MapPokemon');
    const item=type('Holoholo.Rpc.Item'),bag=type('Niantic.Holoholo.IItemBag'),object=type('UnityEngine.Object');
    for(const ball of PgqlCatchPolicy.balls)
      if(constant(item,ball.item)!==ball.id)throw Error('Unexpected item number for '+ball.item);
    plain(bag,'GetItemCount',['Holoholo.Rpc.Item'],'System.Int32');
    plain(bag,'UseItemForEncounter',['Holoholo.Rpc.Item','Niantic.Holoholo.Map.IMapPokemon'],'Niantic.Promises.IPromise<Holoholo.Rpc.UseItemEncounterOutProto>');
    plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
    const capture=plain(map,'TryCapture',['Niantic.Holoholo.Encounter.PokeballThrow','Holoholo.Rpc.ARPlusEncounterValuesProto'],
      'Niantic.Promises.IPromise<Holoholo.Rpc.CatchPokemonOutProto>');
    const toss=capture.parameters[0].type.class,ar=capture.parameters[1].type.class;
    const proto=name=>{
      const fields=ar.fields.filter(f=>!f.isStatic&&f.name.replace(/^_|_$/g,'').toLowerCase()===name.toLowerCase());
      if(fields.length!==1)throw Error('Unsupported AR+ field: '+name);
      return fields[0];
    };
    const output=type('Holoholo.Rpc.CatchPokemonOutProto');
    const statuses=output.fields.filter(f=>!f.isStatic&&f.name.replace(/^_|_$/g,'').toLowerCase()==='status');
    if(statuses.length!==1||!statuses[0].type.class.isEnum)throw Error('Unsupported catch result status');
    const names=new Map();
    for(const f of statuses[0].type.class.fields)if(f.isStatic)names.set(number(f.value),f.name);
    if(![...names.values()].includes('CatchSuccess'))throw Error('Unsupported catch result status values');
    const bound={
      explore,map,selected:plain(explore,'PokemonSelected',['Niantic.Holoholo.Map.MapPokemon','System.Boolean'],'System.Void'),
      encounter:plain(map,'SendEncounterRequest',[],'Niantic.Promises.IPromise<Niantic.Holoholo.Map.PokemonEncounterResponse>'),
      encounterId:plain(map,'get_EncounterId',[],'System.UInt64'),capture,
      toss:{klass:toss,ctor:toss.isValueType?null:plain(toss,'.ctor',[],'System.Void'),
        ball:member(toss,'BallType','Holoholo.Rpc.Item'),reticle:member(toss,'ReticleSize','System.Single'),
        bullseye:member(toss,'HitBullseye','System.Boolean'),spinning:member(toss,'Spinning','System.Boolean'),
        missed:member(toss,'Missed','System.Boolean')},
      ar:{klass:ar,ctor:plain(ar,'.ctor',[],'System.Void'),proximity:proto('Proximity'),awareness:proto('Awareness'),frightened:proto('PokemonFrightened')},
      status:statuses[0],names,bag,
      scene:type('Niantic.Holoholo.MapSceneContext'),findOne:plain(object,'FindObjectOfType',['System.Type'],null,true),
      remove:null,memory:null,hold:null,toast:null};
    for(const f of [bound.ar.proximity,bound.ar.awareness])if(!['System.Single','System.Double'].includes(f.type.name))throw Error('Unsupported AR+ field: '+f.name);
    if(bound.ar.frightened.type.name!=='System.Boolean')throw Error('Unsupported AR+ field: PokemonFrightened');
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Tap to Catch: '+name+' unavailable',{error:String(error)});}
    };
    optional('remove',()=>{
      const handler=type('Niantic.Holoholo.Map.MapContentHandler');
      return {handler:typed(explore,'Niantic.Holoholo.Map.MapContentHandler'),
        register:plain(handler,'RegisterPokemonCaughtOrFled',['System.UInt64'],'System.Void'),destroy:inherited(map,'Destroy',[],'System.Void')};
    });
    optional('memory',()=>plain(type('Niantic.Holoholo.Encounter.EncounterInteractionState'),'SelectPokeball',['Holoholo.Rpc.Item'],'System.Void'));
    optional('hold',()=>{
      const gesture=type('TouchScript.Gestures.TapGesture');
      const own=name=>{
        const matches=gesture.methods.filter(m=>m.name===name&&!m.isStatic);
        if(matches.length!==1||matches[0].virtualAddress.isNull())throw Error('Unsupported tap gesture method: '+name);
        return matches[0];
      };
      plain(type('UnityEngine.Component'),'get_gameObject',[]);plain(type('UnityEngine.GameObject'),'GetComponent',['System.Type']);
      plain(type('Niantic.Holoholo.Map.IMapExploreState'),'PokemonSelected',['Niantic.Holoholo.Map.MapPokemon','System.Boolean'],'System.Void');
      return {began:own('touchBegan'),ended:own('touchEnded'),iface:type('Niantic.Holoholo.Map.IMapExploreState')};
    });
    optional('toast',()=>{
      const service=type('Niantic.Holoholo.UI.IToastService'),params=['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'];
      const options=plain(service,'OneLine',params,'Niantic.Holoholo.UI.IToastReceipt').parameters[1].type.class;
      plain(options,'.ctor',[],'System.Void');
      for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],['DisplaySecondsOverride','System.Nullable<System.Single>']])
        if(options.field(name).type.name!==expected)throw Error('Unsupported toast field: '+name);
      const nullable=options.field('DisplaySecondsOverride').type.class;
      nullable.field('hasValue');nullable.field('value');
      return {service,params:options};
    });
    this.bound=bound;
    return bound;
  }
  service(klass) {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())throw Error('Game map unavailable');
    const service=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(klass.type.object);
    if(service.isNull())throw Error('Game service unavailable: '+klass.type.name);
    return service;
  }
  pin(object) {
    const handle=this.game.handleNew(object.handle,1);
    if(handle.isNull())throw Error('Unable to retain game object');
    return handle;
  }
  object(handle){return new Il2Cpp.Object(this.game.handleTarget(handle));}
  free(handle){if(handle)try{this.game.handleFree(handle);}catch(error){this.ctx.log('Tap to Catch handle release failed',{error:String(error)});}}
  // The tapped object's own implementation: spawns are subclasses of
  // MapPokemon, and calling a base declaration directly is not dispatch.
  own(object,method) {
    const klass=object.class;
    if(!klass.hierarchy)return method.bind(object);
    const key=klass.handle.toString()+':'+method.name,signature=m=>m.parameters.map(p=>p.type.name).join('|');
    let found=this.implementations.get(key);
    if(!found) {
      for(const owner of klass.hierarchy({includeCurrent:true})) {
        found=owner.methods.find(m=>m.name===method.name&&!m.isStatic&&!m.isGeneric&&signature(m)===signature(method)&&!m.virtualAddress.isNull());
        if(found)break;
      }
      if(!found)throw Error('No implementation of '+method.name+' in '+klass.type.name);
      this.implementations.set(key,found);
    }
    return found.bind(object);
  }
  enabled(id){const module=this.modules().find(m=>m.id===id);return module?module:null;}
  // Calls onThen with the promise value, or onError, on the game thread.
  // Callback handles are released on a later frame, not inside the callback.
  request(promise,valueType,onThen,onError) {
    if(promise.isNull())throw Error('Game request was not sent');
    const methods=[...promise.class.hierarchy({includeCurrent:true})].flatMap(klass=>klass.methods);
    const then=methods.find(m=>m.name==='Then'&&!m.isStatic&&m.parameterCount===1&&m.parameters[0].type.name==='System.Action<'+valueType+'>');
    const errors=methods.filter(m=>m.name==='Error'&&!m.isStatic&&m.parameterCount===1&&m.parameters[0].type.name.startsWith('System.Action<'));
    const error=errors.find(m=>m.parameters[0].type.name==='System.Action<System.String>') || (errors.length===1?errors[0]:null);
    if(!then||!error)throw Error('Unsupported game promise: '+promise.class.type.name);
    const pins=[];let finished=false;
    const keep=object=>{pins.push(this.pin(object));return object;};
    const settle=(fn,value)=>{
      if(finished)return;
      finished=true;
      this.game.main(()=>{for(const handle of pins.splice(0))this.free(handle);}).catch(()=>{});
      if(this.closed)return;
      try{fn(value);}catch(problem){this.ctx.log('Tap to Catch callback failed',{error:String(problem)});}
    };
    try {
      keep(promise);
      error.bind(promise).invoke(keep(Il2Cpp.delegate(error.parameters[0].type.class,reason=>settle(onError,reason))));
      then.bind(promise).invoke(keep(Il2Cpp.delegate(then.parameters[0].type.class,value=>settle(onThen,value))));
    }catch(problem){for(const handle of pins.splice(0))this.free(handle);finished=true;throw problem;}
  }
  counts(bag) {
    const counts={};
    for(const ball of PgqlCatchPolicy.balls)counts[ball.id]=this.game.method(bag,'GetItemCount',1).invoke(ball.id);
    return counts;
  }
  // Runs on the game thread in place of opening the encounter.
  tapped(explore,pokemon) {
    const b=this.bound,raw=this.own(pokemon,b.encounterId).invoke(),id=String(raw);
    if(this.pending.has(id)){this.ctx.log('Tap to Catch: catch already in progress');return;}
    this.stats.taps++;
    const cooldown=globalThis.PgqlGameCooldown && PgqlGameCooldown.current;
    if(cooldown && cooldown.blockThrow()){this.stats.blocked++;this.ctx.log('Tap to Catch: held back by the cooldown');return;}
    const bag=this.service(b.bag);
    if(!PgqlCatchPolicy.pickBall({preferred:this.ctx.config.ball,counts:this.counts(bag)}).ball) {
      this.stats.empty++;this.notify('You have no Poké Balls');return;
    }
    const tap={id,raw,pokemon:this.pin(pokemon),handler:null,done:false,timer:null};
    if(b.remove && !this.limits.remove) {
      const handler=b.remove.handler.bind(explore).value;
      if(!handler.isNull())tap.handler=this.pin(handler);
    }
    this.pending.set(id,tap);
    tap.timer=setTimeout(()=>{
      if(tap.done)return;
      this.stats.errors++;this.ctx.log('Tap to Catch: no answer from the game');
      this.game.main(()=>this.end(tap)).catch(()=>this.end(tap));
    },PgqlGameTapToCatch.timeoutMs);
    try {
      this.request(this.own(pokemon,b.encounter).invoke(),'Niantic.Holoholo.Map.PokemonEncounterResponse',
        ()=>this.encountered(tap,bag),reason=>this.failure(tap,'Encounter request failed',reason));
    }catch(error){this.end(tap);throw error;}
  }
  failure(tap,message,reason) {
    if(tap.done)return;
    this.stats.errors++;
    this.ctx.log('Tap to Catch: '+message,{reason:reason===undefined||reason===null?null:String(reason)});
    this.notify('Catch failed');this.end(tap);
  }
  // Pinap Master's berry first when that module is on and the berry is in the bag.
  encountered(tap,bag) {
    if(tap.done)return;
    const module=this.enabled('pinap-master');
    let berry=null;
    try{berry=module&&module.enabled?PgqlBerryPolicy.parse(module.config.berry):null;}catch(_){berry=null;}
    if(!berry || !(this.game.method(bag,'GetItemCount',1).invoke(berry.id)>0)){this.throwBall(tap,bag);return;}
    const proceed=()=>{if(!tap.done)this.throwBall(tap,bag);};
    try {
      this.request(this.game.method(bag,'UseItemForEncounter',2).invoke(berry.id,this.object(tap.pokemon)),'Holoholo.Rpc.UseItemEncounterOutProto',
        ()=>{this.stats.berries++;this.ctx.log('Tap to Catch fed a berry',{berry:berry.key});proceed();},
        reason=>{this.ctx.log('Tap to Catch: berry request failed; throwing anyway',{reason:String(reason)});proceed();});
    }catch(error){this.ctx.log('Tap to Catch: berry unavailable; throwing anyway',{error:String(error)});proceed();}
  }
  makeThrow(spec,ball) {
    const t=this.bound.toss;
    let object;
    if(t.klass.isValueType)object=new Il2Cpp.ValueType(Memory.alloc(t.klass.valueTypeSize),t.klass.type);
    else{object=t.klass.alloc();t.ctor.bind(object).invoke();}
    PgqlGameTapToCatch.setEnum(t.ball,object,ball.id);
    t.reticle.bind(object).value=spec.reticle;t.bullseye.bind(object).value=spec.bullseye;
    t.spinning.bind(object).value=spec.spinning;t.missed.bind(object).value=spec.missed;
    return object;
  }
  makeValues(values) {
    const a=this.bound.ar,object=a.klass.alloc();
    a.ctor.bind(object).invoke();
    if(values){a.proximity.bind(object).value=values.proximity;a.awareness.bind(object).value=values.awareness;a.frightened.bind(object).value=values.frightened;}
    return object;
  }
  throwBall(tap,bag) {
    if(tap.done)return;
    const pick=PgqlCatchPolicy.pickBall({preferred:this.ctx.config.ball,counts:this.counts(bag)});
    if(!pick.ball){this.stats.empty++;this.notify('You have no Poké Balls');this.end(tap);return;}
    const on=id=>{const module=this.enabled(id);return !!(module&&module.enabled);};
    const spec=PgqlCatchPolicy.throwFor({perfectThrow:on('perfect-throw'),headshot:on('headshot')});
    this.stats.last={ball:pick.ball.label,fallback:pick.fallback,excellent:spec.spinning,ring:spec.bullseye};
    this.ctx.log('Tap to Catch throwing',{ball:pick.ball.key,fallback:pick.fallback,reticle:spec.reticle,bullseye:spec.bullseye,curveball:spec.spinning});
    const pokemon=this.object(tap.pokemon);
    this.request(this.own(pokemon,this.bound.capture).invoke(this.makeThrow(spec,pick.ball),this.makeValues(spec.ar)),'Holoholo.Rpc.CatchPokemonOutProto',
      output=>this.result(tap,output,pick),reason=>this.failure(tap,'Catch request failed',reason));
  }
  result(tap,output,pick) {
    if(tap.done)return;
    const b=this.bound,code=PgqlGameTapToCatch.number(b.status.bind(output).value),name=b.names.get(code) || String(code);
    const outcome=PgqlCatchPolicy.outcome(name);
    this.stats[outcome==='error'?'errors':outcome]++;
    if(this.stats.last)this.stats.last.outcome=outcome;
    this.ctx.log('Tap to Catch result',{status:name,outcome,scores:this.scores(output)});
    if(outcome==='caught'||outcome==='fled')this.removeFromMap(tap);
    const text={caught:'Caught with '+(pick.fallback?'a ':'your ')+pick.ball.label,fled:'The Pokémon fled',escaped:'It broke free. Tap again',
      missed:'Missed. Tap again',error:'Catch failed'}[outcome];
    this.notify(text);
    this.end(tap);
  }
  // The server's award list (throw bonuses show up as activities), for the log only.
  scores(output) {
    try {
      const scores=this.game.value(output,'Scores');
      if(!scores||scores.isNull())return null;
      const list=name=>this.game.array(this.game.value(scores,name)).map(v=>typeof v==='number'?v:PgqlGameTapToCatch.number(v));
      return {activities:list('ActivityType'),xp:list('Exp')};
    }catch(_){return null;}
  }
  removeFromMap(tap) {
    const r=this.bound.remove;
    if(!r||this.limits.remove)return;
    try {
      if(tap.handler)r.register.bind(this.object(tap.handler)).invoke(tap.raw);
      const pokemon=this.object(tap.pokemon);
      if(!pokemon.isNull())this.own(pokemon,r.destroy).invoke();
    }catch(error){this.limits.remove=String(error.message || error);this.ctx.log('Tap to Catch: map removal unavailable',{error:String(error)});}
  }
  end(tap) {
    if(tap.done)return;
    tap.done=true;clearTimeout(tap.timer);
    if(this.pending.get(tap.id)===tap)this.pending.delete(tap.id);
    this.free(tap.pokemon);this.free(tap.handler);
  }
  notify(text) {
    const t=this.bound&&this.bound.toast;
    if(!t||this.limits.toast||!this.ctx.config.showToast)return;
    try {
      const service=this.service(t.service),params=t.params.alloc();
      params.method('.ctor',0).invoke();
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=2;seconds.field('hasValue').value=true;
      const shown=service.class.methods.find(m=>m.name==='OneLine'&&!m.isStatic&&m.parameterCount===2&&
        m.parameters[1].type.name==='Niantic.Holoholo.UI.ToastService.ToastParams');
      if(!shown)throw Error('Unsupported game toast service');
      shown.bind(service).invoke(Il2Cpp.string(text),params);
    }catch(error){this.limits.toast=String(error.message || error);this.ctx.log('Tap to Catch toast failed; continuing without toasts',{error:String(error)});}
  }
  // The last ordinary ball chosen in a regular encounter becomes the setting.
  remember(id) {
    const key=PgqlCatchPolicy.key(id);
    if(!key||key===this.ctx.config.ball)return;
    setTimeout(()=>{
      if(this.closed)return;
      try{this.select(key);this.ctx.log('Tap to Catch ball remembered',{ball:key});}
      catch(error){this.ctx.log('Tap to Catch: ball not saved',{error:String(error)});}
    },0);
  }
  // A press on a map Pokémon; after holdMs it opens the normal encounter.
  holdBegan(gesture) {
    this.cancelHold();
    if(!this.ctx.config.holdToOpen)return;
    const go=gesture.method('get_gameObject',0).invoke();if(go.isNull())return;
    const pokemon=go.method('GetComponent',1).overload('System.Type').invoke(this.bound.map.type.object);
    if(pokemon.isNull())return;
    const hold={gesture:gesture.handle,pokemon:this.pin(pokemon),recognized:false,consumed:false,ended:false};
    hold.timer=setTimeout(()=>{if(this.hold===hold)hold.recognized=true;},PgqlGameTapToCatch.holdMs);
    // A press that never ends (gesture cancelled) is dropped.
    hold.expiry=setTimeout(()=>{if(this.hold===hold)this.game.main(()=>{if(this.hold===hold)this.cancelHold();}).catch(()=>{});},10000);
    this.hold=hold;
  }
  holdEnded(gesture) {
    const hold=this.hold;
    if(!hold||!gesture.handle.equals(hold.gesture))return;
    hold.ended=true;
    if(!hold.recognized)this.cancelHold();
  }
  // After the gesture finished: open the encounter if the tap itself did not.
  holdFinished() {
    const hold=this.hold;
    if(!hold||!hold.ended)return;
    const open=hold.recognized&&!hold.consumed,pokemon=open?this.object(hold.pokemon):null;
    hold.consumed=true;
    try{if(open&&!pokemon.isNull())this.openNormally(pokemon);}finally{this.cancelHold();}
  }
  openNormally(pokemon) {
    const b=this.bound,state=this.service(b.hold.iface);
    if(!b.explore.isAssignableFrom(state.class))throw Error('Unexpected map state class');
    this.stats.opened++;this.ctx.log('Tap to Catch: hold opened the encounter');
    this.holdOpening=true;
    try{b.selected.bind(state).invoke(pokemon,false);}finally{this.holdOpening=false;}
  }
  cancelHold() {
    const hold=this.hold;
    if(!hold)return;
    this.hold=null;clearTimeout(hold.timer);clearTimeout(hold.expiry);this.free(hold.pokemon);
  }
  // PokemonSelected: a recognized hold or a disabled module opens the
  // encounter, anything else is caught from the map.
  selected(explore,pokemon,original) {
    if(this.closed||this.failed||this.holdOpening||pokemon.isNull())return original();
    const hold=this.hold;
    if(hold&&hold.recognized&&!hold.consumed&&this.object(hold.pokemon).handle.equals(pokemon.handle)) {
      hold.consumed=true;this.stats.opened++;this.ctx.log('Tap to Catch: hold opened the encounter');
      return original();
    }
    try{this.tapped(explore,pokemon);}
    catch(error) {
      this.stats.errors++;this.ctx.log('Tap to Catch failed; opening the encounter',{error:String(error),pokemon:pokemon.class&&pokemon.class.type?pokemon.class.type.name:null});
      return original();
    }
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this,method=b.selected;
      const wrapped=method.wrap(function(pokemon,allowHidden) {
        return self.selected(this,pokemon,()=>method.bind(this).invoke(pokemon,allowHidden));
      });
      Interceptor.replace(method.virtualAddress,wrapped);this.callbacks.push(wrapped);
      this.undo.push(()=>Interceptor.revert(method.virtualAddress));
      if(b.memory)this.ctx.hook(b.memory.virtualAddress,{onEnter(args) {
        if(self.closed)return;
        try{self.remember(args[1].toInt32());}catch(error){self.ctx.log('Tap to Catch: ball memory failed',{error:String(error)});}
      }});
      if(b.hold) {
        const guard=fn=>function(args){if(self.closed)return;try{fn.call(this,args);}catch(error){self.cancelHold();self.ctx.log('Tap to Catch: hold failed',{error:String(error)});}};
        this.ctx.hook(b.hold.began.virtualAddress,{onEnter:guard(args=>self.holdBegan(new Il2Cpp.Object(args[0])))});
        this.ctx.hook(b.hold.ended.virtualAddress,{onEnter:guard(args=>self.holdEnded(new Il2Cpp.Object(args[0]))),onLeave:guard(()=>self.holdFinished())});
      }
      Interceptor.flush();
      this.ctx.log('Tap to Catch ready',{ball:this.ctx.config.ball,hold:!!b.hold,memory:!!b.memory,remove:!!b.remove,toast:!!b.toast});
      return true;
    });
  }
  report() {
    const s=this.stats,lines=['Ball: '+PgqlCatchPolicy.parse(this.ctx.config.ball).label,
      'Taps: '+s.taps+' (caught '+s.caught+', fled '+s.fled+', broke free '+s.escaped+', missed '+s.missed+', errors '+s.errors+')',
      'Berries fed: '+s.berries];
    if(s.blocked)lines.push('Held back by cooldown: '+s.blocked);
    if(s.empty)lines.push('Out of balls: '+s.empty);
    if(s.opened)lines.push('Opened by holding: '+s.opened);
    if(s.last)lines.push('Last: '+s.last.ball+(s.last.excellent?', Excellent curveball':s.last.ring?', inside the ring':'')+(s.last.outcome?' ('+s.last.outcome+')':''));
    for(const [name,label] of [['hold','Hold to open'],['memory','Ball memory'],['remove','Map removal'],['toast','Toasts']])
      if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  close() {
    if(this.closed)return;
    this.closed=true;
    for(const undo of this.undo.splice(0).reverse())try{undo();}catch(error){this.ctx.log('Tap to Catch cleanup failed',{error:String(error)});}
    if(this.bound)Interceptor.flush();
    this.cancelHold();
    for(const tap of [...this.pending.values()])this.end(tap);
    // Keep the replaced callback referenced for any call already in flight.
  }
};
