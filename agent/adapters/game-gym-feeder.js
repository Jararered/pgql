'use strict';
// Original adapter for Gym Feeder. When a gym of the player's team is opened in
// range, feeds the chosen berry to its defenders through the game's own item bag
// (IItemBag.UseItemOnGymDefender), one request at a time, until the server
// refuses each defender or the per-visit cap is reached. PgqlGymFeedPolicy owns
// the rules. Names are verified from live managed metadata; there are no
// offsets. The screen refresh and the summary toast are optional parts.
globalThis.PgqlGameGymFeeder = class PgqlGameGymFeeder {
  constructor(ctx,{sleep}={}) {
    this.ctx=ctx;this.sleep=sleep || (ms=>new Promise(resolve=>setTimeout(resolve,ms)));this.game=new PgqlGameGifts(ctx);this.closed=false;this.failed=false;this.bound=null;this.limits={};
    this.stats={visits:0,fed:0,stardust:0,candy:0,xp:0,skipped:{},refused:{},ended:{},last:null};
    // A visit lasts from GymState.EnterState to ExitState; reopening the gym
    // screen after a defender's details does not start another one.
    this.entry=0;this.handled=-1;this.visit=null;
    ctx.cleanup(()=>this.close());
  }
  static number(value){return typeof value==='number'?value:value.field('value__').value;}
  bind() {
    if(this.bound)return this.bound;
    PgqlGameVersion.require(Il2Cpp.application.version,'Gym Feeder supports');
    const type=name=>this.game.type(name),number=PgqlGameGymFeeder.number;
    const args=m=>m.parameters.map(p=>p.type.name).join('|');
    const plain=(klass,name,params,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&args(m)===params.join('|'));
      if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))throw Error('Unsupported Gym Feeder method: '+klass.type.name+'.'+name);
      return matches[0];
    };
    // Obfuscated member names change between builds; bind the only field of a type.
    const typed=(klass,typeName)=>{
      const matches=klass.fields.filter(f=>!f.isStatic&&f.type.name===typeName);
      if(matches.length!==1)throw Error('Unsupported Gym Feeder field: '+klass.type.name+' of type '+typeName);
      return matches[0];
    };
    const field=(klass,name,typeName)=>{
      const found=klass.field(name);
      if(found.isStatic||found.type.name!==typeName)throw Error('Unsupported Gym Feeder field: '+klass.type.name+'.'+name);
      return found;
    };
    const approach=type('Niantic.Holoholo.Gym.Approach.GymApproachGuiController'),gym=type('Niantic.Holoholo.Gym.GymState');
    const place=type('Niantic.Holoholo.Map.AbstractMapPlace'),fort=type('Holoholo.Rpc.PokemonFortProto');
    const defender=type('Holoholo.Rpc.GymDefenderProto'),motivated=type('Holoholo.Rpc.MotivatedPokemonProto'),pokemon=type('Holoholo.Rpc.PokemonProto');
    const bag=type('Niantic.Holoholo.IItemBag'),item=type('Holoholo.Rpc.Item'),output=type('Holoholo.Rpc.GymFeedPokemonOutProto');
    const ids={};
    for(const berry of PgqlBerryPolicy.berries) {
      ids[berry.key]=number(item.field(berry.item).value);
      if(ids[berry.key]!==berry.id)throw Error('Unexpected item number for '+berry.item);
    }
    plain(type('Niantic.Holoholo.Gym.IMapGymController'),'get_MapGym',[],'Niantic.Holoholo.Gym.MapGym');
    plain(type('Niantic.Holoholo.IPlayerService'),'GetPlayerTeam',[],'System.Int32');
    plain(bag,'GetItemCount',['Holoholo.Rpc.Item'],'System.Int32');
    plain(bag,'UseItemOnGymDefender',['Holoholo.Rpc.Item','System.UInt64','System.String'],'Niantic.Promises.IPromise<Holoholo.Rpc.GymFeedPokemonOutProto>');
    if(!type('Niantic.Holoholo.Gym.MapGym').isSubclassOf(place,false))throw Error('Unsupported map gym');
    // Result names as numbers; the policy works with names.
    const resultField=field(output,'Result','Holoholo.Rpc.GymFeedPokemonOutProto.Types.Result'),results=new Map();
    for(const f of resultField.type.class.fields)if(f.isStatic)results.set(number(f.value),f.name);
    if(![...results.values()].includes('Success'))throw Error('Unsupported gym feed result');
    const bound={
      opened:plain(approach,'HandleOpenComplete',[],'System.Void'),
      enter:plain(gym,'EnterState',[],'System.Void'),exit:plain(gym,'ExitState',[],'System.Void'),
      defenders:plain(gym,'get_GymDefenders',[],'System.Collections.Generic.IList<Holoholo.Rpc.GymDefenderProto>'),
      stateField:typed(approach,'Niantic.Holoholo.Gym.GymState'),mapGymField:typed(approach,'Niantic.Holoholo.Gym.IMapGymController'),
      playerField:typed(approach,'Niantic.Holoholo.IPlayerService'),
      id:plain(place,'get_Id',[],'System.String'),fortData:plain(place,'get_FortData',[],'Holoholo.Rpc.PokemonFortProto'),
      inRange:plain(place,'get_IsPlayerInRange',[],'System.Boolean'),team:field(fort,'Team','System.Int32'),
      motivated:field(defender,'MotivatedPokemon','Holoholo.Rpc.MotivatedPokemonProto'),
      pokemon:field(motivated,'Pokemon','Holoholo.Rpc.PokemonProto'),motivation:field(motivated,'MotivationNow','System.Double'),
      pokemonId:plain(pokemon,'get_Id',[],'System.UInt64'),
      result:resultField,results,
      stardust:field(output,'StardustAwarded','System.Int32'),xp:field(output,'XpAwarded','System.Int32'),
      candy:field(output,'NumCandyAwarded','System.Int32'),xl:field(output,'NumXlCandyAwarded','System.Int32'),
      gymStatus:field(output,'GymStatusAndDefenders','Holoholo.Rpc.GymStatusAndDefendersProto'),
      statusDefenders:field(type('Holoholo.Rpc.GymStatusAndDefendersProto'),'GymDefender','Niantic.Protobuf.Collections.RepeatedField<Holoholo.Rpc.GymDefenderProto>'),
      bag,scene:type('Niantic.Holoholo.MapSceneContext'),
      findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],'UnityEngine.Object',true),
      ids,refresh:null,toast:null};
    plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Gym Feeder: '+name+' unavailable',{error:String(error)});}
    };
    // The game state's only handler for fresh gym data; the game calls it on
    // every periodic gym update, so passing it the feed answer redraws motivation.
    optional('refresh',()=>{
      const matches=gym.methods.filter(m=>!m.isStatic&&!m.isGeneric&&m.returnType.name==='System.Void'&&args(m)==='Holoholo.Rpc.GymStatusAndDefendersProto');
      if(matches.length!==1)throw Error('Unsupported gym update handler');
      return matches[0];
    });
    optional('toast',()=>{
      const service=type('Niantic.Holoholo.UI.IToastService'),params=['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'];
      const one=plain(service,'OneLine',params,'Niantic.Holoholo.UI.IToastReceipt'),options=one.parameters[1].type.class;
      plain(options,'.ctor',[],'System.Void');
      for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],['DisplaySecondsOverride','System.Nullable<System.Single>']])
        if(options.field(name).type.name!==expected)throw Error('Unsupported toast field: '+name);
      const nullable=options.field('DisplaySecondsOverride').type.class;
      nullable.field('hasValue');nullable.field('value');
      return {service,params:options,top:PgqlGameToast.bind(type,options,this.ctx.log)};
    });
    this.bound=bound;
    return bound;
  }
  service(klass) {
    const b=this.bound,scene=b.findOne.invoke(b.scene.type.object);
    if(scene.isNull())throw Error('Game map unavailable');
    const found=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(klass.type.object);
    if(found.isNull())throw Error('Game service unavailable: '+klass.type.name);
    return found;
  }
  problem(error) {
    if(this.closed||this.failed)return;
    this.failed=true;this.ctx.log('Gym Feeder failed; disabling',{error:String(error)});
    setTimeout(()=>{if(!this.closed)Qol.disable('gym-feeder',{failed:true});},0);
  }
  count(table,key){table[key]=(table[key]||0)+1;}
  // Defenders of a GymState or of a feed answer, as {key, id, motivation}.
  defenders(list) {
    const b=this.bound,found=[];
    for(const entry of this.game.array(list)) {
      const motivated=b.motivated.bind(entry).value;if(motivated.isNull())continue;
      const pokemon=b.pokemon.bind(motivated).value;if(pokemon.isNull())continue;
      const id=b.pokemonId.bind(pokemon).invoke();
      found.push({key:id.toString(),id,motivation:b.motivation.bind(motivated).value});
    }
    return found;
  }
  // Runs on the game thread when the gym screen finishes opening.
  opened(controller) {
    if(this.handled===this.entry)return;
    this.handled=this.entry;
    const b=this.bound,selected=this.ctx.config.berry;
    const gymState=b.stateField.bind(controller).value,players=b.playerField.bind(controller).value,maps=b.mapGymField.bind(controller).value;
    if(gymState.isNull()||players.isNull()||maps.isNull())throw Error('Gym screen state unavailable');
    const mapGym=this.game.method(maps,'get_MapGym').invoke();
    if(mapGym.isNull())throw Error('Gym unavailable');
    const fort=b.fortData.bind(mapGym).invoke();
    const gym={selected,playerTeam:this.game.method(players,'GetPlayerTeam').invoke(),
      gymTeam:fort.isNull()?0:b.team.bind(fort).value,inRange:!!b.inRange.bind(mapGym).invoke()};
    const decision=PgqlGymFeedPolicy.eligible(gym);
    if(!decision.ok){this.count(this.stats.skipped,decision.reason);this.ctx.log('Gym Feeder: gym skipped',{reason:decision.reason});return;}
    const gymId=b.id.bind(mapGym).invoke();
    if(gymId.isNull()||!gymId.content)throw Error('Gym id unavailable');
    const pin=this.game.handleNew(gymState.handle,1);
    if(pin.isNull())throw Error('Unable to retain gym state');
    const defenders=this.defenders(b.defenders.bind(gymState).invoke());
    const visit={entry:this.entry,gymId:gymId.content,gymState,pin,berry:decision.berry,cancelled:false,
      ids:new Map(defenders.map(d=>[d.key,d.id])),gained:{stardust:0,candy:0,xp:0},
      state:PgqlGymFeedPolicy.visit({cap:PgqlGymFeedPolicy.parseCap(this.ctx.config.maxPerVisit),defenders:defenders.map(d=>({id:d.key,motivation:d.motivation}))})};
    if(this.visit)this.visit.cancelled=true;
    this.visit=visit;this.stats.visits++;
    this.ctx.log('Gym Feeder visit started',{defenders:defenders.length,berry:decision.berry.key,cap:visit.state.cap});
    setTimeout(()=>this.run(visit).catch(error=>this.problem(error)),0);
  }
  // One step on the game thread: refresh defenders, then start a feed or say why not.
  step(visit) {
    if(visit.cancelled||this.closed)return {reason:'left'};
    const b=this.bound,bag=this.service(b.bag);
    const defenders=this.defenders(b.defenders.bind(visit.gymState).invoke());
    for(const d of defenders)visit.ids.set(d.key,d.id);
    PgqlGymFeedPolicy.refresh(visit.state,defenders.map(d=>({id:d.key,motivation:d.motivation})));
    const now=Date.now(),decision=PgqlGymFeedPolicy.next(visit.state,{now,count:this.game.method(bag,'GetItemCount',1).invoke(visit.berry.id)});
    if(!decision.id)return decision;
    PgqlGymFeedPolicy.started(visit.state,decision.id,now);
    const request=this.game.method(bag,'UseItemOnGymDefender',3).invoke(visit.berry.id,visit.ids.get(decision.id),Il2Cpp.string(visit.gymId));
    if(request.isNull())throw Error('The game did not send the berry');
    return {id:decision.id,answer:this.game.promise(request,output=>this.answer(visit,output))};
  }
  // Inside the request's Then callback: read the result and redraw the gym.
  answer(visit,output) {
    const b=this.bound,status=b.gymStatus.bind(output).value;
    const name=b.results.get(PgqlGameGymFeeder.number(b.result.bind(output).value)) || 'Unset';
    const reply={name,stardust:b.stardust.bind(output).value,xp:b.xp.bind(output).value,
      candy:b.candy.bind(output).value+b.xl.bind(output).value,defenders:null};
    if(!status.isNull()) {
      reply.defenders=this.defenders(b.statusDefenders.bind(status).value).map(d=>({id:d.key,motivation:d.motivation}));
      if(b.refresh&&!this.limits.refresh&&!visit.cancelled&&!this.closed)
        try{b.refresh.bind(visit.gymState).invoke(status);}
        catch(error){this.limits.refresh=String(error.message || error);this.ctx.log('Gym Feeder screen refresh failed; continuing without it',{error:String(error)});}
    }
    return reply;
  }
  async run(visit) {
    let reason=null;
    try {
      while(!reason) {
        if(this.closed||visit.cancelled){reason='left';break;}
        const step=await this.game.main(()=>this.step(visit));
        if(step.reason==='wait'){await this.sleep(step.waitMs);continue;}
        if(!step.id){reason=step.reason;break;}
        let timer;
        const reply=await Promise.race([step.answer,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No answer from the game')),20000);})])
          .finally(()=>clearTimeout(timer));
        const outcome=PgqlGymFeedPolicy.answered(visit.state,step.id,reply.name,Date.now());
        if(reply.defenders)PgqlGymFeedPolicy.refresh(visit.state,reply.defenders);
        if(outcome==='fed') {
          this.stats.fed++;this.stats.last=visit.berry.label;
          for(const key of ['stardust','candy','xp']){visit.gained[key]+=reply[key];this.stats[key]+=reply[key];}
        }else this.count(this.stats.refused,reply.name);
        this.ctx.log('Gym Feeder fed a defender',{result:reply.name,stardust:reply.stardust});
      }
    }catch(error) {
      PgqlGymFeedPolicy.failed(visit.state,'error');reason='error';
      this.ctx.log('Gym Feeder visit stopped',{error:String(error)});
    }finally{this.finish(visit,reason);}
  }
  finish(visit,reason) {
    if(visit.pin){this.game.handleFree(visit.pin);visit.pin=null;}
    if(this.visit===visit)this.visit=null;
    this.count(this.stats.ended,reason);
    const fed=visit.state.fed,pokemon=visit.state.defenders.filter(d=>d.fed).length;
    this.ctx.log('Gym Feeder visit finished',{reason,fed,pokemon,stardust:visit.gained.stardust});
    if(fed&&!this.closed)this.notify('Gym Feeder: '+fed+' '+(fed===1?'berry':'berries')+' to '+pokemon+' Pokémon, +'+visit.gained.stardust+' stardust');
    else if(reason==='empty'&&!this.closed)this.notify('Gym Feeder: no '+visit.berry.label+' left');
  }
  notify(text) {
    if(!this.bound.toast||this.limits.toast||!this.ctx.config.showToast)return;
    this.game.main(()=>{
      const t=this.bound.toast,service=this.service(t.service),params=t.params.alloc();
      params.method('.ctor',0).invoke();PgqlGameToast.place(t.top,params);
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=3;seconds.field('hasValue').value=true;
      const shown=service.class.methods.find(m=>m.name==='OneLine'&&!m.isStatic&&m.parameterCount===2&&
        m.parameters[1].type.name==='Niantic.Holoholo.UI.ToastService.ToastParams');
      if(!shown)throw Error('Unsupported game toast service');
      shown.bind(service).invoke(Il2Cpp.string(text),params);
    }).catch(error=>{
      if(this.closed)return;
      this.limits.toast=String(error.message || error);this.ctx.log('Gym Feeder toast failed; continuing without toasts',{error:String(error)});
    });
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      // Listeners only, so the game's own gym flow is unchanged.
      this.ctx.hook(b.enter.virtualAddress,{onEnter(){self.entry++;}});
      this.ctx.hook(b.exit.virtualAddress,{onEnter(){if(self.visit)self.visit.cancelled=true;}});
      this.ctx.hook(b.opened.virtualAddress,{
        onEnter(args){this.controller=args[0];},
        onLeave() {
          if(self.closed||self.failed)return;
          try{self.opened(new Il2Cpp.Object(this.controller));}catch(error){self.problem(error);}
        }
      });
      this.ctx.log('Gym Feeder ready',{berry:this.ctx.config.berry,refresh:!!b.refresh,toast:!!b.toast});
      return true;
    });
  }
  report() {
    const s=this.stats,list=table=>Object.entries(table).map(([k,v])=>k+' '+v).join(', ');
    const lines=['Berry: '+PgqlBerryPolicy.label(this.ctx.config.berry)+', at most '+this.ctx.config.maxPerVisit+' per visit',
      'Visits: '+s.visits+(this.visit?' (feeding now)':''),
      'Fed: '+s.fed+' (+'+s.stardust+' stardust, +'+s.candy+' candy, +'+s.xp+' XP)'];
    if(Object.keys(s.refused).length)lines.push('Refused: '+list(s.refused));
    if(Object.keys(s.skipped).length)lines.push('Gyms skipped: '+list(s.skipped));
    if(Object.keys(s.ended).length)lines.push('Visits ended: '+list(s.ended));
    for(const [name,label] of [['refresh','Screen refresh'],['toast','Toasts']])
      if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  close() {
    if(this.closed)return;
    this.closed=true;
    if(this.visit)this.visit.cancelled=true;
  }
};
