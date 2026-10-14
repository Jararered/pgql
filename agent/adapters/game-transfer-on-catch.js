'use strict';
// Original 0.431.0 adapter. Watches for caught Pokemon (the parsed catch result,
// and accessory catches in the action log), waits for the new Pokemon to reach
// the bag and releases it through the game's own bag service unless
// PgqlTransferPolicy keeps it. Names are verified from live managed metadata;
// there are no offsets. The toast, the accessory trigger and the per-encounter
// bypass are optional parts: if one cannot be bound the rest still works.
globalThis.PgqlGameTransferOnCatch = class PgqlGameTransferOnCatch {
  constructor(ctx) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.failed=false;
    this.stats={transferred:0,kept:0,unconfirmed:0,last:null};this.limits={};
    this.lastId=null;this.accessoryIds=new Set();this.bypass=false;this.sliders=new Set();this.undo=[];this.callbacks=[];
    ctx.cleanup(()=>this.close());
  }
  static get maxFrames(){return 600;}
  static number(value){return typeof value==='number'?value:value.field('value__').value;}
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    if(version!=='0.431.0')throw Error('Transfer on Catch supports game 0.431.0; found '+version);
    const type=name=>this.game.type(name),number=PgqlGameTransferOnCatch.number;
    const plain=(klass,name,args,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&
        m.parameters.map(p=>p.type.name).join('|')===args.join('|'));
      if(matches.length!==1||matches[0].returnType.name!==returns)throw Error('Unsupported transfer method: '+name);
      return matches[0];
    };
    const field=(klass,name,expected)=>{
      const found=klass.field(name);
      if(found.type.name!==expected)throw Error('Unsupported transfer field: '+name);
      return found;
    };
    const constant=(klass,name)=>number(klass.field(name).value);
    const output=type('Holoholo.Rpc.CatchPokemonOutProto'),pokemon=type('Holoholo.Rpc.PokemonProto'),settings=type('Holoholo.Rpc.PokemonSettingsProto');
    const display=type('Holoholo.Rpc.PokemonDisplayProto'),detail=type('Holoholo.Rpc.PokemonCreateDetail'),bag=type('Niantic.Holoholo.IPokemonBag');
    const parsers=output.methods.filter(m=>!m.isStatic&&m.parameterCount===1&&m.returnType.name==='System.Void'&&m.parameters[0].type.name.includes('ParseContext'));
    if(parsers.length!==1)throw Error('Unsupported catch result parser');
    plain(bag,'GetPokemon',['System.UInt64'],'Holoholo.Rpc.PokemonProto');
    plain(bag,'ReleasePokemon',['Holoholo.Rpc.PokemonProto'],'Niantic.Promises.IPromise<Holoholo.Rpc.ReleasePokemonOutProto>');
    plain(settings,'get_IsTransferable',[],'System.Boolean');plain(settings,'get_PokemonClass',[],'Holoholo.Rpc.HoloPokemonClass');
    plain(detail,'get_OriginDetailCase',[],'Holoholo.Rpc.PokemonCreateDetail.OriginDetailOneofCase');
    plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
    const size=field(pokemon,'size_','Holoholo.Rpc.HoloPokemonSize'),ball=field(pokemon,'pokeball_','Holoholo.Rpc.Item');
    const origin=field(pokemon,'originDetail_','Holoholo.Rpc.PokemonCreateDetail');
    const scores=field(output,'Scores','Holoholo.Rpc.CaptureScoreProto');
    const cases=plain(detail,'get_OriginDetailCase',[],'Holoholo.Rpc.PokemonCreateDetail.OriginDetailOneofCase').returnType.class;
    const bound={output,settings,parse:parsers[0],
      captured:field(output,'CapturedPokemonId','System.UInt64'),scores,
      xl:field(scores.type.class,'XlCandy','Niantic.Protobuf.Collections.RepeatedField<System.Int32>'),
      id:field(pokemon,'id_','System.UInt64'),species:field(pokemon,'pokemonId_','System.Int32'),
      attack:field(pokemon,'individualAttack_','System.Int32'),defense:field(pokemon,'individualDefense_','System.Int32'),
      stamina:field(pokemon,'individualStamina_','System.Int32'),size,ball,origin,
      display:field(pokemon,'pokemonDisplay_','Holoholo.Rpc.PokemonDisplayProto'),
      shiny:field(display,'Shiny','System.Boolean'),card:field(display,'LocationCard','Holoholo.Rpc.LocationCardDisplayProto'),
      getSettings:plain(pokemon,'GetPokemonSettings',['IGameMasterData','System.Boolean'],'Holoholo.Rpc.IPokemonSettings'),
      sizes:{xxs:constant(size.type.class,'Xxs'),xxl:constant(size.type.class,'Xxl')},
      balls:['PremierBall','BeastBall','WildBallPremier','MasterBall'].map(name=>constant(ball.type.class,name)),
      origins:{wild:constant(cases,'WildDetail'),invasion:constant(cases,'InvasionDetail')},
      normalClass:constant(type('Holoholo.Rpc.HoloPokemonClass'),'PokemonClassNormal'),
      scene:type('Niantic.Holoholo.MapSceneContext'),bag,master:type('IGameMasterData'),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],'UnityEngine.Object',true),
      toast:null,accessory:null,slider:null};
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Transfer on Catch: '+name+' unavailable',{error:String(error)});}
    };
    optional('toast',()=>{
      const service=type('Niantic.Holoholo.UI.IToastService'),args=['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'];
      const two=plain(service,'TwoLine',args,'Niantic.Holoholo.UI.IToastReceipt');plain(service,'OneLine',args,'Niantic.Holoholo.UI.IToastReceipt');
      const params=two.parameters[1].type.class;
      plain(params,'.ctor',[],'System.Void');
      for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],
        ['DisplaySecondsOverride','System.Nullable<System.Single>'],['BackgroundColor','System.Nullable<UnityEngine.Color>']])field(params,name,expected);
      for(const name of ['DisplaySecondsOverride','BackgroundColor']) {
        const nullable=params.field(name).type.class;
        field(nullable,'hasValue','System.Boolean');nullable.field('value');
      }
      for(const channel of ['r','g','b','a'])field(type('UnityEngine.Color'),channel,'System.Single');
      return {service,params};
    });
    optional('accessory',()=>{
      const entry=type('Holoholo.Rpc.ActionLogEntry'),log=type('Holoholo.Rpc.CatchPokemonLogEntry');
      const handlers=type('Niantic.Holoholo.Pgp.PgpActivityMonitor').methods.filter(m=>!m.isStatic&&!m.isGeneric&&m.returnType.name==='System.Boolean'&&
        m.parameters.map(p=>p.type.name).join('|')==='Holoholo.Rpc.ActionLogEntry');
      if(handlers.length!==1)throw Error('Unsupported accessory action log handler');
      plain(entry,'get_CatchPokemon',[],'Holoholo.Rpc.CatchPokemonLogEntry');
      return {handler:handlers[0],sfida:field(entry,'Sfida','System.Boolean'),id:field(log,'PokemonId','System.UInt64')};
    });
    optional('slider',()=>{
      const slider=type('Niantic.Holoholo.UI.Items.ItemSelectionSliderGuiController');
      const initialize=plain(slider,'Initialize',['Niantic.Holoholo.UI.Items.ItemSelectionSliderGuiController.Initializer'],'System.Void');
      const initializer=initialize.parameters[0].type;
      if(!initializer.class.isValueType)throw Error('Unsupported item slider initializer');
      plain(type('Niantic.Holoholo.NUI.GuiController'),'Dismiss',[],'System.Void');
      const completed=type('Niantic.Holoholo.Encounter.EncounterState').methods.filter(m=>m.name==='EncounterStateComplete'&&!m.isStatic&&m.parameterCount===1&&m.returnType.name==='System.Void');
      if(completed.length!==1)throw Error('Unsupported encounter end');
      return {initialize,initializer,title:field(initializer.class,'TitleKey','System.String'),
        openInfo:plain(slider,'OpenInfoGui',[],'System.Void'),completed:completed[0]};
    });
    this.bound=bound;
    return bound;
  }
  // The services live in the map scene's container; null until the map is loaded.
  services() {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())return null;
    const resolve=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type');
    const get=klass=>{const service=resolve.invoke(klass.type.object);if(service.isNull())throw Error('Game service unavailable: '+klass.type.name);return service;};
    return {bag:get(b.bag),master:get(b.master),toast:b.toast?get(b.toast.service):null};
  }
  // Plain data for PgqlTransferPolicy.decide.
  snapshot(pokemon,master) {
    const b=this.bound,number=PgqlGameTransferOnCatch.number,read=field=>field.bind(pokemon).value;
    const settings=b.getSettings.bind(pokemon).invoke(master,false),known=!settings.isNull()&&b.settings.isAssignableFrom(settings.class);
    const detail=read(b.origin),origin=detail.isNull()?0:number(detail.method('get_OriginDetailCase',0).invoke());
    const display=read(b.display),size=number(read(b.size));
    return {id:String(read(b.id)),species:read(b.species),attack:read(b.attack),defense:read(b.defense),stamina:read(b.stamina),
      size:size===b.sizes.xxs?'XXS':size===b.sizes.xxl?'XXL':'other',
      shiny:!display.isNull()&&!!b.shiny.bind(display).value,background:!display.isNull()&&!b.card.bind(display).value.isNull(),
      shadow:origin===b.origins.invasion,wildOrigin:origin===b.origins.wild||origin===b.origins.invasion,
      specialBall:b.balls.includes(number(read(b.ball))),
      normalClass:known&&number(settings.method('get_PokemonClass',0).invoke())===b.normalClass,
      transferable:known&&!!settings.method('get_IsTransferable',0).invoke()};
  }
  static lines(outcome,xl) {
    const result=outcome==='transferred'?'[Transferred]':outcome==='kept-preference'?'[Meets Preference, Not Transferred]':'[Not Transferred]';
    return ['Successful Capture!',result,...(xl>0?['+'+xl+' XL Candy']:[])];
  }
  // Runs on the game thread. A toast problem never stops transfers.
  notify(service,lines) {
    if(!service||this.limits.toast)return;
    try {
      const b=this.bound.toast,params=b.params.alloc();
      params.method('.ctor',0).invoke();
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=3;seconds.field('hasValue').value=true;
      const background=params.field('BackgroundColor').value,color=background.field('value').value;
      for(const [channel,value] of [['r',0.1137],['g',0.3608],['b',0.0823],['a',0.8]])color.field(channel).value=value;
      background.field('hasValue').value=true;
      const shown=service.class.methods.find(m=>m.name===(lines.length>1?'TwoLine':'OneLine')&&!m.isStatic&&m.parameterCount===2&&
        m.parameters[1].type.name==='Niantic.Holoholo.UI.ToastService.ToastParams');
      if(!shown)throw Error('Unsupported game toast service');
      shown.bind(service).invoke(Il2Cpp.string('<size=22>'+lines.join('\n')+'</size>'),params);
    }catch(error){this.limits.toast=String(error.message || error);this.ctx.log('Transfer toast failed; continuing without toasts',{error:String(error)});}
  }
  problem(error) {
    if(this.closed||this.failed)return;
    this.failed=true;this.ctx.log('Transfer on Catch failed; no further Pokémon will be transferred',{error:String(error)});
  }
  // The game's answer to a release request, as its status number. The request
  // is an RpcPromise, which inherits Then and Error from its base promise.
  watch(request) {
    return new Promise((resolve,reject)=>{
      const methods=[...request.class.hierarchy({includeCurrent:true})].flatMap(klass=>klass.methods);
      const callback=(name,argument)=>methods.find(m=>m.name===name&&!m.isStatic&&m.parameterCount===1&&m.parameters[0].type.name===argument);
      const then=callback('Then','System.Action<Holoholo.Rpc.ReleasePokemonOutProto>'),error=callback('Error','System.Action<System.String>');
      if(!then||!error)throw Error('Unsupported release promise: '+request.class.type.name);
      const pins=[];let finished=false;
      const pin=object=>{
        const handle=this.game.handleNew(object.handle,1);
        if(handle.isNull())throw Error('Unable to retain release callback');
        pins.push(handle);return object;
      };
      const settle=(fn,value)=>{
        if(finished)return;
        finished=true;fn(value);
        this.game.main(()=>{for(const handle of pins.splice(0))this.game.handleFree(handle);}).catch(()=>{});
      };
      try {
        pin(request);
        error.bind(request).invoke(pin(Il2Cpp.delegate(error.parameters[0].type.class,()=>settle(reject,Error('The game reported a request error')))));
        then.bind(request).invoke(pin(Il2Cpp.delegate(then.parameters[0].type.class,output=>{
          try{settle(resolve,PgqlGameTransferOnCatch.number(this.game.value(output,'Status')));}catch(problem){settle(reject,problem);}
        })));
      }catch(problem){settle(reject,problem);}
    });
  }
  // Runs on the game thread once the caught Pokemon is in the bag.
  settle(services,pokemon,info) {
    const data=this.snapshot(pokemon,services.master);
    if(data.id!==info.id)return;
    const config=this.ctx.config,decision=PgqlTransferPolicy.decide(data,config,{bypassed:info.bypassed});
    const summary={id:info.id,species:data.species,ivs:data.attack+'/'+data.defense+'/'+data.stamina,outcome:decision.outcome,reason:decision.reason,accessory:info.accessory};
    if(decision.outcome==='transferred') {
      // One request, never retried; the answer is only used for reporting.
      const request=services.bag.method('ReleasePokemon',1).invoke(pokemon);
      this.stats.transferred++;
      this.watch(request).then(status=>{
        if(status===1)return;
        this.stats.unconfirmed++;this.ctx.log('Transfer was not accepted by the game',{id:info.id,status});
      }).catch(error=>{
        if(this.closed)return;
        this.stats.unconfirmed++;this.ctx.log('Transfer result unknown',{id:info.id,error:String(error)});
      });
    }else this.stats.kept++;
    this.stats.last=summary;
    this.ctx.log(decision.outcome==='transferred'?'Caught Pokémon transferred':'Caught Pokémon kept',summary);
    if(config.showToast)this.notify(services.toast,PgqlGameTransferOnCatch.lines(decision.outcome,info.xl));
  }
  poll(raw,info,attempt) {
    this.game.main(()=>{
      if(this.closed||this.failed)return true;
      const services=this.services();
      if(!services)return false;
      const pokemon=services.bag.method('GetPokemon',1).invoke(raw);
      if(pokemon.isNull())return false;
      this.settle(services,pokemon,info);
      return true;
    }).then(done=>{
      if(done||this.closed||this.failed)return;
      if(attempt+1>=PgqlGameTransferOnCatch.maxFrames){this.ctx.log('Caught Pokémon did not reach the bag in time; not transferred',{id:info.id});return;}
      this.poll(raw,info,attempt+1);
    }).catch(error=>{if(!this.closed)this.problem(error);});
  }
  // A caught Pokemon id from either trigger. May run on any game thread.
  captured(raw,xl,accessory) {
    const id=String(raw);
    if(this.closed||this.failed||id==='0'||id===this.lastId)return;
    if(accessory) {
      if(this.accessoryIds.has(id))return;
      if(this.accessoryIds.size>=256)this.accessoryIds.clear();
      this.accessoryIds.add(id);
    }
    this.lastId=id;
    const bypassed=!accessory&&this.bypass;
    if(!accessory)this.bypass=false;
    this.poll(raw,{id,xl,accessory,bypassed},0);
  }
  xlCandy(message) {
    const b=this.bound,scores=b.scores.bind(message).value;
    if(scores.isNull())return 0;
    const list=b.xl.bind(scores).value;
    return list.isNull()||list.method('get_Count',0).invoke()<1?0:list.method('get_Item',1).invoke(0);
  }
  // Tapping the info button of the encounter ball or berry slider keeps the
  // next catch of this encounter instead of opening the info panel.
  installBypass() {
    const b=this.bound.slider,self=this;
    this.ctx.hook(b.initialize.virtualAddress,{onEnter(args) {
      if(self.closed||self.failed)return;
      try {
        // The initializer is a large struct, passed by reference.
        const title=b.title.bind(new Il2Cpp.ValueType(args[1],b.initializer)).value,key=args[0].toString();
        const name=title.isNull()?'':title.content;
        if(name==='encounter_item_pokeballs'||name==='encounter_item_berries') {
          if(self.sliders.size>=16)self.sliders.clear();
          self.sliders.add(key);
        }else self.sliders.delete(key);
      }catch(error){self.sliders.clear();self.limits.slider=String(error.message || error);self.ctx.log('Transfer bypass unavailable',{error:String(error)});}
    }});
    this.ctx.hook(b.completed.virtualAddress,{onEnter(){self.bypass=false;}});
    const wrapped=b.openInfo.wrap(function() {
      if(self.closed||self.failed||self.limits.slider||!self.sliders.has(this.handle.toString()))return b.openInfo.bind(this).invoke();
      self.bypass=true;self.ctx.log('Transfer on Catch disabled for this encounter');
      try {
        const services=self.services();
        if(services)self.notify(services.toast,['Transfer On Catch was <color=#FF0000>disabled</color> for this encounter.']);
        this.method('Dismiss',0).invoke();
      }catch(error){self.ctx.log('Transfer bypass feedback failed',{error:String(error)});}
    });
    Interceptor.replace(b.openInfo.virtualAddress,wrapped);this.callbacks.push(wrapped);
    this.undo.push(()=>Interceptor.revert(b.openInfo.virtualAddress));
  }
  async start() {
    await this.game.initialize();
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      // Observed with a listener: Instant Catch owns the replacement of this parser.
      this.ctx.hook(b.parse.virtualAddress,{
        onEnter(args){this.message=args[0];},
        onLeave() {
          if(self.closed||self.failed)return;
          try {
            const message=new Il2Cpp.Object(this.message),id=b.captured.bind(message).value;
            if(String(id)!=='0')self.captured(id,self.xlCandy(message),false);
          }catch(error){self.problem(error);}
        }
      });
      if(b.accessory)this.ctx.hook(b.accessory.handler.virtualAddress,{
        onEnter(args){this.entry=args[1];},
        onLeave(result) {
          if(self.closed||self.failed||!(result.toInt32()&1))return;
          try {
            const entry=new Il2Cpp.Object(this.entry);
            if(entry.isNull()||!b.accessory.sfida.bind(entry).value)return;
            const caught=entry.method('get_CatchPokemon',0).invoke();
            if(!caught.isNull())self.captured(b.accessory.id.bind(caught).value,0,true);
          }catch(error){self.problem(error);}
        }
      });
      if(b.slider) {
        try{this.installBypass();Interceptor.flush();}
        catch(error){this.limits.slider=String(error.message || error);this.ctx.log('Transfer bypass unavailable',{error:String(error)});}
      }
      this.ctx.log('Transfer on Catch ready',{toast:!!b.toast,accessory:!!b.accessory,bypass:!!b.slider&&!this.limits.slider});
      return true;
    });
  }
  // Multi-line text for the status action.
  report() {
    const s=this.stats,lines=['Transferred: '+s.transferred+(s.unconfirmed?' ('+s.unconfirmed+' not confirmed)':''),'Kept: '+s.kept];
    if(s.last)lines.push('Last: #'+s.last.species+' '+s.last.ivs+' — '+(s.last.outcome==='transferred'?'transferred':'kept, '+s.last.reason));
    for(const [name,label] of [['toast','Toasts'],['accessory','Accessory catches'],['slider','Encounter bypass']])
      if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  close() {
    if(this.closed)return;
    this.closed=true;
    for(const undo of this.undo.splice(0).reverse())try{undo();}catch(error){this.ctx.log('Transfer cleanup failed',{error:String(error)});}
    if(this.bound)Interceptor.flush();
    // Keep the replaced callback referenced for any call already in flight.
  }
};
