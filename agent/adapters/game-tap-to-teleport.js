'use strict';
// Original adapter. A second ground tap within 500 ms asks GPS Joystick
// (through the controller) to jump to the tapped spot. The game's own map
// controller converts the tap's screen point to a location, and the tap still
// reaches the game. Optionally, Nearby menu icons and the stamp "See in map"
// button teleport to their place. Names are verified from live managed
// metadata; there are no offsets. The Nearby and stamp parts are optional: if
// one cannot be bound the map tap still works.
globalThis.PgqlGameTapToTeleport = class PgqlGameTapToTeleport {
  constructor(ctx) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;
    this.lastTap=0;this.stats={teleports:0,last:null};this.limits={};this.undo=[];this.callbacks=[];this.implementations=new Map();
    ctx.cleanup(()=>this.close());
  }
  static get doubleTapMs(){return 500;}
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Tap to Teleport supports');
    const type=name=>this.game.type(name);
    const plain=(klass,name,args,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&
        m.parameters.map(p=>p.type.name).join('|')===args.join('|'));
      if(matches.length!==1||returns!==null&&matches[0].returnType.name!==returns)throw Error('Unsupported teleport method: '+name);
      return matches[0];
    };
    const field=(klass,name,expected)=>{
      const found=klass.field(name);
      if(found.type.name!==expected)throw Error('Unsupported teleport field: '+name);
      return found;
    };
    // One instance field of the given type; obfuscated names are not relied on.
    const typed=(klass,expected)=>{
      const matches=klass.fields.filter(f=>!f.isStatic&&f.type.name===expected);
      if(matches.length!==1)throw Error('Unsupported teleport field type: '+expected);
      return matches[0];
    };
    const handler=type('Niantic.Holoholo.Map.GroundTapHandler'),gesture=type('TouchScript.Gestures.TapGesture');
    const controller=type('Niantic.Holoholo.Map.IMapController'),latLng=type('Niantic.LatLng'),place=type('Niantic.Holoholo.Map.IPlace');
    field(latLng,'Latitude','System.Double');field(latLng,'Longitude','System.Double');
    plain(controller,'GetGroundLocation',['UnityEngine.Vector2','Niantic.LatLng&'],'System.Boolean');
    plain(place,'get_Location',[],'Niantic.LatLng');
    const object=type('UnityEngine.Object'),scene=type('Niantic.Holoholo.MapSceneContext');
    plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],null);plain(type('Zenject.Context'),'get_Container',[],null);
    this.bound={
      tap:plain(handler,'OnTap',['System.Object','System.EventArgs'],'System.Void'),gesture,
      start:field(gesture,'startPosition','UnityEngine.Vector2'),handlerGesture:field(handler,'tapGesture','TouchScript.Gestures.TapGesture'),
      controller:typed(handler,'Niantic.Holoholo.Map.IMapController'),latLng,scene,
      findOne:plain(object,'FindObjectOfType',['System.Type'],null,true)
    };
    try{this.bound.nearby=this.bindNearby(type,plain,field);}
    catch(error){this.limits.nearby=String(error.message || error);}
    try {
      const detail=type('Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController'),gui=type('Niantic.Holoholo.NUI.GuiController');
      this.bound.stamp={seeInMap:plain(detail,'OnClickSeeInMap',[],'System.Void'),location:typed(detail,'Niantic.LatLng'),
        subcategory:type('Niantic.Holoholo.Collections.StampSubcategoryGuiController'),back:field(gui,'backButtonAction','System.Action')};
      plain(type('System.Action'),'Invoke',[],'System.Void');
    }catch(error){this.limits.stamp=String(error.message || error);}
    return this.bound;
  }
  bindNearby(type,plain,field) {
    const prefix='Niantic.Holoholo.NearbyPokemon.';
    const pokemon=type(prefix+'NearbyPokemonIcon'),contest=type(prefix+'NearbyContestIcon'),raid=type(prefix+'NearbyRaidIconWidget');
    const station=type(prefix+'NearbyStationIconWidget'),gui=type(prefix+'NearbyPokemonGuiController'),fort=type('Holoholo.Rpc.PokemonFortProto');
    const entities=type('Niantic.Holoholo.Map.IMapEntityService');
    for(const klass of [pokemon,contest])plain(klass,'get_FortId',[],'System.String');
    plain(raid,'get_FortProto',[],'Holoholo.Rpc.PokemonFortProto');
    plain(station,'get_Station',[],'Niantic.Holoholo.Map.IMapStation');
    field(fort,'Latitude','System.Double');field(fort,'Longitude','System.Double');
    plain(entities,'GetMapPoi',['System.String'],'Niantic.Holoholo.Map.IMapPlace');
    plain(gui,'DismissWithPermissions',[],'System.Void');
    return {entities,gui,clicks:[
      [plain(pokemon,'IconClicked',[],'System.Void'),object=>this.poi(object)],
      [plain(contest,'IconClicked',[],'System.Void'),object=>this.poi(object)],
      [plain(raid,'IconClicked',[],'System.Void'),object=>this.coordinates(object.method('get_FortProto',0).invoke())],
      [plain(station,'IconClickedAction',[],'System.Void'),object=>this.location(object.method('get_Station',0).invoke())]
    ]};
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      this.ctx.hook(b.tap.virtualAddress,{onEnter(args) {
        if(self.closed)return;
        try{self.tapped(new Il2Cpp.Object(args[0]),new Il2Cpp.Object(args[1]));}
        catch(error){self.ctx.log('Tap to Teleport tap failed',{error:String(error)});}
      }});
      if(b.nearby) {
        try{for(const [method,locate] of b.nearby.clicks)this.click(method,locate,()=>this.dismissNearby());Interceptor.flush();}
        catch(error){this.limits.nearby=String(error.message || error);}
      }
      if(b.stamp) {
        try{this.click(b.stamp.seeInMap,object=>this.coordinates(b.stamp.location.bind(object).value),object=>this.leaveStamps(object));Interceptor.flush();}
        catch(error){this.limits.stamp=String(error.message || error);}
      }
      if(this.limits.nearby)this.ctx.log('Nearby menu teleport unavailable',{error:this.limits.nearby});
      if(this.limits.stamp)this.ctx.log('Stamp teleport unavailable',{error:this.limits.stamp});
      this.ctx.log('Tap to Teleport ready',{nearby:!this.limits.nearby,stamp:!this.limits.stamp});
      return true;
    });
  }
  // Runs on the game thread for every ground tap.
  tapped(handler,sender) {
    const now=Date.now(),second=now-this.lastTap<PgqlGameTapToTeleport.doubleTapMs;
    // A completed double tap starts over, so a third quick tap does not jump again.
    this.lastTap=second?0:now;
    if(!second)return;
    const b=this.bound;
    const gesture=!sender.isNull()&&sender.class.handle.equals(b.gesture.handle)?sender:b.handlerGesture.bind(handler).value;
    const controller=b.controller.bind(handler).value;
    if(gesture.isNull()||controller.isNull())throw Error('Map tap state unavailable');
    const out=new Il2Cpp.ValueType(Memory.alloc(16),b.latLng.type);
    out.field('Latitude').value=0;out.field('Longitude').value=0;
    const found=this.implementation(controller,'GetGroundLocation',['UnityEngine.Vector2','Niantic.LatLng&']).invoke(b.start.bind(gesture).value,Il2Cpp.reference(out));
    const place=this.coordinates(out);
    if(!found||!place){this.ctx.log('Tap to Teleport: no map location for tap');return;}
    this.teleport(place,'map');
  }
  teleport(place,source) {
    if(!this.ctx.teleport(place.latitude,place.longitude))return false;
    this.stats.teleports++;this.stats.last={...place,source};
    this.ctx.log('Teleporting',{latitude:place.latitude,longitude:place.longitude,source});
    return true;
  }
  // Replaces a click handler: teleports when enabled and a place resolves,
  // otherwise the game's own handler runs.
  click(method,locate,after) {
    const self=this;
    const wrapped=method.wrap(function() {
      const original=()=>method.bind(this).invoke();
      if(self.closed||!self.ctx.config.nearbyMenu)return original();
      let place=null;
      try{place=locate(this);}catch(error){self.ctx.log('Teleport target unavailable',{error:String(error)});}
      if(!place||!self.teleport(place,'menu'))return original();
      try{after(this);}catch(error){self.ctx.log('Teleport menu close failed',{error:String(error)});}
    });
    Interceptor.replace(method.virtualAddress,wrapped);this.callbacks.push(wrapped);
    this.undo.push(()=>Interceptor.revert(method.virtualAddress));
  }
  coordinates(value) {
    if(!value||value.isNull&&value.isNull())return null;
    const latitude=value.field('Latitude').value,longitude=value.field('Longitude').value;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||(latitude===0&&longitude===0))return null;
    return {latitude,longitude};
  }
  location(place) {
    if(!place||place.isNull())return null;
    return this.coordinates(this.implementation(place,'get_Location',[]).invoke());
  }
  poi(icon) {
    const id=icon.method('get_FortId',0).invoke();
    if(id.isNull()||!id.content)return null;
    const entities=this.service(this.bound.nearby.entities);
    return this.location(this.implementation(entities,'GetMapPoi',['System.String']).invoke(id));
  }
  service(klass) {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())throw Error('Load the game map before teleporting');
    const service=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(klass.type.object);
    if(service.isNull())throw Error('Service unavailable: '+klass.name);
    return service;
  }
  dismissNearby() {
    const b=this.bound,gui=b.findOne.invoke(b.nearby.gui.type.object);
    if(!gui.isNull())gui.method('DismissWithPermissions',0).invoke();
  }
  // Steps back out of the stamp detail and its subcategory page to the map.
  leaveStamps(detail) {
    const b=this.bound.stamp,back=gui=>{
      if(gui.isNull())return;
      const action=b.back.bind(gui).value;
      if(!action.isNull())action.method('Invoke',0).invoke();
    };
    back(detail);back(this.bound.findOne.invoke(b.subcategory.type.object));
  }
  // The object's own implementation of an interface method, including
  // explicit implementations named Interface.Method.
  implementation(object,name,args) {
    const key=object.class.handle.toString()+':'+name;
    let method=this.implementations.get(key);
    if(!method) {
      for(let klass=object.class;klass&&!method;klass=klass.parent)
        method=klass.methods.find(m=>!m.isStatic&&!m.isGeneric&&(m.name===name||m.name.endsWith('.'+name))&&
          m.parameters.map(p=>p.type.name).join('|')===args.join('|')&&!m.virtualAddress.isNull());
      if(!method)throw Error('Unsupported teleport implementation: '+name);
      this.implementations.set(key,method);
    }
    return method.bind(object);
  }
  status(){return {teleports:this.stats.teleports,last:this.stats.last,limits:{...this.limits}};}
  close() {
    if(this.closed)return;
    this.closed=true;
    for(const undo of this.undo.splice(0).reverse())try{undo();}catch(error){this.ctx.log('Tap to Teleport cleanup failed',{error:String(error)});}
    if(this.bound)Interceptor.flush();
    // Keep the replaced callbacks referenced for any call already in flight.
  }
};
