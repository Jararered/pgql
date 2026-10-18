'use strict';
// Original adapter for Raid Pack. Four independent parts, each bound from live
// managed metadata (public names on 0.433.0; there are no offsets):
//  - skips: raid intro, gym approach camera, boss intro and raid exit fades;
//  - results: the raid / Max Battle victory screen goes straight to the catch;
//  - battle: while a raid battle runs, reads the game's own battle state every
//    frame and submits fast/charged attacks and dodges through
//    BattleDirector.TrySubmitPlayerAction; PgqlRaidBattlePolicy decides;
//  - movesets: a toast with the boss and its moves when a raid gym or a
//    Power Spot is tapped.
// A part that does not bind on this build is reported and left out.
globalThis.PgqlGameRaidPack = class PgqlGameRaidPack {
  constructor(ctx,{sleep}={}) {
    this.ctx=ctx;this.sleep=sleep || (ms=>new Promise(resolve=>setTimeout(resolve,ms)));this.game=new PgqlGameGifts(ctx);
    this.closed=false;this.failed=false;this.bound=null;this.limits={};this.tweaks=new Map();this.battle=null;this.cache={};
    this.stats={battles:0,fast:0,charged:0,dodges:0,rejected:0,manual:0,intros:0,approaches:0,results:0,maxResults:0,movesets:0,last:null};
    ctx.cleanup(()=>this.close());
  }
  // Enum fields are value types to the bridge: a plain number cannot be written to them.
  static setEnum(field,object,value) {
    const cell=Memory.alloc(8);cell.writeS32(value);
    field.bind(object).value=new Il2Cpp.ValueType(cell,field.type);
  }
  static number(value){return typeof value==='number'?value:typeof value==='object'&&value!==null&&value.field?value.field('value__').value:Number(value);}
  static get pollMs(){return 50;}
  static get victory(){return 2;}
  // PokemonDisplayProto forms are shown for these species only (their forms change the moveset).
  static get formSpecies(){return [649,744,849,854,855];}
  bind() {
    if(this.bound)return this.bound;
    PgqlGameVersion.require(Il2Cpp.application.version,'Raid Pack supports');
    const type=name=>this.type(name);
    const {args,method:plain,inheritedField:field,fieldOfType:typed}=PgqlBinding.create('Raid Pack');
    const bound={frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],'System.Void',true).virtualAddress,skips:null,results:null,maxResults:null,battle:null,dodge:null,manual:null,movesets:null,stations:null,toast:null,names:null,
      scene:type('Niantic.Holoholo.MapSceneContext'),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],'UnityEngine.Object',true)};
    plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Raid Pack: '+name+' unavailable',{error:String(error)});}
    };
    const float='System.Single';
    optional('skips',()=>{
      const root=type('Niantic.Holoholo.Gym.GymRootController'),camera=type('Niantic.Holoholo.Gym.Approach.ApproachCameraController');
      const definition=type('Niantic.Holoholo.Gym.Approach.ApproachCameraController.AnimationDefinition');
      const raid=type('Niantic.Holoholo.Raid.RaidState'),sequencer=type('Niantic.Holoholo.VNext.RaidBattleAnimationSequencer');
      const fields=(klass,names)=>Object.fromEntries(names.map(n=>[n,field(klass,n,float)]));
      return {
        introSeen:plain(root,'get_PlayerHasSeenRaidIntroSequence',[],'System.Boolean'),
        approach:plain(camera,'AnimateToTarget',['UnityEngine.Pose',float,definition.type.name],'Niantic.Promises.IPromise'),
        definition,duration:field(definition,'duration',float),
        raidEnter:plain(raid,'EnterState',[],'System.Void'),
        raidFields:fields(raid,['exitTimerWidgetFadeDuration','exitScreenFadeDuration','victoryTransitionTime','victoryIntroDelay']),
        start:plain(sequencer,'PlayStartSequence',['Niantic.Holoholo.VNext.IGymBattleUIVNext'],'Niantic.Promises.IPromise'),
        sequencerFields:fields(sequencer,['bossIntroZoomSpeed','bossRoarZoomDelay','bossFaceHoldTime','shrinkSequenceSpeed'])};
    });
    const resolveInfo=(controller,info,impl,status)=>{
      const init=plain(controller,'Initialize',[info],'System.Void'),close=plain(controller,'Close',[],'System.Void');
      plain(type(info),'get_Status',[],status);
      return {init,close,impl:type(impl),setStatus:plain(type(impl),'set_Status',[status],'System.Void'),getStatus:plain(type(impl),'get_Status',[],status)};
    };
    optional('results',()=>{
      const r=resolveInfo(type('Niantic.Holoholo.Raid.RaidResolveUIController'),'Niantic.Holoholo.Raid.IRaidResolveInformation',
        'Niantic.Holoholo.Raid.RaidResolveInformation','Niantic.Holoholo.Battle.BattleStatus');
      r.leaderboard=plain(type('Niantic.Holoholo.Raid.RaidResolveUIController'),'CloseLeaderboard',[],'System.Void');
      return r;
    });
    optional('maxResults',()=>resolveInfo(type('Niantic.Holoholo.Bread.BreadBattleResolveGuiController'),'Niantic.Holoholo.Bread.IBreadBattleResolveInformation',
      'Niantic.Holoholo.Bread.BreadBattleResolveInformation','Niantic.Holoholo.VNext.BattleStatus'));
    optional('battle',()=>{
      const state=type('Niantic.Holoholo.VNext.RaidBattleVNextState'),director=type('Niantic.Holoholo.VNext.BattleDirector');
      const battle=type('Niantic.Holoholo.VNext.BattleState'),sync=type('Niantic.Holoholo.VNext.BattleState.TurnSyncInfo');
      const actor=type('Niantic.Holoholo.VNext.BattleActorState'),character=type('Niantic.Holoholo.VNext.BattleCharacterState');
      const pokemonState=type('Niantic.Holoholo.VNext.BattlePokemonState'),proto=type('Holoholo.Rpc.BattlePokemonProto');
      const moveData=type('Holoholo.Rpc.BattlePokemonProto.Types.MoveData'),action=type('Niantic.Holoholo.VNext.BattleTurnAction');
      const event=type('Holoholo.Rpc.BattleEventProto'),attack=type('Holoholo.Rpc.BattleEventProto.Types.Attack');
      const display=type('Holoholo.Rpc.PokemonDisplayProto'),master=type('IGameMasterData');
      plain(director,'.ctor',[],'System.Void');
      const statusType=type('Niantic.Holoholo.VNext.BattleDirectorPlayerActionStatus'),statuses={};
      for(const f of statusType.fields)if(f.isStatic)statuses[f.name]=PgqlGameRaidPack.number(f.value);
      if(statuses.ACCEPTED!==1)throw Error('Unsupported battle action status');
      const constant=(klass,name)=>PgqlGameRaidPack.number(klass.field(name).value);
      const moveType=type('Holoholo.Rpc.BattlePokemonProto.Types.MoveType'),eventType=type('Holoholo.Rpc.BattleEventProto.Types.EventType');
      const types={attack:constant(eventType,'Attack'),fast:constant(moveType,'Fast'),charge:constant(moveType,'Charge'),charge2:constant(moveType,'Charge2')};
      if(types.attack!==4||types.fast!==PgqlRaidBattlePolicy.moveTypes.fast||types.charge!==PgqlRaidBattlePolicy.moveTypes.charge||types.charge2!==PgqlRaidBattlePolicy.moveTypes.charge2)
        throw Error('Unexpected battle enum values');
      return {
        enter:plain(state,'EnterState',['Niantic.Platform.GameStates.StateLogic.IStateApi','Niantic.Holoholo.Raid.RaidBattleLaunchData'],'System.Void'),
        exit:plain(state,'ExitState',[],'System.Void'),
        directorField:typed(state,'Niantic.Holoholo.VNext.IBattleDirector'),directorClass:director,
        current:plain(director,'get_CurrentState',[],'Niantic.Holoholo.VNext.BattleState'),
        blocked:plain(director,'get_InputBlocked',[],'System.Boolean'),
        submit:plain(director,'TrySubmitPlayerAction',['Holoholo.Rpc.BattleEventProto','System.Boolean'],
          'Niantic.Promises.IPromise<Niantic.Holoholo.VNext.BattleDirectorPlayerActionStatus>'),
        sync:plain(battle,'get_CurrentTurnSyncInfo',[],'Niantic.Holoholo.VNext.BattleState.TurnSyncInfo'),
        local:plain(battle,'get_LocalActor',[],'Niantic.Holoholo.VNext.BattleActorState'),
        opponents:field(battle,'ActiveOpponents','System.Collections.Generic.Dictionary<System.String,Niantic.Holoholo.VNext.BattleActorState>'),
        started:plain(sync,'get_TurnIsAtLeastBattleStart',[],'System.Boolean'),
        turn:field(sync,'Turn','System.Int64'),msPerTurn:field(sync,'MsPerTurn','System.Int64'),
        actorId:plain(actor,'get_ActorId',[],'System.String'),
        active:plain(actor,'get_ActivePokemonState',[],'Niantic.Holoholo.VNext.BattlePokemonState'),
        currentAction:field(character,'CurrentAction','Niantic.Holoholo.VNext.BattleTurnAction'),
        queued:field(pokemonState,'QueuedActions','System.Collections.Generic.List<Niantic.Holoholo.VNext.BattleTurnAction>'),
        energy:field(pokemonState,'CurrentEnergy','System.Int32'),
        fainted:plain(pokemonState,'get_IsFainted',[],'System.Boolean'),
        pokemon:plain(pokemonState,'get_Pokemon',[],'Holoholo.Rpc.BattlePokemonProto'),
        pokemonId:field(proto,'Id','System.UInt64'),pokedexId:field(proto,'PokedexId','Holoholo.Rpc.HoloPokemonId'),
        display:field(proto,'Display','Holoholo.Rpc.PokemonDisplayProto'),
        moves:field(proto,'Moves','Niantic.Protobuf.Collections.MapField<System.Int32,Holoholo.Rpc.BattlePokemonProto.Types.MoveData>'),
        breadMode:field(display,'BreadModeEnum','Holoholo.Proto.Shared.Bread.BreadModeEnum.Types.Modifier'),
        move:field(moveData,'Move','Holoholo.Rpc.HoloPokemonMove'),moveType:field(moveData,'Type','Holoholo.Rpc.HoloPokemonType'),
        moveTurns:field(moveData,'DurationTurns','System.Int32'),moveEnergy:field(moveData,'EnergyDelta','System.Int32'),
        actionType:field(action,'Type','Holoholo.Rpc.BattleEventProto.Types.EventType'),
        actionVariety:field(action,'AttackVariety','Holoholo.Rpc.BattlePokemonProto.Types.MoveType'),
        actionMove:field(action,'AttackMove','Holoholo.Rpc.HoloPokemonMove'),
        actionTurn:field(action,'Turn','System.Int64'),actionSerial:field(action,'Serial','System.Int32'),
        event,eventKind:field(event,'Type','Holoholo.Rpc.BattleEventProto.Types.EventType'),
        setAttack:plain(event,'set_Attack',['Holoholo.Rpc.BattleEventProto.Types.Attack'],'System.Void'),
        attack,attackVariety:field(attack,'AttackType','Holoholo.Rpc.BattlePokemonProto.Types.MoveType'),
        attackMove:field(attack,'Move','Holoholo.Rpc.HoloPokemonMove'),attackType:field(attack,'Type','Holoholo.Rpc.HoloPokemonType'),
        attackTarget:field(attack,'TargetId','System.String'),
        master,effectiveness:plain(master,'Get_TypeEffectiveness',['Holoholo.Rpc.HoloPokemonType','Holoholo.Rpc.IPokemonSettings'],'System.Single'),
        settings:plain(master,'Get_PokemonSettingsWithOverrides',['Holoholo.Rpc.BattlePokemonProto'],'Holoholo.Rpc.IPokemonSettings'),
        statuses,types};
    });
    if(bound.battle)optional('dodge',()=>{
      const event=type('Holoholo.Rpc.BattleEventProto'),dodge=type('Holoholo.Rpc.BattleEventProto.Types.Dodge');
      const direction=type('Holoholo.Rpc.BattleEventProto.Types.Dodge.Types.Direction'),settings=type('Holoholo.Rpc.MoveSettingsProto');
      const generic=bound.battle.master.methods.filter(m=>m.name==='MaybeGetByKey'&&m.isGeneric&&args(m)==='System.Enum');
      if(generic.length!==1)throw Error('Unsupported game master lookup');
      return {setDodge:plain(event,'set_Dodge',[dodge.type.name],'System.Void'),dodge,direction:field(dodge,'Direction',direction.type.name),
        right:PgqlGameRaidPack.number(direction.field('Right').value),dodgeKind:PgqlGameRaidPack.number(type('Holoholo.Rpc.BattleEventProto.Types.EventType').field('Dodge').value),
        moveEnum:type('Holoholo.Rpc.HoloPokemonMove'),settings,
        start:field(settings,'DamageWindowStartMs','System.Int32'),end:field(settings,'DamageWindowEndMs','System.Int32')};
    });
    if(bound.battle)optional('manual',()=>({
      swap:plain(type('Niantic.Holoholo.VNext.SwapButtonVNext'),'Swap',[],'System.Void'),
      ability:plain(type('Niantic.Holoholo.VNext.BattleAbilityButtonVNext'),'AbilityButtonClick',[],'System.Void'),
      item:plain(type('Niantic.Holoholo.VNext.BattleItemButtonVNext'),'TryUseRaidItem',[],'System.Void')}));
    const pokemonFields=()=>{
      const pokemon=type('Holoholo.Rpc.PokemonProto');
      return {id:field(pokemon,'pokemonId_','System.Int32'),move1:field(pokemon,'move1_','System.Int32'),move2:field(pokemon,'move2_','System.Int32'),
        display:field(pokemon,'pokemonDisplay_','Holoholo.Rpc.PokemonDisplayProto'),
        form:field(type('Holoholo.Rpc.PokemonDisplayProto'),'Form','Holoholo.Rpc.PokemonDisplayProto.Types.Form')};
    };
    optional('movesets',()=>{
      const gym=type('Niantic.Holoholo.Gym.MapGym'),place=type('Niantic.Holoholo.Map.AbstractMapPlace');
      if(!gym.isSubclassOf(place,false))throw Error('Unsupported map gym');
      return {tap:plain(gym,'OnTap',['System.Object','System.EventArgs'],'System.Void'),
        fortData:plain(place,'get_FortData',[],'Holoholo.Rpc.PokemonFortProto'),
        raidInfo:field(type('Holoholo.Rpc.PokemonFortProto'),'RaidInfo','Holoholo.Rpc.RaidInfoProto'),
        raidPokemon:field(type('Holoholo.Rpc.RaidInfoProto'),'RaidPokemon','Holoholo.Rpc.PokemonProto'),...pokemonFields()};
    });
    optional('stations',()=>{
      const station=type('Niantic.Holoholo.Map.MapStation'),proto=type('Niantic.Holoholo.Bread.StationProto');
      const details=field(proto,'BattleDetails','Niantic.Holoholo.Bread.BreadBattleDetailProto');
      return {tap:plain(station,'OnTap',['System.Object','System.EventArgs'],'System.Void'),
        proto:plain(station,'get_StationProto',[],'Niantic.Holoholo.Bread.StationProto'),details,
        battlePokemon:field(details.type.class,'BattlePokemon','Holoholo.Rpc.PokemonProto'),...pokemonFields()};
    });
    if(bound.movesets||bound.stations) {
      optional('toast',()=>{
        const service=type('Niantic.Holoholo.UI.IToastService'),params=type('Niantic.Holoholo.UI.ToastService.ToastParams');
        plain(service,'TwoLine',['System.String',params.type.name],'Niantic.Holoholo.UI.IToastReceipt');
        plain(params,'.ctor',[],'System.Void');
        for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],['DisplaySecondsOverride','System.Nullable<System.Single>']])
          field(params,name,expected);
        const nullable=params.field('DisplaySecondsOverride').type.class;
        field(nullable,'hasValue','System.Boolean');nullable.field('value');
        return {service,params,top:PgqlGameToast.bind(type,params,this.ctx.log)};
      });
      optional('names',()=>{
        const i18n=type('Niantic.Holoholo.Internationalization.II18n');
        plain(i18n,'PokemonName',['Holoholo.Rpc.HoloPokemonId'],'System.String');
        plain(i18n,'PokemonMoveName',['Holoholo.Rpc.HoloPokemonMove'],'System.String');
        const formName=plain(type('Niantic.Holoholo.Util.PokemonFormExt'),'FormName',['Holoholo.Rpc.PokemonDisplayProto.Types.Form',i18n.type.name],'System.String',true);
        return {i18n,formName};
      });
    }
    if(!['skips','results','maxResults','battle','movesets','stations'].some(name=>bound[name]))throw Error('No Raid Pack part is supported on this game build');
    this.bound=bound;
    return bound;
  }
  // Top-level types come from the shared cache; nested ones (Outer.Inner) from their declaring type.
  type(name) {
    try{return this.game.type(name);}
    catch(error) {
      const parts=name.split('.');
      for(let i=parts.length-1;i>0;i--) {
        let klass=null;
        try{klass=this.game.type(parts.slice(0,i).join('.'));}catch(_){continue;}
        for(const part of parts.slice(i))klass=klass&&klass.nestedClasses.find(c=>c.name===part);
        if(klass)return klass;
      }
      throw error;
    }
  }
  service(klass) {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())throw Error('Game map unavailable');
    const found=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(klass.type.object);
    if(found.isNull())throw Error('Game service unavailable: '+klass.type.name);
    return found;
  }
  // The implementation of an interface method on a service object.
  implementation(object,name,params) {
    const key=object.class.handle.toString()+':'+name+':'+params.join('|');
    if(!this.cache[key]) {
      const found=[...object.class.hierarchy({includeCurrent:true})].flatMap(k=>k.methods).find(m=>!m.isStatic&&!m.isGeneric&&
        (m.name===name||m.name.endsWith('.'+name))&&m.parameters.map(p=>p.type.name).join('|')===params.join('|')&&!m.virtualAddress.isNull());
      if(!found)throw Error('No implementation of '+name+' on '+object.class.type.name);
      this.cache[key]=found;
    }
    return this.cache[key].bind(object);
  }
  // A part failed while running: leave it out from now on, keep the rest.
  limit(name,error) {
    if(this.limits[name])return;
    this.limits[name]=String(error && error.message || error);
    this.ctx.log('Raid Pack: '+name+' stopped after an error',{error:String(error)});
  }
  // Shortens serialized timings on a game object; originals come back on disable.
  tweak(object,fields,value) {
    const key=object.handle.toString();
    let entry=this.tweaks.get(key);
    if(!entry) {
      const pin=this.game.handleNew(object.handle,1);
      if(pin.isNull())throw Error('Unable to retain game object');
      entry={pin,original:new Map()};this.tweaks.set(key,entry);
    }
    for(const [name,f] of Object.entries(fields)) {
      if(!entry.original.has(name))entry.original.set(name,{field:f,value:f.bind(object).value});
      f.bind(object).value=typeof value==='object'?value[name]:value;
    }
  }
  restore() {
    for(const entry of this.tweaks.values()) {
      try {
        const object=new Il2Cpp.Object(this.game.handleTarget(entry.pin));
        if(!object.isNull())for(const {field,value} of entry.original.values())field.bind(object).value=value;
      }catch(error){this.ctx.log('Raid Pack restore failed',{error:String(error)});}
      try{this.game.handleFree(entry.pin);}catch(_){}
    }
    this.tweaks.clear();
  }
  // ---- skips and results (game thread, inside hooks) ----
  installSkips() {
    const s=this.bound.skips,self=this,config=()=>this.ctx.config;
    this.ctx.hook(s.introSeen.virtualAddress,{onLeave(retval) {
      if(self.closed||self.limits.skips||!config().skipAnimations)return;
      if(retval.toInt32()===0)self.stats.intros++;
      retval.replace(ptr(1));
    }});
    this.ctx.hook(s.approach.virtualAddress,{onEnter(args) {
      if(self.closed||self.limits.approach||!config().skipAnimations)return;
      try {
        // x0 this, x1 the Pose (28 bytes, by reference), s0 the FOV, x2 the definition.
        const animation=new Il2Cpp.Object(args[2]);
        if(animation.isNull())return;
        if(!s.definition.isAssignableFrom(animation.class))throw Error('Unexpected approach camera arguments');
        self.tweak(animation,{duration:s.duration},0.05);self.stats.approaches++;
      }catch(error){self.limit('approach',error);}
    }});
    this.ctx.hook(s.raidEnter.virtualAddress,{onEnter(args){this.state=args[0];},onLeave() {
      if(self.closed||self.limits.skips||!config().skipAnimations)return;
      try{self.tweak(new Il2Cpp.Object(this.state),s.raidFields,0.1);}catch(error){self.limit('skips',error);}
    }});
    this.ctx.hook(s.start.virtualAddress,{onEnter(args) {
      if(self.closed||self.limits.skips||!config().skipAnimations)return;
      try{self.tweak(new Il2Cpp.Object(args[0]),s.sequencerFields,{bossIntroZoomSpeed:1000,bossRoarZoomDelay:0,bossFaceHoldTime:0,shrinkSequenceSpeed:1000});}
      catch(error){self.limit('skips',error);}
    }});
  }
  // Victory on a resolve screen: clear the status so the screen does not
  // animate, then close it, which continues to the catch.
  installResults(name,setting,counter) {
    const r=this.bound[name],self=this,victory=PgqlGameRaidPack.victory;
    this.ctx.hook(r.init.virtualAddress,{
      onEnter(args) {
        this.skip=false;
        if(self.closed||self.limits[name]||!self.ctx.config[setting])return;
        try {
          const info=new Il2Cpp.Object(args[1]);
          if(info.isNull()||!r.impl.isAssignableFrom(info.class))return;
          if(PgqlGameRaidPack.number(r.getStatus.bind(info).invoke())!==victory)return;
          r.setStatus.bind(info).invoke(0);
          this.controller=args[0];this.skip=true;
        }catch(error){self.limit(name,error);}
      },
      onLeave() {
        if(!this.skip||self.closed)return;
        try {
          const controller=new Il2Cpp.Object(this.controller);
          if(r.leaderboard)r.leaderboard.bind(controller).invoke();
          r.close.bind(controller).invoke();
          self.stats[counter]++;self.ctx.log('Raid Pack skipped the result screen',{kind:counter});
        }catch(error){self.limit(name,error);}
      }});
  }
  // ---- boss movesets ----
  installMovesets(name,read) {
    const self=this,part=this.bound[name];
    this.ctx.hook(part.tap.virtualAddress,{onEnter(args) {
      if(self.closed||self.limits[name]||!self.ctx.config.bossMovesets)return;
      try {
        const pokemon=read(new Il2Cpp.Object(args[0]));
        if(!pokemon||pokemon.isNull())return;
        const id=part.id.bind(pokemon).value;
        if(!(id>0))return;
        const display=part.display.bind(pokemon).value;
        self.showMoveset({id,form:display.isNull()?0:PgqlGameRaidPack.number(part.form.bind(display).value),
          fast:part.move1.bind(pokemon).value,charged:part.move2.bind(pokemon).value});
      }catch(error){self.limit(name,error);}
    }});
  }
  movesetText(boss) {
    const b=this.bound;
    let name='#'+boss.id,fast='#'+boss.fast,charged='#'+boss.charged;
    if(b.names&&!this.limits.names) {
      try {
        const i18n=this.service(b.names.i18n),text=value=>value.isNull()||!value.content?null:value.content;
        name=text(this.implementation(i18n,'PokemonName',['Holoholo.Rpc.HoloPokemonId']).invoke(boss.id)) || name;
        if(boss.form&&PgqlGameRaidPack.formSpecies.includes(boss.id)) {
          const form=text(b.names.formName.invoke(boss.form,i18n));
          if(form)name+=' ('+form.replace(/\n/g,' ')+')';
        }
        const move=this.implementation(i18n,'PokemonMoveName',['Holoholo.Rpc.HoloPokemonMove']);
        fast=text(move.invoke(boss.fast)) || fast;charged=text(move.invoke(boss.charged)) || charged;
      }catch(error){this.limit('names',error);}
    }
    return name+'\n'+fast+' / '+charged;
  }
  showMoveset(boss) {
    const text=this.movesetText(boss);
    this.stats.movesets++;this.stats.last=text.replace('\n',': ');
    this.ctx.log('Raid Pack boss moveset',{text:this.stats.last});
    const t=this.bound.toast;
    if(!t||this.limits.toast)return;
    try {
      const service=this.service(t.service),params=t.params.alloc();
      params.method('.ctor',0).invoke();PgqlGameToast.place(t.top,params);
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=5;seconds.field('hasValue').value=true;
      this.implementation(service,'TwoLine',['System.String',t.params.type.name]).invoke(Il2Cpp.string(text),params);
    }catch(error){this.limit('toast',error);}
  }
  // ---- battle automation ----
  installBattle() {
    const b=this.bound.battle,self=this;
    this.ctx.hook(b.enter.virtualAddress,{onEnter(args){this.state=args[0];},onLeave() {
      if(self.closed||self.limits.battle)return;
      try{self.startBattle(new Il2Cpp.Object(this.state));}catch(error){self.limit('battle',error);}
    }});
    this.ctx.hook(b.exit.virtualAddress,{onEnter(){self.endBattle('exit');}});
    const m=this.bound.manual;
    if(m)for(const method of [m.swap,m.ability,m.item])this.ctx.hook(method.virtualAddress,{onEnter() {
      if(self.battle&&!self.closed){PgqlRaidBattlePolicy.manual(self.battle.policy,Date.now());self.stats.manual++;}
    }});
  }
  startBattle(state) {
    const b=this.bound.battle;
    const director=b.directorField.bind(state).value;
    if(director.isNull())throw Error('Battle director unavailable');
    if(!b.directorClass.isAssignableFrom(director.class))throw Error('Unsupported battle director: '+director.class.type.name);
    this.endBattle('restart');
    const pin=this.game.handleNew(director.handle,1);
    if(pin.isNull())throw Error('Unable to retain battle director');
    const battle={pin,policy:PgqlRaidBattlePolicy.battle(),ended:false,boss:null,moves:new Map(),master:null};
    this.battle=battle;this.stats.battles++;
    this.ctx.log('Raid Pack battle started',{autoAttack:!!this.ctx.config.autoAttack,autoDodge:!!this.ctx.config.autoDodge});
    setTimeout(()=>this.loop(battle).catch(error=>this.limit('battle',error)),0);
  }
  endBattle(reason) {
    const battle=this.battle;
    if(!battle)return;
    battle.ended=true;this.battle=null;
    try{this.game.handleFree(battle.pin);}catch(_){}
    this.ctx.log('Raid Pack battle ended',{reason,...battle.policy.stats});
  }
  async loop(battle) {
    while(!battle.ended&&!this.closed&&!this.limits.battle) {
      try {
        await this.game.main(()=>{if(!battle.ended)this.tick(battle);},'raid-pack');
        PgqlRaidBattlePolicy.ok(battle.policy);
      }catch(error) {
        if(battle.ended||this.closed)return;
        this.ctx.log('Raid Pack battle step failed',{error:String(error)});
        if(PgqlRaidBattlePolicy.error(battle.policy)){this.ctx.log('Raid Pack: automation stopped for this battle');return;}
      }
      await this.sleep(PgqlGameRaidPack.pollMs);
    }
  }
  // Move settings from the game master: energy and the damage window of a move.
  moveSettings(battle,move) {
    if(battle.moves.has(move))return battle.moves.get(move);
    const d=this.bound.dodge;
    let found=null;
    if(d&&!this.limits.dodge) {
      try {
        if(!this.cache.maybeGet) {
          const generic=battle.master.class.methods.find(m=>m.isGeneric&&(m.name==='MaybeGetByKey'||m.name.endsWith('.MaybeGetByKey'))&&
            m.parameterCount===1&&m.parameters[0].type.name==='System.Enum');
          if(!generic)throw Error('Unsupported game master lookup');
          this.cache.maybeGet=generic.inflate(d.settings);
        }
        const cell=Memory.alloc(8);cell.writeS32(move);
        const settings=this.cache.maybeGet.bind(battle.master).invoke(new Il2Cpp.ValueType(cell,d.moveEnum.type).box());
        if(!settings.isNull())found={startMs:d.start.bind(settings).value,endMs:d.end.bind(settings).value};
      }catch(error){this.limit('dodge',error);}
    }
    battle.moves.set(move,found);
    return found;
  }
  // Fast and charged moves of a battle Pokemon, with their effectiveness against the boss.
  readMoves(battle,proto,bossSettings) {
    const b=this.bound.battle,number=PgqlGameRaidPack.number,list=[];
    for(const entry of this.game.array(b.moves.bind(proto).value)) {
      const slot=number(this.game.method(entry,'get_Key').invoke()),data=this.game.method(entry,'get_Value').invoke();
      if(data.isNull())continue;
      const move=number(b.move.bind(data).value),type=number(b.moveType.bind(data).value);
      if(!move)continue;
      list.push({slot,move,type,energy:b.moveEnergy.bind(data).value,turns:b.moveTurns.bind(data).value,
        effectiveness:bossSettings?battle.effectiveness.invoke(type,bossSettings):1});
    }
    const fast=list.find(m=>m.slot===b.types.fast) || list.find(m=>m.energy>0) || null;
    const charged=list.filter(m=>m!==fast&&(m.slot===b.types.charge||m.slot===b.types.charge2||m.energy<0));
    return {fast,charged};
  }
  tick(battle) {
    const b=this.bound.battle,config=this.ctx.config,number=PgqlGameRaidPack.number;
    if(!config.autoAttack&&!config.autoDodge)return;
    const director=new Il2Cpp.Object(this.game.handleTarget(battle.pin));
    if(director.isNull()){this.endBattle('gone');return;}
    const state=b.current.bind(director).invoke();
    if(state.isNull())return;
    const sync=b.sync.bind(state).invoke();
    if(sync.isNull()||!b.started.bind(sync).invoke())return;
    const turn=Number(b.turn.bind(sync).value),msPerTurn=Number(b.msPerTurn.bind(sync).value);
    const local=b.local.bind(state).invoke();
    if(local.isNull())return;
    const mine=b.active.bind(local).invoke();
    if(mine.isNull()||b.fainted.bind(mine).invoke())return;
    let boss=null;
    for(const entry of this.game.array(b.opponents.bind(state).value)) {
      const actor=this.game.method(entry,'get_Value').invoke();
      if(actor.isNull())continue;
      const pokemon=b.active.bind(actor).invoke();
      if(!pokemon.isNull()){boss={actor,pokemon};break;}
    }
    if(!boss)return;
    if(!battle.master)battle.master=this.service(b.master);
    const bossProto=b.pokemon.bind(boss.pokemon).invoke();
    if(bossProto.isNull())return;
    const bossKey=b.pokemonId.bind(bossProto).value.toString();
    if(!battle.boss||battle.boss.key!==bossKey) {
      const display=b.display.bind(bossProto).value;
      battle.boss={key:bossKey,id:b.actorId.bind(boss.actor).invoke().content,settings:this.implementation(battle.master,'Get_PokemonSettingsWithOverrides',['Holoholo.Rpc.BattlePokemonProto']).invoke(bossProto),
        isMax:!display.isNull()&&number(b.breadMode.bind(display).value)!==0};
      this.ctx.log('Raid Pack boss',{pokedex:number(b.pokedexId.bind(bossProto).value),max:battle.boss.isMax,actor:battle.boss.id});
    }
    if(config.autoDodge&&this.bound.dodge&&!this.limits.dodge&&!battle.boss.isMax)this.watchBoss(battle,boss,msPerTurn);
    const proto=b.pokemon.bind(mine).invoke();
    if(proto.isNull())return;
    if(!battle.effectiveness)battle.effectiveness=this.implementation(battle.master,'Get_TypeEffectiveness',['Holoholo.Rpc.HoloPokemonType','Holoholo.Rpc.IPokemonSettings']);
    const moves=this.readMoves(battle,proto,battle.boss.settings.isNull()?null:battle.boss.settings);
    const decision=PgqlRaidBattlePolicy.decide(battle.policy,{turn,now:Date.now(),energy:b.energy.bind(mine).value,fast:moves.fast,charged:moves.charged,
      isMax:battle.boss.isMax,inputBlocked:!!b.blocked.bind(director).invoke(),
      config:{autoAttack:!!config.autoAttack,autoDodge:!!config.autoDodge&&!!this.bound.dodge&&!this.limits.dodge,manualMaxBattles:!!config.manualMaxBattles}});
    if(decision.kind==='none')return;
    this.submit(battle,director,decision,turn);
  }
  // Boss charged attacks, from the boss's current and queued turn actions.
  watchBoss(battle,boss,msPerTurn) {
    const b=this.bound.battle,number=PgqlGameRaidPack.number,actions=[];
    for(const owner of [boss.actor,boss.pokemon]){const a=b.currentAction.bind(owner).value;if(!a.isNull())actions.push(a);}
    actions.push(...this.game.array(b.queued.bind(boss.pokemon).value));
    for(const action of actions) {
      if(number(b.actionType.bind(action).value)!==b.types.attack)continue;
      const variety=number(b.actionVariety.bind(action).value);
      if(variety!==b.types.charge&&variety!==b.types.charge2)continue;
      const move=number(b.actionMove.bind(action).value),turn=Number(b.actionTurn.bind(action).value);
      const key=turn+':'+b.actionSerial.bind(action).value+':'+move;
      if(battle.policy.seen.has(key))continue;
      const settings=this.moveSettings(battle,move);
      if(!settings){battle.policy.seen.add(key);continue;}
      if(PgqlRaidBattlePolicy.bossAttack(battle.policy,{key,turn,msPerTurn,startMs:settings.startMs,endMs:settings.endMs}))
        this.ctx.log('Raid Pack boss charged attack',{move,turn,window:battle.policy.dodge.start+'-'+battle.policy.dodge.end});
    }
  }
  submit(battle,director,decision,turn) {
    const b=this.bound.battle,event=b.event.new(),set=PgqlGameRaidPack.setEnum;
    if(decision.kind==='dodge') {
      const d=this.bound.dodge,dodge=d.dodge.new();
      set(d.direction,dodge,d.right);
      set(b.eventKind,event,d.dodgeKind);
      d.setDodge.bind(event).invoke(dodge);
    }else {
      const attack=b.attack.new(),move=decision.move;
      set(b.attackVariety,attack,decision.kind==='fast'?b.types.fast:(move.slot===b.types.charge2?b.types.charge2:b.types.charge));
      set(b.attackMove,attack,move.move);set(b.attackType,attack,move.type);
      if(decision.kind==='charged'&&battle.boss.id)b.attackTarget.bind(attack).value=Il2Cpp.string(battle.boss.id);
      set(b.eventKind,event,b.types.attack);
      b.setAttack.bind(event).invoke(attack);
    }
    const request=b.submit.bind(director).invoke(event,false);
    PgqlRaidBattlePolicy.submitted(battle.policy,decision,turn);
    if(decision.kind==='dodge')this.stats.dodges++;else this.stats[decision.kind]++;
    if(request.isNull())return;
    const accepted=[b.statuses.ACCEPTED,b.statuses.BUFFERED_BY_INPUT_BLOCK];
    this.game.promise(request,status=>PgqlGameRaidPack.number(status)).then(status=>{
      const ok=accepted.includes(status);
      PgqlRaidBattlePolicy.answered(battle.policy,ok);
      if(!ok){this.stats.rejected++;if(battle.policy.stats.rejected<=10)this.ctx.log('Raid Pack action refused',{kind:decision.kind,status});}
    }).catch(()=>{});
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind();
      const install=(name,fn)=>{if(!b[name])return;try{fn();}catch(error){b[name]=null;this.limit(name,error);}};
      install('skips',()=>this.installSkips());
      install('results',()=>this.installResults('results','skipAnimations','results'));
      install('maxResults',()=>this.installResults('maxResults','skipMaxBattleResult','maxResults'));
      install('battle',()=>this.installBattle());
      install('movesets',()=>this.installMovesets('movesets',gym=>{
        const m=b.movesets,fort=m.fortData.bind(gym).invoke();
        if(fort.isNull())return null;
        const info=m.raidInfo.bind(fort).value;
        return info.isNull()?null:m.raidPokemon.bind(info).value;
      }));
      install('stations',()=>this.installMovesets('stations',station=>{
        const s=b.stations,proto=s.proto.bind(station).invoke();
        if(proto.isNull())return null;
        const details=s.details.bind(proto).value;
        return details.isNull()?null:s.battlePokemon.bind(details).value;
      }));
      const parts=['skips','results','maxResults','battle','dodge','manual','movesets','stations','toast','names'].filter(name=>b[name]);
      this.ctx.log('Raid Pack ready',{parts});
      return true;
    });
  }
  report() {
    const s=this.stats;
    const lines=['Battles: '+s.battles+(this.battle?' (in battle now)':''),
      'Attacks: '+s.fast+' fast, '+s.charged+' charged; dodges: '+s.dodges+(s.rejected?'; refused: '+s.rejected:'')+(s.manual?'; manual taps: '+s.manual:''),
      'Skipped: '+s.intros+' raid intros, '+s.approaches+' approach cameras, '+s.results+' raid results, '+s.maxResults+' Max Battle results',
      'Boss movesets shown: '+s.movesets+(s.last?' (last: '+s.last+')':'')];
    const labels={skips:'Transition skips',approach:'Approach camera skip',results:'Raid result skip',maxResults:'Max Battle result skip',battle:'Auto-battle',dodge:'Auto-dodge',
      manual:'Manual tap pause',movesets:'Gym movesets',stations:'Power Spot movesets',toast:'Toasts',names:'Names'};
    for(const [name,label] of Object.entries(labels))if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  // Unity objects may only be used on the game thread, so shortened timings are
  // restored on the next game frame, after the synchronous cleanup returned.
  close() {
    if(this.closed)return;
    this.closed=true;
    this.endBattle('disabled');
    if(!this.bound||!this.tweaks.size)return;
    let done=false;
    const listener=Interceptor.attach(this.bound.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      this.restore();this.ctx.log('Raid Pack timings restored');
    }});
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
