'use strict';
// Original adapter. Four independent, reversible visual reductions,
// each applied to the live game through its own switches: the weather service's
// display flag, the sky dome's cloud renderers, Unity's quality level with the
// game's resolution scale, and the road renderers of each map tile. Names are
// verified from live managed metadata; there are no offsets.
globalThis.PgqlGamePerformance = class PgqlGamePerformance {
  constructor(ctx) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;
    this.saved={};this.errors={};this.roadHook=null;
    ctx.cleanup(()=>this.close());
  }
  static get reductions(){return ['weather','sky','quality','roads'];}
  static get resolutionScale(){return 0.7;}
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Performance Mode supports');
    const type=name=>this.game.type(name);
    const {method:plain,field}=PgqlBinding.create('performance');
    const weather=type('Niantic.Holoholo.Map.WeatherService'),sky=type('Niantic.Holoholo.Map.Skydome');
    const tile=type('Niantic.Holoholo.Map.GameMapTile'),quality=type('UnityEngine.QualitySettings');
    const render=type('Niantic.Holoholo.Performance.Rendering.IRenderQualityService'),renderer=type('UnityEngine.Renderer');
    field(sky,'cloudRenderers','UnityEngine.MeshRenderer[]');
    for(const name of ['roadMeshRenderer','roadOutlinesMeshRenderer'])field(tile,name,'UnityEngine.MeshRenderer');
    for(const [klass,name,args] of [[weather,'get_DisplayWeatherEffects',[]],[weather,'set_DisplayWeatherEffects',['System.Boolean']],
      [renderer,'get_enabled',[]],[renderer,'set_enabled',['System.Boolean']],
      [render,'ApplyResolutionScale',['System.Single']],[render,'get_CurrentResolutionScale',[]],
      [type('UnityEngine.GameObject'),'get_scene',[]],[type('UnityEngine.Component'),'get_gameObject',[]],
      [type('UnityEngine.SceneManagement.Scene'),'IsValid',[]],[type('Zenject.DiContainer'),'Resolve',['System.Type']],
      [type('Zenject.Context'),'get_Container',[]]])plain(klass,name,args);
    this.bound={weather,sky,tile,render,scene:type('Niantic.Holoholo.MapSceneContext'),
      level:plain(quality,'GetQualityLevel',[],null,true),setLevel:plain(quality,'SetQualityLevel',['System.Int32','System.Boolean'],null,true),
      names:plain(quality,'get_names',[],null,true),initialize:plain(tile,'Initialize',['Niantic.Lightship.Maps.Core.IMapTile']),
      frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],null,true).virtualAddress,
      findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],null,true),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],null,true)};
    return this.bound;
  }
  // Scene instances only; prefab assets of the same class are also loaded.
  live(type) {
    const all=this.bound.findAll.invoke(type.type.object),found=[];
    for(let i=0;i<all.length;i++) {
      const item=all.get(i);
      if(item.method('get_gameObject',0).invoke().method('get_scene',0).invoke().method('IsValid',0).invoke())found.push(item);
    }
    return found;
  }
  one(type,label) {
    const found=this.live(type);
    if(found.length!==1)throw Error(label+' is not available on the map');
    return found[0];
  }
  renderService() {
    const scene=this.bound.findOne.invoke(this.bound.scene.type.object);
    if(scene.isNull())throw Error('Load the game map before using Performance Mode');
    const service=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(this.bound.render.type.object);
    if(service.isNull())throw Error('Render quality service unavailable');
    return service;
  }
  clouds() {
    const list=this.one(this.bound.sky,'Sky dome').field('cloudRenderers').value,found=[];
    if(!list.isNull())for(let i=0;i<list.length;i++)if(!list.get(i).isNull())found.push(list.get(i));
    return found;
  }
  roads(enabled,tile) {
    for(const name of ['roadMeshRenderer','roadOutlinesMeshRenderer']) {
      const renderer=tile.field(name).value;
      if(!renderer.isNull())renderer.method('set_enabled',1).invoke(enabled);
    }
  }
  // Each handler: on() saves what it changes and applies; keep() re-asserts
  // against the game changing it back; off() restores exactly what was saved.
  handlers() {
    const b=this.bound,self=this;
    return {
      weather:{
        on:()=>{const service=this.one(b.weather,'Weather service'),value=service.method('get_DisplayWeatherEffects',0).invoke();
          service.method('set_DisplayWeatherEffects',1).invoke(false);return {value};},
        keep:()=>{const service=this.one(b.weather,'Weather service');
          if(service.method('get_DisplayWeatherEffects',0).invoke())service.method('set_DisplayWeatherEffects',1).invoke(false);},
        off:saved=>this.one(b.weather,'Weather service').method('set_DisplayWeatherEffects',1).invoke(saved.value)
      },
      sky:{
        on:()=>{const clouds=this.clouds(),states=clouds.map(cloud=>cloud.method('get_enabled',0).invoke());
          for(const cloud of clouds)cloud.method('set_enabled',1).invoke(false);return {states};},
        keep:()=>{for(const cloud of this.clouds())if(cloud.method('get_enabled',0).invoke())cloud.method('set_enabled',1).invoke(false);},
        off:saved=>this.clouds().forEach((cloud,index)=>cloud.method('set_enabled',1).invoke(saved.states[index]!==false))
      },
      quality:{
        on:()=>{const service=this.renderService(),level=b.level.invoke(),scale=service.method('get_CurrentResolutionScale',0).invoke();
          const lowest=b.names.invoke().length-1;
          if(lowest>level)b.setLevel.invoke(lowest,true);
          service.method('ApplyResolutionScale',1).invoke(scale*PgqlGamePerformance.resolutionScale);
          return {level,scale};},
        keep:()=>{},
        off:saved=>{b.setLevel.invoke(saved.level,true);this.renderService().method('ApplyResolutionScale',1).invoke(saved.scale);}
      },
      roads:{
        on:()=>{
          for(const tile of this.live(b.tile))this.roads(false,tile);
          // Tiles are rebuilt as the player moves; hide the roads of each new one.
          this.roadHook=Interceptor.attach(b.initialize.virtualAddress,{
            onEnter(args){this.tile=args[0];},
            onLeave() {
              if(self.closed||!self.saved.roads)return;
              try{self.roads(false,new Il2Cpp.Object(this.tile));}
              catch(error){self.errors.roads=String(error);}
            }
          });
          return {};},
        keep:()=>{},
        off:()=>{if(this.roadHook){this.roadHook.detach();this.roadHook=null;}for(const tile of this.live(b.tile))this.roads(true,tile);}
      }
    };
  }
  reconcile(config) {
    const handlers=this.handlers();
    for(const key of PgqlGamePerformance.reductions) {
      try {
        const wanted=config[key]===true,saved=this.saved[key];
        if(wanted&&!saved)this.saved[key]=handlers[key].on();
        else if(wanted)handlers[key].keep();
        else if(saved){delete this.saved[key];handlers[key].off(saved);}
        delete this.errors[key];
      }catch(error){this.errors[key]=String(error);}
    }
    return this.status();
  }
  // Applies the wanted set of reductions; safe to call repeatedly.
  async apply(config) {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      this.bind();
      return this.reconcile(config);
    });
  }
  status() {
    const result={};
    for(const key of PgqlGamePerformance.reductions)result[key]=this.errors[key]?'unavailable: '+this.errors[key]:this.saved[key]?'on':'off';
    return result;
  }
  // Unity objects may only be used on the game thread, so everything is
  // restored on the next game frame, after the synchronous cleanup returned.
  close() {
    if(this.closed)return;
    this.closed=true;
    if(this.roadHook){this.roadHook.detach();this.roadHook=null;}
    if(!this.bound||!Object.keys(this.saved).length)return;
    let done=false;
    const listener=Interceptor.attach(this.bound.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      this.reconcile({});
      this.ctx.log('Performance Mode restored',this.status());
    }});
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
