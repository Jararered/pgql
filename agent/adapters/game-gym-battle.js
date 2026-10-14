'use strict';
// Original adapter for Auto Gym Battle. Gym battles on 0.433.0 still run the
// legacy client-driven battle system (Niantic.Holoholo.Gym.GymBattleState and
// Niantic.Holoholo.Battle.*), not the VNext battle director used by raids. While
// a battle against a gym of another team runs, this adapter reads the battle
// frame every frame and drives the game's own actions on
// IBattleFrameObservableService: TryOrQueueAttack, TryOrQueueSpecialAttack,
// TryDodge and TrySwap. PgqlGymBattlePolicy owns the rules. Names are verified
// from live managed metadata; there are no offsets.
globalThis.PgqlGameGymBattle = class PgqlGameGymBattle {
  constructor(ctx,{sleep}={}) {
    this.ctx=ctx;this.sleep=sleep || (ms=>new Promise(resolve=>setTimeout(resolve,ms)));this.game=new PgqlGameGifts(ctx);
    this.closed=false;this.bound=null;this.limits={};this.cache={};this.battle=null;
    this.stats={battles:0,skipped:{},fast:0,charged:0,dodges:0,swaps:0,rejected:0,refused:{},manual:0,countdowns:0,last:null};
    ctx.cleanup(()=>this.close());
  }
  static number(value){return typeof value==='number'?value:typeof value==='object'&&value!==null&&value.field?value.field('value__').value:Number(value);}
  static get pollMs(){return 50;}
  bind() {
    if(this.bound)return this.bound;
    PgqlGameVersion.require(Il2Cpp.application.version,'Auto Gym Battle supports');
    const type=name=>this.type(name),number=PgqlGameGymBattle.number;
    const args=m=>m.parameters.map(p=>p.type.name).join('|');
    const plain=(klass,name,params,returns)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&!m.isStatic&&args(m)===params.join('|'));
      if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))throw Error('Unsupported Auto Gym Battle method: '+klass.type.name+'.'+name);
      return matches[0];
    };
    const field=(klass,name,typeName)=>{
      const found=klass.fields.find(f=>f.name===name);
      if(!found||found.isStatic||found.type.name!==typeName)throw Error('Unsupported Auto Gym Battle field: '+klass.type.name+'.'+name);
      return found;
    };
    const constant=(klass,name)=>number(klass.field(name).value);
    const state=type('Niantic.Holoholo.Gym.GymBattleState'),base=type('Niantic.Holoholo.Gym.BattleState');
    if(!state.isSubclassOf(base,false))throw Error('Unsupported gym battle state');
    const service=type('Niantic.Holoholo.Battle.BattleFrameObservableService'),serviceApi=type('Niantic.Holoholo.Battle.IBattleFrameObservableService');
    const frame=type('Niantic.Holoholo.Battle.BattleFrame'),player=type('Niantic.Holoholo.Battle.BattleFrame.PlayerFrame');
    const pokemon=type('Niantic.Holoholo.Battle.BattleFrame.PokemonFrame'),action=type('Niantic.Holoholo.Battle.BattleFrame.PokemonFrame.FrameAction');
    const actionType=type('Niantic.Holoholo.Battle.BattleFrame.PokemonFrame.FrameAction.ActionType');
    const battlePokemon=type('Niantic.Holoholo.Battle.BattlePokemon'),timing=type('Niantic.Holoholo.Battle.BattleTimingService');
    const proto=type('Holoholo.Rpc.PokemonProto'),settings=type('Holoholo.Rpc.PokemonSettingsProto'),moveSettings=type('Holoholo.Rpc.MoveSettingsProto');
    const root=type('Niantic.Holoholo.Gym.GymRootController'),status=type('Niantic.Holoholo.Battle.BattleStatus');
    const types=PgqlGymBattlePolicy.actionTypes;
    for(const [key,name] of [['attack','Attack'],['special','SpecialAttack'],['special2','SpecialAttack2'],['dodge','Dodge']])
      if(constant(actionType,name)!==types[key])throw Error('Unexpected gym battle action numbers');
    if(constant(status,'Active')!==1)throw Error('Unexpected gym battle status numbers');
    if(!serviceApi.isAssignableFrom(service))throw Error('Unsupported battle frame service');
    // ObservableService<BattleFrame>.get_Observed, inherited from the generic parent.
    const observed=service.parent && service.parent.methods.find(m=>m.name==='get_Observed'&&m.parameterCount===0&&!m.isStatic);
    if(!observed || observed.returnType.name!=='Niantic.Holoholo.Battle.BattleFrame')throw Error('Unsupported battle frame lookup');
    const master=type('IGameMasterData');
    plain(master,'Get_PokemonSettings',['Holoholo.Rpc.PokemonProto','System.Boolean'],'Holoholo.Rpc.PokemonSettingsProto');
    plain(master,'Get_TypeEffectiveness',['Holoholo.Rpc.HoloPokemonType','Holoholo.Rpc.HoloPokemonType','Holoholo.Rpc.HoloPokemonType'],'System.Single');
    if(!master.methods.some(m=>m.name==='MaybeGetByKey'&&m.isGeneric&&args(m)==='System.Enum'))throw Error('Unsupported game master lookup');
    const bound={
      enter:plain(state,'EnterState',[],'System.Void'),exit:plain(state,'ExitState',[],'System.Void'),
      playerPokemon:plain(state,'get_PlayerPokemon',[],'Niantic.Holoholo.Battle.PlayerBattlePokemon'),
      serviceField:field(base,'battleFrameObservableService','Niantic.Holoholo.Battle.IBattleFrameObservableService'),
      rootField:field(base,'gymRootController','Niantic.Holoholo.Gym.IGymRootController'),
      playersField:field(base,'playerService','Niantic.Holoholo.IPlayerService'),
      masterField:field(base,'gameMasterData','IGameMasterData'),
      service,observed,active:plain(service,'get_BattleActive',[],'System.Boolean'),
      attack:plain(service,'TryOrQueueAttack',[],'System.Void'),special:plain(service,'TryOrQueueSpecialAttack',['System.Boolean'],'System.Void'),
      dodge:plain(service,'TryDodge',[],'System.Boolean'),swap:plain(service,'TrySwap',['Holoholo.Rpc.PokemonProto'],'System.Boolean'),
      local:field(frame,'LocalPlayer','Niantic.Holoholo.Battle.BattleFrame.PlayerFrame'),
      enemy:field(frame,'EnemyPokemon','Niantic.Holoholo.Battle.BattleFrame.PokemonFrame'),
      status:field(frame,'BattleStatus','Niantic.Holoholo.Battle.BattleStatus'),
      roster:field(player,'Pokemon','System.Collections.Generic.List<Niantic.Holoholo.Battle.BattleFrame.PokemonFrame>'),
      activeIndex:field(player,'ActivePokemonIndex','System.Int32'),swapping:plain(player,'get_IsSwapping',[],'System.Boolean'),
      pokemon:plain(pokemon,'get_Pokemon',[],'Holoholo.Rpc.PokemonProto'),health:plain(pokemon,'get_Health',[],'System.Int32'),
      energy:plain(pokemon,'get_Energy',[],'System.Int32'),fainted:plain(pokemon,'get_IsFainted',[],'System.Boolean'),
      dodging:plain(pokemon,'get_IsDodging',[],'System.Boolean'),
      current:plain(pokemon,'get_CurrentAction',[],'Niantic.Holoholo.Battle.BattleFrame.PokemonFrame.FrameAction'),
      queuedActive:field(pokemon,'QueuedActionActive','System.Boolean'),
      actionType:field(action,'Type','Niantic.Holoholo.Battle.BattleFrame.PokemonFrame.FrameAction.ActionType'),
      actionStart:field(action,'StartTimeMs','System.Int64'),
      timingField:field(battlePokemon,'battleTimingService','Niantic.Holoholo.Battle.IBattleTimingService'),
      timing,lands:plain(timing,'TimeUntilAttackLands',['Niantic.Holoholo.Battle.BattleFrame.PokemonFrame.FrameAction'],'System.Single'),
      id:field(proto,'id_','System.UInt64'),pokedex:field(proto,'pokemonId_','System.Int32'),
      maxHealth:field(proto,'maxStamina_','System.Int32'),
      moves:['move1_','move2_','move3_'].map(name=>field(proto,name,'System.Int32')),
      type1:field(settings,'type1_','Holoholo.Rpc.HoloPokemonType'),type2:field(settings,'type2_','Holoholo.Rpc.HoloPokemonType'),
      moveSettings,moveEnum:type('Holoholo.Rpc.HoloPokemonMove'),
      moveType:field(moveSettings,'Type','Holoholo.Rpc.HoloPokemonType'),moveEnergy:field(moveSettings,'EnergyDelta','System.Int32'),
      root,team:plain(root,'get_GymTeam',[],'Niantic.Holoholo.Team'),
      playerTeam:plain(type('Niantic.Holoholo.IPlayerService'),'GetPlayerTeam',[],'System.Int32'),
      manual:null};
    try{bound.manual=plain(type('Niantic.Holoholo.Battle.SwapButton'),'Swap',[],'System.Void');}
    catch(error){this.limit('manual',error);}
    // The "Next up" screen between defenders: its Battle button counts down.
    try {
      const next=type('Niantic.Holoholo.Gym.Battle.GymBattleContinueGuiController');
      bound.countdown={opened:plain(next,'HandleOpenComplete',[],'System.Void'),proceed:plain(next,'ContinueToNextBattle',[],'System.Void')};
    }catch(error){bound.countdown=null;this.limit('countdown',error);}
    this.bound=bound;
    return bound;
  }
  // Types by full name, nested types through their declaring type.
  type(name) {
    try{return this.game.type(name);}catch(error) {
      const parts=name.split('.');
      for(let i=parts.length-1;i>0;i--) {
        let klass=null;
        try{klass=this.game.type(parts.slice(0,i).join('.'));}catch(_){continue;}
        for(const part of parts.slice(i))klass=klass&&klass.nestedClasses.find(k=>k.name===part);
        if(klass)return klass;
      }
      throw error;
    }
  }
  // The concrete implementation of an interface method on this object.
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
  limit(name,error) {
    if(this.limits[name])return;
    this.limits[name]=String(error && error.message || error);
    this.ctx.log('Auto Gym Battle: '+name+' unavailable',{error:this.limits[name]});
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      this.ctx.hook(b.enter.virtualAddress,{onEnter(args){this.state=args[0];},onLeave() {
        if(self.closed)return;
        try{self.startBattle(new Il2Cpp.Object(this.state));}catch(error){self.ctx.log('Auto Gym Battle could not start',{error:String(error)});}
      }});
      this.ctx.hook(b.exit.virtualAddress,{onEnter(){self.endBattle('exit');}});
      if(b.manual)this.ctx.hook(b.manual.virtualAddress,{onEnter() {
        if(self.battle&&!self.closed){PgqlGymBattlePolicy.manual(self.battle.policy,Date.now());self.stats.manual++;}
      }});
      if(b.countdown)this.ctx.hook(b.countdown.opened.virtualAddress,{onEnter(args){this.screen=args[0];},onLeave() {
        if(self.closed||!self.battle||!self.ctx.config.skipCountdown)return;
        try{self.skipCountdown(new Il2Cpp.Object(this.screen));}catch(error){self.limit('countdown',error);}
      }});
      this.ctx.log('Auto Gym Battle ready',{parts:['battle'].concat(b.manual?['manual']:[],b.countdown?['countdown']:[])});
      return true;
    });
  }
  startBattle(state) {
    const b=this.bound,number=PgqlGameGymBattle.number;
    this.endBattle('restart');
    const root=b.rootField.bind(state).value,players=b.playersField.bind(state).value;
    let teams=null;
    if(!root.isNull()&&b.root.isAssignableFrom(root.class)&&!players.isNull())
      teams={gymTeam:number(b.team.bind(root).invoke()),playerTeam:number(this.implementation(players,'GetPlayerTeam',[]).invoke())};
    const rival=teams?PgqlGymBattlePolicy.rival(teams):{ok:false,reason:'unknown-team'};
    if(!rival.ok) {
      this.stats.skipped[rival.reason]=(this.stats.skipped[rival.reason]||0)+1;
      this.ctx.log('Auto Gym Battle skipped this battle',{reason:rival.reason,...teams});
      return;
    }
    const pin=this.game.handleNew(state.handle,1);
    if(pin.isNull())throw Error('Unable to retain gym battle state');
    const battle={pin,policy:PgqlGymBattlePolicy.battle(),ended:false,master:null,scores:new Map(),moves:new Map(),settings:new Map(),refusals:new Set()};
    this.battle=battle;this.stats.battles++;
    this.ctx.log('Auto Gym Battle started',{...teams});
    setTimeout(()=>this.loop(battle).catch(error=>this.ctx.log('Auto Gym Battle stopped',{error:String(error)})),0);
  }
  // Presses the Battle button of the "Next up" screen on the next frame, once it has opened.
  skipCountdown(screen) {
    const pin=this.game.handleNew(screen.handle,1);
    if(pin.isNull())throw Error('Unable to retain the next-defender screen');
    this.game.main(()=>{
      const target=new Il2Cpp.Object(this.game.handleTarget(pin));
      if(target.isNull()||this.closed)return false;
      this.bound.countdown.proceed.bind(target).invoke();
      return true;
    },'auto-gym-countdown').then(done=>{
      if(!done)return;
      this.stats.countdowns++;
      this.ctx.log('Auto Gym Battle skipped the countdown');
    }).catch(error=>this.limit('countdown',error)).finally(()=>{try{this.game.handleFree(pin);}catch(_){}});
  }
  endBattle(reason) {
    const battle=this.battle;
    if(!battle)return;
    battle.ended=true;this.battle=null;
    try{this.game.handleFree(battle.pin);}catch(_){}
    this.ctx.log('Auto Gym Battle ended',{reason,...battle.policy.stats});
  }
  async loop(battle) {
    while(!battle.ended&&!this.closed) {
      try {
        await this.game.main(()=>{if(!battle.ended)this.tick(battle);},'auto-gym-battle');
        PgqlGymBattlePolicy.ok(battle.policy);
      }catch(error) {
        if(battle.ended||this.closed)return;
        this.ctx.log('Auto Gym Battle step failed',{error:String(error)});
        if(PgqlGymBattlePolicy.error(battle.policy)){this.ctx.log('Auto Gym Battle: automation stopped for this battle');return;}
      }
      await this.sleep(PgqlGameGymBattle.pollMs);
    }
  }
  // Move settings from the game master: type and energy of a move.
  move(battle,id) {
    if(battle.moves.has(id))return battle.moves.get(id);
    const b=this.bound;
    if(!this.cache.maybeGet) {
      const generic=battle.master.class.methods.find(m=>m.isGeneric&&(m.name==='MaybeGetByKey'||m.name.endsWith('.MaybeGetByKey'))&&
        m.parameterCount===1&&m.parameters[0].type.name==='System.Enum');
      if(!generic)throw Error('Unsupported game master lookup');
      this.cache.maybeGet=generic.inflate(b.moveSettings);
    }
    const cell=Memory.alloc(8);cell.writeS32(id);
    const found=this.cache.maybeGet.bind(battle.master).invoke(new Il2Cpp.ValueType(cell,b.moveEnum.type).box());
    const value=found.isNull()?null:{type:PgqlGameGymBattle.number(b.moveType.bind(found).value),energy:b.moveEnergy.bind(found).value};
    battle.moves.set(id,value);
    return value;
  }
  // Types and moves of a battle Pokemon, cached by its id.
  profile(battle,proto) {
    const b=this.bound,number=PgqlGameGymBattle.number,key=b.id.bind(proto).value.toString();
    if(battle.settings.has(key))return battle.settings.get(key);
    const settings=this.implementation(battle.master,'Get_PokemonSettings',['Holoholo.Rpc.PokemonProto','System.Boolean']).invoke(proto,true);
    const types=settings.isNull()?[0,0]:[number(b.type1.bind(settings).value),number(b.type2.bind(settings).value)];
    const moves=b.moves.map((f,slot)=>({slot,id:f.bind(proto).value})).filter(m=>m.id)
      .map(m=>({...m,...(this.move(battle,m.id) || {type:0,energy:0})})).filter(m=>m.type);
    const value={key,pokedex:b.pokedex.bind(proto).value,maxHealth:b.maxHealth.bind(proto).value,types,
      fast:moves.find(m=>m.slot===0) || null,charged:moves.filter(m=>m.slot>0)};
    battle.settings.set(key,value);
    return value;
  }
  effectiveness(battle,moveType,types) {
    return this.implementation(battle.master,'Get_TypeEffectiveness',
      ['Holoholo.Rpc.HoloPokemonType','Holoholo.Rpc.HoloPokemonType','Holoholo.Rpc.HoloPokemonType']).invoke(moveType,types[0],types[1]);
  }
  // A party member's matchup against the defender, cached per pair.
  matchup(battle,member,defender) {
    const key=member.key+'>'+defender.key;
    if(battle.scores.has(key))return battle.scores.get(key);
    const fast=member.fast?this.effectiveness(battle,member.fast.type,defender.types):1;
    const charged=member.charged.map(m=>({move3:m.slot===2,energy:m.energy,effectiveness:this.effectiveness(battle,m.type,defender.types)}));
    const defence=[defender.fast,...defender.charged].filter(Boolean).map(m=>this.effectiveness(battle,m.type,member.types));
    const value={charged,score:PgqlGymBattlePolicy.score({fast,charged:charged.map(m=>m.effectiveness),defence})};
    battle.scores.set(key,value);
    return value;
  }
  tick(battle) {
    const b=this.bound,config=this.ctx.config,number=PgqlGameGymBattle.number,game=this.game;
    if(!config.autoAttack&&!config.autoDodge&&!config.autoSwap)return;
    const state=new Il2Cpp.Object(game.handleTarget(battle.pin));
    if(state.isNull()){this.endBattle('gone');return;}
    const service=b.serviceField.bind(state).value;
    if(service.isNull()||!b.service.isAssignableFrom(service.class))return;
    if(!b.active.bind(service).invoke())return;
    const frame=b.observed.bind(service).invoke();
    if(frame.isNull())return;
    if(!battle.master){battle.master=b.masterField.bind(state).value;if(battle.master.isNull()){battle.master=null;return;}}
    const local=b.local.bind(frame).value,enemyFrame=b.enemy.bind(frame).value;
    if(local.isNull()||enemyFrame.isNull())return;
    const enemyProto=b.pokemon.bind(enemyFrame).invoke();
    if(enemyProto.isNull())return;
    const defender=this.profile(battle,enemyProto);
    const frames=game.array(b.roster.bind(local).value),index=b.activeIndex.bind(local).value;
    const activeFrame=frames[index];
    if(!activeFrame||activeFrame.isNull())return;
    const members=frames.map((pokemonFrame,i)=>{
      const proto=b.pokemon.bind(pokemonFrame).invoke();
      if(proto.isNull())return null;
      const profile=this.profile(battle,proto),match=this.matchup(battle,profile,defender);
      return {id:profile.key,index:i,proto,pokedex:profile.pokedex,score:match.score,charged:match.charged,
        energy:b.energy.bind(pokemonFrame).invoke(),fainted:!!b.fainted.bind(pokemonFrame).invoke(),
        health:profile.maxHealth>0?b.health.bind(pokemonFrame).invoke()/profile.maxHealth:1};
    });
    const active=members[index];
    if(!active)return;
    PgqlGymBattlePolicy.observe(battle.policy,{defender:defender.key,activeId:active.id,activeFainted:active.fainted});
    let enemy=null;
    const enemyAction=b.current.bind(enemyFrame).invoke();
    if(!enemyAction.isNull()) {
      const kind=number(b.actionType.bind(enemyAction).value);
      enemy={key:defender.key+':'+b.actionStart.bind(enemyAction).value.toString(),type:kind,landsInSec:-1};
      if(config.autoDodge&&(kind===PgqlGymBattlePolicy.actionTypes.special||kind===PgqlGymBattlePolicy.actionTypes.special2)) {
        const player=b.playerPokemon.bind(state).invoke(),service=player.isNull()?null:b.timingField.bind(player).value;
        if(service&&!service.isNull()&&b.timing.isAssignableFrom(service.class))enemy.landsInSec=b.lands.bind(service).invoke(enemyAction);
      }
    }
    const decision=PgqlGymBattlePolicy.decide(battle.policy,{now:Date.now(),status:number(b.status.bind(frame).value),
      busy:!!b.swapping.bind(local).invoke()||!!b.dodging.bind(activeFrame).invoke(),queued:!!b.queuedActive.bind(activeFrame).value,
      enemy,active,bench:members.filter(m=>m&&m!==active),charged:active.charged,
      config:{autoAttack:!!config.autoAttack,autoDodge:!!config.autoDodge,autoSwap:!!config.autoSwap}});
    if(decision.kind==='none')return;
    this.act(battle,service,decision,active,defender);
  }
  act(battle,service,decision,active,defender) {
    const b=this.bound;
    let ok=true;
    if(decision.kind==='dodge')ok=!!b.dodge.bind(service).invoke();
    else if(decision.kind==='swap')ok=!!b.swap.bind(service).invoke(decision.member.proto);
    else if(decision.kind==='charged')b.special.bind(service).invoke(!!decision.move.move3);
    else b.attack.bind(service).invoke();
    PgqlGymBattlePolicy.tried(battle.policy,decision,ok,Date.now());
    if(!ok) {
      this.stats.rejected++;this.stats.refused[decision.kind]=(this.stats.refused[decision.kind]||0)+1;
      const key=decision.kind+'>'+defender.key;
      if(!battle.refusals.has(key)) {
        battle.refusals.add(key);
        this.ctx.log('Auto Gym Battle action refused',{kind:decision.kind,active:active.pokedex,against:defender.pokedex,
          to:decision.member?decision.member.pokedex:undefined,energy:active.energy});
      }
      return;
    }
    if(decision.kind==='dodge')this.stats.dodges++;
    else if(decision.kind==='swap') {
      this.stats.swaps++;
      this.stats.last={from:active.pokedex,to:decision.member.pokedex,against:defender.pokedex,ratio:Math.round(decision.ratio*100)/100};
      this.ctx.log('Auto Gym Battle swapped',this.stats.last);
    }else this.stats[decision.kind]++;
  }
  report() {
    const s=this.stats,skipped=Object.entries(s.skipped).map(([k,v])=>v+' '+k).join(', ');
    const lines=['Battles: '+s.battles+(this.battle?' (in battle now)':'')+(skipped?'; skipped: '+skipped:''),
      'Attacks: '+s.fast+' fast, '+s.charged+' charged; dodges: '+s.dodges+'; swaps: '+s.swaps+(s.rejected?'; refused: '+Object.entries(s.refused).map(([k,v])=>v+' '+k).join(', '):'')+(s.manual?'; manual taps: '+s.manual:'')+(s.countdowns?'; countdowns skipped: '+s.countdowns:'')];
    if(s.last)lines.push('Last swap: #'+s.last.from+' → #'+s.last.to+' against #'+s.last.against+' ('+s.last.ratio+'× better)');
    const limits=Object.entries(this.limits);
    if(limits.length)lines.push('Unavailable: '+limits.map(([k,v])=>k+' ('+v+')').join('; '));
    return lines.join('\n');
  }
  close() {
    if(this.closed)return;
    this.closed=true;this.endBattle('disabled');
  }
};
