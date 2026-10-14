const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0,version='0.433.0',clock=100000;const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0'}};
function managed(values={},methods={}) {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,methods,class:{name:'Managed'},isNull:()=>false};
  byPointer.set(id,self);return self;
}
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];}})});
const methodOf=fn=>({bind:object=>({invoke:(...args)=>fn(object,...args)})});
const disabled=[];
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const lookup=class {constructor(handle){return byPointer.get(handle.id)||NULL_OBJECT;}};
const sandbox={setTimeout,clearTimeout,Promise,Date:{now:()=>clock},
  Qol:{disable:id=>disabled.push(id)},
  Il2Cpp:{get application(){return {version};},string:content=>({content,isNull:()=>false}),Object:lookup},
  PgqlGameGifts:class {
    constructor(){this.freed=0;this.held=0;}
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    method(object,name){return {invoke:(...args)=>object.methods[name](...args)};}
    array(list){return list.items;}
    promise(managed,convert){return new Promise((resolve,reject)=>managed.values.answer={resolve:output=>{try{resolve(convert(output));}catch(e){reject(e);}},reject});}
    handleNew(handle){this.held++;return {isNull:()=>false,handle};}
    handleFree(){this.freed++;}
  }};
const context=vm.createContext(sandbox);
for(const file of ['core/berry-policy.js','core/gym-feed-policy.js','core/game-version.js','adapters/game-gym-feeder.js'])vm.runInContext(read(file),context);
const Adapter=context.PgqlGameGymFeeder;
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setTimeout(resolve,0));};
const results=new Map([[1,'Success'],[3,'ErrorNotInRange'],[5,'ErrorPokemonFull'],[9,'ErrorTooFast']]);
const number=name=>[...results].find(([,n])=>n===name)[0];

const pokemonId=key=>({toString:()=>key});
const defender=(key,motivation)=>managed({motivated:managed({pokemon:managed({id:pokemonId(key)}),motivation})});

function fixture(config={},{defenders=[['a',0],['b',0.2]],playerTeam=2,gymTeam=2,inRange=true}={}) {
  const logs=[],hooks=new Map(),cleanups=[],used=[],toasts=[],refreshed=[];
  const state={config:{berry:'razz',maxPerVisit:'20',showToast:true,...config}};
  const ctx={get config(){return state.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks)};
  const adapter=new Adapter(ctx,{sleep:async ms=>{clock+=ms;}});
  const gymState=managed({list:{items:defenders.map(([k,m])=>defender(k,m))}});
  const counts={701:4,705:0};
  const requests=[];
  const bag=managed({},{GetItemCount:id=>counts[id]||0,UseItemOnGymDefender:(id,pid,gym)=>{
    used.push([id,String(pid),gym.content]);counts[id]--;const request=managed();requests.push(request);return request;}});
  const mapGym=managed({id:{isNull:()=>false,content:'gym-1'},fort:managed({team:gymTeam}),inRange});
  const controller=managed({state:gymState,players:managed({},{GetPlayerTeam:()=>playerTeam}),maps:managed({},{get_MapGym:()=>mapGym})});
  adapter.bound={opened:{virtualAddress:'opened'},enter:{virtualAddress:'enter'},exit:{virtualAddress:'exit'},
    defenders:methodOf(o=>o.values.list),stateField:fieldOf('state'),mapGymField:fieldOf('maps'),playerField:fieldOf('players'),
    id:methodOf(o=>o.values.id),fortData:methodOf(o=>o.values.fort),inRange:methodOf(o=>o.values.inRange),team:fieldOf('team'),
    motivated:fieldOf('motivated'),pokemon:fieldOf('pokemon'),motivation:fieldOf('motivation'),pokemonId:methodOf(o=>o.values.id),
    result:fieldOf('result'),results,stardust:fieldOf('stardust'),xp:fieldOf('xp'),candy:fieldOf('candy'),xl:fieldOf('xl'),
    gymStatus:fieldOf('status'),statusDefenders:fieldOf('list'),bag:'IItemBag',
    ids:{},refresh:methodOf((o,status)=>refreshed.push([o,status])),toast:null};
  adapter.bind=()=>adapter.bound;
  adapter.service=()=>bag;
  adapter.notify=text=>toasts.push(text);
  const open=()=>{const frame={},hook=hooks.get('opened');hook.onEnter.call(frame,[controller.handle]);hook.onLeave.call(frame);};
  const enter=()=>hooks.get('enter').onEnter.call({});
  const exit=()=>hooks.get('exit').onEnter.call({});
  // The server's answer to the latest request.
  const answer=async(name='Success',{stardust=30,list=null}={})=>{
    await settle();
    const request=requests.at(-1);
    request.values.answer.resolve(managed({result:number(name),stardust,xp:50,candy:0,xl:0,status:list?managed({list:{items:list}}):NULL_OBJECT}));
    await settle();
  };
  return {adapter,logs,hooks,cleanups,used,toasts,refreshed,state,counts,gymState,requests,open,enter,exit,answer};
}

(async()=>{
  // Other game versions and changed metadata install nothing.
  const installed=[],bare={log:()=>{},cleanup:()=>{},hook:address=>installed.push(address),config:{berry:'razz',maxPerVisit:'20'}};
  version='0.434.0';
  await assert.rejects(new Adapter(bare).start(),/supports game 0\.433\.0; found 0\.434\.0/);
  version='0.433.0';
  await assert.rejects(new Adapter(bare).start(),/Unsupported game metadata: Niantic\.Holoholo\.Gym\.Approach\.GymApproachGuiController/);
  assert.equal(installed.length,0);

  // A friendly gym in range: each defender is fed in turn, lowest motivation
  // first, until the server says they are full.
  let t=fixture();
  assert.equal(await t.adapter.start(),true);
  assert.deepEqual([...t.hooks.keys()],['enter','exit','opened']);
  t.enter();t.open();await settle();
  assert.deepEqual(t.used,[[701,'a','gym-1']]);
  assert.equal(t.adapter.game.held,1,'the gym state is retained for the visit');
  // The answer redraws the gym with the server's defenders.
  const fresh=[defender('a',0.15),defender('b',0.2)];
  await t.answer('Success',{list:fresh});
  assert.equal(t.refreshed.length,1);assert.equal(t.refreshed[0][0],t.gymState);
  assert.deepEqual(t.used.map(u=>u[1]),['a','b']);
  await t.answer('ErrorPokemonFull');
  assert.deepEqual(t.used.map(u=>u[1]),['a','b','a']);
  await t.answer('ErrorPokemonFull');
  assert.equal(t.used.length,3);
  assert.equal(t.adapter.visit,null);assert.equal(t.adapter.game.freed,1);
  assert.deepEqual(t.toasts,['Gym Feeder: 1 berry to 1 Pokémon, +30 stardust']);
  assert.match(t.adapter.report(),/^Berry: Razz Berry, at most 20 per visit\nVisits: 1\nFed: 1 \(\+30 stardust, \+0 candy, \+50 XP\)\nRefused: ErrorPokemonFull 2\nVisits ended: done 1$/);

  // Returning from a defender's details reopens the screen without a new visit;
  // the next time the gym is entered is a new visit.
  t.open();await settle();assert.equal(t.used.length,3);
  t.exit();t.enter();t.open();await settle();
  assert.equal(t.used.length,4);assert.equal(t.adapter.stats.visits,2);

  // Leaving the gym stops feeding after the answer in flight.
  t.exit();await t.answer('Success');
  assert.equal(t.used.length,4);assert.equal(t.adapter.visit,null);
  assert.match(t.logs.find(l=>l.message==='Gym Feeder visit finished'&&l.details.reason==='left').message,/finished/);

  // Rival, neutral and out-of-range gyms, and berry off, are skipped.
  for(const [options,config,reason] of [[{gymTeam:1},{},'rival'],[{gymTeam:0},{},'neutral'],[{inRange:false},{},'out-of-range'],[{},{berry:'off'},'off']]) {
    t=fixture(config,options);await t.adapter.start();
    t.enter();t.open();await settle();
    assert.equal(t.used.length,0,reason);assert.equal(t.adapter.stats.skipped[reason],1,reason);
  }

  // The cap ends the visit.
  t=fixture({maxPerVisit:'2'});await t.adapter.start();
  t.enter();t.open();await t.answer();await t.answer();
  assert.equal(t.used.length,2);assert.equal(t.adapter.stats.ended.cap,1);
  assert.deepEqual(t.toasts,['Gym Feeder: 2 berries to 2 Pokémon, +60 stardust']);

  // An empty bag ends the visit and says so.
  t=fixture({berry:'pinap'});await t.adapter.start();
  t.enter();t.open();await settle();
  assert.equal(t.used.length,0);assert.deepEqual(t.toasts,['Gym Feeder: no Pinap Berry left']);

  // Too fast waits and tries again; a gym-level refusal ends the visit.
  t=fixture();await t.adapter.start();
  t.enter();t.open();const before=clock;await t.answer('ErrorTooFast');
  assert.deepEqual(t.used.map(u=>u[1]),['a','a']);assert(clock-before>=4000);
  await t.answer('ErrorNotInRange');
  assert.equal(t.used.length,2);assert.equal(t.adapter.stats.ended.ErrorNotInRange,1);assert.equal(t.toasts.length,0);

  // A failed request ends the visit without turning the module off.
  t=fixture();await t.adapter.start();
  t.enter();t.open();await settle();
  t.requests.at(-1).values.answer.reject(Error('Game request failed'));await settle();
  assert.equal(t.adapter.stats.ended.error,1);assert.equal(t.adapter.failed,false);

  // An unexpected error while opening turns the module off.
  t=fixture();await t.adapter.start();
  t.gymState.values.list=null;t.adapter.game.array=()=>{throw Error('defender list changed');};
  t.enter();t.open();await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(t.adapter.failed,true);assert.deepEqual(disabled,['gym-feeder']);

  // Disabling stops the visit; later openings do nothing.
  t=fixture();await t.adapter.start();
  t.enter();t.open();await settle();
  t.cleanups.forEach(fn=>fn());
  await t.answer('Success');
  assert.equal(t.used.length,1);assert.equal(t.adapter.visit,null);
  t.exit();t.enter();t.open();await settle();assert.equal(t.used.length,1);
  console.log('Gym Feeder version gate, visit flow, skip rules, cap, empty bag, back-off, errors and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
