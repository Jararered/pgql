'use strict';
// Original adapter. Sends the game's own encounter request for each
// nearby map Pokemon, one at a time, reads the result proto the game stores on
// that map Pokemon and hands a plain snapshot to PgqlScannerPolicy. Matches are
// shown as a game toast and an Android notification; scanned Pokemon are
// redrawn on the map (shiny model, hidden Ditto, XXS/XXL scale, ripple tint).
// The result field is found by its proto type, which is unique on each class;
// every other name is readable managed metadata. There are no offsets.
globalThis.PgqlGameShinyScanner = class PgqlGameShinyScanner {
  constructor(ctx) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.failed=false;
    this.cache=new PgqlScannerPolicy.ScanCache();this.queue=[];this.queued=new Set();this.waiting=new Map();this.active=null;
    this.stats={requests:0,results:0,alerts:0,far:0,hundoPause:0,storageFull:0,timeouts:0,errors:0,last:null};
    this.limits={};this.callbacks=[];this.storage={checkedAt:0,full:false};
    ctx.cleanup(()=>this.close());
  }
  static get maxQueue(){return 64;}
  static get maxWaiting(){return 128;}
  static get retryMs(){return 10000;}
  static get timeoutMs(){return 15000;}
  static get maxDistance(){return 100;}
  static get colors(){return {scanned:[0.2,0.42,0.282,1],shiny:[1,0.875,0.333,1],hundo:[1,0.392,0.431,1]};}
  static number(value){return typeof value==='number'?value:value.field('value__').value;}
  // Spawn kinds: the class, its Initialize parameter list and the proto type
  // of the encounter result it keeps. Wild results wrap the Pokemon once more.
  static get kinds() {
    return [
      {type:'wild',klass:'Niantic.Holoholo.Map.WildMapPokemon',init:[['Holoholo.Rpc.WildPokemonProto'],['Niantic.Holoholo.Map.WildMapPokemon.Data']],result:'Holoholo.Rpc.EncounterOutProto',wrapped:true,ripple:'normalRippleFx'},
      {type:'lure',klass:'Niantic.Holoholo.Map.TroyDiskMapPlacePokemon',owner:'Niantic.Holoholo.Map.MapPlacePokemon',init:[['Holoholo.Rpc.MapPokemonProto','Niantic.LatLng']],result:'Holoholo.Rpc.DiskEncounterOutProto',ripple:'normalRippleFx'},
      {type:'incense',klass:'Niantic.Holoholo.Map.IncenseMapPokemon',init:[['Holoholo.Rpc.GetIncensePokemonOutProto','Holoholo.Rpc.Item']],result:'Holoholo.Rpc.IncenseEncounterOutProto',ripple:'normalRippleFx'},
      {type:'route',klass:'Niantic.Holoholo.Map.RouteMapPokemon',init:[['Holoholo.Rpc.AttractedPokemonClientProto']],result:'Holoholo.Rpc.AttractedPokemonEncounterOutProto',ripple:null},
      {type:'photobomb',klass:'Niantic.Holoholo.Map.PhotobombingMapPokemon',init:[['Holoholo.Rpc.GetPhotobombOutProto']],result:'Holoholo.Rpc.EncounterPhotobombOutProto',ripple:'rippleFx'},
      {type:'station',klass:'Niantic.Holoholo.Map.StationMapPokemon',init:[['Niantic.Holoholo.Map.StationMapPokemon.Data']],result:'Holoholo.Rpc.EncounterPokestopEncounterOutProto',ripple:null}
    ];
  }
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Shiny Scanner supports');
    const type=name=>this.game.type(name),number=PgqlGameShinyScanner.number;
    const plain=(klass,name,args,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&
        m.parameters.map(p=>p.type.name).join('|')===args.join('|'));
      if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))throw Error('Unsupported scanner method: '+klass.type.name+'.'+name);
      return matches[0];
    };
    const field=(klass,name,expected)=>{
      const found=klass.field(name);
      if(found.type.name!==expected)throw Error('Unsupported scanner field: '+klass.type.name+'.'+name);
      return found;
    };
    const byType=(klass,expected)=>{
      const matches=[...klass.hierarchy({includeCurrent:true})].flatMap(k=>k.fields).filter(f=>!f.isStatic&&f.type.name===expected);
      if(matches.length!==1)throw Error('Unsupported encounter result on '+klass.type.name);
      return matches[0];
    };
    const constant=(klass,name)=>number(klass.field(name).value);
    const base=type('Niantic.Holoholo.Map.MapPokemon'),latlng=type('Niantic.LatLng');
    const encounter='Niantic.Promises.IPromise<Niantic.Holoholo.Map.PokemonEncounterResponse>';
    plain(base,'SendEncounterRequest',[],encounter);plain(base,'get_Location',[],'Niantic.LatLng');
    plain(base,'get_EncounterId',[],'System.UInt64');plain(base,'get_PokemonId',[],'System.Int32');
    plain(base,'get_PokemonDisplay',[],'Holoholo.Rpc.PokemonDisplayProto');
    plain(base,'get_HoloCharacter',[],'Niantic.Holoholo.Assets.Character.HoloCharacter');
    field(latlng,'Latitude','System.Double');field(latlng,'Longitude','System.Double');
    const pokemon=type('Holoholo.Rpc.PokemonProto'),display=type('Holoholo.Rpc.PokemonDisplayProto'),settings=type('Holoholo.Rpc.PokemonSettingsProto');
    const size=field(pokemon,'size_','Holoholo.Rpc.HoloPokemonSize'),pokemonClass=type('Holoholo.Rpc.HoloPokemonClass');
    const proximity=type('Niantic.Holoholo.Map.IPlayerProximityService'),player=type('Niantic.Holoholo.IPlayerService'),bag=type('Niantic.Holoholo.IPokemonBag');
    plain(proximity,'DistanceM',['Niantic.LatLng'],'System.Single');
    plain(player,'get_PlayerId',[],'System.String');plain(player,'get_MaxPokemon',[],'System.Int32');plain(bag,'get_Count',[],'System.Int32');
    plain(pokemon,'GetClass',['IGameMasterData'],'Holoholo.Rpc.HoloPokemonClass');
    plain(pokemon,'GetPokemonSettings',['IGameMasterData','System.Boolean'],'Holoholo.Rpc.IPokemonSettings');
    plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
    const bound={base,encounter,
      destroyed:field(base,'<Destroyed>k__BackingField','System.Boolean'),
      species:field(pokemon,'pokemonId_','System.Int32'),attack:field(pokemon,'individualAttack_','System.Int32'),
      defense:field(pokemon,'individualDefense_','System.Int32'),stamina:field(pokemon,'individualStamina_','System.Int32'),
      cpm:field(pokemon,'cpMultiplier_','System.Single'),weight:field(pokemon,'weightKg_','System.Single'),size,
      display:field(pokemon,'pokemonDisplay_','Holoholo.Rpc.PokemonDisplayProto'),
      shiny:field(display,'Shiny','System.Boolean'),card:field(display,'LocationCard','Holoholo.Rpc.LocationCardDisplayProto'),
      weather:field(display,'WeatherBoostedCondition','Niantic.Rpc.GameplayWeatherProto.Types.WeatherCondition'),
      strong:field(display,'IsStrongPokemon','System.Boolean'),
      settings,pokedexWeight:field(settings,'pokedexWeightKg_','System.Single'),weightStd:field(settings,'weightStdDev_','System.Single'),
      sizes:{xxs:constant(size.type.class,'Xxs'),xxl:constant(size.type.class,'Xxl')},
      classes:{legendary:constant(pokemonClass,'PokemonClassLegendary'),mythic:constant(pokemonClass,'PokemonClassMythic')},
      scene:type('Niantic.Holoholo.MapSceneContext'),proximity,player,bag,master:type('IGameMasterData'),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],'UnityEngine.Object',true),
      kinds:[],toast:null,model:null,ripple:null,names:null};
    // A spawn kind: its Initialize hooks and its encounter result field.
    const kind=spec=>{
      const klass=type(spec.klass),owner=spec.owner?type(spec.owner):klass;
      const inits=spec.init.map(args=>plain(owner,'Initialize',args,'System.Void'));
      const result=byType(klass,spec.result),inner=result.type.class;
      const hops=spec.wrapped?[field(inner,'Pokemon','Holoholo.Rpc.WildPokemonProto'),field(type('Holoholo.Rpc.WildPokemonProto'),'Pokemon','Holoholo.Rpc.PokemonProto')]:
        [field(inner,'Pokemon','Holoholo.Rpc.PokemonProto')];
      let ripple=null;
      if(spec.ripple) {
        const found=klass.field(spec.ripple);
        if(!['UnityEngine.GameObject','UnityEngine.ParticleSystem'].includes(found.type.name))throw Error('Unsupported ripple on '+spec.klass);
        ripple=found;
      }
      return {type:spec.type,klass,inits,result,hops,ripple};
    };
    for(const spec of PgqlGameShinyScanner.kinds) {
      if(spec.type==='wild'){bound.kinds.push(kind(spec));continue;}
      try{bound.kinds.push(kind(spec));}
      catch(error){this.limits[spec.type]=String(error.message || error);this.ctx.log('Shiny Scanner: '+spec.type+' spawns unavailable',{error:String(error)});}
    }
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Shiny Scanner: '+name+' unavailable',{error:String(error)});}
    };
    optional('toast',()=>{
      const service=type('Niantic.Holoholo.UI.IToastService'),args=['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'];
      const one=plain(service,'OneLine',args,'Niantic.Holoholo.UI.IToastReceipt'),params=one.parameters[1].type.class;
      plain(params,'.ctor',[],'System.Void');
      for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],
        ['DisplaySecondsOverride','System.Nullable<System.Single>'],['BackgroundColor','System.Nullable<UnityEngine.Color>']])field(params,name,expected);
      for(const name of ['DisplaySecondsOverride','BackgroundColor']) {
        const nullable=params.field(name).type.class;
        field(nullable,'hasValue','System.Boolean');nullable.field('value');
      }
      return {service,params};
    });
    optional('model',()=>{
      const holo=type('Niantic.Holoholo.Assets.Character.HoloCharacter');
      const load=plain(holo,'LoadPokemon',['System.Int32','Holoholo.Rpc.PokemonDisplayProto','System.Boolean',
        'Niantic.Holoholo.Assets.Character.HoloCharacter.PokemonForceLoad','Holoholo.Rpc.CharacterSize','System.Boolean'],'Niantic.Promises.IPromise<System.Boolean>');
      plain(holo,'get_Ready',[],'System.Boolean');plain(holo,'set_ScaleFactor',['System.Single'],'System.Void');
      plain(holo,'get_PokemonModel',[],'Niantic.PokemonAssets.PokemonModel');plain(holo,'TryShowShinySparkles',['System.Action'],'System.Void');
      plain(holo,'add_PokemonInstantiated',['System.Action'],'System.Void');plain(holo,'remove_PokemonInstantiated',['System.Action'],'System.Void');
      plain(type('Niantic.PokemonAssets.PokemonModel'),'set_IsShiny',['System.Boolean'],'System.Void');
      plain(type('Holoholo.Rpc.PokemonDisplayProto'),'Clone',[],'Holoholo.Rpc.PokemonDisplayProto');
      return {holo,load,action:type('System.Action'),force:load.parameters[3].type.class.field('LOAD_ALWAYS').value,
        size:load.parameters[4].type.class.field('M').value};
    });
    optional('ripple',()=>{
      const particles=type('UnityEngine.ParticleSystem'),color=type('UnityEngine.Color');
      plain(particles,'set_startColor',['UnityEngine.Color'],'System.Void');
      for(const channel of ['r','g','b','a'])field(color,channel,'System.Single');
      plain(type('UnityEngine.GameObject'),'SetActive',['System.Boolean'],'System.Void');
      return {particles,color};
    });
    optional('names',()=>{
      const i18n=type('Niantic.Holoholo.Internationalization.II18n');
      const found=i18n.methods.filter(m=>m.name==='PokemonName'&&!m.isStatic&&m.parameterCount===1&&m.returnType.name==='System.String'&&
        ['System.Int32','Holoholo.Rpc.HoloPokemonId'].includes(m.parameters[0].type.name));
      if(found.length!==1)throw Error('Unsupported Pokémon name lookup');
      return {i18n,method:found[0]};
    });
    this.bound=bound;
    return bound;
  }
  // The services live in the map scene's container; null until the map is loaded.
  services() {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())return null;
    const resolve=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type');
    const get=(klass,required=true)=>{
      const service=resolve.invoke(klass.type.object);
      if(service.isNull()&&required)throw Error('Game service unavailable: '+klass.type.name);
      return service.isNull()?null:service;
    };
    return {proximity:get(b.proximity),player:get(b.player),bag:get(b.bag),master:get(b.master),
      toast:b.toast?get(b.toast.service,false):null,names:b.names?get(b.names.i18n,false):null};
  }
  // Retained map Pokemon and their kind, by GC handle.
  pin(object) {
    const handle=this.game.handleNew(object.handle,1);
    if(handle.isNull())throw Error('Unable to retain map Pokémon');
    return handle;
  }
  unpin(handle){try{this.game.handleFree(handle);}catch(error){this.ctx.log('Shiny Scanner release failed',{error:String(error)});}}
  target(handle){return new Il2Cpp.Object(this.game.handleTarget(handle));}
  // Called from the Initialize hooks on the game thread.
  seen(kind,object) {
    if(this.closed||this.failed||object.isNull())return;
    const id=String(object.method('get_EncounterId',0).invoke());
    if(id==='0'||this.queued.has(id))return;
    if(this.queue.length>=PgqlGameShinyScanner.maxQueue){this.ctx.log('Shiny Scanner queue full; spawn skipped',{id});return;}
    this.queued.add(id);this.queue.push({id,kind,handle:this.pin(object)});
    this.next();
  }
  drop(job) {
    if(job.dropped)return;
    job.dropped=true;this.queued.delete(job.id);this.waiting.delete(job.id);this.unpin(job.handle);
  }
  clearQueue(){for(const job of this.queue.splice(0))this.drop(job);}
  // Spawns skipped for distance, a 100% nearby or full storage are retried
  // while they stay on the map; the oldest is released when the set is full.
  wait(job) {
    if(this.closed||job.dropped){this.drop(job);return;}
    if(this.waiting.size>=PgqlGameShinyScanner.maxWaiting)this.drop(this.waiting.values().next().value);
    this.waiting.set(job.id,job);
  }
  retry() {
    if(this.closed||this.failed)return;
    for(const job of [...this.waiting.values()]) {
      this.waiting.delete(job.id);
      if(this.queue.length>=PgqlGameShinyScanner.maxQueue){this.waiting.set(job.id,job);continue;}
      this.queue.push(job);
    }
    this.next();
  }
  // One job at a time. A job that gets no answer in time clears the queue so a
  // stuck request never blocks scanning.
  next() {
    if(this.closed||this.failed||this.active||!this.queue.length)return;
    const job=this.queue.shift(),self=this;let finished=false;
    const finish=(later=false)=>{
      if(finished)return;
      finished=true;clearTimeout(timer);
      if(this.active===job)this.active=null;
      if(later)this.wait(job);else this.drop(job);
      if(!this.closed)setTimeout(()=>this.next(),0);
    };
    const timer=setTimeout(()=>{
      if(finished||self.closed)return;
      self.stats.timeouts++;self.ctx.log('Shiny Scanner request timed out; clearing the queue',{id:job.id,type:job.kind.type});
      self.clearQueue();finish();
    },PgqlGameShinyScanner.timeoutMs);
    job.timer=timer;this.active=job;
    this.game.main(()=>this.scan(job,finish)).catch(error=>{
      if(!this.closed){this.stats.errors++;this.ctx.log('Shiny Scanner scan failed',{id:job.id,error:String(error)});}
      finish();
    });
  }
  // Runs on the game thread. Calls finish exactly once, now or after the answer.
  scan(job,finish) {
    if(this.closed){finish();return;}
    const object=this.target(job.handle);
    if(object.isNull()||this.bound.destroyed.bind(object).value){finish();return;}
    const services=this.services();
    if(!services){finish(true);return;}
    if(this.cache.useAccount(services.player.method('get_PlayerId',0).invoke().content))this.storage.checkedAt=0;
    const where=this.place(services,object);
    if(where.distance>PgqlGameShinyScanner.maxDistance){this.stats.far++;finish(true);return;}
    const known=this.cache.get(job.id);
    if(known){this.mark(object,job.kind,known.marker);finish();return;}
    if(this.cache.hundoPause(where.latitude,where.longitude)){this.stats.hundoPause++;finish(true);return;}
    if(!this.hasStorage(services)){this.stats.storageFull++;finish(true);return;}
    this.stats.requests++;
    this.request(object).then(()=>this.game.main(()=>{
      if(this.closed)return;
      const pokemon=this.result(object,job.kind);
      if(!pokemon){this.ctx.log('Shiny Scanner got no encounter result',{id:job.id,type:job.kind.type});return;}
      this.found(services,object,job,pokemon,where);
    })).catch(error=>{
      if(this.closed)return;
      this.stats.errors++;this.ctx.log('Shiny Scanner encounter request failed',{id:job.id,type:job.kind.type,error:String(error)});
    }).finally(()=>finish());
  }
  place(services,object) {
    const location=object.method('get_Location',0).invoke();
    return {latitude:location.field('Latitude').value,longitude:location.field('Longitude').value,
      distance:services.proximity.method('DistanceM',1).invoke(location)};
  }
  // Scans pause while the Pokemon storage is full; checked at most every 5 s.
  hasStorage(services) {
    const now=Date.now();
    if(now-this.storage.checkedAt<5000)return !this.storage.full;
    this.storage.checkedAt=now;
    const count=services.bag.method('get_Count',0).invoke(),max=services.player.method('get_MaxPokemon',0).invoke();
    const full=max>0&&count>=max;
    if(full!==this.storage.full)this.ctx.log(full?'Pokémon storage is full; pausing scans':'Pokémon storage has space; resuming scans',{count,max});
    this.storage.full=full;
    return !full;
  }
  // The game's answer to an encounter request. Resolves when the result is stored.
  request(object) {
    return new Promise((resolve,reject)=>{
      const promise=object.method('SendEncounterRequest',0).invoke();
      if(promise.isNull())throw Error('Encounter request was not sent');
      const methods=[...promise.class.hierarchy({includeCurrent:true})].flatMap(klass=>klass.methods);
      const callback=(name,argument)=>methods.find(m=>m.name===name&&!m.isStatic&&m.parameterCount===1&&m.parameters[0].type.name===argument);
      const then=callback('Then','System.Action<Niantic.Holoholo.Map.PokemonEncounterResponse>'),error=callback('Error','System.Action<System.String>');
      if(!then||!error)throw Error('Unsupported encounter promise: '+promise.class.type.name);
      const pins=[];let settled=false;
      const keep=object=>{pins.push(this.pin(object));return object;};
      const settle=(fn,value)=>{
        if(settled)return;
        settled=true;fn(value);
        for(const handle of pins.splice(0))this.unpin(handle);
      };
      keep(promise);
      error.bind(promise).invoke(keep(Il2Cpp.delegate(error.parameters[0].type.class,message=>settle(reject,Error('The game reported a request error: '+(message&&message.content || 'unknown'))))));
      then.bind(promise).invoke(keep(Il2Cpp.delegate(then.parameters[0].type.class,()=>settle(resolve))));
    });
  }
  // The encounter's PokemonProto, or null.
  result(object,kind) {
    let value=kind.result.bind(object).value;
    for(const hop of kind.hops) {
      if(value.isNull())return null;
      value=hop.bind(value).value;
    }
    return value.isNull()?null:value;
  }
  name(services,species) {
    const b=this.bound;
    if(services.names&&!this.limits.names) {
      try {
        // The interface method has no code; call the service's implementation.
        if(!this.nameMethod||!this.nameMethod.owner.equals(services.names.class.handle)) {
          const wanted=b.names.method.parameters[0].type.name;
          const found=[...services.names.class.hierarchy({includeCurrent:true})].flatMap(klass=>klass.methods).find(m=>!m.isStatic&&m.parameterCount===1&&
            (m.name==='PokemonName'||m.name.endsWith('.PokemonName'))&&m.parameters[0].type.name===wanted&&!m.virtualAddress.isNull());
          if(!found)throw Error('Pokémon name lookup has no implementation');
          this.nameMethod={owner:services.names.class.handle,method:found};
        }
        const text=this.nameMethod.method.bind(services.names).invoke(species);
        if(!text.isNull()&&text.content)return text.content;
      }catch(error){this.limits.names=String(error.message || error);this.ctx.log('Shiny Scanner names unavailable',{error:String(error)});}
    }
    return '#'+species;
  }
  // Plain data for PgqlScannerPolicy.
  snapshot(services,pokemon,where,type) {
    const b=this.bound,read=field=>field.bind(pokemon).value,number=PgqlGameShinyScanner.number;
    const display=read(b.display),size=number(read(b.size)),species=read(b.species);
    const cls=number(pokemon.method('GetClass',1).invoke(services.master));
    let pokedexWeight=0,weightStd=0;
    if(species===129) {
      const settings=pokemon.method('GetPokemonSettings',2).invoke(services.master,false);
      if(!settings.isNull()&&b.settings.isAssignableFrom(settings.class)){pokedexWeight=b.pokedexWeight.bind(settings).value;weightStd=b.weightStd.bind(settings).value;}
    }
    return {species,name:this.name(services,species),attack:read(b.attack),defense:read(b.defense),stamina:read(b.stamina),cpm:read(b.cpm),
      shiny:!display.isNull()&&!!b.shiny.bind(display).value,background:!display.isNull()&&!b.card.bind(display).value.isNull(),
      weatherBoosted:!display.isNull()&&number(b.weather.bind(display).value)!==0,strong:!display.isNull()&&!!b.strong.bind(display).value,
      size:size===b.sizes.xxs?'XXS':size===b.sizes.xxl?'XXL':'other',weight:read(b.weight),pokedexWeight,weightStd,
      pokemonClass:cls===b.classes.legendary?'legendary':cls===b.classes.mythic?'mythic':'normal',
      latitude:where.latitude,longitude:where.longitude,type};
  }
  // Runs on the game thread with a fresh encounter result.
  found(services,object,job,pokemon,where) {
    const data=this.snapshot(services,pokemon,where,job.kind.type),marker=PgqlScannerPolicy.marker(data);
    this.stats.results++;
    this.cache.set(job.id,job.kind.type,marker);
    const alert=PgqlScannerPolicy.classify(data,this.ctx.config);
    this.ctx.log('Shiny Scanner result',{id:job.id,type:job.kind.type,species:data.species,ivs:data.attack+'/'+data.defense+'/'+data.stamina,
      shiny:data.shiny,size:data.size,alert:alert?alert.kind:null});
    if(alert&&this.cache.markSent(job.id))this.alert(services,alert,data);
    if(marker.hundo)this.cache.sawHundo(where.latitude,where.longitude);
    this.mark(object,job.kind,marker);
  }
  alert(services,alert,data) {
    const config=this.ctx.config;
    this.stats.alerts++;this.stats.last={text:alert.text,latitude:data.latitude,longitude:data.longitude};
    this.ctx.log('Shiny Scanner alert',{kind:alert.kind,text:alert.text,latitude:data.latitude,longitude:data.longitude});
    if(config.showToast)this.toast(services.toast,alert);
    if(config.androidNotify) {
      try{this.ctx.notify('Shiny Scanner',alert.text,{latitude:data.latitude,longitude:data.longitude});}
      catch(error){this.ctx.log('Shiny Scanner notification failed',{error:String(error)});}
    }
  }
  // A toast problem never stops scanning.
  toast(service,alert) {
    if(!service||!this.bound.toast||this.limits.toast)return;
    try {
      const b=this.bound.toast,params=b.params.alloc();
      params.method('.ctor',0).invoke();
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=4;seconds.field('hasValue').value=true;
      const background=params.field('BackgroundColor').value,color=background.field('value').value;
      const rgba=alert.important?[0.55,0.42,0.05,0.9]:[0.1137,0.3608,0.0823,0.8];
      ['r','g','b','a'].forEach((channel,i)=>{color.field(channel).value=rgba[i];});
      background.field('hasValue').value=true;
      const shown=service.class.methods.find(m=>m.name==='OneLine'&&!m.isStatic&&m.parameterCount===2&&
        m.parameters[1].type.name==='Niantic.Holoholo.UI.ToastService.ToastParams');
      if(!shown)throw Error('Unsupported game toast service');
      shown.bind(service).invoke(Il2Cpp.string('<size=22>'+alert.text+'</size>'),params);
    }catch(error){this.limits.toast=String(error.message || error);this.ctx.log('Shiny Scanner toast failed; continuing without toasts',{error:String(error)});}
  }
  // Redraws a scanned map Pokemon. Runs on the game thread; visual problems
  // are logged once and never stop scanning.
  mark(object,kind,marker) {
    if(this.bound.ripple&&kind.ripple&&!this.limits.ripple) {
      try{this.tint(object,kind,marker);}
      catch(error){this.limits.ripple=String(error.message || error);this.ctx.log('Shiny Scanner ripple tint unavailable',{error:String(error)});}
    }
    if(!this.ctx.config.updateModels||!this.bound.model||this.limits.model)return;
    if(!marker.shiny&&!marker.ditto&&!marker.scale)return;
    try {
      const holo=object.method('get_HoloCharacter',0).invoke();
      if(holo.isNull())return;
      if(holo.method('get_Ready',0).invoke()){this.redraw(object,holo,marker);return;}
      // The model is still loading: redraw once it has been instantiated.
      const b=this.bound.model,self=this;let pin=null;
      const listener=Il2Cpp.delegate(b.action,()=>{
        try{holo.method('remove_PokemonInstantiated',1).invoke(listener);}catch(error){}
        if(pin)self.unpin(pin);
        if(!self.closed)try{self.redraw(object,holo,marker);}catch(error){self.modelProblem(error);}
      });
      pin=this.pin(listener);this.callbacks.push(listener);
      holo.method('add_PokemonInstantiated',1).invoke(listener);
    }catch(error){this.modelProblem(error);}
  }
  modelProblem(error){if(!this.limits.model){this.limits.model=String(error.message || error);this.ctx.log('Shiny Scanner model updates unavailable',{error:String(error)});}}
  tint(object,kind,marker) {
    const b=this.bound.ripple,value=kind.ripple.bind(object).value;
    if(value.isNull())return;
    const particles=kind.ripple.type.name==='UnityEngine.ParticleSystem'?value:value.method('GetComponent',1).overload('System.Type').invoke(b.particles.type.object);
    if(particles.isNull())return;
    const holder=kind.ripple.type.name==='UnityEngine.ParticleSystem'?particles.method('get_gameObject',0).invoke():value;
    const colors=PgqlGameShinyScanner.colors,rgba=marker.hundo?colors.hundo:marker.shiny?colors.shiny:colors.scanned;
    const color=b.color.alloc();
    ['r','g','b','a'].forEach((channel,i)=>{color.field(channel).value=rgba[i];});
    holder.method('SetActive',1).invoke(true);
    particles.method('set_startColor',1).invoke(color.unbox());
  }
  // Loads the shiny or Ditto model on a copy of the display, so the game's
  // own data is left unchanged, then applies the size scale.
  redraw(object,holo,marker) {
    const b=this.bound.model;
    if(marker.scale)holo.method('set_ScaleFactor',1).invoke(marker.scale);
    if(!marker.shiny&&!marker.ditto)return;
    const display=object.method('get_PokemonDisplay',0).invoke();
    if(display.isNull())return;
    const copy=display.method('Clone',0).invoke();
    if(marker.shiny)this.bound.shiny.bind(copy).value=true;
    const species=marker.ditto?132:object.method('get_PokemonId',0).invoke();
    const promise=b.load.bind(holo).invoke(species,copy,true,b.force,b.size,false);
    if(promise.isNull())return;
    const then=[...promise.class.hierarchy({includeCurrent:true})].flatMap(k=>k.methods)
      .find(m=>m.name==='Then'&&!m.isStatic&&m.parameterCount===1&&m.parameters[0].type.name==='System.Action');
    if(!then)throw Error('Unsupported model load promise');
    const pins=[this.pin(promise),this.pin(copy)],self=this;
    const done=Il2Cpp.delegate(then.parameters[0].type.class,()=>{
      for(const handle of pins.splice(0))self.unpin(handle);
      if(self.closed)return;
      try {
        if(marker.scale)holo.method('set_ScaleFactor',1).invoke(marker.scale);
        if(!marker.shiny)return;
        const model=holo.method('get_PokemonModel',0).invoke();
        if(model.isNull())return;
        model.method('set_IsShiny',1).invoke(true);
        holo.method('TryShowShinySparkles',1).invoke(self.noop());
      }catch(error){self.modelProblem(error);}
    });
    pins.push(this.pin(done));this.callbacks.push(done);
    then.bind(promise).invoke(done);
  }
  noop() {
    if(!this.idle){this.idle=Il2Cpp.delegate(this.bound.model.action,()=>{});this.idlePin=this.pin(this.idle);}
    return this.idle;
  }
  async start() {
    await this.game.initialize();
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      for(const kind of b.kinds)for(const init of kind.inits)this.ctx.hook(init.virtualAddress,{
        onEnter(args){this.object=args[0];},
        onLeave() {
          if(self.closed||self.failed)return;
          try {
            const object=new Il2Cpp.Object(this.object);
            if(!object.isNull()&&kind.klass.isAssignableFrom(object.class))self.seen(kind,object);
          }catch(error){self.stats.errors++;self.ctx.log('Shiny Scanner hook failed',{type:kind.type,error:String(error)});}
        }
      });
      this.ctx.interval(()=>this.retry(),PgqlGameShinyScanner.retryMs);
      this.ctx.log('Shiny Scanner ready',{spawns:b.kinds.map(kind=>kind.type),toast:!!b.toast,model:!!b.model,ripple:!!b.ripple,names:!!b.names});
      return true;
    });
  }
  // Multi-line text for the status action.
  report() {
    const s=this.stats,lines=['Scanned: '+s.results+' of '+s.requests+' requests'+(s.timeouts?' ('+s.timeouts+' timed out)':''),
      'Alerts: '+s.alerts,'Skipped: '+s.far+' too far, '+s.hundoPause+' near a 100%, '+s.storageFull+' storage full'];
    if(s.errors)lines.push('Errors: '+s.errors+' (see the session log)');
    if(s.last)lines.push('Last: '+s.last.text+' ('+s.last.latitude.toFixed(5)+', '+s.last.longitude.toFixed(5)+')');
    const labels={lure:'Lure spawns',incense:'Incense spawns',route:'Route spawns',photobomb:'Photobombs',station:'Station spawns',
      toast:'Toasts',model:'Model updates',ripple:'Ripple tint',names:'Pokémon names'};
    for(const [name,label] of Object.entries(labels))if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  close() {
    if(this.closed)return;
    this.closed=true;
    if(this.active){clearTimeout(this.active.timer);this.drop(this.active);this.active=null;}
    this.clearQueue();
    for(const job of [...this.waiting.values()])this.drop(job);
    if(this.idlePin){this.unpin(this.idlePin);this.idlePin=null;}
    // Keep delegates referenced for any callback already in flight.
  }
};
