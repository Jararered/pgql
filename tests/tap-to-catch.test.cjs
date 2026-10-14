const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0,version='0.433.0';const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0',equals:other=>other&&other.id===undefined}};
function managed(values={},methods={}) {
  const id=++serial,self={handle:{id,toString:()=>String(id),equals:other=>other&&other.id===id},values,methods,class:{name:'Managed'},isNull:()=>false,
    method:name=>({invoke:(...args)=>methods[name](...args),overload:()=>({invoke:(...args)=>methods[name](...args)})})};
  byPointer.set(id,self);return self;
}
// Field mocks write to object.values[key]; value types are stored as written.
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];},set value(v){object.values[key]=v;}})});
const methodOf=fn=>({bind:object=>({invoke:(...args)=>fn(object,...args)})});
const attached=[],replaced=new Map(),reverted=[];
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const lookup=class {constructor(handle){return byPointer.get(handle.id)||NULL_OBJECT;}};
const sandbox={setTimeout,clearTimeout,Date,
  Qol:{disable:()=>{}},
  Memory:{alloc:()=>({writeS32(v){this.s32=v;}})},
  Il2Cpp:{get application(){return {version};},string:content=>({content}),Object:lookup,
    ValueType:class {constructor(cell,type){this.cell=cell;this.type=type;}},
    delegate:(type,fn)=>managed({type,fn})},
  Interceptor:{attach:(address,callbacks)=>{const entry={address,callbacks,detached:false};attached.push(entry);return {detach:()=>{entry.detached=true;}};},
    replace:(address,fn)=>replaced.set(address,fn),revert:address=>{reverted.push(address);replaced.delete(address);},flush(){}},
  PgqlGameGifts:class {
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    method(object,name){return {invoke:(...args)=>object.methods[name](...args)};}
    handleNew(handle){return {isNull:()=>false,handle};}
    handleTarget(pin){return pin.handle;}
    handleFree(){}
  }};
const context=vm.createContext(sandbox);
for(const file of ['core/catch-policy.js','core/berry-policy.js','core/game-version.js','adapters/game-tap-to-catch.js'])vm.runInContext(read(file),context);
const Adapter=context.PgqlGameTapToCatch;

function fixture({config={},modules={}}={}) {
  const logs=[],hooks=new Map(),cleanups=[],selected=[],toasts=[],requests=[],used=[],captures=[],opened=[],registered=[],destroyed=[];
  const state={config:{ball:'great',holdToOpen:true,showToast:true,...config}};
  const ctx={get config(){return state.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks)};
  const enabled={...modules};
  const adapter=new Adapter(ctx,{select:key=>{selected.push(key);state.config={...state.config,ball:key};},
    modules:()=>Object.entries(enabled).map(([id,value])=>({id,enabled:value!==false,config:typeof value==='object'?value:{}}))});
  const counts={1:3,2:2,3:1,705:4};
  const bag=managed({},{GetItemCount:id=>counts[id]||0,UseItemForEncounter:(id,pokemon)=>{used.push([id,pokemon]);counts[id]--;return managed({kind:'berry'});}});
  const handler=managed();
  const explore=managed({handler});
  // The original PokemonSelected opens the encounter.
  const selectedMethod={virtualAddress:'selected',bind:object=>({invoke:(pokemon,hidden)=>opened.push([object,pokemon,hidden])}),
    wrap:fn=>({call:(self,...args)=>fn.call(self,...args)})};
  const toss=klassWith(['ball','reticle','bullseye','spinning','missed']);
  const ar=klassWith(['proximity','awareness','frightened']);
  adapter.bound={explore:{isAssignableFrom:()=>true},map:{type:{object:'MapPokemonType'}},selected:selectedMethod,
    encounter:methodOf(o=>{const p=managed({kind:'encounter',pokemon:o});return p;}),
    encounterId:methodOf(o=>o.values.eid),
    capture:methodOf((o,t,v)=>{captures.push({pokemon:o,toss:t,values:v});return managed({kind:'capture'});}),
    toss:{klass:toss,ctor:methodOf(()=>{}),ball:fieldOf('ball'),reticle:fieldOf('reticle'),bullseye:fieldOf('bullseye'),spinning:fieldOf('spinning'),missed:fieldOf('missed')},
    ar:{klass:ar,ctor:methodOf(()=>{}),proximity:fieldOf('proximity'),awareness:fieldOf('awareness'),frightened:fieldOf('frightened')},
    status:fieldOf('status'),names:new Map([[0,'CatchError'],[1,'CatchSuccess'],[2,'CatchEscape'],[3,'CatchFlee'],[4,'CatchMissed']]),bag:'bag',
    remove:{handler:fieldOf('handler'),register:methodOf((o,id)=>registered.push([o,id])),destroy:methodOf(o=>destroyed.push(o))},
    memory:{virtualAddress:'memory'},hold:{began:{virtualAddress:'began'},ended:{virtualAddress:'ended'},iface:'iface'},toast:null};
  adapter.bind=()=>adapter.bound;
  adapter.service=klass=>klass==='bag'?bag:klass==='iface'?explore:null;
  adapter.notify=text=>toasts.push(text);
  adapter.request=(promise,type,onThen,onError)=>{requests.push({promise,type,onThen,onError});};
  const pokemon=eid=>managed({eid:{toString:()=>String(eid),eid}});
  // The game handling a tap on a map Pokémon.
  const tap=p=>replaced.get('selected').call(explore,p,true);
  const answer=(kind,value)=>{const r=requests.filter(x=>x.promise.values.kind===kind).at(-1);r.onThen(value);};
  const output=status=>managed({status});
  return {adapter,logs,hooks,cleanups,selected,toasts,requests,used,captures,opened,registered,destroyed,state,counts,bag,handler,explore,pokemon,tap,answer,output,enabled};
}
function klassWith(){return {isValueType:false,alloc:()=>managed()};}

(async()=>{
  // Other game versions and changed metadata install nothing.
  const bare={log:()=>{},cleanup:()=>{},hook:()=>{},config:{ball:'poke'}};
  version='0.434.0';
  await assert.rejects(new Adapter(bare).start(),/supports game 0\.433\.0; found 0\.434\.0/);
  version='0.433.0';
  await assert.rejects(new Adapter(bare).start(),/Unsupported game metadata: Niantic\.Holoholo\.Map\.MapExploreState/);
  assert.equal(replaced.size,0);

  // A tap sends the encounter request instead of opening the encounter, then
  // throws the remembered ball as a plain hit when no throw module is on.
  let t=fixture();
  assert.equal(await t.adapter.start(),true);
  assert.deepEqual([...t.hooks.keys()],['memory','began','ended']);
  const first=t.pokemon(11);
  t.tap(first);
  assert.equal(t.opened.length,0);assert.equal(t.requests.length,1);
  assert.equal(t.requests[0].type,'Niantic.Holoholo.Map.PokemonEncounterResponse');
  t.tap(first);assert.equal(t.requests.length,1,'a second tap waits for the first catch');
  t.answer('encounter',managed());
  assert.equal(t.used.length,0,'no berry without Pinap Master');
  assert.equal(t.captures.length,1);
  let c=t.captures[0];
  assert.equal(c.pokemon,first);assert.equal(c.toss.values.ball.cell.s32,2,'Great Ball');
  assert.deepEqual([c.toss.values.reticle,c.toss.values.bullseye,c.toss.values.spinning,c.toss.values.missed],[1,false,false,false]);
  assert.equal(c.values.values.proximity,undefined,'AR+ values left at their defaults');
  // A successful catch removes the Pokémon from the map.
  t.answer('capture',t.output(1));
  assert.deepEqual(t.registered.map(r=>[r[0],r[1].eid]),[[t.handler,11]]);assert.deepEqual(t.destroyed,[first]);
  assert.deepEqual(t.toasts,['Caught with your Great Ball']);
  assert.equal(t.adapter.pending.size,0);assert.equal(t.adapter.stats.caught,1);
  assert.match(t.adapter.report(),/^Ball: Great Ball\nTaps: 1 \(caught 1, fled 0, broke free 0, missed 0, errors 0\)\nBerries fed: 0\nLast: Great Ball \(caught\)$/);

  // Pinap Master's berry is fed first; Perfect Throw makes an Excellent curveball.
  t=fixture({modules:{'pinap-master':{berry:'pinap'},'perfect-throw':true,'headshot':true}});
  await t.adapter.start();
  const second=t.pokemon(12);t.tap(second);t.answer('encounter',managed());
  assert.deepEqual(t.used.map(u=>[u[0],u[1]]),[[705,second]]);assert.equal(t.captures.length,0,'waits for the berry');
  t.answer('berry',managed());
  c=t.captures[0];
  assert.deepEqual([c.toss.values.reticle,c.toss.values.bullseye,c.toss.values.spinning],[0.05,true,true]);
  assert.deepEqual([c.values.values.proximity,c.values.values.awareness,c.values.values.frightened],[0.475,0,false]);
  assert.equal(t.adapter.stats.berries,1);
  // A flee also removes it; a breakout leaves it for another tap.
  t.answer('capture',t.output(3));assert.equal(t.destroyed.length,1);assert.equal(t.toasts.at(-1),'The Pokémon fled');
  const third=t.pokemon(13);t.tap(third);t.answer('encounter',managed());t.answer('berry',managed());
  t.answer('capture',t.output(2));assert.equal(t.destroyed.length,1);assert.equal(t.toasts.at(-1),'It broke free. Tap again');
  t.tap(third);assert.equal(t.requests.filter(r=>r.promise.values.kind==='encounter').length,3,'tap again after a breakout');
  // A failed berry request still throws.
  t.answer('encounter',managed());t.requests.at(-1).onError('rpc');assert.equal(t.captures.length,3);

  // Headshot alone lands the ball inside the ring.
  t=fixture({modules:{'headshot':true,'perfect-throw':false,'pinap-master':false}});
  await t.adapter.start();t.tap(t.pokemon(14));t.answer('encounter',managed());
  c=t.captures[0];assert.deepEqual([c.toss.values.reticle,c.toss.values.bullseye,c.toss.values.spinning],[1,true,false]);

  // Out of the chosen ball: the cheapest ball in stock; out of all: a toast and no request.
  t=fixture({config:{ball:'ultra'}});t.counts[3]=0;
  await t.adapter.start();t.tap(t.pokemon(15));t.answer('encounter',managed());
  assert.equal(t.captures[0].toss.values.ball.cell.s32,1);
  t.answer('capture',t.output(1));assert.equal(t.toasts.at(-1),'Caught with a Poké Ball');
  t.counts[1]=0;t.counts[2]=0;t.counts[4]=3;t.tap(t.pokemon(16));
  assert.equal(t.requests.length,2,'no encounter request without balls');assert.equal(t.toasts.at(-1),'You have no Poké Balls');
  assert.equal(t.opened.length,0);

  // Errors and misses are reported; a failed encounter request clears the tap.
  t=fixture();await t.adapter.start();
  const missed=t.pokemon(17);t.tap(missed);t.answer('encounter',managed());t.answer('capture',t.output(4));
  assert.equal(t.toasts.at(-1),'Missed. Tap again');assert.equal(t.destroyed.length,0);
  t.tap(missed);t.requests.at(-1).onError('timeout');
  assert.equal(t.adapter.stats.errors,1);assert.equal(t.adapter.pending.size,0);assert.equal(t.toasts.at(-1),'Catch failed');
  // An exception while tapping opens the normal encounter instead.
  t.adapter.service=()=>{throw Error('map gone');};
  t.tap(missed);assert.equal(t.opened.length,1);assert.match(t.logs.at(-1).message,/opening the encounter/);

  // The cooldown tracker holds back a map catch.
  t=fixture();await t.adapter.start();
  context.PgqlGameCooldown={current:{blockThrow:()=>true}};
  t.tap(t.pokemon(18));assert.equal(t.requests.length,0);assert.equal(t.adapter.stats.blocked,1);
  context.PgqlGameCooldown.current={blockThrow:()=>false};
  t.tap(t.pokemon(18));assert.equal(t.requests.length,1);
  delete context.PgqlGameCooldown;

  // The last ordinary ball picked in an encounter becomes the setting.
  t=fixture({config:{ball:'poke'}});await t.adapter.start();
  const pick=id=>t.hooks.get('memory').onEnter([null,{toInt32:()=>id}]);
  pick(3);pick(4);pick(701);await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(t.selected,['ultra']);
  pick(3);await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(t.selected,['ultra'],'unchanged ball is not rewritten');

  // Holding a Pokémon opens the normal encounter; a short press still catches.
  t=fixture();await t.adapter.start();
  const held=t.pokemon(19);
  const gesture=target=>managed({},{get_gameObject:()=>managed({},{GetComponent:()=>target})});
  const press=(g,target,ms,tapFires)=>new Promise(resolve=>{
    t.hooks.get('began').onEnter([g.handle]);
    setTimeout(()=>{
      const frame={};t.hooks.get('ended').onEnter.call(frame,[g.handle]);
      if(tapFires)t.tap(target);
      t.hooks.get('ended').onLeave.call(frame);resolve();
    },ms);
  });
  byPointer.get(0);
  const lookupGesture=g=>{byPointer.set(g.handle.id,g);return g;};
  let g=lookupGesture(gesture(held));
  await press(g,held,Adapter.holdMs+50,true);
  assert.deepEqual(t.opened.map(o=>o[1]),[held],'the tap opened the encounter');assert.equal(t.requests.length,0);
  g=lookupGesture(gesture(held));
  await press(g,held,Adapter.holdMs+50,false);
  assert.equal(t.opened.length,2,'opened through the map state when the game reports no tap');
  assert.deepEqual([t.opened[1][0],t.opened[1][2]],[t.explore,false]);
  g=lookupGesture(gesture(held));
  await press(g,held,20,true);
  assert.equal(t.opened.length,2);assert.equal(t.requests.length,1,'a short press catches');
  // Hold to Open off: holding catches as well.
  t.state.config={...t.state.config,holdToOpen:false};
  const other=t.pokemon(20);g=lookupGesture(gesture(other));
  await press(g,other,Adapter.holdMs+50,true);assert.equal(t.opened.length,2);assert.equal(t.requests.length,2);
  // Gestures on things other than Pokémon are ignored.
  g=lookupGesture(gesture(NULL_OBJECT));t.hooks.get('began').onEnter([g.handle]);assert.equal(t.adapter.hold,null);

  // The promise helper wires Then/Error delegates and settles once.
  t=fixture();
  const promiseOf=errorTypes=>{
    const calls={};
    const method=(name,typeName)=>({name,isStatic:false,parameterCount:1,parameters:[{type:{name:typeName,class:typeName}}],
      bind:()=>({invoke:delegate=>{calls[name]=delegate;}})});
    const p=managed();
    p.class={type:{name:'Promise'},hierarchy:()=>[{methods:[method('Then','System.Action<Out>'),...errorTypes.map(e=>method('Error',e))]}]};
    return {p,calls};
  };
  let {p,calls}=promiseOf(['System.Action<Niantic.Platform.Ditto.Rpc.RpcStatus>']);
  const got=[];
  Adapter.prototype.request.call(t.adapter,p,'Out',v=>got.push(['then',v]),r=>got.push(['error',r]));
  calls.Then.values.fn('value');calls.Error.values.fn('late');
  assert.deepEqual(got,[['then','value']]);
  ({p,calls}=promiseOf(['System.Action<System.String>','System.Action<System.Exception>']));
  Adapter.prototype.request.call(t.adapter,p,'Out',v=>got.push(['then',v]),r=>got.push(['error',r]));
  assert.equal(calls.Error.values.type,'System.Action<System.String>');calls.Error.values.fn('boom');
  assert.deepEqual(got.at(-1),['error','boom']);
  ({p}=promiseOf([]));
  assert.throws(()=>Adapter.prototype.request.call(t.adapter,p,'Out',()=>{},()=>{}),/Unsupported game promise/);

  // Disabling restores PokemonSelected; a late answer is ignored.
  t=fixture();await t.adapter.start();
  t.tap(t.pokemon(21));
  t.cleanups.forEach(fn=>fn());
  assert(reverted.includes('selected'));assert.equal(t.adapter.pending.size,0);
  t.answer('encounter',managed());assert.equal(t.captures.length,0);
  console.log('Tap to Catch version gate, ball choice, berry, throw bonuses, results, cooldown, ball memory, hold-to-open and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
