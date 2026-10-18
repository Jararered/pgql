const assert=require('node:assert/strict');
const vm=require('node:vm');
const {read,flush}=require('./helpers/sandbox.cjs');
let serial=0,version='0.433.0';const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0'}};
function managed(values={},methods={}) {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,methods,class:{name:'Managed'},isNull:()=>false,
    method:name=>({invoke:(...args)=>methods[name](...args)})};
  byPointer.set(id,self);return self;
}
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];}})});
const methodOf=fn=>({bind:object=>({invoke:(...args)=>fn(object,...args)})});
const attached=[],disabled=[];
const lookup=class {constructor(handle){return byPointer.get(handle.id)||NULL_OBJECT;}};
const sandbox={setTimeout,clearTimeout,Date,
  Qol:{disable:id=>disabled.push(id)},
  Il2Cpp:{get application(){return {version};},string:content=>({content}),Object:lookup,ValueType:lookup,delegate:(type,fn)=>({handle:{type},fn})},
  Interceptor:{attach:(address,callbacks)=>{const entry={address,callbacks,detached:false};attached.push(entry);return {detach:()=>{entry.detached=true;}};},flush(){}},
  PgqlGameGifts:class {
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    method(object,name){return {invoke:(...args)=>object.methods[name](...args)};}
    handleNew(handle){return {isNull:()=>false,handle};}
    handleFree(){}
  }};
const context=vm.createContext(sandbox);
vm.runInContext(read('core/berry-policy.js'),context);
vm.runInContext(read('core/game-version.js'),context);
vm.runInContext(read('core/metadata-binding.js'),context);
vm.runInContext(read('adapters/game-toast.js'),context);
vm.runInContext(read('adapters/game-pinap-master.js'),context);
const Adapter=context.PgqlGamePinapMaster;
const settle=()=>flush(4);

function fixture(config={}) {
  const logs=[],hooks=new Map(),cleanups=[],used=[],selected=[],toasts=[];
  const state={config:{berry:'pinap',showToast:true,...config}};
  const ctx={get config(){return state.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks)};
  const adapter=new Adapter(ctx,{select:key=>{selected.push(key);state.config={...state.config,berry:key};}});
  adapter.bound={active:{virtualAddress:'active'},setActive:methodOf((o,id)=>{o.values.active=id;}),canUse:methodOf(o=>o.values.can),
    stateField:fieldOf('state'),bagField:fieldOf('bag'),state:{isAssignableFrom:()=>true},
    special:methodOf(o=>o.values.special),mapPokemon:methodOf(o=>o.values.pokemon),
    ids:{},confirm:{},button:null,picker:null,toast:null};
  adapter.bind=()=>adapter.bound;
  const answers=[];
  adapter.watch=()=>new Promise((resolve,reject)=>answers.push({resolve,reject}));
  adapter.notify=text=>toasts.push(text);
  const counts={701:4,705:2};
  const bag=managed({},{GetItemCount:id=>counts[id]||0,UseItemForEncounter:(id,pokemon)=>{used.push([id,pokemon]);counts[id]--;return managed();}});
  const encounter=(values={})=>{
    const encounterState=managed({special:false,pokemon:managed(),...values});
    return managed({state:encounterState,bag,can:true,active:0});
  };
  // The game reading the active berry: our listener sees the result.
  const poll=interaction=>{
    const frame={},hook=hooks.get('active');
    hook.onEnter.call(frame,[interaction.handle]);
    hook.onLeave.call(frame,{toInt32:()=>interaction.values.active});
  };
  return {adapter,logs,hooks,cleanups,used,selected,toasts,state,counts,bag,encounter,poll,answers};
}

(async()=>{
  assert.equal(Adapter.number(5),5);assert.equal(Adapter.number({field:()=>({value:7})}),7);

  // Other game versions and changed metadata install nothing.
  const installed=[],bare={log:()=>{},cleanup:()=>{},hook:address=>installed.push(address),config:{berry:'pinap'}};
  version='0.434.0';
  await assert.rejects(new Adapter(bare).start(),/supports game 0\.433\.0; found 0\.434\.0/);
  version='0.433.0';
  await assert.rejects(new Adapter(bare).start(),/Unsupported game metadata: Niantic\.Holoholo\.Encounter\.EncounterInteractionState/);
  assert.equal(installed.length,0);

  // A wild encounter without a berry gets the chosen berry once.
  let t=fixture();
  assert.equal(await t.adapter.start(),true);
  assert.deepEqual([...t.hooks.keys()],['active']);
  const wild=t.encounter();
  t.poll(wild);
  assert.equal(t.used.length,1);assert.equal(t.used[0][0],705);assert.equal(t.used[0][1],wild.values.state.values.pokemon);
  assert.equal(wild.values.active,705,'the encounter shows the berry as active');
  // Active berry, a pending request and the throttle each prevent a second use.
  t.poll(wild);assert.equal(t.used.length,1);
  wild.values.active=0;t.poll(wild);assert.equal(t.used.length,1,'pending request');
  t.answers[0].resolve(true);await settle();
  assert.equal(t.adapter.stats.confirmed,1);
  t.poll(wild);assert.equal(t.used.length,1,'throttled for two seconds');
  // After a throw consumes the berry, it is fed again.
  t.adapter.lastUse-=2500;t.adapter.quietUntil=0;t.poll(wild);
  assert.equal(t.used.length,2);assert.equal(t.counts[705],0);
  t.answers[1].resolve(false);await settle();
  assert.equal(t.adapter.stats.refused,1);assert.match(t.logs.at(-1).message,/refused/);
  // Out of stock: nothing is used and checks back off.
  t.adapter.lastUse-=2500;wild.values.active=0;t.poll(wild);
  assert.equal(t.used.length,2);assert(t.adapter.quietUntil>Date.now());
  assert.match(t.adapter.report(),/^Berry: Pinap Berry\nFed: 2 \(1 confirmed, 1 refused\)\nRaid\/Rocket encounters skipped: 0\nLast: Pinap Berry$/);

  // The setting is read at each decision; off feeds nothing.
  t=fixture({berry:'off'});await t.adapter.start();
  t.poll(t.encounter());assert.equal(t.used.length,0);
  t.state.config={...t.state.config,berry:'razz'};t.adapter.quietUntil=0;
  t.poll(t.encounter());assert.deepEqual(t.used.map(u=>u[0]),[701]);

  // Raid and Rocket encounters are skipped and counted once; so is a game
  // that does not currently allow a berry.
  t=fixture();await t.adapter.start();
  const raid=t.encounter({special:true});
  t.poll(raid);t.adapter.quietUntil=0;t.poll(raid);
  assert.equal(t.used.length,0);assert.equal(t.adapter.stats.special,1);
  assert.match(t.logs.at(-1).message,/raid or Rocket encounter skipped/);
  const busy=t.encounter();busy.values.can=false;t.adapter.quietUntil=0;t.poll(busy);
  assert.equal(t.used.length,0);

  // An unexpected error turns the module off instead of repeating.
  t=fixture();await t.adapter.start();
  const broken=t.encounter();broken.values.bag=NULL_OBJECT;
  t.poll(broken);await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(t.adapter.failed,true);assert.deepEqual(disabled,['pinap-master']);
  assert.match(t.logs.at(-1).details.error,/item bag unavailable/);
  broken.values.bag=t.bag;t.poll(broken);assert.equal(t.used.length,0);

  // The selector button is added only to the encounter berry selector and
  // repainted once it is open.
  t=fixture();
  t.adapter.bound.button={initialize:{virtualAddress:'slider'},opened:{virtualAddress:'opened'},initializer:'Initializer',title:fieldOf('TitleKey'),
    action:'UnityAction',frame:'frame'};
  const calls=[];
  t.adapter.install=slider=>calls.push(['install',slider]);t.adapter.hide=slider=>calls.push(['hide',slider]);
  t.adapter.repaint=slider=>calls.push(['repaint',slider]);t.adapter.remove=()=>{calls.push(['remove']);return 1;};
  await t.adapter.start();
  assert.deepEqual([...t.hooks.keys()],['active','slider','opened']);
  const open=(slider,title)=>{const frame={},hook=t.hooks.get('slider');
    hook.onEnter.call(frame,[slider.handle,managed({TitleKey:title===null?NULL_OBJECT:{isNull:()=>false,content:title}}).handle]);hook.onLeave.call(frame);};
  const berries=managed(),balls=managed();
  open(berries,'encounter_item_berries');open(balls,'encounter_item_pokeballs');open(balls,null);
  assert.deepEqual(calls.map(c=>[c[0],c[1].handle.id]),[['install',berries.handle.id],['hide',balls.handle.id],['hide',balls.handle.id]]);
  const frame={};t.hooks.get('opened').onEnter.call(frame,[berries.handle]);t.hooks.get('opened').onLeave.call(frame);
  assert.equal(calls.at(-1)[0],'repaint');
  // Without the picker a tap cycles to the next berry and confirms it.
  t.adapter.delegate.fn();
  assert.deepEqual(t.selected,['razz']);assert.deepEqual(t.toasts,['Razz Berry selected']);
  // A picker that fails falls back to cycling and is reported.
  t.adapter.bound.picker={};t.adapter.openPicker=()=>{throw Error('modal changed');};
  t.adapter.delegate.fn();
  assert.deepEqual(t.selected,['razz','nanab']);assert.match(t.adapter.report(),/Berry picker unavailable: modal changed/);
  for(let i=0;i<3;i++)t.adapter.delegate.fn();
  assert.equal(t.selected.at(-1),'off');assert.equal(t.toasts.at(-1),'Pinap Master off');
  // A button failure disables only the button.
  t.adapter.install=()=>{throw Error('no info button');};
  open(berries,'encounter_item_berries');
  assert.match(t.adapter.report(),/Selector button unavailable: no info button/);assert.equal(t.adapter.failed,false);

  // Disable removes the button on the next game frame and ignores later taps.
  t.cleanups.forEach(fn=>fn());
  const frameHook=attached.find(entry=>entry.address==='frame');
  assert(frameHook);frameHook.callbacks.onLeave();
  assert.equal(calls.at(-1)[0],'remove');assert.equal(frameHook.detached,true);
  const before=t.selected.length;t.adapter.delegate.fn();assert.equal(t.selected.length,before);
  const late=t.encounter();t.poll(late);assert.equal(t.used.length,0);
  console.log('Pinap Master version gate, feeding, skip rules, confirmation, button, picker fallback and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
