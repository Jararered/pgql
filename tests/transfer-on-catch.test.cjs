const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0,version='0.433.0';const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0'}};
function managed(values={},methods={}) {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,isNull:()=>false,method:name=>({invoke:(...args)=>methods[name](...args)})};
  byPointer.set(id,self);return self;
}
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];}})});
const replaced=new Map(),reverted=[],pinned=[],freed=[];let flushed=0;
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const lookup=class {constructor(handle){return byPointer.get(handle.id)||NULL_OBJECT;}};
const sandbox={setTimeout,clearTimeout,
  Il2Cpp:{get application(){return {version};},string:content=>({content}),Object:lookup,ValueType:lookup,delegate:(type,fn)=>({handle:{type},fn})},
  Interceptor:{replace:(address,fn)=>replaced.set(address,fn),revert:address=>{reverted.push(address);replaced.delete(address);},flush:()=>{flushed++;}},
  PgqlGameGifts:class {
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    value(object,name){return object[name];}
    handleNew(handle){pinned.push(handle);return {isNull:()=>false,handle};}
    handleFree(pin){freed.push(pin.handle);}
  }};
const context=vm.createContext(sandbox);
vm.runInContext(read('core/transfer-policy.js'),context);
vm.runInContext(read('core/game-version.js'),context);
vm.runInContext(read('adapters/game-transfer-on-catch.js'),context);
const Adapter=context.PgqlGameTransferOnCatch;
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const defaults={showToast:true,minIv:'100',keepXxs:false,keepXxl:false,transferShiny:false,transferBackground:false,transferShadow:false,ignoreList:'132,201,352,570,999'};
const common={species:16,attack:10,defense:11,stamina:12,size:'other',shiny:false,background:false,shadow:false,wildOrigin:true,specialBall:false,normalClass:true,transferable:true};

function fixture(config={},{slider=false}={}) {
  const logs=[],hooks=new Map(),cleanups=[],released=[],toasts=[],bag=new Map(),state={config:{...defaults,...config},frames:0,status:1,map:true,opened:0};
  const ctx={get config(){return state.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks)};
  const adapter=new Adapter(ctx);
  adapter.bound={parse:{virtualAddress:'parse'},captured:fieldOf('CapturedPokemonId'),scores:fieldOf('Scores'),xl:fieldOf('XlCandy'),
    accessory:{handler:{virtualAddress:'pgp'},sfida:fieldOf('Sfida'),id:fieldOf('PokemonId')},toast:null,
    slider:slider?{initialize:{virtualAddress:'slider'},initializer:'Initializer',title:fieldOf('TitleKey'),completed:{virtualAddress:'ended'},
      openInfo:{virtualAddress:'info',wrap:fn=>fn,bind:()=>({invoke:()=>{state.opened++;}})}}:null};
  const service=managed({},{GetPokemon:raw=>{state.frames++;const found=bag.get(String(raw));return found&&found.after<state.frames?found.pokemon:NULL_OBJECT;},
    ReleasePokemon:pokemon=>{released.push(pokemon.data.id);return Promise.resolve({Status:state.status});}});
  adapter.watch=request=>request.then(output=>output.Status);
  adapter.services=()=>state.map?{bag:service,master:{},toast:{}}:null;
  adapter.snapshot=pokemon=>pokemon.data;
  adapter.notify=(toast,lines)=>toasts.push(lines);
  const add=(id,data={},after=0)=>{const pokemon=managed();pokemon.data={...common,...data,id};bag.set(id,{pokemon,after:state.frames+after});return pokemon;};
  const message=(id,xl)=>managed({CapturedPokemonId:id,Scores:xl===undefined?NULL_OBJECT:managed({XlCandy:managed({},{get_Count:()=>1,get_Item:()=>xl})})});
  const caught=async(id,xl)=>{const frame={},hook=hooks.get('parse');hook.onEnter.call(frame,[message(id,xl).handle]);hook.onLeave.call(frame);await settle();};
  const accessory=async(id,{handled=1,sfida=true}={})=>{
    const entry=managed({Sfida:sfida},{get_CatchPokemon:()=>managed({PokemonId:id})}),frame={},hook=hooks.get('pgp');
    hook.onEnter.call(frame,[null,entry.handle]);hook.onLeave.call(frame,{toInt32:()=>handled});await settle();
  };
  return {adapter,logs,hooks,cleanups,released,toasts,state,add,caught,accessory};
}
(async()=>{
  assert.deepEqual([...Adapter.lines('transferred',0)],['Successful Capture!','[Transferred]']);
  assert.deepEqual([...Adapter.lines('kept-preference',2)],['Successful Capture!','[Meets Preference, Not Transferred]','+2 XL Candy']);
  assert.deepEqual([...Adapter.lines('kept-protected',0)],['Successful Capture!','[Not Transferred]']);
  assert.equal(Adapter.number(4),4);assert.equal(Adapter.number({field:()=>({value:6})}),6);

  // Other game versions and changed metadata install nothing.
  const installed=[],bare={log:()=>{},cleanup:()=>{},hook:address=>installed.push(address),config:defaults};
  version='0.434.0';
  await assert.rejects(new Adapter(bare).start(),/supports game 0\.433\.0; found 0\.434\.0/);
  version='0.433.0';
  await assert.rejects(new Adapter(bare).start(),/Unsupported game metadata: Holoholo\.Rpc\.CatchPokemonOutProto/);
  assert.equal(installed.length,0);assert.equal(replaced.size,0);

  // A caught Pokemon is released once it reaches the bag, with one toast.
  let t=fixture();
  assert.equal(await t.adapter.start(),true);
  assert.deepEqual([...t.hooks.keys()],['parse','pgp']);
  t.add('77',{},3);
  await t.caught('77',2);
  assert.deepEqual(t.released,['77']);assert.equal(t.state.frames,4,'polled until the bag had it');
  assert.deepEqual(t.toasts.map(lines=>[...lines]),[['Successful Capture!','[Transferred]','+2 XL Candy']]);
  assert.equal(t.logs.at(-1).message,'Caught Pokémon transferred');assert.equal(t.logs.at(-1).details.ivs,'10/11/12');
  // The same result parsed again, a failed catch and a kept Pokemon release nothing.
  await t.caught('77');await t.caught('0');
  t.add('78',{shiny:true});await t.caught('78');
  t.add('79',{species:132});await t.caught('79');
  assert.deepEqual(t.released,['77']);
  assert.deepEqual(t.toasts.slice(1).map(lines=>lines[1]),['[Not Transferred]','[Meets Preference, Not Transferred]']);
  assert.equal(t.toasts[1].length,2,'no XL line without XL candy');
  assert.match(t.adapter.report(),/^Transferred: 1\nKept: 2\nLast: #132 10\/11\/12 — kept, species on the ignore list$/);
  // Settings are read when the decision is made.
  t.state.config={...defaults,transferShiny:true,showToast:false};
  t.add('80',{shiny:true});await t.caught('80');
  assert.deepEqual(t.released,['77','80']);assert.equal(t.toasts.length,3,'toasts can be turned off');
  // The game refusing or failing the request is reported, not retried.
  t.state.status=2;t.add('81');await t.caught('81');
  assert.deepEqual(t.released,['77','80','81']);assert.equal(t.adapter.stats.unconfirmed,1);
  assert.match(t.logs.at(-1).message,/not accepted/);assert.match(t.adapter.report(),/Transferred: 3 \(1 not confirmed\)/);

  // Accessory catches come from handled action log entries flagged as accessory.
  t=fixture();await t.adapter.start();
  t.add('5');t.add('6');t.add('7');
  await t.accessory('5',{handled:0});await t.accessory('6',{sfida:false});assert.deepEqual(t.released,[]);
  await t.accessory('7');await t.accessory('7');
  assert.deepEqual(t.released,['7']);assert.equal(t.logs.at(-1).details.accessory,true);
  assert.deepEqual([...t.toasts[0]],['Successful Capture!','[Transferred]']);
  // Each entry is acted on once even when another catch came in between.
  await t.caught('5');await t.accessory('7');assert.deepEqual(t.released,['7','5']);

  // A Pokemon that never shows up is given up on; a missing map just waits.
  t=fixture();await t.adapter.start();
  t.state.map=false;await t.caught('9');
  for(let i=0;i<Adapter.maxFrames;i++)await settle();
  assert.deepEqual(t.released,[]);assert.match(t.logs.at(-1).message,/did not reach the bag/);assert.equal(t.adapter.failed,false);

  // The slider's info button keeps the next manual catch of the encounter.
  t=fixture({}, {slider:true});await t.adapter.start();
  assert.deepEqual([...t.hooks.keys()],['parse','pgp','slider','ended']);
  const info=replaced.get('info'),open=(slider,title)=>t.hooks.get('slider').onEnter([slider.handle,managed({TitleKey:title===null?NULL_OBJECT:{isNull:()=>false,content:title}}).handle]);
  let dismissed=0;const balls=managed({},{Dismiss:()=>{dismissed++;}}),shop=managed({},{Dismiss:()=>{dismissed++;}});
  open(shop,'shop_title');info.call(shop);
  assert.equal(t.state.opened,1,'other sliders keep their info panel');assert.equal(t.adapter.bypass,false);
  open(balls,'encounter_item_pokeballs');info.call(balls);
  assert.equal(t.state.opened,1);assert.equal(dismissed,1);assert.equal(t.adapter.bypass,true);
  assert.match(t.toasts[0][0],/disabled<\/color> for this encounter/);
  t.add('20');t.add('21');t.add('22');
  await t.accessory('20');assert.deepEqual(t.released,['20'],'accessory catches ignore the bypass');assert.equal(t.adapter.bypass,true);
  await t.caught('21');assert.deepEqual(t.released,['20']);assert.equal(t.logs.at(-1).details.reason,'disabled for this encounter');
  await t.caught('22');assert.deepEqual(t.released,['20','22'],'the bypass covers one catch');
  // Leaving the encounter without a catch clears it; a reused slider is re-read.
  open(balls,'encounter_item_berries');info.call(balls);assert.equal(t.adapter.bypass,true);
  t.hooks.get('ended').onEnter();assert.equal(t.adapter.bypass,false);
  open(balls,null);info.call(balls);assert.equal(t.state.opened,2);

  // Disable restores the info button and makes every hook inert.
  t.add('23');t.cleanups.forEach(fn=>fn());
  assert.deepEqual(reverted,['info']);assert.equal(replaced.size,0);assert(flushed>0);
  info.call(balls);assert.equal(t.state.opened,3);
  await t.caught('23');await t.accessory('23');assert.deepEqual(t.released,['20','22']);

  // An unexpected error stops further transfers instead of repeating it.
  t=fixture();await t.adapter.start();
  t.adapter.services=()=>{throw Error('container gone');};
  t.add('30');await t.caught('30');
  assert.equal(t.adapter.failed,true);assert.match(t.logs.at(-1).message,/no further Pokémon will be transferred/);
  t.adapter.services=()=>({bag:null});await t.caught('31');assert.deepEqual(t.released,[]);

  // The release answer is read through callbacks inherited from the base promise.
  const promiseOf=(methods,inherited)=>{
    const calls={},method=(name,argument)=>({name,isStatic:false,parameterCount:1,parameters:[{type:{name:argument,class:argument}}],bind:()=>({invoke:delegate=>{calls[name]=delegate.fn;}})});
    return {calls,handle:{id:'request'},class:{type:{name:'RpcPromise'},hierarchy:()=>[{methods:methods.map(args=>method(...args))},{methods:inherited.map(args=>method(...args))}]}};
  };
  const watcher=new Adapter(bare),callbacks=[['Then','System.Action<Holoholo.Rpc.ReleasePokemonOutProto>'],['Error','System.Action<System.String>']];
  let request=promiseOf([],callbacks),answer=watcher.watch(request);
  request.calls.Then({Status:{field:()=>({value:1})}});request.calls.Error();
  assert.equal(await answer,1);await settle();assert.equal(pinned.length,3);assert.equal(freed.length,3,'callbacks are released after the answer');
  request=promiseOf([],callbacks);answer=watcher.watch(request);request.calls.Error();
  await assert.rejects(answer,/request error/);
  await assert.rejects(watcher.watch(promiseOf([['Then','System.Action<System.Int32>']],[])),/Unsupported release promise: RpcPromise/);

  // Module: settings, validation, role and status.
  const timers=[],events=[];
  const moduleContext=vm.createContext({send:event=>events.push(event),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},
    PgqlGameTransferOnCatch:class {constructor(){this.failed=false;}async start(){return true;}report(){return 'Transferred: 0\nKept: 0';}}});
  for(const file of ['runtime.js','core/feature-catalog.js','core/transfer-policy.js','modules/transfer-on-catch.js','modules/zz-feature-catalog.js'])vm.runInContext(read(file),moduleContext);
  const q=moduleContext.Qol,described=()=>q.describe().find(module=>module.id==='transfer-on-catch');
  assert.equal(q.describe().length,34,'the module takes the reserved catalog slot');
  assert.equal(described().availability,'implemented');assert.equal(described().category,'Inventory');
  assert.deepEqual(JSON.parse(JSON.stringify(described().config)),defaults);
  assert(described().settings.every(setting=>setting.description));
  assert.deepEqual([...described().settings.filter(setting=>setting.type==='text').map(setting=>setting.key)],['minIv','ignoreList']);
  assert.throws(()=>q.setConfig('transfer-on-catch','minIv','high'),/Invalid IV/);
  assert.throws(()=>q.setConfig('transfer-on-catch','minIv',90),/must be text/);
  assert.throws(()=>q.setConfig('transfer-on-catch','ignoreList','ditto'),/Pokédex numbers/);
  assert.equal(described().config.minIv,'100');
  assert.equal(q.setConfig('transfer-on-catch','minIv','15/14/13').minIv,'15/14/13');
  q.enable('transfer-on-catch');
  assert.equal((await q.invoke('transfer-on-catch',{action:'status'})).phase,'initializing');
  timers.splice(0).forEach(fn=>fn());await settle();
  assert.deepEqual(JSON.parse(JSON.stringify(await q.invoke('transfer-on-catch',{action:'status'}))),{phase:'ready',reason:'Transferred: 0\nKept: 0'});
  q.disable('transfer-on-catch');
  moduleContext.PgqlRole='pgp';
  assert.throws(()=>q.enable('transfer-on-catch'),/main game process/);
  console.log('Transfer on Catch version gate, triggers, bag wait, decisions, toasts, bypass, cleanup, failure and module tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
