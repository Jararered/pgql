const assert=require('node:assert/strict');
const vm=require('node:vm');
const {read,flush}=require('./helpers/sandbox.cjs');
let serial=0,version='0.433.0',clock=100000;const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0',id:0}};
function managed(values={},methods={},klass='Managed') {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,methods,class:{name:klass,type:{name:klass},handle:{toString:()=>klass}},isNull:()=>false};
  byPointer.set(id,self);return self;
}
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];},set value(v){object.values[key]=v;}})});
const methodOf=(name,fn)=>({virtualAddress:name,bind:object=>({invoke:(...args)=>fn(object,...args)})});
const accessor=key=>methodOf(key,o=>o.values[key]);
const lookup=class {constructor(handle){return (handle&&byPointer.get(handle.id))||NULL_OBJECT;}};
const disabled=[];
const sandbox={setTimeout,clearTimeout,Promise,Date:{now:()=>clock},Number,
  Qol:{disable:id=>disabled.push(id)},
  Il2Cpp:{get application(){return {version};},Object:lookup},
  PgqlGameGifts:class {
    constructor(){this.freed=0;}
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    array(list){return list.items;}
    handleNew(handle){return {isNull:()=>false,handle};}
    handleTarget(pin){return pin.handle;}
    handleFree(){this.freed++;}
  }};
const context=vm.createContext(sandbox);
for(const file of ['core/gym-battle-policy.js','core/game-version.js','core/metadata-binding.js','adapters/game-gym-battle.js'])vm.runInContext(read(file),context);
const Adapter=context.PgqlGameGymBattle;
const settle=()=>flush(6,'timeout');

// Types: 1 normal, 5 ground, 10 fire, 11 water, 12 grass. Effectiveness of an attack type against defender types.
const chart={'11>10':1.6,'12>11':1.6,'10>12':1.6,'10>11':0.625,'12>10':0.625,'11>12':0.625,'5>10':1.6,'10>5':1};
const eff=(attack,[a,b])=>(chart[attack+'>'+a]||1)*(b?(chart[attack+'>'+b]||1):1);
// Species: types and moves (move id -> type, energy).
const species={4:{types:[10,0]},7:{types:[11,0]},1:{types:[12,0]},50:{types:[5,0]}};
const moveTable={52:{type:10,energy:10},103:{type:10,energy:-50},230:{type:11,energy:8},105:{type:11,energy:-50},107:{type:11,energy:-33},
  214:{type:12,energy:6},116:{type:12,energy:-100},216:{type:5,energy:7}};

function world({gymTeam=1,playerTeam=2}={}) {
  const proto=(id,dex,moves,maxHealth=100)=>managed({id:{toString:()=>id},dex,maxHealth,m1:moves[0],m2:moves[1]||0,m3:moves[2]||0});
  const frame=(p,extra={})=>managed({proto:p,health:100,energy:0,fainted:false,dodging:false,current:NULL_OBJECT,queued:false,...extra});
  // Party: Bulbasaur (grass, weak into a fire defender), Squirtle (water: strong), Charmander (fire).
  const party=[frame(proto('p-grass',1,[214,116])),frame(proto('p-water',7,[230,105,107])),frame(proto('p-fire',4,[52,103]))];
  const enemy=frame(proto('d-fire',4,[52,103]));
  const local=managed({roster:{items:party},index:0,swapping:false});
  const battleFrame=managed({local,enemy,status:1});
  const calls=[];
  const service=managed({active:true,frame:battleFrame},{},'BattleFrameObservableService');
  const master=managed({},{
    Get_PokemonSettings:(p)=>managed({t1:species[p.values.dex].types[0],t2:species[p.values.dex].types[1]}),
    Get_TypeEffectiveness:(attack,a,b)=>eff(attack,[a,b])},'GameMaster');
  const timing=managed({lands:0.3},{},'BattleTimingService');
  const playerPokemon=managed({timing});
  const root=managed({team:gymTeam},{},'GymRootController');
  const players=managed({},{GetPlayerTeam:()=>playerTeam});
  const state=managed({service,root,players,master,player:playerPokemon});
  return {party,enemy,local,battleFrame,service,master,timing,state,calls,root};
}

function fixture(config={},options={}) {
  const logs=[],hooks=new Map(),cleanups=[];
  const cfg={config:{autoAttack:true,autoDodge:true,autoSwap:true,skipCountdown:true,...config}};
  const ctx={get config(){return cfg.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks)};
  const adapter=new Adapter(ctx,{sleep:async()=>{await new Promise(resolve=>setTimeout(resolve,1));}});
  const w=world(options);
  const record=(name,ret)=>methodOf(name,(o,...args)=>{w.calls.push([name,...args.map(a=>a&&a.values?a.values.id.toString():a)]);return ret;});
  adapter.bound={
    enter:methodOf('enter',()=>null),exit:methodOf('exit',()=>null),playerPokemon:accessor('player'),
    serviceField:fieldOf('service'),rootField:fieldOf('root'),playersField:fieldOf('players'),masterField:fieldOf('master'),
    service:{isAssignableFrom:k=>k.name==='BattleFrameObservableService'},observed:accessor('frame'),active:accessor('active'),
    attack:record('attack'),special:record('special'),dodge:record('dodge',true),swap:record('swap',true),
    local:fieldOf('local'),enemy:fieldOf('enemy'),status:fieldOf('status'),roster:fieldOf('roster'),activeIndex:fieldOf('index'),
    swapping:accessor('swapping'),pokemon:accessor('proto'),health:accessor('health'),energy:accessor('energy'),fainted:accessor('fainted'),
    dodging:accessor('dodging'),current:accessor('current'),queuedActive:fieldOf('queued'),
    actionType:fieldOf('type'),actionStart:fieldOf('start'),timingField:fieldOf('timing'),
    timing:{isAssignableFrom:k=>k.name==='BattleTimingService'},lands:accessor('lands'),
    id:fieldOf('id'),pokedex:fieldOf('dex'),maxHealth:fieldOf('maxHealth'),moves:[fieldOf('m1'),fieldOf('m2'),fieldOf('m3')],
    type1:fieldOf('t1'),type2:fieldOf('t2'),root:{isAssignableFrom:k=>k.name==='GymRootController'},team:accessor('team'),
    manual:methodOf('manualSwap',()=>null),
    countdown:{opened:methodOf('nextOpened',()=>null),proceed:methodOf('proceed',o=>{o.values.proceeded=(o.values.proceeded||0)+1;})}};
  adapter.bind=()=>adapter.bound;
  adapter.implementation=(object,name)=>({invoke:(...args)=>object.methods[name](...args)});
  adapter.move=(battle,id)=>moveTable[id]||null;
  return {adapter,w,logs,hooks,ctx,cfg,
    enter(){const h=hooks.get('enter'),t={};h.onEnter.call(t,[w.state.handle]);h.onLeave.call(t);},
    exit(){hooks.get('exit').onEnter();},
    nextScreen(){const screen=managed({},{},'GymBattleContinueGuiController'),h=hooks.get('nextOpened'),t={};h.onEnter.call(t,[screen.handle]);h.onLeave.call(t);return screen;},
    close(){for(const fn of cleanups)fn();}};
}
const names=calls=>calls.map(c=>c[0]);

(async()=>{
  // Version gate: an unsupported build fails before anything is installed.
  {
    version='0.999.0';
    const ctx={config:{},log(){},cleanup(){},hook(){throw Error('hooked');}};
    const adapter=new Adapter(ctx);
    adapter.game.type=()=>{throw Error('no metadata');};
    await assert.rejects(adapter.start(),/Auto Gym Battle supports/);
    version='0.433.0';
  }

  // Friendly and neutral gyms are left alone.
  for(const [gymTeam,reason] of [[2,'friendly'],[0,'neutral']]) {
    const t=fixture({}, {gymTeam,playerTeam:2});
    await t.adapter.start();t.enter();await settle();
    assert.equal(t.w.calls.length,0);
    assert.equal(t.adapter.stats.skipped[reason],1);
    assert.match(t.adapter.report(),new RegExp('skipped: 1 '+reason));
    const screen=t.nextScreen();await settle();assert.equal(screen.values.proceeded,undefined,'no skip outside an automated battle');
    t.close();
  }
  // An unreadable gym team is never battled.
  {
    const t=fixture();
    t.w.state.values.root=NULL_OBJECT;
    await t.adapter.start();t.enter();await settle();
    assert.equal(t.w.calls.length,0);assert.equal(t.adapter.stats.skipped['unknown-team'],1);t.close();
  }

  // Rival gym: the weak grass lead against a fire defender swaps to water, then attacks.
  const t=fixture();
  await t.adapter.start();
  assert.ok(t.logs.some(l=>l.message==='Auto Gym Battle ready'));
  t.enter();await settle();
  assert.deepEqual([...t.w.calls[0]],['swap','p-water'],'swaps to the water member');
  assert.equal(t.adapter.stats.swaps,1);
  assert.deepEqual({...t.adapter.stats.last},{from:1,to:7,against:4,ratio:6.55});
  // The game swaps; the water member attacks and no further swap happens.
  t.w.local.values.index=1;t.w.calls.length=0;await settle();
  assert.ok(t.w.calls.length>0);
  assert.ok(names(t.w.calls).every(n=>n==='attack'),'fast attacks only: '+names(t.w.calls));
  // A queued action is not replaced.
  t.w.party[1].values.queued=true;t.w.calls.length=0;await settle();
  assert.equal(t.w.calls.length,0);t.w.party[1].values.queued=false;
  // With 33 energy the second charged move (super effective water) fires as move3.
  t.w.party[1].values.energy=33;t.w.calls.length=0;await settle();
  assert.deepEqual([...t.w.calls[0]],['special',true]);
  t.w.party[1].values.energy=0;

  // The defender's charged attack: dodge just before it lands, once.
  t.w.enemy.values.current=managed({type:1,start:{toString:()=>'777'}});
  t.w.calls.length=0;await settle();
  assert.deepEqual([...t.w.calls[0]],['dodge']);
  assert.equal(names(t.w.calls).filter(n=>n==='dodge').length,1,'dodged once');
  // Too early to dodge, or a fast attack: keep attacking.
  t.w.enemy.values.current=managed({type:1,start:{toString:()=>'999'}});t.w.timing.values.lands=1.4;
  t.w.calls.length=0;await settle();assert.ok(!names(t.w.calls).includes('dodge'));
  t.w.enemy.values.current=managed({type:0,start:{toString:()=>'1001'}});t.w.timing.values.lands=0.2;
  t.w.calls.length=0;await settle();assert.ok(!names(t.w.calls).includes('dodge'));
  t.w.enemy.values.current=NULL_OBJECT;

  // Busy (swapping) or a finished battle: nothing.
  t.w.local.values.swapping=true;t.w.calls.length=0;await settle();assert.equal(t.w.calls.length,0);t.w.local.values.swapping=false;
  t.w.battleFrame.values.status=2;t.w.calls.length=0;await settle();assert.equal(t.w.calls.length,0);t.w.battleFrame.values.status=1;

  // The "Next up" countdown: pressed on the next frame while battling, unless the setting is off.
  let screen=t.nextScreen();await settle();
  assert.equal(screen.values.proceeded,1);assert.equal(t.adapter.stats.countdowns,1);
  assert.match(t.adapter.report(),/countdowns skipped: 1/);
  t.cfg.config={...t.cfg.config,skipCountdown:false};
  screen=t.nextScreen();await settle();assert.equal(screen.values.proceeded,undefined);
  t.cfg.config={...t.cfg.config,skipCountdown:true};

  // Settings apply live.
  t.cfg.config={autoAttack:false,autoDodge:true,autoSwap:true};t.w.calls.length=0;await settle();
  assert.equal(t.w.calls.length,0);
  t.cfg.config={autoAttack:true,autoDodge:true,autoSwap:true};

  // A manual swap tap pauses automation.
  t.hooks.get('manualSwap').onEnter();t.w.calls.length=0;await settle();
  assert.equal(t.w.calls.length,0);assert.equal(t.adapter.stats.manual,1);
  clock+=2000;await settle();assert.ok(t.w.calls.length>0,'resumes after the pause');

  // The next defender (ground): water is still the best matchup, so no swap is needed.
  t.w.enemy.values.proto=managed({id:{toString:()=>'d-ground'},dex:50,maxHealth:100,m1:216,m2:0,m3:0});
  t.w.calls.length=0;await settle();
  assert.ok(!names(t.w.calls).includes('swap'),'water stays in against ground');

  // Refused swaps are counted and retried.
  t.w.local.values.index=2;// the fire member is now active against ground; water is far better
  t.adapter.bound.swap=methodOf('swap',(o,p)=>{t.w.calls.push(['swap',p.values.id.toString()]);return false;});
  t.w.calls.length=0;await settle();
  assert.equal(names(t.w.calls).filter(n=>n==='swap').length,1,'a refused swap waits');
  clock+=1000;await settle();
  assert.equal(names(t.w.calls).filter(n=>n==='swap').length,2,'and is retried after a second');
  assert.ok(t.adapter.stats.rejected>0);
  assert.match(t.adapter.report(),/refused: 2 swap/);
  assert.ok(t.logs.some(l=>l.message==='Auto Gym Battle action refused'&&l.details.kind==='swap'),'the first refusal is logged');

  // Errors: five failed steps stop the battle only.
  t.adapter.bound.observed=methodOf('frame',()=>{throw Error('boom');});
  await settle();await settle();
  assert.ok(t.logs.some(l=>l.message==='Auto Gym Battle: automation stopped for this battle'));
  // Leaving the battle frees the state pin; disable cleans up.
  t.exit();assert.equal(t.adapter.battle,null);assert.ok(t.adapter.game.freed>=1);
  assert.ok(t.logs.some(l=>l.message==='Auto Gym Battle ended'));
  assert.match(t.adapter.report(),/Battles: 1/);
  t.close();assert.equal(t.adapter.closed,true);
  console.log('Auto Gym Battle version gate, rival gate, swap, attacks, dodge, countdown skip, live settings, manual pause, refusals and errors tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
