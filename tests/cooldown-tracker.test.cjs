const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
let serial=0;const objects=new Map();
const pointer=(isNull=false)=>({id:++serial,isNull:()=>isNull,toInt32(){return this.int||0;}});
const NULL={isNull:()=>true,handle:pointer(true)};

// Fake managed metadata: methods are [name,args,returns,isStatic,impl], fields [name,type,class].
function klass(name,{methods=[],fields=[],nested=[]}={}) {
  const k={name,type:{name,object:{name}},nestedClasses:nested};
  k.methods=methods.map(([method,args=[],returns='System.Void',isStatic=false,impl=()=>{}])=>({name:method,isStatic,isGeneric:false,
    returnType:{name:returns},parameters:args.map(arg=>({type:{name:arg}})),virtualAddress:{name:name+'.'+method},
    bind(object){return {invoke:(...a)=>impl(object,...a)};},invoke:(...a)=>impl(null,...a)}));
  k.fields=fields.map(([field,type,typeClass=null])=>({name:field,type:{name:type,class:typeClass},
    bind:object=>({get value(){return object.values[field];}})}));
  k.field=key=>{const found=k.fields.find(f=>f.name===key);if(!found)throw Error('No field '+key);return found;};
  return k;
}
// A managed object or struct whose fields and methods are plain values.
function object(k,values={},methods={}) {
  const self={handle:pointer(),class:k,values,isNull:()=>false,
    method:name=>{const fn=(...a)=>methods[name](...a);return {invoke:fn,overload:()=>({invoke:fn})};},
    field:name=>({get value(){if(!(name in values))values[name]=object(null);return values[name];},set value(v){values[name]=v;}})};
  objects.set(self.handle.id,self);return self;
}
const types={};
const T=(name,spec)=>(types[name]=klass(name,spec));
const PARSE=['Google.Protobuf.ParseContext&'];
const dataType=klass('Niantic.Platform.Ditto.Location.LocationData',{fields:[['LatitudeDeg','System.Double'],['LongitudeDeg','System.Double']]});
const locationType=klass('Niantic.Platform.Ditto.Location.Location',{fields:[['data','Niantic.Platform.Ditto.Location.LocationData',dataType]]});
const closureType=klass('<>c__DisplayClass5_0',{methods:[['<NotifyLocationUpdate>b__0']],fields:[['location','Niantic.Platform.Ditto.Location.Location',locationType]]});
T('Niantic.Platform.Ditto.Device.DeviceManager',{nested:[klass('<>c',{methods:[['<Start>b__1_0']]}),closureType]});
T('Holoholo.Rpc.CaptureScoreProto');
T('Holoholo.Rpc.CatchPokemonOutProto',{methods:[['khk',PARSE]],fields:[['Status','Holoholo.Rpc.CatchPokemonOutProto.Types.Status'],['Scores','Holoholo.Rpc.CaptureScoreProto']]});
T('Holoholo.Rpc.FortSearchOutProto',{methods:[['khk',PARSE]],fields:[['Result','Holoholo.Rpc.FortSearchOutProto.Types.Result'],['XpAwarded','System.Int32']]});
for(const name of ['GymFeedPokemonOutProto','GymStartSessionOutProto','GymBattleAttackOutProto','GymDeployOutProto'])T('Holoholo.Rpc.'+name,{methods:[['khk',PARSE]]});
T('Niantic.Holoholo.Encounter.EncounterState',{methods:[['ApproachComplete'],['ExitState'],['get_MapPokemon',[],'Niantic.Holoholo.Map.MapPokemon']]});
const drags=[];
T('Niantic.Holoholo.Encounter.Pokeball',{methods:[['Drag',['UnityEngine.Vector2']],['EndDrag',[],'System.Void',false,self=>drags.push(self)]]});
T('Niantic.Holoholo.MapSceneContext');
const found={};
T('UnityEngine.Object',{methods:[['FindObjectOfType',['System.Type'],'UnityEngine.Object',true,(_,type)=>found[type.name]||NULL],
  ['op_Implicit',['UnityEngine.Object'],'System.Boolean',true,()=>true]]});
T('Zenject.Context',{methods:[['get_Container',[],'Zenject.DiContainer']]});
T('Zenject.DiContainer',{methods:[['Resolve',['System.Type'],'System.Object']]});
const textType=klass('UnityEngine.UI.Text',{methods:[['get_text',[],'System.String']]});
T('Niantic.Holoholo.Pokestop.PokestopSpinnerInteractionGuiController',{methods:[['Initialize',['Holoholo.Rpc.PokemonFortProto']]],fields:[['titleText','UnityEngine.UI.Text',textType]]});
T('Niantic.Holoholo.Gym.Approach.GymApproachGuiController',{methods:[['Init',['Niantic.Holoholo.Map.IMapGym']]],fields:[['gymNameText','UnityEngine.UI.Text',textType]]});
T('Niantic.Holoholo.Map.MapExploreState',{methods:[['GymSelected',['Niantic.Holoholo.Map.IMapGym','System.Boolean']]]});
T('Niantic.Holoholo.Pgp.PgpActivityMonitor',{methods:[['xkc',['System.Int64','System.Int32']],['xke',['Holoholo.Rpc.ActionLogEntry'],'System.Boolean']]});
const paramsType=klass('Niantic.Holoholo.UI.ToastService.ToastParams',{methods:[['.ctor']],
  fields:[['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],
    ['DisplaySecondsOverride','System.Nullable<System.Single>',klass('N1',{fields:[['hasValue','System.Boolean'],['value','System.Single']]})],
    ['BackgroundColor','System.Nullable<UnityEngine.Color>',klass('N2',{fields:[['hasValue','System.Boolean'],['value','UnityEngine.Color']]})]]});
paramsType.alloc=()=>object(paramsType,{},{'.ctor':()=>{}});
T('Niantic.Holoholo.UI.IToastService',{methods:[['OneLine',['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'],'Niantic.Holoholo.UI.IToastReceipt']]});
types['Niantic.Holoholo.UI.IToastService'].methods[0].parameters[1].type.class=paramsType;
T('Niantic.Holoholo.Map.UI.MainMenuGuiController',{fields:[['fullPokeballCanvasGroup','UnityEngine.CanvasGroup']]});
T('UnityEngine.CanvasGroup',{methods:[['get_alpha',[],'System.Single'],['set_alpha',['System.Single']]]});
T('UnityEngine.UI.Image');T('UnityEngine.UI.Graphic',{methods:[['get_color',[],'UnityEngine.Color'],['set_color',['UnityEngine.Color']]]});
T('UnityEngine.Color',{fields:['r','g','b','a'].map(c=>[c,'System.Single'])});
T('UnityEngine.Component',{methods:[['get_gameObject',[],'UnityEngine.GameObject']]});
T('UnityEngine.GameObject',{methods:[['GetComponent',['System.Type'],'UnityEngine.Component'],['get_scene',[],'UnityEngine.SceneManagement.Scene']]});
T('UnityEngine.SceneManagement.Scene',{methods:[['IsValid',[],'System.Boolean']]});
T('UnityEngine.Resources',{methods:[['FindObjectsOfTypeAll',['System.Type'],'UnityEngine.Object[]',true,()=>({length:menus.length,get:i=>menus[i]})]]});
T('Niantic.Holoholo.UI.IUserPromptsService',{methods:[['ShowModal',['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]'],'Niantic.Holoholo.UI.IModalPromise']]});
T('Niantic.Holoholo.UI.ModalButton',{fields:[['OkButton','Niantic.Holoholo.UI.IModalButton[]']]});
types['Niantic.Holoholo.UI.ModalButton'].field('OkButton').value='ok-buttons';
T('UnityEngine.UnitySynchronizationContext',{methods:[['ExecuteTasks',[],'System.Void',true]]});
types['UnityEngine.UnitySynchronizationContext'].method=()=>({virtualAddress:{name:'frame'}});

// Scene: toast service, modal service and the main-menu Poké Ball.
const toasts=[],modals=[];
const toastService=object(klass('ToastService',{methods:[['OneLine',['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'],'Niantic.Holoholo.UI.IToastReceipt',false,(_,text,params)=>toasts.push({text:text.content,params})]]}));
const promptService=object(klass('UserPromptsService',{methods:[['ShowModal',['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]'],'Niantic.Holoholo.UI.IModalPromise',false,(_,title,i1,body,i2,flag,buttons)=>modals.push([title.content,body.content,buttons])]]}));
const services={'Niantic.Holoholo.UI.IToastService':toastService,'Niantic.Holoholo.UI.IUserPromptsService':promptService};
const container={method:()=>({overload:()=>({invoke:type=>services[type.name]||NULL})})};
found['Niantic.Holoholo.MapSceneContext']=object(types['Niantic.Holoholo.MapSceneContext'],{},{get_Container:()=>container});
const color=object(types['UnityEngine.Color'],{r:1,g:1,b:1,a:1});
const ball={alpha:0,color:[1,1,1,1]};
const image=object(types['UnityEngine.UI.Image'],{},{get_color:()=>{['r','g','b','a'].forEach((c,i)=>{color.values[c]=ball.color[i];});return color;},
  set_color:value=>{ball.color=['r','g','b','a'].map(c=>value.values[c]);}});
const groupObject=object(types['UnityEngine.CanvasGroup'],{},{get_alpha:()=>ball.alpha,set_alpha:value=>{ball.alpha=value;},
  get_gameObject:()=>object(null,{},{GetComponent:()=>image})});
const scene=valid=>object(null,{},{get_scene:()=>object(null,{},{IsValid:()=>valid})});
const menus=[object(types['Niantic.Holoholo.Map.UI.MainMenuGuiController'],{fullPokeballCanvasGroup:groupObject},{get_gameObject:()=>scene(false)}),
  object(types['Niantic.Holoholo.Map.UI.MainMenuGuiController'],{fullPokeballCanvasGroup:groupObject},{get_gameObject:()=>scene(true)})];

let version='0.433.0',clock=1000000;
const timers=[];
const fakeSetTimeout=(fn,ms)=>{const timer={fn,ms,id:timers.length+1};timers.push(timer);return timer;};
const fakeClearTimeout=timer=>{const index=timers.indexOf(timer);if(index>=0)timers.splice(index,1);};
const runTimers=(predicate=()=>true)=>{for(const timer of timers.filter(predicate)){fakeClearTimeout(timer);timer.fn();}};
const hooks=new Map(),attached=[];
const context=vm.createContext({setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout,Date:{now:()=>clock},NULL,JSON,
  PgqlGameGifts:class {type(name){if(!types[name])throw Error('Unsupported game metadata: '+name);return types[name];}async initialize(){}async main(fn){return fn();}},
  Il2Cpp:{get application(){return {version};},Object:class {constructor(handle){return handle===NULL?NULL:objects.get(handle.id);}},string:content=>({content})},
  Interceptor:{attach:(address,callbacks)=>{const entry={address:address.name,callbacks,detached:false};attached.push(entry);return {detach:()=>{entry.detached=true;}};}}});
vm.runInContext(read('core/cooldown-policy.js'),context);
vm.runInContext(read('core/game-version.js'),context);
vm.runInContext(read('adapters/game-cooldown.js'),context);
const Cooldown=context.PgqlGameCooldown;
const teleports=[],logs=[],cleanups=[];
let config={preventThrows:true,rocketTp:true},stored=null,accept=true;
const store={load:async()=>stored,save:async text=>{stored=text;}};
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details}),hook:(address,callbacks)=>hooks.set(address.name,callbacks),
  teleport:(latitude,longitude)=>{if(!accept)return false;teleports.push([latitude,longitude]);return true;},get config(){return config;}};
const call=(name,self,...args)=>{const frame={},hook=hooks.get(name);assert(hook,'no hook on '+name);
  if(hook.onEnter)hook.onEnter.call(frame,[self?self.handle:pointer(),...args]);if(hook.onLeave)hook.onLeave.call(frame);};
const D='Niantic.Platform.Ditto.Device.DeviceManager',E='Niantic.Holoholo.Encounter.EncounterState.';
const moveTo=(lat,lon)=>call('<>c__DisplayClass5_0.<NotifyLocationUpdate>b__0',object(closureType,{location:object(locationType,{data:object(dataType,{LatitudeDeg:lat,LongitudeDeg:lon})})}));
const caught=(status,scores=true)=>call('Holoholo.Rpc.CatchPokemonOutProto.khk',object(types['Holoholo.Rpc.CatchPokemonOutProto'],{Status:status,Scores:scores?object(null):NULL}));
const encounter=kind=>call(E+'ApproachComplete',object(types[E.slice(0,-1)],{},{get_MapPokemon:()=>object(klass(kind))}));
const leave=()=>call(E+'ExitState');
const drag=()=>{const ballObject=object(types['Niantic.Holoholo.Encounter.Pokeball']);call('Niantic.Holoholo.Encounter.Pokeball.Drag',ballObject,pointer());return ballObject;};
const KM=1/111.195;

(async()=>{
  // Version gate and strict bindings.
  version='0.434.0';
  await assert.rejects(new Cooldown({...ctx,cleanup:()=>{}},{store}).start(),/supports game 0\.433\.0/);
  version='0.433.0';
  closureType.methods.push({...closureType.methods[0]});
  await assert.rejects(new Cooldown({...ctx,cleanup:()=>{}},{store}).start(),/Unsupported location update/);
  closureType.methods.pop();
  const pokeball=types['Niantic.Holoholo.Encounter.Pokeball'];
  pokeball.methods.push({...pokeball.methods[0]});
  await assert.rejects(new Cooldown({...ctx,cleanup:()=>{}},{store}).start(),/Unsupported cooldown method: Drag/);
  pokeball.methods.pop();
  assert.equal(hooks.size,0);

  const adapter=new Cooldown(ctx,{store});
  assert.equal(await adapter.start(),true);
  assert(logs.some(l=>l.message==='Cooldown Tracker ready'&&l.details.spin&&l.details.gym&&l.details.goPlus&&l.details.toast&&l.details.indicator&&l.details.modal));
  assert.equal(adapter.report(),'No Records');

  // No location yet: nothing is recorded, and a manual save explains why.
  caught(1);assert.equal(adapter.history.current,null);
  assert.throws(()=>adapter.manualSave(),/location unknown/);

  // A catch records the player's position; nearby throws stay free.
  moveTo(10,20);
  caught(1);
  assert.equal(adapter.history.current.trigger,'catch');assert.equal(adapter.history.current.lat,10);
  runTimers(t=>t.ms===250);
  assert.equal(JSON.parse(stored).current.lat,10,'saved after the debounce');
  drag();assert.equal(drags.length,0);

  // 5 km away the throw is cut off with a toast, and the menu ball is tinted.
  moveTo(10+5*KM,20);
  const held=drag();
  assert.deepEqual(drags,[held]);
  assert.match(toasts[0].text,/^Cooldown: 3m 2\ds\n\(Distance: 5km\)$/);
  assert.equal(ball.alpha,1);assert.deepEqual(ball.color,[1,0.3,0,1]);
  // Dragging again ends the drag but toasts at most every 2 s.
  drag();assert.equal(drags.length,2);assert.equal(toasts.length,1);
  clock+=2000;drag();assert.equal(toasts.length,2);
  // Turned off, throws are allowed.
  config={...config,preventThrows:false};drag();assert.equal(drags.length,3);config={...config,preventThrows:true};

  // Exempt encounters neither block nor record.
  encounter('QuestMapPokemon');drag();assert.equal(drags.length,3);
  caught(1);assert.equal(adapter.history.current.lat,10);
  leave();drag();assert.equal(drags.length,4,'the exemption ends with the encounter');

  // A failed catch with no scores does not count.
  caught(0,false);assert.equal(adapter.history.current.lat,10);
  assert(logs.some(l=>/Catch not counted/.test(l.message)));

  // A long cooldown schedules "Cooldown is over"; a catch cancels it.
  encounter('WildMapPokemon');
  let modalTimer=timers.find(t=>t.ms>30000);assert(modalTimer,'modal scheduled');
  caught(2);assert(!timers.includes(modalTimer),'cancelled by the catch result');
  assert.equal(adapter.history.current.lat,10+5*KM,'an escape with scores counts');
  moveTo(10+15*KM,20);
  encounter('WildMapPokemon');modalTimer=timers.find(t=>t.ms>30000);
  runTimers(t=>t===modalTimer);await settle();
  assert.deepEqual(modals,[['Cooldown is over','Maybe','ok-buttons']]);
  leave();

  // Rocket Teleport: jump to the origin for a Shadow, back after the catch ends it.
  const origin=adapter.history.current;
  encounter('IncidentMapPokemon');
  assert.deepEqual(teleports,[[origin.lat,origin.lon]]);
  moveTo(origin.lat,origin.lon);
  caught(2);assert.equal(teleports.length,1,'an escape keeps the encounter at the origin');
  caught(1);assert.deepEqual(teleports.at(-1),[10+15*KM,20]);
  // Exit also returns, but only once.
  moveTo(10+15*KM,20);encounter('IncidentMapPokemon');assert.equal(teleports.length,3);
  leave();assert.equal(teleports.length,4);leave();assert.equal(teleports.length,4);
  // Toggle off or a short cooldown: no jump.
  config={...config,rocketTp:false};encounter('IncidentMapPokemon');leave();config={...config,rocketTp:true};
  moveTo(adapter.history.current.lat,adapter.history.current.lon);encounter('IncidentMapPokemon');leave();
  assert.equal(teleports.length,4);

  // Spins: names from the spinner, counting rules.
  const spinner=object(types['Niantic.Holoholo.Pokestop.PokestopSpinnerInteractionGuiController'],
    {titleText:object(textType,{},{get_text:()=>({isNull:()=>false,content:'Old Fountain'})})});
  call('Niantic.Holoholo.Pokestop.PokestopSpinnerInteractionGuiController.Initialize',spinner);
  const spin=(result,xp)=>call('Holoholo.Rpc.FortSearchOutProto.khk',object(types['Holoholo.Rpc.FortSearchOutProto'],{Result:result,XpAwarded:xp}));
  moveTo(11,21);
  spin(1,0);spin(2,0);assert.equal(adapter.history.current.trigger,'catch');
  spin(1,50);assert.equal(adapter.history.current.trigger,'pokestop');assert.equal(adapter.history.current.label,'Old Fountain');

  // Gyms: remote feeds are skipped; the others record with the gym's name.
  const gymGui=object(types['Niantic.Holoholo.Gym.Approach.GymApproachGuiController'],
    {gymNameText:object(textType,{},{get_text:()=>({isNull:()=>false,content:'Clock Tower'})})});
  call('Niantic.Holoholo.Gym.Approach.GymApproachGuiController.Init',gymGui);
  const remote=on=>Object.assign(pointer(),{int:on?1:0});
  call('Niantic.Holoholo.Map.MapExploreState.GymSelected',null,pointer(),remote(true));
  call('Holoholo.Rpc.GymFeedPokemonOutProto.khk');assert.equal(adapter.history.current.trigger,'pokestop');
  call('Niantic.Holoholo.Map.MapExploreState.GymSelected',null,pointer(),remote(false));
  call('Holoholo.Rpc.GymFeedPokemonOutProto.khk');assert.equal(adapter.history.current.trigger,'healing');
  call('Holoholo.Rpc.GymBattleAttackOutProto.khk');assert.equal(adapter.history.current.trigger,'battle');
  call('Holoholo.Rpc.GymDeployOutProto.khk');assert.equal(adapter.history.current.label,'Clock Tower');
  const handled=on=>{const hook=hooks.get('Niantic.Holoholo.Pgp.PgpActivityMonitor.xke');hook.onLeave.call({},Object.assign(pointer(),{int:on?1:0}));};
  handled(false);assert.equal(adapter.history.current.trigger,'defending');
  handled(true);assert.equal(adapter.history.current.trigger,'pgp');
  adapter.manualSave();assert.equal(adapter.history.current.trigger,'manual');

  // History keeps four previous records; the report lists them.
  assert.equal(adapter.history.list().length,5);
  const report=adapter.report().split('\n');
  assert.equal(report[0],'Cooldown: Ready');assert.match(report[1],/^Manual — 0s ago · 0m · 11\.000000,21\.000000$/);
  assert.match(report[2],/^Go Plus — /);assert.match(report[4],/^Gym Battle Clock Tower — /);
  assert.match(adapter.report(),/Throws held back: 4/);

  // With no cooldown left, the tint is undone back to the game's look.
  assert.equal(ball.alpha,0);assert.deepEqual(ball.color,[1,1,1,1]);

  // Closing saves pending changes and stops listening.
  adapter.record('catch',null);moveTo(12,22);assert.equal(ball.alpha,1);
  cleanups.forEach(fn=>fn());await settle();
  assert.equal(JSON.parse(stored).current.lat,11,'flushed on close');
  const frame=attached.find(a=>a.address==='frame');assert(frame,'tint restored on the next frame');
  frame.callbacks.onLeave();assert.equal(ball.alpha,0);assert.equal(frame.detached,true);
  const before=adapter.history.current;caught(1);assert.equal(adapter.history.current,before);
  const dragsBefore=drags.length;drag();assert.equal(drags.length,dragsBefore);

  // A new session loads the saved record; corrupt data starts fresh.
  hooks.clear();
  const reloaded=new Cooldown({...ctx,cleanup:()=>{}},{store});await reloaded.start();
  assert.equal(reloaded.history.current.trigger,'catch');assert.equal(reloaded.history.previous.length,4);
  stored='{not json';hooks.clear();
  const fresh=new Cooldown({...ctx,cleanup:()=>{}},{store});await fresh.start();
  assert.equal(fresh.history.current,null);assert(logs.some(l=>/unreadable/.test(l.message)));
  fresh.close();reloaded.close();

  // Optional parts: no gyms leaves catches and spins working.
  const savedGym=types['Holoholo.Rpc.GymDeployOutProto'];delete types['Holoholo.Rpc.GymDeployOutProto'];
  hooks.clear();stored=null;
  const partial=new Cooldown({...ctx,cleanup:()=>{}},{store});await partial.start();
  assert.match(partial.report(),/Gym tracking unavailable: .*GymDeployOutProto/);
  assert(!hooks.has('Holoholo.Rpc.GymFeedPokemonOutProto.khk'));
  moveTo(1,1);caught(1);assert.equal(partial.history.current.trigger,'catch');
  types['Holoholo.Rpc.GymDeployOutProto']=savedGym;partial.close();

  // Module: catalog slot, settings, actions, role.
  const moduleTimers=[],events=[];
  let fakeAdapter=null;
  const moduleContext=vm.createContext({send:event=>events.push(event),setTimeout:fn=>{moduleTimers.push(fn);return moduleTimers.length;},clearTimeout:()=>{},Date,
    PgqlGameCooldown:class {constructor(){fakeAdapter=this;this.failed=false;this.history={current:null};}async start(){return true;}
      report(){return 'Cooldown: Ready';}manualSave(){this.history.current={trigger:'manual',label:null,lat:1.5,lon:2.25,ts:1};return this.history.current;}}});
  for(const file of ['runtime.js','core/feature-catalog.js','core/cooldown-policy.js','modules/cooldown-tracker.js','modules/zz-feature-catalog.js'])vm.runInContext(read(file),moduleContext);
  const q=moduleContext.Qol,described=()=>q.describe().find(module=>module.id==='cooldown-tracker');
  assert.equal(q.describe().length,33,'the module takes the reserved catalog slot');
  assert.equal(described().availability,'implemented');assert.equal(described().category,'Map');
  assert.deepEqual(JSON.parse(JSON.stringify(described().config)),{preventThrows:true,rocketTp:true});
  assert.deepEqual(described().actions.map(a=>a.id).join(),'show,save,return');
  assert(described().settings.every(setting=>setting.description));
  q.enable('cooldown-tracker');
  await assert.rejects(q.invoke('cooldown-tracker',{action:'show'}),/not ready/);
  moduleTimers.splice(0).forEach(fn=>fn());await settle();
  assert.equal(await q.invoke('cooldown-tracker',{action:'show'}),'Cooldown: Ready');
  assert.deepEqual(JSON.parse(JSON.stringify(await q.invoke('cooldown-tracker',{action:'status'}))),{phase:'ready',reason:'Cooldown: Ready'});
  await assert.rejects(q.invoke('cooldown-tracker',{action:'return'}),/No cooldown recorded/);
  assert.match(await q.invoke('cooldown-tracker',{action:'save'}),/1\.500000,2\.250000/);
  assert.match(await q.invoke('cooldown-tracker',{action:'return'}),/^Teleporting to Manual\n/);
  assert.deepEqual(events.filter(e=>e.type==='teleport').map(e=>[e.latitude,e.longitude]),[[1.5,2.25]]);
  await assert.rejects(q.invoke('cooldown-tracker',{action:'bogus'}),/Unknown Cooldown Tracker action/);
  q.disable('cooldown-tracker');
  moduleContext.PgqlRole='pgp';
  assert.throws(()=>q.enable('cooldown-tracker'),/main game process/);
  console.log('Cooldown Tracker version gate, location, catch/spin/gym/GO Plus records, throw guard, toast, indicator, modal, Rocket Teleport, persistence and module tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
