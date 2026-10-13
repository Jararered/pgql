'use strict';
// Original 0.431.0 profile, resolved from live managed metadata. No game offsets.
globalThis.PgqlBuddyProfile = class PgqlBuddyProfile {
  constructor(ctx) {
    this.ctx=ctx;this.closed=false;this.game=new PgqlGameGifts(ctx);
    ctx.cleanup(()=>{this.closed=true;});
  }
  type(name){return this.game.type(name);}
  method(object,name,args,returns) {
    const methods=[...object.class.hierarchy({includeCurrent:true})].flatMap(c=>c.methods);
    const matches=methods.filter(m=>!m.isStatic&&m.name===name&&m.returnType.name===returns&&
      m.parameters.map(p=>p.type.name).join('|')===args.join('|'));
    // A derived method may hide an identical base declaration; use the nearest.
    if(!matches.length)throw Error('Unsupported buddy method: '+name);
    return matches[0].bind(object);
  }
  service(name) {
    const find=this.type('UnityEngine.Object').method('FindObjectOfType',1).overload('System.Type');
    const map=find.invoke(this.type('Niantic.Holoholo.MapSceneContext').type.object);
    if(map.isNull())throw Error('Load the game map before using buddy care');
    // Resolve afresh on the Unity thread; never retain an unpinned scene object.
    const object=map.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type').invoke(this.type(name).type.object);
    if(object.isNull())throw Error('Buddy service unavailable: '+name);
    return object;
  }
  enum(object,name){return object.field(name).value.field('value__').value;}
  enumConstant(type,name){return this.type(type).field(name).value.field('value__').value;}
  promise(managed,convert) {
    const methods=[...managed.class.hierarchy({includeCurrent:true})].flatMap(c=>c.methods);
    const then=methods.find(m=>m.name==='Then'&&m.parameterCount===1&&m.parameters[0].type.name.startsWith('System.Action<'));
    const error=methods.find(m=>m.name==='Error'&&m.parameterCount===1&&m.parameters[0].type.name==='System.Action<System.String>');
    if(!then||!error)throw Error('Unsupported buddy promise');
    return new Promise((resolve,reject)=>{
      const retained=[];let finished=false;
      const pin=object=>{
        const handle=this.game.handleNew(object.handle,1);
        if(handle.isNull())throw Error('Unable to retain buddy callback');
        if(!this.game.handleTarget(handle).equals(object.handle)){this.game.handleFree(handle);throw Error('Unsupported managed handle ABI');}
        retained.push({object,handle});return object;
      };
      const settle=(fn,value)=>{if(finished)return;finished=true;
        try{fn(value);}finally{for(const entry of retained)this.game.handleFree(entry.handle);retained.length=0;}
      };
      try {
        pin(managed);
        const fail=pin(Il2Cpp.delegate(error.parameters[0].type.class,()=>settle(reject,Error('Buddy request failed; outcome may be unknown'))));
        const done=pin(Il2Cpp.delegate(then.parameters[0].type.class,value=>{
          if(this.closed){settle(reject,Error('Buddy adapter is disabled'));return;}
          try{settle(resolve,convert(value));}catch(problem){settle(reject,problem);}
        }));
        error.bind(managed).invoke(fail);then.bind(managed).invoke(done);
      }catch(problem){settle(reject,problem);}
    });
  }
  checkResult(output,proto,names=['Success']) {
    if(output.isNull()||output.class.type.name!=='Holoholo.Rpc.'+proto)throw Error('Unexpected buddy response type');
    const result=this.enum(output,'Result');
    const enumType=this.type('Holoholo.Rpc.'+proto).field('Result').type.class;
    const accepted=names.map(name=>enumType.field(name).value.field('value__').value);
    if(!accepted.includes(result))throw Error('Buddy request rejected: '+proto+' result '+result);
  }
  identity() {
    const buddy=this.service('Niantic.Holoholo.Buddy.IBuddyPokemonService');
    if(!buddy.method('get_HasBuddy',0).invoke())return null;
    const pokemon=buddy.method('get_Pokemon',0).invoke();
    if(pokemon.isNull())return null;
    const player=this.service('Niantic.Holoholo.IPlayerService').method('get_PlayerId',0).invoke().content;
    if(!player)throw Error('Player identity is unavailable');
    return {player,buddy:pokemon.method('get_Id',0).invoke().toString()};
  }
  readState(output,identity,day) {
    this.checkResult(output,'BuddyStatsOutProto');
    const current=this.identity();
    if(!current||current.player!==identity.player||current.buddy!==identity.buddy)return {ready:false,reason:'Buddy changed during progress read'};
    const observed=output.field('ObservedData').value;
    if(observed.isNull())throw Error('Buddy progress is unavailable');
    const feed=observed.field('BuddyFeedStats').value,total=observed.field('TotalStats').value;
    const shown=observed.field('TodayStatsShownHearts').value;
    if(feed.isNull()||total.isNull()||shown.isNull())throw Error('Buddy progress is incomplete');
    const hearts={};
    const categories=shown.field('BuddyShownHeartsPerCategory').value;
    if(categories.isNull())throw Error('Daily buddy hearts are unavailable');
    for(const entry of this.game.array(categories)) {
      const value=entry.method('get_Value',0).invoke();
      if(value.isNull())throw Error('Invalid daily buddy heart entry');
      hearts[entry.method('get_Key',0).invoke()]=this.game.array(value.field('BuddyShownHeartTypes').value).map(x=>x.field('value__').value);
    }
    const rpc=this.service('Niantic.Holoholo.Buddy.IBuddyRpcService');
    const food=this.game.array(rpc.method('get_AvailableFood',0).invoke());
    const ordinary=[['RazzBerry','useRazz'],['NanabBerry','useNanab'],['PinapBerry','usePinap']];
    const items=ordinary.map(([name,setting])=>{
      const id=this.enumConstant('Holoholo.Rpc.Item',name);
      const found=food.find(item=>this.enum(item,'Item')===id);
      return {id,setting,count:found?found.field('Count').value:0};
    });
    const gift=observed.field('BuddyGiftPickedUp').value;
    const souvenir=gift.isNull()?null:gift.field('Souvenir').value;
    let giftKey=null;
    if(souvenir&&!souvenir.isNull()) {
      const details=this.game.array(souvenir.field('SouvenirsDetails').value);
      if(details.length)giftKey=JSON.stringify([this.enum(souvenir,'SouvenirTypeId'),details.map(x=>x.field('TimePickedUp').value.toString())]);
    }
    return {ready:true,...current,day,hearts,food:items,souvenir:giftKey,
      onMap:this.service('Niantic.Holoholo.Buddy.IBuddyPokemonService').method('get_BuddySpawnedOnMap',0).invoke(),
      bagFull:this.service('Niantic.Holoholo.IPlayerService').method('get_BagIsFull',0).invoke(),
      // Conservatively refuse feeding while the server retains a Poffin expiry.
      poffin:feed.field('PoffinExpirationMs').value.toString()!=='0',mapExpiration:feed.field('MapExpirationMs').value.toString(),
      berriesFed:total.field('BerriesFed').value,communication:total.field('Communication').value};
  }
  async read(config,request=null) {
    if(this.closed)throw Error('Buddy adapter is disabled');
    const day=await this.game.main(()=>{
      const player=this.service('Niantic.Holoholo.IPlayerService');
      const method=this.method(player,'GetPlayerDayBucket',[],'Niantic.Promises.IPromise<Holoholo.Rpc.GetPlayerDayOutProto>');
      return this.promise(method.invoke(),output=>{this.checkResult(output,'GetPlayerDayOutProto');return output.field('Day').value.toString();});
    });
    return this.game.main(()=>{
      if(this.closed)throw Error('Buddy adapter is disabled');
      const identity=this.identity();
      if(!identity)return request?{outcome:'skipped'}:{ready:false,reason:'No buddy is selected'};
      const rpc=this.service('Niantic.Holoholo.Buddy.IBuddyRpcService');
      const method=this.method(rpc,'RequestBuddyStats',[],'Niantic.Promises.IPromise<Holoholo.Rpc.BuddyStatsOutProto>');
      return this.promise(method.invoke(),output=>{
        const effective={...config,...this.ctx.config};
        const state=this.readState(output,identity,day),snapshot=PgqlBuddyPolicy(state,effective);
        if(!request)return snapshot;
        const action=snapshot.actions?.[request.action];
        if(effective[request.action]!==true||!snapshot.ready||snapshot.identity!==request.identity||!action?.eligible||action.key!==request.key)return {outcome:'skipped'};
        return this.dispatch(request.action,state,effective);
      });
    });
  }
  dispatch(action,state,config) {
    if(this.closed)throw Error('Buddy adapter is disabled');
    const rpc=this.service('Niantic.Holoholo.Buddy.IBuddyRpcService');
    let method,proto,args=[];
    if(action==='feed') {
      const allowed={701:'useRazz',703:'useNanab',705:'usePinap'};
      const berry=state.food.find(item=>allowed[item.id]===item.setting&&config[item.setting]===true&&item.count>0);
      if(!berry)return {outcome:'skipped'};
      method='Feed';proto='BuddyFeedingOutProto';args=[berry.id,1];
    }else if(action==='play'){method='Pet';proto='BuddyPettingOutProto';}
    else if(action==='souvenir'){method='OpenGift';proto='OpenBuddyGiftOutProto';}
    else throw Error('Unsupported buddy action');
    const call=this.method(rpc,method,action==='feed'?['Holoholo.Rpc.Item','System.Int32']:[],`Niantic.Promises.IPromise<Holoholo.Rpc.${proto}>`);
    return this.promise(call.invoke(...args),output=>{
      this.checkResult(output,proto,action==='souvenir'?['SuccessAddedSouvenirToCollections']:['Success']);
      return {outcome:'success'};
    });
  }
  snapshot(config){return this.read(config);}
  execute(action,request){return this.read(request.config,{...request,action});}
};
PgqlGameAdapters.register('buddy','0.431.0',ctx=>new PgqlBuddyProfile(ctx));
