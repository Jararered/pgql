'use strict';
// Original adapter. Shortens the game's own map refresh throttle so
// nearby Pokemon are requested sooner; the game still makes its ordinary map
// requests. It never forces or fabricates a request. Names are verified from
// live managed metadata; there are no offsets.
globalThis.PgqlGameMapRefresh = class PgqlGameMapRefresh {
  constructor(ctx) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.original=null;this.applied=null;
    ctx.cleanup(()=>this.close());
  }
  // Seconds between refreshes while moving / while idle, and metres moved.
  static get fast(){return {min:3,max:5,distance:10};}
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Instant Loading supports');
    const type=name=>this.game.type(name);
    const plain=(klass,name,args,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&
        m.parameters.map(p=>p.type.name).join('|')===args.join('|'));
      if(matches.length!==1)throw Error('Unsupported map refresh method: '+name);
      return matches[0];
    };
    const field=(klass,name,expected)=>{
      const found=klass.field(name);
      if(found.type.name!==expected)throw Error('Unsupported map refresh field: '+name);
      return found;
    };
    const handler=type('Niantic.Holoholo.Map.MapContentHandler'),throttle=type('Niantic.Holoholo.SpaceTimeThrottle');
    const settings=type('Holoholo.Rpc.GlobalSettingsProto'),map=type('Holoholo.Rpc.MapSettingsProto');
    field(handler,'fetchThrottle','Niantic.Holoholo.SpaceTimeThrottle');field(settings,'MapSettings','Holoholo.Rpc.MapSettingsProto');
    for(const name of ['minIntervalS','maxIntervalS','minDistanceM'])field(throttle,name,'System.Double');
    for(const name of ['SetMinUpdateInterval','SetMaxUpdateInterval','SetMinDistance'])plain(throttle,name,['System.Single']);
    const global=type('Niantic.Holoholo.IGlobalSettings');
    if(plain(global,'get_Settings',[]).returnType.name!=='Holoholo.Rpc.GlobalSettingsProto')throw Error('Unsupported global settings');
    for(const [klass,name,args] of [[type('UnityEngine.GameObject'),'get_scene',[]],[type('UnityEngine.Component'),'get_gameObject',[]],
      [type('UnityEngine.SceneManagement.Scene'),'IsValid',[]],[type('Zenject.DiContainer'),'Resolve',['System.Type']],[type('Zenject.Context'),'get_Container',[]]])plain(klass,name,args);
    this.bound={handler,global,scene:type('Niantic.Holoholo.MapSceneContext'),
      proto:{min:field(map,'GetMapObjectsMinRefreshSeconds','System.Single'),max:field(map,'GetMapObjectsMaxRefreshSeconds','System.Single'),
        distance:field(map,'GetMapObjectsMinDistanceMeters','System.Single')},
      merge:plain(map,'MergeFrom',['Niantic.Protobuf.CodedInputStream']),
      frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],true).virtualAddress,
      findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],true),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],true)};
    return this.bound;
  }
  // The live throttle the map uses, and the settings it was configured from.
  targets() {
    const b=this.bound,all=b.findAll.invoke(b.handler.type.object);let handler=null;
    for(let i=0;i<all.length;i++) {
      const candidate=all.get(i);
      if(candidate.method('get_gameObject',0).invoke().method('get_scene',0).invoke().method('IsValid',0).invoke())handler=candidate;
    }
    if(!handler)throw Error('Load the game map before using Instant Loading');
    const throttle=handler.field('fetchThrottle').value;
    if(throttle.isNull())throw Error('Map refresh throttle unavailable');
    const scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())throw Error('Load the game map before using Instant Loading');
    const global=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(b.global.type.object);
    const settings=global.isNull()?global:global.method('get_Settings',0).invoke();
    const proto=settings.isNull()?settings:settings.field('MapSettings').value;
    this.liveProto=proto.isNull()?null:proto.handle;
    return {throttle,proto};
  }
  read(throttle) {
    return {min:throttle.field('minIntervalS').value,max:throttle.field('maxIntervalS').value,distance:throttle.field('minDistanceM').value};
  }
  write(targets,values) {
    targets.throttle.method('SetMinUpdateInterval',1).invoke(values.min);
    targets.throttle.method('SetMaxUpdateInterval',1).invoke(values.max);
    targets.throttle.method('SetMinDistance',1).invoke(values.distance);
    if(!targets.proto.isNull())for(const key of ['min','max','distance'])this.bound.proto[key].bind(targets.proto).value=values[key];
  }
  // Never slower than what the server configured.
  faster(original) {
    const fast=PgqlGameMapRefresh.fast;
    return {min:Math.min(original.min,fast.min),max:Math.min(original.max,fast.max),distance:Math.min(original.distance,fast.distance)};
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),targets=this.targets();
      this.original=this.read(targets.throttle);this.applied=this.faster(this.original);
      this.write(targets,this.applied);
      const self=this;
      // A settings download during the session would bring the slow values
      // back; keep the server's values for restore and re-apply ours.
      this.ctx.hook(b.merge.virtualAddress,{
        onEnter(args) {
          this.proto=args[0];this.live=false;
          if(self.closed||!self.liveProto||!args[0].equals(self.liveProto))return;
          // Merge onto the server's values, not ours, so the result is theirs.
          try {
            const proto=new Il2Cpp.Object(args[0]);
            for(const key of ['min','max','distance'])b.proto[key].bind(proto).value=self.original[key];
            this.live=true;
          }catch(error){self.ctx.log('Map refresh settings hook failed',{error:String(error)});}
        },
        onLeave() {
          if(self.closed)return;
          try {
            const proto=new Il2Cpp.Object(this.proto),merged={};
            for(const key of ['min','max','distance'])merged[key]=b.proto[key].bind(proto).value;
            // A message without usable timers is not the map configuration.
            if(!(merged.max>0)||!(merged.min>=0)||!(merged.distance>=0))return;
            self.original=merged;self.applied=self.faster(merged);
            if(this.live)for(const key of ['min','max','distance'])b.proto[key].bind(proto).value=self.applied[key];
            self.game.main(()=>{if(!self.closed)self.write(self.targets(),self.applied);}).catch(error=>self.ctx.log('Map refresh re-apply failed',{error:String(error)}));
          }catch(error){self.ctx.log('Map refresh settings hook failed',{error:String(error)});}
        }
      });
      this.ctx.log('Map refresh shortened',{original:this.original,applied:this.applied});
      return this.status();
    });
  }
  status(){return {original:this.original,applied:this.applied};}
  // Unity objects may only be used on the game thread, so the restore runs on
  // the next game frame, after the synchronous module cleanup has returned.
  close() {
    if(this.closed)return;
    this.closed=true;
    if(!this.bound||!this.original)return;
    let done=false;
    const listener=Interceptor.attach(this.bound.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      try{this.write(this.targets(),this.original);this.ctx.log('Map refresh restored',{original:this.original});}
      catch(error){this.ctx.log('Map refresh restore failed',{error:String(error)});}
    }});
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
