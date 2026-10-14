const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
let serial=0;const objects=new Map();
const pointer=(isNull=false)=>{const id=++serial;return {id,isNull:()=>isNull,equals:other=>!!other&&other.id===id,toString:()=>'p'+id};};
const NULL={isNull:()=>true,handle:pointer(true)};

// Fake managed metadata: methods are [name,args,returns,isStatic,impl].
function klass(name,{methods=[],fields=[],parent=null}={}) {
  const k={name,handle:pointer(),type:{name,object:{name}},parent};
  k.methods=methods.map(([method,args=[],returns='System.Void',isStatic=false,impl=()=>{}])=>({name:method,isStatic,isGeneric:false,
    returnType:{name:returns},parameters:args.map(arg=>({type:{name:arg}})),virtualAddress:{name:name+'.'+method,isNull:()=>false},
    bind(object){return {invoke:(...a)=>impl(object,...a)};},invoke:(...a)=>impl(null,...a),wrap(fn){return {fn};}}));
  k.fields=fields.map(([field,type,isStatic=false])=>({name:field,isStatic,type:{name:type},
    bind:object=>({get value(){return object.values[field];}})}));
  k.field=key=>{const found=k.fields.find(f=>f.name===key);if(!found)throw Error('No field '+key);return found;};
  return k;
}
function object(k,values={},methods={}) {
  const self={handle:pointer(),class:k,values,isNull:()=>false,
    method:name=>{const fn=(...a)=>methods[name](...a);return {invoke:fn,overload:()=>({invoke:fn})};},
    field:name=>({get value(){return values[name];},set value(v){values[name]=v;}})};
  objects.set(self.handle.id,self);return self;
}
const latLng=(latitude,longitude)=>({field:name=>({value:name==='Latitude'?latitude:longitude})});
const managedString=content=>({isNull:()=>false,content});

// The tapped spot, Nearby targets and services.
let ground={found:true,latitude:51.5,longitude:-0.12},lastScreen=null;
const types={},classes={};
const T=(name,spec)=>(types[name]=klass(name,spec));
T('Niantic.LatLng',{fields:[['Latitude','System.Double'],['Longitude','System.Double']]});
T('TouchScript.Gestures.TapGesture',{fields:[['startPosition','UnityEngine.Vector2']]});
T('Niantic.Holoholo.Map.GroundTapHandler',{methods:[['OnTap',['System.Object','System.EventArgs']]],
  fields:[['tapGesture','TouchScript.Gestures.TapGesture'],['ekne','Niantic.Holoholo.Map.IMapController']]});
T('Niantic.Holoholo.Map.IMapController',{methods:[['GetGroundLocation',['UnityEngine.Vector2','Niantic.LatLng&'],'System.Boolean']]});
T('Niantic.Holoholo.Map.IPlace',{methods:[['get_Location',[],'Niantic.LatLng']]});
T('UnityEngine.Object',{methods:[['FindObjectOfType',['System.Type'],'UnityEngine.Object',true,(_,type)=>found[type.name]||NULL]]});
T('Niantic.Holoholo.MapSceneContext');T('Zenject.DiContainer',{methods:[['Resolve',['System.Type'],'System.Object']]});
T('Zenject.Context',{methods:[['get_Container',[],'Zenject.DiContainer']]});
const N='Niantic.Holoholo.NearbyPokemon.';
const clicked=[];
const click=(name,method='IconClicked')=>[method,[],'System.Void',false,self=>clicked.push(name+':'+self.values.name)];
T(N+'NearbyPokemonIcon',{methods:[['get_FortId',[],'System.String'],click('pokemon')]});
T(N+'NearbyContestIcon',{methods:[['get_FortId',[],'System.String'],click('contest')]});
T(N+'NearbyRaidIconWidget',{methods:[['get_FortProto',[],'Holoholo.Rpc.PokemonFortProto'],click('raid')]});
T(N+'NearbyStationIconWidget',{methods:[['get_Station',[],'Niantic.Holoholo.Map.IMapStation'],click('station','IconClickedAction')]});
T(N+'NearbyPokemonGuiController',{methods:[['DismissWithPermissions']]});
T('Holoholo.Rpc.PokemonFortProto',{fields:[['Latitude','System.Double'],['Longitude','System.Double']]});
T('Niantic.Holoholo.Map.IMapEntityService',{methods:[['GetMapPoi',['System.String'],'Niantic.Holoholo.Map.IMapPlace']]});
T('Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController',{methods:[click('stamp','OnClickSeeInMap')],fields:[['dnxn','Niantic.LatLng']]});
T('Niantic.Holoholo.Collections.StampSubcategoryGuiController');
T('Niantic.Holoholo.NUI.GuiController',{fields:[['backButtonAction','System.Action']]});
T('System.Action',{methods:[['Invoke']]});

// Concrete game objects.
const controllerClass=klass('Niantic.Holoholo.Map.MapController',{methods:[['Niantic.Holoholo.Map.IMapController.GetGroundLocation',
  ['UnityEngine.Vector2','Niantic.LatLng&'],'System.Boolean',false,(_,screen,reference)=>{
    lastScreen=screen;reference.out.field('Latitude').value=ground.latitude;reference.out.field('Longitude').value=ground.longitude;return ground.found;}]]});
const controller=object(controllerClass);
const gestureObject=object(types['TouchScript.Gestures.TapGesture'],{startPosition:{x:200,y:900}});
const handler=object(types['Niantic.Holoholo.Map.GroundTapHandler'],{tapGesture:gestureObject,ekne:controller});
const placeClass=klass('Niantic.Holoholo.Map.MapPokestop',{methods:[['get_Location',[],'Niantic.LatLng',false,self=>latLng(self.values.lat,self.values.lng)]]});
const pois={stop1:object(placeClass,{lat:10,lng:20})};
const entitiesClass=klass('Niantic.Holoholo.Map.MapEntityService',{methods:[['GetMapPoi',['System.String'],'Niantic.Holoholo.Map.IMapPlace',false,(_,id)=>pois[id.content]||NULL]]});
const entities=object(entitiesClass);
const container={method:()=>({overload:()=>({invoke:type=>type.name==='Niantic.Holoholo.Map.IMapEntityService'?entities:NULL})})};
const scene=object(types['Niantic.Holoholo.MapSceneContext'],{},{get_Container:()=>container});
const dismissed=[];
const nearbyGui=object(types[N+'NearbyPokemonGuiController'],{},{DismissWithPermissions:()=>dismissed.push('nearby')});
const backs=[];
const action=name=>object(types['System.Action'],{},{Invoke:()=>backs.push(name)});
const subcategory=object(types['Niantic.Holoholo.Collections.StampSubcategoryGuiController'],{backButtonAction:action('subcategory')});
const found={'Niantic.Holoholo.MapSceneContext':scene,[N+'NearbyPokemonGuiController']:nearbyGui,'Niantic.Holoholo.Collections.StampSubcategoryGuiController':subcategory};

let version='0.433.0',clock=1000;
const hooks=new Map(),replaced=new Map(),reverted=[];
class ValueType {
  constructor(handle,type){this.handle=handle;this.type=type;this.values={};}
  field(name){const values=this.values;return {get value(){return values[name];},set value(v){values[name]=v;}};}
}
const context=vm.createContext({setTimeout,clearTimeout,Date:{now:()=>clock},
  PgqlGameGifts:class {type(name){if(!types[name])throw Error('Unsupported game metadata: '+name);return types[name];}async initialize(){}async main(fn){return fn();}async metadata(fn){return fn();}},
  Il2Cpp:{get application(){return {version};},Object:class {constructor(handle){return objects.get(handle.id);}},ValueType,reference:out=>({out})},
  Memory:{alloc:()=>pointer()},
  Interceptor:{replace:(address,wrapped)=>replaced.set(address.name,wrapped),revert:address=>{reverted.push(address.name);replaced.delete(address.name);},flush:()=>{}},
});
vm.runInContext(read('core/game-version.js'),context);
vm.runInContext(read('adapters/game-tap-to-teleport.js'),context);
const Teleport=context.PgqlGameTapToTeleport;
const teleports=[],logs=[],cleanups=[];
let config={nearbyMenu:true},accept=true;
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details}),hook:(address,callbacks)=>hooks.set(address.name,callbacks),
  teleport:(latitude,longitude)=>{if(!accept)return false;teleports.push([latitude,longitude]);return true;},get config(){return config;}};
const tap=(sender=gestureObject)=>hooks.get('Niantic.Holoholo.Map.GroundTapHandler.OnTap').onEnter([handler.handle,sender.handle]);
const press=(method,self)=>replaced.get(method).fn.call(self);

(async()=>{
  // Version gate and strict bindings.
  version='0.434.0';
  await assert.rejects(new Teleport({...ctx,cleanup:()=>{}}).start(),/supports game 0\.433\.0/);
  version='0.433.0';
  const onTap=types['Niantic.Holoholo.Map.GroundTapHandler'].methods[0];
  onTap.parameters=[{type:{name:'System.Object'}}];
  await assert.rejects(new Teleport({...ctx,cleanup:()=>{}}).start(),/Unsupported teleport method: OnTap/);
  onTap.parameters=[{type:{name:'System.Object'}},{type:{name:'System.EventArgs'}}];
  const controllerType=types['Niantic.Holoholo.Map.IMapController'];
  controllerType.methods.push({...controllerType.methods[0]});
  await assert.rejects(new Teleport({...ctx,cleanup:()=>{}}).start(),/Unsupported teleport method: GetGroundLocation/);
  controllerType.methods.pop();
  assert.equal(hooks.size,0);assert.equal(replaced.size,0);

  const adapter=new Teleport(ctx);
  assert.equal(await adapter.start(),true);
  assert(logs.some(l=>l.message==='Tap to Teleport ready'&&l.details.nearby&&l.details.stamp));
  assert.deepEqual([...replaced.keys()].sort(),[N+'NearbyContestIcon.IconClicked',N+'NearbyPokemonIcon.IconClicked',N+'NearbyRaidIconWidget.IconClicked',
    N+'NearbyStationIconWidget.IconClickedAction','Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController.OnClickSeeInMap'].sort());

  // One tap does nothing; a second within 500 ms jumps to the ground location.
  tap();assert.deepEqual(teleports,[]);
  clock+=300;tap();assert.deepEqual(teleports,[[51.5,-0.12]]);
  assert.deepEqual(lastScreen,{x:200,y:900},'the gesture start position is converted');
  // A third quick tap starts a new double tap instead of jumping again.
  clock+=200;tap();assert.equal(teleports.length,1);
  clock+=200;tap();assert.equal(teleports.length,2);
  // Taps further apart never jump.
  clock+=1000;tap();clock+=600;tap();assert.equal(teleports.length,2);
  // An unrelated sender falls back to the handler's own gesture.
  clock+=1000;tap(controller);clock+=100;tap(controller);assert.equal(teleports.length,3);
  // No ground hit or an empty location is ignored.
  ground={found:false,latitude:1,longitude:1};clock+=1000;tap();clock+=100;tap();
  ground={found:true,latitude:0,longitude:0};clock+=1000;tap();clock+=100;tap();
  assert.equal(teleports.length,3);assert(logs.some(l=>/no map location/.test(l.message)));
  ground={found:true,latitude:51.5,longitude:-0.12};
  assert.deepEqual(JSON.parse(JSON.stringify(adapter.status())),{teleports:3,last:{latitude:51.5,longitude:-0.12,source:'map'},limits:{}});

  // Nearby menu: a POI Pokémon teleports and closes the menu.
  const icon=object(types[N+'NearbyPokemonIcon'],{name:'a'},{get_FortId:()=>managedString('stop1')});
  press(N+'NearbyPokemonIcon.IconClicked',icon);
  assert.deepEqual(teleports.at(-1),[10,20]);assert.deepEqual(dismissed,['nearby']);assert.deepEqual(clicked,[]);
  // A grass Pokémon (no POI) or an unknown POI tracks as usual.
  press(N+'NearbyPokemonIcon.IconClicked',object(types[N+'NearbyPokemonIcon'],{name:'b'},{get_FortId:()=>managedString('')}));
  press(N+'NearbyContestIcon.IconClicked',object(types[N+'NearbyContestIcon'],{name:'c'},{get_FortId:()=>managedString('gone')}));
  assert.deepEqual(clicked,['pokemon:b','contest:c']);
  // Raids use the fort proto, stations the station's location.
  const fort=object(types['Holoholo.Rpc.PokemonFortProto'],{Latitude:30,Longitude:40});
  press(N+'NearbyRaidIconWidget.IconClicked',object(types[N+'NearbyRaidIconWidget'],{name:'r'},{get_FortProto:()=>fort}));
  assert.deepEqual(teleports.at(-1),[30,40]);
  const station=object(placeClass,{lat:50,lng:60});
  press(N+'NearbyStationIconWidget.IconClickedAction',object(types[N+'NearbyStationIconWidget'],{name:'s'},{get_Station:()=>station}));
  assert.deepEqual(teleports.at(-1),[50,60]);assert.equal(dismissed.length,3);
  // A throttled or refused teleport keeps the game's behaviour.
  accept=false;press(N+'NearbyRaidIconWidget.IconClicked',object(types[N+'NearbyRaidIconWidget'],{name:'r2'},{get_FortProto:()=>fort}));accept=true;
  assert.deepEqual(clicked.at(-1),'raid:r2');
  // Turned off, every icon tracks.
  config={nearbyMenu:false};
  press(N+'NearbyPokemonIcon.IconClicked',icon);assert.deepEqual(clicked.at(-1),'pokemon:a');
  config={nearbyMenu:true};

  // Stamp "See in map" jumps and steps back out of both stamp pages.
  const detail=object(types['Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController'],{name:'d',dnxn:latLng(70,80),backButtonAction:action('detail')});
  press('Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController.OnClickSeeInMap',detail);
  assert.deepEqual(teleports.at(-1),[70,80]);assert.deepEqual(backs,['detail','subcategory']);
  const before=teleports.length;
  press('Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController.OnClickSeeInMap',
    object(types['Niantic.Holoholo.Collections.StampCollectionPoiDetailGuiController'],{name:'e',dnxn:latLng(0,0)}));
  assert.equal(teleports.length,before);assert.equal(clicked.at(-1),'stamp:e');

  // Closing reverts every replacement and ignores later taps.
  cleanups.forEach(fn=>fn());
  assert.equal(replaced.size,0);assert.equal(reverted.length,5);
  clock+=1000;tap();clock+=100;tap();assert.equal(teleports.length,before);

  // Optional parts: a missing Nearby class leaves the map tap working.
  const saved=types[N+'NearbyStationIconWidget'];delete types[N+'NearbyStationIconWidget'];
  hooks.clear();const partial=new Teleport({...ctx,cleanup:()=>{}});await partial.start();
  assert.match(partial.status().limits.nearby,/NearbyStationIconWidget/);
  assert.equal(replaced.size,1,'only the stamp button is replaced');
  clock+=1000;tap();clock+=100;tap();assert.equal(teleports.length,before+1);
  types[N+'NearbyStationIconWidget']=saved;partial.close();

  // Mock location bypass over a fake JNI table.
  const cell=()=>({v:null,readPointer(){return this.v;},readS32(){return this.v;},writePointer(v){this.v=v;return this;}});
  const named=name=>({name,isNull:()=>false});
  const slots=prefix=>({add:offset=>({readPointer:()=>named(prefix+offset/8)})});
  const jniTable=Object.assign(slots('jni:'),{isNull:()=>false});
  const env={readPointer:()=>jniTable},javaVm={readPointer:()=>slots('vm:')};
  const ids={isFromMockProvider:pointer(),isMock:pointer()};
  let envResult=0,missingIsMock=false;const jniCalls=[];
  const natives={
    JNI_GetCreatedJavaVMs:(vms,count,out)=>{vms.v=javaVm;out.v=1;return 0;},
    'vm:6':(vm,out)=>{out.v=env;return envResult;},'vm:4':(vm,out)=>{jniCalls.push('attach');out.v=env;return 0;},'vm:5':()=>{jniCalls.push('detach');return 0;},
    'jni:6':(e,name)=>name==='android/location/Location'?{isNull:()=>false}:{isNull:()=>true},'jni:228':()=>false,
    'jni:33':(e,c,name)=>name==='isMock'&&missingIsMock?{isNull:()=>true}:ids[name],'jni:23':()=>jniCalls.push('delete')
  };
  const attached=new Map();
  const jniContext=vm.createContext({
    Process:{pointerSize:8,findModuleByName:()=>({findExportByName:name=>named(name)})},Module:{},
    NativeFunction:function(address){return natives[address.name];},
    Memory:{alloc:()=>cell(),allocUtf8String:value=>value},ptr:()=>'zero',
    Interceptor:{attach:(address,callbacks)=>{attached.set(address.name,callbacks);return {detach:()=>attached.delete(address.name)};}}});
  for(const file of ['core/jni-helper.js','adapters/mock-location.js'])vm.runInContext(read(file),jniContext);
  const mockLogs=[],bypass=new jniContext.PgqlMockLocationBypass({log:message=>mockLogs.push(message)});
  bypass.start();
  assert.deepEqual([...attached.keys()],['jni:37','jni:38','jni:39']);assert.equal(bypass.active,true);
  assert.deepEqual(jniCalls,['delete'],'an attached thread is reused and the class ref released');
  const call=(slot,id)=>{const frame={},result={value:1,replace(v){this.value=v;}};attached.get(slot).onEnter.call(frame,[null,null,id]);attached.get(slot).onLeave.call(frame,result);return result.value;};
  assert.equal(call('jni:37',ids.isMock),'zero');assert.equal(call('jni:39',ids.isFromMockProvider),'zero');
  assert.equal(call('jni:38',pointer()),1,'other boolean calls pass through');
  bypass.stop();assert.equal(attached.size,0);assert.equal(bypass.active,false);
  // A detached thread attaches only for the lookup; isMock is optional.
  envResult=-2;missingIsMock=true;jniCalls.length=0;
  bypass.start();assert.deepEqual(jniCalls,['attach','delete','detach']);assert.equal(bypass.methods.length,1);bypass.stop();
  natives['jni:33']=()=>({isNull:()=>true});envResult=0;
  assert.throws(()=>bypass.start(),/Mock location checks unavailable/);assert.equal(attached.size,0);

  // Module: catalog slot, settings, mock toggle, role and status.
  const timers=[],events=[],mockStates=[];
  let mockFails=false;
  const moduleContext=vm.createContext({send:event=>events.push(event),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},Date,
    PgqlGameTapToTeleport:class {async start(){return true;}status(){return {teleports:2,last:{latitude:1.5,longitude:2.25,source:'map'},limits:{stamp:'missing'}};}},
    PgqlMockLocationBypass:class {constructor(){this.active=false;}start(){if(mockFails)throw Error('no JNI');this.active=true;mockStates.push('start');}stop(){this.active=false;mockStates.push('stop');}}});
  for(const file of ['runtime.js','core/feature-catalog.js','modules/tap-to-teleport.js','modules/zz-feature-catalog.js'])vm.runInContext(read(file),moduleContext);
  const q=moduleContext.Qol,described=()=>q.describe().find(module=>module.id==='tap-to-teleport');
  assert.equal(q.describe().length,33,'the module takes the reserved catalog slot');
  assert.equal(described().availability,'implemented');assert.equal(described().category,'Map');
  assert.deepEqual(JSON.parse(JSON.stringify(described().config)),{nearbyMenu:true,hideMock:true});
  assert(described().settings.every(setting=>setting.description));
  q.enable('tap-to-teleport');assert.deepEqual(mockStates,['start']);
  assert.equal((await q.invoke('tap-to-teleport',{action:'status'})).phase,'initializing');
  timers.splice(0).forEach(fn=>fn());await settle();
  assert.deepEqual(JSON.parse(JSON.stringify(await q.invoke('tap-to-teleport',{action:'status'}))),
    {phase:'ready',reason:'Teleports: 2\nLast: 1.500000,2.250000 (map)\nStamp teleport unavailable: missing\nMock location: hidden'});
  q.setConfig('tap-to-teleport','hideMock',false);assert.deepEqual(mockStates,['start','stop']);
  assert.match((await q.invoke('tap-to-teleport',{action:'status'})).reason,/Mock location: visible/);
  mockFails=true;q.setConfig('tap-to-teleport','hideMock',true);
  assert.match((await q.invoke('tap-to-teleport',{action:'status'})).reason,/Mock location: unavailable \(Error: no JNI\)/);
  assert.equal(described().enabled,true,'a failed bypass never stops teleporting');
  q.disable('tap-to-teleport');assert.equal(mockStates.at(-1),'stop');
  moduleContext.PgqlRole='pgp';
  assert.throws(()=>q.enable('tap-to-teleport'),/main game process/);

  // Runtime: ctx.teleport validates and throttles to one jump per 250 ms.
  let now=5000;const runtimeEvents=[];
  const runtime=vm.createContext({send:event=>runtimeEvents.push(event),setTimeout,clearTimeout,Date:{now:()=>now}});
  vm.runInContext(read('runtime.js'),runtime);
  vm.runInContext(`globalThis.jumpCtx=null;Qol.register({id:'jumper',name:'Jumper',enable(ctx){jumpCtx=ctx}})`,runtime);
  runtime.Qol.enable('jumper');
  const jump=runtime.jumpCtx.teleport;
  assert.equal(jump(51.5,-0.12),true);assert.equal(jump(51.6,-0.12),false);
  now+=250;assert.equal(jump(51.7,-0.12),true);
  for(const [latitude,longitude] of [[91,0],[0,181],[NaN,0],[0,Infinity],[0,0],['1',2]])assert.throws(()=>jump(latitude,longitude),/valid latitude/);
  assert.deepEqual(runtimeEvents.filter(e=>e.type==='teleport').map(e=>[e.moduleId,e.latitude,e.longitude]),[['jumper',51.5,-0.12],['jumper',51.7,-0.12]]);
  console.log('Tap to Teleport version gate, double tap, Nearby/stamp teleports, cleanup, mock bypass, module and ctx.teleport tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
