const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0,version='0.433.0',clock=100000;const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0',id:0}};
function managed(values={},methods={},klass='Managed') {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,methods,class:{name:klass,type:{name:klass}},isNull:()=>false};
  byPointer.set(id,self);return self;
}
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];},set value(v){object.values[key]=v;}})});
const methodOf=(name,fn)=>({virtualAddress:name,bind:object=>({invoke:(...args)=>fn(object,...args)})});
const disabled=[];
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const lookup=class {constructor(handle){return (handle&&byPointer.get(handle.id))||NULL_OBJECT;}};
const sandbox={setTimeout,clearTimeout,Promise,Date:{now:()=>clock},Number,
  Qol:{disable:id=>disabled.push(id)},ptr:value=>({ptr:value}),
  Interceptor:{attach:(address,callbacks)=>{sandbox.frames.push(callbacks);return {detach(){}};}},frames:[],
  Il2Cpp:{get application(){return {version};},string:content=>({content,isNull:()=>false}),Object:lookup},
  PgqlGameGifts:class {
    constructor(){this.freed=0;this.held=0;}
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    method(object,name){return {invoke:(...args)=>object.methods[name](...args)};}
    array(list){return list.items;}
    promise(request,convert){return new Promise((resolve,reject)=>{request.values.answer={resolve:v=>resolve(convert(v)),reject};});}
    handleNew(handle){this.held++;return {isNull:()=>false,handle,toString:()=>'pin'+handle.id};}
    handleTarget(pin){return pin.handle;}
    handleFree(){this.freed++;}
  }};
const context=vm.createContext(sandbox);
for(const file of ['core/raid-battle-policy.js','core/game-version.js','adapters/game-raid-pack.js'])vm.runInContext(read(file),context);
const Adapter=context.PgqlGameRaidPack;
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setTimeout(resolve,0));};

// One raid battle: our Pokemon (Bulbasaur-like, Vine Whip fast, Sludge Bomb and Solar Beam charged) against a boss.
function world({isMax=false}={}) {
  const moveData=(move,type,energy,turns)=>managed({move,type,energy,turns});
  const entry=(key,value)=>managed({},{get_Key:()=>key,get_Value:()=>value});
  const myProto=managed({id:{toString:()=>'p1'},moves:{items:[entry(1,moveData(214,12,6,1)),entry(2,moveData(90,4,-50,5)),entry(3,moveData(116,12,-100,6))]},display:NULL_OBJECT,pokedex:1});
  const mine=managed({energy:0,fainted:false,proto:myProto,current:NULL_OBJECT,queued:{items:[]}});
  const bossDisplay=managed({bread:isMax?1:0});
  const bossProto=managed({id:{toString:()=>'boss'},display:bossDisplay,pokedex:6,moves:{items:[]}});
  const bossPokemon=managed({proto:bossProto,current:NULL_OBJECT,queued:{items:[]},fainted:false});
  const bossActor=managed({actorId:{content:'boss-actor',isNull:()=>false},active:bossPokemon,current:NULL_OBJECT});
  const local=managed({active:mine,current:NULL_OBJECT});
  const sync=managed({started:true,turn:10,ms:500});
  const state=managed({sync,local,opponents:{items:[entry('boss-actor',bossActor)]}});
  const submitted=[],requests=[];
  const director=managed({state,blocked:false});
  const master=managed({},{
    Get_PokemonSettingsWithOverrides:proto=>managed({types:[10,3]}),
    Get_TypeEffectiveness:(type,settings)=>({4:1,12:0.39}[type]??1)});
  return {mine,myProto,bossPokemon,bossActor,bossDisplay,state,sync,director,master,submitted,requests};
}

function fixture(config={},options={}) {
  const logs=[],hooks=new Map(),cleanups=[],toasts=[];
  const state={config:{autoAttack:true,manualMaxBattles:false,autoDodge:true,skipAnimations:true,skipMaxBattleResult:true,bossMovesets:true,...config}};
  const ctx={get config(){return state.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks)};
  const adapter=new Adapter(ctx,{sleep:async()=>{await new Promise(resolve=>setTimeout(resolve,1));}});
  const w=world(options);
  const raidStatus=managed({status:2},{},'RaidResolveInformation');
  const created=[];
  const make=kind=>({new:()=>{const o=managed({kind});created.push(o);return o;}});
  const accessor=key=>({bind:o=>({invoke:()=>o.values[key]})});
  adapter.bound={frame:'frame',scene:'scene',findOne:null,
    skips:{introSeen:methodOf('introSeen',()=>0),approach:methodOf('approach',()=>null),definition:{isAssignableFrom:k=>k.name==='AnimationDefinition'},
      duration:fieldOf('duration'),raidEnter:methodOf('raidEnter',()=>null),
      raidFields:{exitScreenFadeDuration:fieldOf('exitScreenFadeDuration'),victoryIntroDelay:fieldOf('victoryIntroDelay')},
      start:methodOf('sequencerStart',()=>null),sequencerFields:{bossIntroZoomSpeed:fieldOf('bossIntroZoomSpeed'),bossFaceHoldTime:fieldOf('bossFaceHoldTime')}},
    results:{init:methodOf('raidResolve',()=>null),close:methodOf('raidClose',o=>{o.values.closed=(o.values.closed||0)+1;}),
      leaderboard:methodOf('raidLeaderboard',o=>{o.values.leaderboard=true;}),
      impl:{isAssignableFrom:k=>k.name==='RaidResolveInformation'},getStatus:accessor('status'),
      setStatus:methodOf('setStatus',(o,v)=>{o.values.status=v;})},
    maxResults:null,
    battle:{enter:methodOf('battleEnter',()=>null),exit:methodOf('battleExit',()=>null),directorField:fieldOf('director'),
      directorClass:{isAssignableFrom:()=>true},
      current:accessor('state'),blocked:accessor('blocked'),
      submit:methodOf('submit',(director,event,prediction)=>{
        w.submitted.push({kind:event.values.kind,type:event.values.type,attack:event.values.attack&&{...event.values.attack.values},dodge:event.values.dodge&&{...event.values.dodge.values},prediction});
        const request=managed();w.requests.push(request);return request;}),
      sync:accessor('sync'),local:accessor('local'),opponents:fieldOf('opponents'),started:accessor('started'),
      turn:fieldOf('turn'),msPerTurn:fieldOf('ms'),actorId:accessor('actorId'),active:accessor('active'),
      currentAction:fieldOf('current'),queued:fieldOf('queued'),energy:fieldOf('energy'),fainted:accessor('fainted'),pokemon:accessor('proto'),
      pokemonId:fieldOf('id'),pokedexId:fieldOf('pokedex'),display:fieldOf('display'),moves:fieldOf('moves'),breadMode:fieldOf('bread'),
      move:fieldOf('move'),moveType:fieldOf('type'),moveTurns:fieldOf('turns'),moveEnergy:fieldOf('energy'),
      actionType:fieldOf('type'),actionVariety:fieldOf('variety'),actionMove:fieldOf('move'),actionTurn:fieldOf('turn'),actionSerial:fieldOf('serial'),
      event:make('event'),eventKind:fieldOf('type'),setAttack:methodOf('setAttack',(o,a)=>{o.values.attack=a;}),
      attack:make('attack'),attackVariety:fieldOf('variety'),attackMove:fieldOf('move'),attackType:fieldOf('type'),attackTarget:fieldOf('target'),
      master:'IGameMasterData',statuses:{ACCEPTED:1,BUFFERED_BY_INPUT_BLOCK:6,REJECTED_BY_SERVER:2},types:{attack:4,fast:1,charge:2,charge2:3}},
    dodge:{setDodge:methodOf('setDodge',(o,d)=>{o.values.dodge=d;}),dodge:make('dodge'),direction:fieldOf('direction'),right:2,dodgeKind:5},
    manual:{swap:methodOf('swap',()=>null),ability:methodOf('ability',()=>null),item:methodOf('item',()=>null)},
    movesets:{tap:methodOf('gymTap',()=>null),fortData:accessor('fort'),raidInfo:fieldOf('raidInfo'),raidPokemon:fieldOf('raidPokemon'),
      id:fieldOf('pokemonId_'),move1:fieldOf('move1_'),move2:fieldOf('move2_'),display:fieldOf('pokemonDisplay_'),form:fieldOf('Form')},
    stations:null,toast:{service:'toast',params:{type:{name:'ToastParams'}}},names:null};
  adapter.bind=()=>adapter.bound;
  adapter.service=klass=>klass==='IGameMasterData'?w.master:managed({},{},'ToastService');
  adapter.implementation=(object,name)=>({invoke:(...args)=>object.methods[name](...args)});
  adapter.moveSettings=(battle,move)=>({103:{startMs:2150,endMs:2800}}[move]||null);
  // Toasts are recorded instead of built.
  adapter.showMoveset=boss=>{toasts.push(adapter.movesetText(boss));adapter.stats.movesets++;};
  const battleState=managed({director:w.director});
  const enterBattle=()=>{const frame={};hooks.get('battleEnter').onEnter.call(frame,[battleState.handle]);hooks.get('battleEnter').onLeave.call(frame);};
  const exitBattle=()=>hooks.get('battleExit').onEnter.call({});
  return {adapter,logs,hooks,cleanups,toasts,state,w,created,raidStatus,enterBattle,exitBattle};
}

(async()=>{
  // Other game versions and changed metadata install nothing.
  const installed=[],bare={log:()=>{},cleanup:()=>{},hook:address=>installed.push(address),config:{}};
  version='0.434.0';
  await assert.rejects(new Adapter(bare).start(),/Raid Pack supports game 0\.433\.0; found 0\.434\.0/);
  version='0.433.0';
  await assert.rejects(new Adapter(bare).start(),/Unsupported game metadata/);
  assert.equal(installed.length,0);

  let t=fixture();
  assert.equal(await t.adapter.start(),true);
  assert.deepEqual([...t.hooks.keys()].sort(),['ability','approach','battleEnter','battleExit','gymTap','introSeen','item','raidEnter','raidResolve','sequencerStart','swap'].sort());
  assert.deepEqual([...t.logs.find(l=>l.message==='Raid Pack ready').details.parts],['skips','results','battle','dodge','manual','movesets','toast']);

  // Raid intro: the game is told it was already seen.
  let replaced=null;t.hooks.get('introSeen').onLeave({toInt32:()=>0,replace:v=>{replaced=v;}});
  assert.deepEqual(replaced,{ptr:1});assert.equal(t.adapter.stats.intros,1);
  t.state.config={...t.state.config,skipAnimations:false};replaced=null;
  t.hooks.get('introSeen').onLeave({toInt32:()=>0,replace:v=>{replaced=v;}});assert.equal(replaced,null,'setting off leaves the intro');
  t.state.config={...t.state.config,skipAnimations:true};
  // Approach camera and raid timings are shortened and restored on disable.
  const definition=managed({duration:1.5},{},'AnimationDefinition');
  t.hooks.get('approach').onEnter([null,null,definition.handle]);
  assert.equal(definition.values.duration,0.05);
  const wrongArgs=managed({duration:9},{},'Pose');
  t.hooks.get('approach').onEnter([null,null,wrongArgs.handle]);
  assert.equal(wrongArgs.values.duration,9);assert.match(t.adapter.limits.approach,/Unexpected approach camera arguments/);
  const raidState=managed({exitScreenFadeDuration:1,victoryIntroDelay:2});
  const frame={};t.hooks.get('raidEnter').onEnter.call(frame,[raidState.handle]);t.hooks.get('raidEnter').onLeave.call(frame);
  assert.deepEqual({...raidState.values},{exitScreenFadeDuration:0.1,victoryIntroDelay:0.1});
  const sequencer=managed({bossIntroZoomSpeed:2,bossFaceHoldTime:1});
  t.hooks.get('sequencerStart').onEnter([sequencer.handle]);
  assert.deepEqual({...sequencer.values},{bossIntroZoomSpeed:1000,bossFaceHoldTime:0});

  // Victory result screen: status cleared, leaderboard and screen closed.
  const controller=managed();
  let f={};t.hooks.get('raidResolve').onEnter.call(f,[controller.handle,t.raidStatus.handle]);t.hooks.get('raidResolve').onLeave.call(f);
  assert.equal(t.raidStatus.values.status,0);assert.equal(controller.values.closed,1);assert.equal(controller.values.leaderboard,true);
  assert.equal(t.adapter.stats.results,1);
  // A defeat keeps its screen.
  const defeat=managed({status:3},{},'RaidResolveInformation'),other=managed();
  f={};t.hooks.get('raidResolve').onEnter.call(f,[other.handle,defeat.handle]);t.hooks.get('raidResolve').onLeave.call(f);
  assert.equal(defeat.values.status,3);assert.equal(other.values.closed,undefined);

  // Boss moveset when a raid gym is tapped; eggs have no boss yet.
  const boss=managed({pokemonId_:150,move1_:234,move2_:79,pokemonDisplay_:managed({Form:0})});
  const gym=managed({fort:managed({raidInfo:managed({raidPokemon:boss})})});
  t.hooks.get('gymTap').onEnter([gym.handle]);
  assert.deepEqual(t.toasts,['#150\n#234 / #79']);
  const egg=managed({fort:managed({raidInfo:managed({raidPokemon:managed({pokemonId_:0})})})});
  t.hooks.get('gymTap').onEnter([egg.handle]);assert.equal(t.toasts.length,1);
  t.state.config={...t.state.config,bossMovesets:false};t.hooks.get('gymTap').onEnter([gym.handle]);assert.equal(t.toasts.length,1);

  // A raid battle: fast attacks until there is energy, then the most effective charged move.
  t=fixture();await t.adapter.start();
  t.enterBattle();await settle();
  assert.equal(t.adapter.battle.policy.stats.fast,1);
  assert.deepEqual(t.w.submitted[0],{kind:'event',type:4,attack:{kind:'attack',variety:1,move:214,type:12},dodge:undefined,prediction:false});
  // Same turn: nothing more.
  await settle();assert.equal(t.w.submitted.length,1);
  t.w.requests[0].values.answer.resolve(1);
  t.w.sync.values.turn=11;t.w.mine.values.energy=60;await settle();
  const charged=t.w.submitted[1];
  assert.equal(charged.attack.move,90,'Sludge Bomb beats Solar Beam against the boss; Solar Beam also needs 100 energy');
  assert.equal(charged.attack.variety,2);assert.equal(charged.attack.target.content,'boss-actor');
  // A refused attack is retried on the next turn.
  t.w.requests[1].values.answer.resolve(2);await settle();
  assert.equal(t.adapter.stats.rejected,1);
  t.w.sync.values.turn=12;t.w.mine.values.energy=0;await settle();
  assert.equal(t.w.submitted.length,3);assert.equal(t.w.submitted[2].attack.move,214);
  // A boss charged attack is dodged inside its damage window.
  t.w.bossPokemon.values.current=managed({type:4,variety:2,move:103,turn:13,serial:7});
  t.w.sync.values.turn=14;await settle();
  assert.deepEqual(t.w.submitted.map(s=>s.type),[4,4,4,4],'the window starts at turn 17');
  t.w.sync.values.turn=17;await settle();
  assert.deepEqual(t.w.submitted[4],{kind:'event',type:5,attack:undefined,dodge:{kind:'dodge',direction:2},prediction:false});
  assert.equal(t.adapter.stats.dodges,1);
  // A manual tap pauses auto-attack.
  t.hooks.get('swap').onEnter();assert.equal(t.adapter.stats.manual,1);
  t.w.sync.values.turn=30;await settle();
  const count=t.w.submitted.length;
  clock+=2000;t.w.sync.values.turn=31;await settle();
  assert.equal(t.w.submitted.length,count+1,'automation resumes after the pause');
  // Leaving the battle stops the loop and releases the director.
  t.exitBattle();await settle();
  assert.equal(t.adapter.battle,null);assert.equal(t.adapter.game.freed,1);
  const after=t.w.submitted.length;t.w.sync.values.turn=50;await settle();assert.equal(t.w.submitted.length,after);
  assert.match(t.adapter.report(),/^Battles: 1\nAttacks: 5 fast, 1 charged; dodges: 1; refused: 1; manual taps: 1\n/);

  // Auto-attack off still dodges; both off does nothing.
  t=fixture({autoAttack:false});await t.adapter.start();
  t.w.bossPokemon.values.queued={items:[managed({type:4,variety:3,move:103,turn:6,serial:1})]};
  t.enterBattle();await settle();
  assert.deepEqual(t.w.submitted.map(s=>s.type),[5]);t.exitBattle();
  t=fixture({autoAttack:false,autoDodge:false});await t.adapter.start();
  t.enterBattle();await settle();assert.equal(t.w.submitted.length,0);t.exitBattle();
  // Max Battles: auto-attack unless disabled for them; no dodging.
  t=fixture({manualMaxBattles:true},{isMax:true});await t.adapter.start();
  t.enterBattle();await settle();assert.equal(t.w.submitted.length,0);t.exitBattle();
  t=fixture({},{isMax:true});await t.adapter.start();
  t.w.bossPokemon.values.current=managed({type:4,variety:2,move:103,turn:6,serial:1});
  t.enterBattle();await settle();assert.deepEqual(t.w.submitted.map(s=>s.type),[4]);t.exitBattle();
  // Repeated battle-step errors stop automation for that battle only.
  t=fixture();await t.adapter.start();
  t.w.director.values.state=null;t.adapter.bound.battle.current={bind:()=>({invoke:()=>{throw Error('state changed');}})};
  t.enterBattle();for(let i=0;i<20;i++)await settle();
  assert(t.logs.some(l=>l.message==='Raid Pack: automation stopped for this battle'));
  assert.equal(t.adapter.failed,false);assert.deepEqual(disabled,[]);

  // Disabling ends the battle and restores shortened timings on the next frame.
  t=fixture();await t.adapter.start();
  const seq=managed({bossIntroZoomSpeed:2,bossFaceHoldTime:1});
  t.hooks.get('sequencerStart').onEnter([seq.handle]);
  t.enterBattle();await settle();
  sandbox.frames.length=0;
  t.cleanups.forEach(fn=>fn());
  assert.equal(t.adapter.battle,null);
  assert.equal(seq.values.bossIntroZoomSpeed,1000,'restored on the game thread, not synchronously');
  sandbox.frames.at(-1).onLeave();
  assert.deepEqual({...seq.values},{bossIntroZoomSpeed:2,bossFaceHoldTime:1});
  const n=t.w.submitted.length;t.w.sync.values.turn=99;await settle();assert.equal(t.w.submitted.length,n);
  console.log('Raid Pack version gate, skips, result skip, movesets, auto-battle, dodge, manual pause, Max Battle rules, errors and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
