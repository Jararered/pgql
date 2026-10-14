'use strict';
// Original adapter for the Cooldown Tracker. Follows the player's
// location, records the last cooldown action (catch, spin, gym, GO Plus or a
// manual save) and holds back Poké Ball drags while a cooldown is running.
// PgqlCooldownPolicy owns the rules. Names are verified from live managed
// metadata; there are no offsets. Spins, gyms, GO Plus, the toast, the main-menu
// indicator and the "Cooldown is over" modal are optional parts.
globalThis.PgqlGameCooldown = class PgqlGameCooldown {
  constructor(ctx,{store}={}) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.failed=false;
    this.store=store || PgqlGameCooldown.preferences();
    this.history=new PgqlCooldownPolicy.History();this.position=null;this.limits={};
    this.exempt=false;this.poi=null;this.remoteGym=false;this.shadowReturn=null;
    this.modalTimer=null;this.saveTimer=null;this.lastToast=0;this.blocked=0;this.indicator={group:null,tinted:false,original:null};
    ctx.cleanup(()=>this.close());
  }
  static get version(){return PgqlGameVersion.supported;}
  static number(value){return typeof value==='number'?value:value.field('value__').value;}
  // The game's own SharedPreferences, so the record survives reattach and restarts.
  static preferences() {
    const prefs=()=>Java.use('android.app.ActivityThread').currentApplication().getSharedPreferences('pgql_cooldown',0);
    return {
      load:()=>new Promise((resolve,reject)=>Java.perform(()=>{
        try{const value=prefs().getString('history',null);resolve(value===null?null:String(value));}catch(error){reject(error);}
      })),
      save:text=>new Promise((resolve,reject)=>Java.perform(()=>{
        try{prefs().edit().putString('history',text).apply();resolve();}catch(error){reject(error);}
      }))
    };
  }
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Cooldown Tracker supports');
    const type=name=>this.game.type(name);
    const proto=name=>{try{return type('Holoholo.Rpc.'+name);}catch(_){return type(name);}};
    const args=m=>m.parameters.map(p=>p.type.name).join('|');
    const plain=(klass,name,params,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&args(m)===params.join('|'));
      if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))throw Error('Unsupported cooldown method: '+name);
      return matches[0];
    };
    // The only instance method of that name, for members whose argument types vary.
    const only=(klass,name,count)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&!m.isStatic&&(count===undefined||m.parameters.length===count));
      if(matches.length!==1)throw Error('Unsupported cooldown method: '+name);
      return matches[0];
    };
    const field=(klass,name,expected)=>{
      const found=klass.field(name);
      if(expected&&found.type.name!==expected)throw Error('Unsupported cooldown field: '+name);
      return found;
    };
    const parser=klass=>{
      const found=klass.methods.filter(m=>!m.isStatic&&m.parameters.length===1&&m.returnType.name==='System.Void'&&m.parameters[0].type.name.includes('ParseContext'));
      if(found.length!==1)throw Error('Unsupported response parser: '+klass.name);
      return found[0];
    };
    // Player location: the closure DeviceManager runs for each location update.
    const device=type('Niantic.Platform.Ditto.Device.DeviceManager'),updates=[];
    for(const nested of device.nestedClasses)
      for(const method of nested.methods)if(!method.isStatic&&method.name.includes('NotifyLocationUpdate'))updates.push({nested,method});
    if(updates.length!==1)throw Error('Unsupported location update');
    const locationField=field(updates[0].nested,'location'),data=field(locationField.type.class,'data');
    for(const name of ['LatitudeDeg','LongitudeDeg'])field(data.type.class,name,'System.Double');
    const output=proto('CatchPokemonOutProto'),state=type('Niantic.Holoholo.Encounter.EncounterState');
    const ball=type('Niantic.Holoholo.Encounter.Pokeball');
    const bound={update:updates[0].method,
      catchParse:parser(output),status:field(output,'Status'),scores:field(output,'Scores','Holoholo.Rpc.CaptureScoreProto'),
      approach:only(state,'ApproachComplete'),exit:only(state,'ExitState'),mapPokemon:only(state,'get_MapPokemon',0),
      drag:only(ball,'Drag'),endDrag:only(ball,'EndDrag',0),
      scene:type('Niantic.Holoholo.MapSceneContext'),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],'UnityEngine.Object',true),
      spin:null,gym:null,goPlus:null,toast:null,indicator:null,modal:null};
    plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Cooldown Tracker: '+name+' unavailable',{error:String(error)});}
    };
    // A POI name read from a label field, for the record's title.
    const label=(klass,method,fieldName)=>{
      const named=field(type(klass),fieldName);
      only(named.type.class,'get_text',0);
      return {method:only(type(klass),method),field:fieldName};
    };
    optional('spin',()=>{
      const out=proto('FortSearchOutProto');
      return {parse:parser(out),result:field(out,'Result'),xp:field(out,'XpAwarded','System.Int32'),
        name:label('Niantic.Holoholo.Pokestop.PokestopSpinnerInteractionGuiController','Initialize','titleText')};
    });
    optional('gym',()=>{
      const responses=[];
      for(const [name,trigger] of [['GymFeedPokemonOutProto','healing'],['GymStartSessionOutProto','battle'],
        ['GymBattleAttackOutProto','battle'],['GymDeployOutProto','defending']])responses.push({trigger,parse:parser(proto(name))});
      const selected=only(type('Niantic.Holoholo.Map.MapExploreState'),'GymSelected');
      const flags=selected.parameters.map((p,i)=>p.type.name==='System.Boolean'?i:-1).filter(i=>i>=0);
      if(flags.length!==1)throw Error('Unsupported gym selection');
      return {responses,selected,remote:flags[0],name:label('Niantic.Holoholo.Gym.Approach.GymApproachGuiController','Init','gymNameText')};
    });
    // The monitor's per-entry action log handler (obfuscated name), as Transfer on Catch binds it.
    optional('goPlus',()=>{
      const handlers=type('Niantic.Holoholo.Pgp.PgpActivityMonitor').methods.filter(m=>!m.isStatic&&!m.isGeneric&&m.returnType.name==='System.Boolean'&&
        args(m)==='Holoholo.Rpc.ActionLogEntry');
      if(handlers.length!==1)throw Error('Unsupported GO Plus action log handler');
      return {activities:handlers[0]};
    });
    optional('toast',()=>{
      const service=type('Niantic.Holoholo.UI.IToastService'),params=['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'];
      const one=plain(service,'OneLine',params,'Niantic.Holoholo.UI.IToastReceipt'),options=one.parameters[1].type.class;
      plain(options,'.ctor',[],'System.Void');
      for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],
        ['DisplaySecondsOverride','System.Nullable<System.Single>'],['BackgroundColor','System.Nullable<UnityEngine.Color>']])field(options,name,expected);
      for(const name of ['DisplaySecondsOverride','BackgroundColor']) {
        const nullable=options.field(name).type.class;
        field(nullable,'hasValue','System.Boolean');nullable.field('value');
      }
      return {service,params:options};
    });
    optional('indicator',()=>{
      const menu=type('Niantic.Holoholo.Map.UI.MainMenuGuiController'),group=type('UnityEngine.CanvasGroup'),image=type('UnityEngine.UI.Image'),graphic=type('UnityEngine.UI.Graphic');
      const color=type('UnityEngine.Color');
      field(menu,'fullPokeballCanvasGroup','UnityEngine.CanvasGroup');
      for(const channel of ['r','g','b','a'])field(color,channel,'System.Single');
      for(const [klass,name,params] of [[group,'get_alpha',[]],[group,'set_alpha',['System.Single']],
        [graphic,'get_color',[]],[graphic,'set_color',['UnityEngine.Color']],
        [type('UnityEngine.Component'),'get_gameObject',[]],[type('UnityEngine.GameObject'),'GetComponent',['System.Type']],
        [type('UnityEngine.GameObject'),'get_scene',[]],[type('UnityEngine.SceneManagement.Scene'),'IsValid',[]]])plain(klass,name,params);
      return {menu,image,
        alive:plain(type('UnityEngine.Object'),'op_Implicit',['UnityEngine.Object'],'System.Boolean',true),
        findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],'UnityEngine.Object[]',true)};
    });
    optional('modal',()=>{
      const prompts=type('Niantic.Holoholo.UI.IUserPromptsService'),buttons=type('Niantic.Holoholo.UI.ModalButton');
      const show=plain(prompts,'ShowModal',['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]']);
      field(buttons,'OkButton','Niantic.Holoholo.UI.IModalButton[]');
      return {prompts,show,buttons};
    });
    this.bound=bound;
    return bound;
  }
  // Game services from the map scene's container; null until the map is loaded.
  service(klass) {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())return null;
    const found=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(klass.type.object);
    return found.isNull()?null:found;
  }
  remaining(){return PgqlCooldownPolicy.remaining(this.history.current,this.position,Date.now());}
  // Records a cooldown action at the player's current location.
  record(trigger,label) {
    if(!this.position){this.ctx.log('Cooldown not saved: player location unknown',{trigger});return null;}
    const saved=this.history.save(trigger,label,this.position,Date.now());
    this.ctx.log('Cooldown saved',{trigger,label:saved.label,latitude:saved.lat,longitude:saved.lon});
    this.persist();this.refreshIndicator();
    return saved;
  }
  manualSave() {
    if(!this.position)throw Error('Player location unknown; move or wait for a location update');
    return this.record('manual',null);
  }
  persist() {
    clearTimeout(this.saveTimer);
    this.saveTimer=setTimeout(()=>{
      this.saveTimer=null;
      Promise.resolve(this.store.save(JSON.stringify(this.history))).catch(error=>this.ctx.log('Cooldown save failed',{error:String(error)}));
    },250);
  }
  async load() {
    try {
      const text=await this.store.load();
      if(text)this.history=PgqlCooldownPolicy.History.fromJSON(JSON.parse(text));
      if(this.history.current)this.ctx.log('Cooldown loaded',{trigger:this.history.current.trigger,ts:this.history.current.ts});
    }catch(error){this.ctx.log('Saved cooldown unreadable; starting fresh',{error:String(error)});}
  }
  problem(error) {
    if(this.failed)return;
    this.failed=true;
    this.ctx.log('Cooldown Tracker error; stopping',{error:String(error && error.stack || error)});
    this.close();
  }
  readLabel(object,name) {
    const text=object.field(name).value;
    if(text.isNull())return null;
    const value=text.method('get_text',0).invoke();
    return value.isNull()||!value.content?null:value.content.slice(0,80);
  }
  cancelModal(){if(this.modalTimer){clearTimeout(this.modalTimer);this.modalTimer=null;}}
  returnFromShadow() {
    const back=this.shadowReturn;
    if(!back)return;
    this.shadowReturn=null;
    if(!this.ctx.teleport(back.lat,back.lon))this.ctx.log('Rocket Teleport return was throttled',{latitude:back.lat,longitude:back.lon});
    else this.ctx.log('Rocket Teleport returned',{latitude:back.lat,longitude:back.lon});
  }
  // Runs on the game thread after an encounter's approach.
  approached(mapPokemon) {
    this.cancelModal();
    const kind=mapPokemon.isNull()?'':mapPokemon.class.name,policy=PgqlCooldownPolicy;
    this.exempt=policy.exemptEncounters.includes(kind);
    if(this.exempt){this.ctx.log('Encounter ignores cooldown',{kind});return;}
    const config=this.ctx.config,left=this.remaining(),origin=this.history.current;
    if(kind===policy.shadowEncounter&&config.rocketTp&&origin&&left>=10000&&this.position) {
      const back={lat:this.position.lat,lon:this.position.lon};
      if(this.ctx.teleport(origin.lat,origin.lon)){this.shadowReturn=back;this.ctx.log('Rocket Teleport to cooldown origin',{remaining:left});}
      return;
    }
    if(left>=30000)this.modalTimer=setTimeout(()=>{this.modalTimer=null;this.showModal();},left+500);
  }
  showModal() {
    const b=this.bound;
    if(this.closed||!b.modal||this.limits.modal)return;
    this.game.main(()=>{
      if(this.closed)return;
      const service=this.service(b.modal.prompts);
      if(!service)return;
      const signature=b.modal.show.parameters.map(p=>p.type.name).join('|');
      const show=service.class.methods.find(m=>m.name==='ShowModal'&&!m.isStatic&&m.parameters.map(p=>p.type.name).join('|')===signature);
      if(!show)throw Error('Unsupported game prompt service');
      const none=new Il2Cpp.Object(NULL);
      show.bind(service).invoke(Il2Cpp.string('Cooldown is over'),none,Il2Cpp.string('Maybe'),none,false,b.modal.buttons.field('OkButton').value);
    }).catch(error=>{this.limits.modal=String(error.message || error);this.ctx.log('Cooldown modal failed; continuing without it',{error:String(error)});});
  }
  // Runs on the game thread. Rate limited: a held drag is ended on every frame.
  toast(text) {
    const b=this.bound,now=Date.now();
    if(!text||!b.toast||this.limits.toast||now-this.lastToast<2000)return;
    this.lastToast=now;
    try {
      const service=this.service(b.toast.service);
      if(!service)return;
      const params=b.toast.params.alloc();
      params.method('.ctor',0).invoke();
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=2;seconds.field('hasValue').value=true;
      const background=params.field('BackgroundColor').value,color=background.field('value').value;
      [0.6,0.18,0,0.9].forEach((value,i)=>{color.field('rgba'[i]).value=value;});
      background.field('hasValue').value=true;
      const shown=service.class.methods.find(m=>m.name==='OneLine'&&!m.isStatic&&m.parameters.length===2&&
        m.parameters[1].type.name==='Niantic.Holoholo.UI.ToastService.ToastParams');
      if(!shown)throw Error('Unsupported game toast service');
      shown.bind(service).invoke(Il2Cpp.string(text),params);
    }catch(error){this.limits.toast=String(error.message || error);this.ctx.log('Cooldown toast failed; continuing without toasts',{error:String(error)});}
  }
  // Main-menu Poké Ball tint while on cooldown; the game's own look is kept
  // and restored when the cooldown ends or the module stops.
  refreshIndicator() {
    const b=this.bound;
    if(this.closed||!b||!b.indicator||this.limits.indicator)return;
    const active=this.remaining()>0;
    if(active===this.indicator.tinted&&(!active||this.indicator.group))return;
    this.game.main(()=>{if(!this.closed)this.applyIndicator(this.remaining()>0);})
      .catch(error=>{this.limits.indicator=String(error.message || error);this.ctx.log('Cooldown indicator failed; continuing without it',{error:String(error)});});
  }
  canvasGroup() {
    const b=this.bound.indicator,state=this.indicator;
    if(state.group&&b.alive.invoke(state.group))return state.group;
    state.group=null;state.original=null;state.tinted=false;
    const all=b.findAll.invoke(b.menu.type.object);
    for(let i=0;i<all.length;i++) {
      const menu=all.get(i);
      if(!menu.method('get_gameObject',0).invoke().method('get_scene',0).invoke().method('IsValid',0).invoke())continue;
      const group=menu.field('fullPokeballCanvasGroup').value;
      if(!group.isNull()){state.group=group;return group;}
    }
    return null;
  }
  applyIndicator(active) {
    const b=this.bound.indicator,state=this.indicator,group=this.canvasGroup();
    if(!group){state.tinted=false;return;}
    const image=group.method('get_gameObject',0).invoke().method('GetComponent',1).overload('System.Type').invoke(b.image.type.object);
    if(image.isNull())throw Error('Main menu Poké Ball image not found');
    if(active&&!state.tinted) {
      const color=image.method('get_color',0).invoke();
      state.original={alpha:group.method('get_alpha',0).invoke(),color:['r','g','b','a'].map(c=>color.field(c).value)};
      ['r','g','b','a'].forEach((channel,i)=>{color.field(channel).value=[1,0.3,0,1][i];});
      image.method('set_color',1).invoke(color);group.method('set_alpha',1).invoke(1);
      state.tinted=true;
    }else if(!active&&state.tinted) {
      const color=image.method('get_color',0).invoke(),original=state.original;
      ['r','g','b','a'].forEach((channel,i)=>{color.field(channel).value=original.color[i];});
      image.method('set_color',1).invoke(color);group.method('set_alpha',1).invoke(original.alpha);
      state.tinted=false;state.original=null;
    }
  }
  async start() {
    await this.load();
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this,policy=PgqlCooldownPolicy,number=PgqlGameCooldown.number;
      const guard=fn=>function(...a){if(self.closed||self.failed)return;try{fn.apply(this,a);}catch(error){self.problem(error);}};
      this.ctx.hook(b.update.virtualAddress,{
        onEnter(args){this.closure=args[0];},
        onLeave:guard(function() {
          const data=new Il2Cpp.Object(this.closure).field('location').value.field('data').value;
          const position={lat:data.field('LatitudeDeg').value,lon:data.field('LongitudeDeg').value};
          if(!policy.validPoint(position))return;
          self.position=position;self.refreshIndicator();
        })
      });
      this.ctx.hook(b.approach.virtualAddress,{
        onEnter(args){this.state=args[0];},
        onLeave:guard(function(){self.approached(new Il2Cpp.Object(this.state).method('get_MapPokemon',0).invoke());})
      });
      this.ctx.hook(b.exit.virtualAddress,{onLeave:guard(()=>{self.exempt=false;self.cancelModal();self.returnFromShadow();})});
      this.ctx.hook(b.catchParse.virtualAddress,{
        onEnter(args){this.message=args[0];},
        onLeave:guard(function() {
          self.cancelModal();
          const message=new Il2Cpp.Object(this.message);
          const status=number(b.status.bind(message).value),hasScores=!b.scores.bind(message).value.isNull();
          if(policy.catchCounts({status,hasScores,exempt:self.exempt}))self.record('catch',null);
          else if(!self.exempt)self.ctx.log('Catch not counted; probably already on a cooldown',{status});
          if(policy.catchEnds(status))self.returnFromShadow();
        })
      });
      this.ctx.hook(b.drag.virtualAddress,{onEnter:guard(function(args) {
        if(self.exempt||!self.ctx.config.preventThrows)return;
        const left=self.remaining();
        if(left<=0)return;
        b.endDrag.bind(new Il2Cpp.Object(args[0])).invoke();
        self.blocked++;
        self.toast(policy.toast(self.history.current,self.position,Date.now()));
      })});
      const named=(part,kind)=>this.ctx.hook(part.method.virtualAddress,{
        onEnter(args){this.self=args[0];},
        onLeave:guard(function(){self.poi={kind,name:self.readLabel(new Il2Cpp.Object(this.self),part.field)};})
      });
      const poiName=kind=>self.poi&&self.poi.kind===kind?self.poi.name:null;
      if(b.spin) {
        named(b.spin.name,'pokestop');
        this.ctx.hook(b.spin.parse.virtualAddress,{
          onEnter(args){this.message=args[0];},
          onLeave:guard(function() {
            const message=new Il2Cpp.Object(this.message);
            const result=number(b.spin.result.bind(message).value),xp=b.spin.xp.bind(message).value;
            if(policy.spinCounts({result,xp}))self.record('pokestop',poiName('pokestop'));
            else self.ctx.log('Spin not counted',{result,xp});
          })
        });
      }
      if(b.gym) {
        named(b.gym.name,'gym');
        this.ctx.hook(b.gym.selected.virtualAddress,{onEnter:guard(args=>{self.remoteGym=!!(args[1+b.gym.remote].toInt32()&1);})});
        for(const response of b.gym.responses)this.ctx.hook(response.parse.virtualAddress,{onLeave:guard(()=>{
          if(response.trigger==='healing'&&self.remoteGym){self.ctx.log('Remote gym feed; cooldown not saved');return;}
          self.record(response.trigger,poiName('gym'));
        })});
      }
      if(b.goPlus)this.ctx.hook(b.goPlus.activities.virtualAddress,{onLeave:guard(result=>{if(result.toInt32()&1)self.record('pgp',null);})});
      this.ctx.log('Cooldown Tracker ready',{spin:!!b.spin,gym:!!b.gym,goPlus:!!b.goPlus,toast:!!b.toast,indicator:!!b.indicator,modal:!!b.modal});
      return true;
    });
  }
  // Multi-line text for the Show Cooldown action.
  report() {
    const policy=PgqlCooldownPolicy,now=Date.now(),current=this.history.current,lines=[];
    if(!current)lines.push('No Records');
    else if(!this.position)lines.push('Cooldown: player location unknown');
    else {
      const left=this.remaining();
      lines.push(left>0?'Cooldown: '+policy.formatTime(left):'Cooldown: Ready');
    }
    for(const entry of this.history.list())lines.push(policy.describe(entry,this.position,now));
    if(this.blocked)lines.push('Throws held back: '+this.blocked);
    for(const [name,label] of [['spin','Pokéstop tracking'],['gym','Gym tracking'],['goPlus','GO Plus tracking'],
      ['toast','Toasts'],['indicator','Poké Ball indicator'],['modal','Cooldown modal']])
      if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  close() {
    if(this.closed)return;
    this.closed=true;this.cancelModal();
    if(this.saveTimer){clearTimeout(this.saveTimer);this.saveTimer=null;
      Promise.resolve(this.store.save(JSON.stringify(this.history))).catch(error=>this.ctx.log('Cooldown save failed',{error:String(error)}));}
    // The tint is undone on the next game frame; the frame scheduler is already closed.
    if(this.indicator.tinted&&this.bound&&this.bound.indicator) {
      let done=false;
      const frame=this.game.type('UnityEngine.UnitySynchronizationContext').method('ExecuteTasks',0).virtualAddress;
      const listener=Interceptor.attach(frame,{onLeave:()=>{
        if(done)return;
        done=true;clearTimeout(timer);listener.detach();
        try{this.applyIndicator(false);}catch(error){this.ctx.log('Cooldown indicator restore failed',{error:String(error)});}
      }});
      const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
    }
  }
};
