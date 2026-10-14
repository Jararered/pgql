const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0;const byPointer=new Map();
const pointer=()=>{const id=++serial;return {id,equals:other=>other&&other.id===id,toString:()=>String(id)};};
const calls=fn=>({invoke:fn,overload:()=>({invoke:fn})});
const NULL_OBJECT={isNull:()=>true};
function managed(values,methods={}) {
  const self={handle:pointer(),values,isNull:()=>false,method:name=>calls(methods[name]),field:name=>({get value(){return values[name];},set value(v){values[name]=v;}})};
  byPointer.set(self.handle.id,self);return self;
}
const proto=managed({GetMapObjectsMinRefreshSeconds:10,GetMapObjectsMaxRefreshSeconds:30,GetMapObjectsMinDistanceMeters:10});
const throttleValues={minIntervalS:10,maxIntervalS:30,minDistanceM:10};
const throttle=managed(throttleValues,{SetMinUpdateInterval:v=>{throttleValues.minIntervalS=v;},SetMaxUpdateInterval:v=>{throttleValues.maxIntervalS=v;},SetMinDistance:v=>{throttleValues.minDistanceM=v;}});
const inScene=valid=>({get_gameObject:()=>({method:()=>calls(()=>({method:()=>calls(()=>valid)}))})});
const handler=managed({fetchThrottle:throttle},inScene(true)),prefabHandler=managed({fetchThrottle:NULL_OBJECT},inScene(false));
const settings=managed({MapSettings:proto}),global=managed({}, {get_Settings:()=>settings});
const scene=managed({}, {get_Container:()=>({method:()=>calls(()=>global)})});
let mapLoaded=true,version='0.433.0';
const M=(name,args=[],isStatic=false,returns='System.Void')=>[name,args,isStatic,returns];
const signatures={
  'Niantic.Holoholo.Map.MapContentHandler':[],'Niantic.Holoholo.MapSceneContext':[],'Holoholo.Rpc.GlobalSettingsProto':[],
  'Niantic.Holoholo.SpaceTimeThrottle':[M('SetMinUpdateInterval',['System.Single']),M('SetMaxUpdateInterval',['System.Single']),M('SetMinDistance',['System.Single'])],
  'Holoholo.Rpc.MapSettingsProto':[M('MergeFrom',['Holoholo.Rpc.MapSettingsProto']),M('MergeFrom',['Niantic.Protobuf.CodedInputStream'])],
  'Niantic.Holoholo.IGlobalSettings':[M('get_Settings',[],false,'Holoholo.Rpc.GlobalSettingsProto')],
  'UnityEngine.GameObject':[M('get_scene')],'UnityEngine.Component':[M('get_gameObject')],'UnityEngine.SceneManagement.Scene':[M('IsValid')],
  'Zenject.DiContainer':[M('Resolve',['System.Type'])],'Zenject.Context':[M('get_Container')],
  'UnityEngine.UnitySynchronizationContext':[M('ExecuteTasks',[],true)],'UnityEngine.Resources':[M('FindObjectsOfTypeAll',['System.Type'],true)],
  'UnityEngine.Object':[M('FindObjectOfType',['System.Type'],true)],
};
const fieldTypes={fetchThrottle:'Niantic.Holoholo.SpaceTimeThrottle',MapSettings:'Holoholo.Rpc.MapSettingsProto',minIntervalS:'System.Double',maxIntervalS:'System.Double',
  minDistanceM:'System.Double',GetMapObjectsMinRefreshSeconds:'System.Single',GetMapObjectsMaxRefreshSeconds:'System.Single',GetMapObjectsMinDistanceMeters:'System.Single'};
const statics={FindObjectsOfTypeAll:()=>{const all=[prefabHandler,...(mapLoaded?[handler]:[])];return {length:all.length,get:i=>all[i]};},
  FindObjectOfType:()=>mapLoaded?scene:NULL_OBJECT};
const types=new Map();
function type(name) {
  if(!signatures[name])throw Error('Unsupported game metadata: '+name);
  if(!types.has(name))types.set(name,{type:{name,object:{name}},
    field:key=>({type:{name:fieldTypes[key]},bind:object=>({get value(){return object.values[key];},set value(v){object.values[key]=v;}})}),
    methods:signatures[name].map(([method,args,isStatic,returns])=>({name:method,isStatic,isGeneric:false,returnType:{name:returns},virtualAddress:name+'.'+method,
      parameters:args.map(arg=>({type:{name:arg}})),invoke:statics[method]}))});
  return types.get(name);
}
const cleanups=[],logs=[],hooks=new Map(),attached=new Map();
const context=vm.createContext({setTimeout,clearTimeout,
  PgqlGameGifts:class {type(name){return type(name);}async initialize(){}async main(fn){return fn();}},
  Il2Cpp:{get application(){return {version};},Object:class {constructor(handle){return byPointer.get(handle.id);}}},
  Interceptor:{attach:(address,callbacks)=>{attached.set(address,callbacks);return {detach:()=>attached.delete(address)};}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/game-version.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-map-refresh.js'),'utf8'),context);
const Refresh=context.PgqlGameMapRefresh;
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details}),hook:(address,callbacks)=>hooks.set(address,callbacks)};
const plain=value=>JSON.parse(JSON.stringify(value));
const timers=()=>[throttleValues.minIntervalS,throttleValues.maxIntervalS,throttleValues.minDistanceM];
const settingsTimers=()=>[proto.values.GetMapObjectsMinRefreshSeconds,proto.values.GetMapObjectsMaxRefreshSeconds,proto.values.GetMapObjectsMinDistanceMeters];
(async()=>{
  // Other versions and a missing map change nothing.
  version='0.434.0';
  await assert.rejects(new Refresh({...ctx,cleanup:()=>{}}).start(),/supports game 0\.433\.0/);
  version='0.433.0';mapLoaded=false;
  await assert.rejects(new Refresh({...ctx,cleanup:()=>{}}).start(),/Load the game map/);
  mapLoaded=true;assert.deepEqual(timers(),[10,30,10]);assert.deepEqual(settingsTimers(),[10,30,10]);
  assert.equal(hooks.size,0);

  const refresh=new Refresh(ctx);
  assert.deepEqual(plain(await refresh.start()),{original:{min:10,max:30,distance:10},applied:{min:3,max:5,distance:10}});
  assert.deepEqual(timers(),[3,5,10]);assert.deepEqual(settingsTimers(),[3,5,10]);
  // It only ever shortens: values the server already set lower are kept.
  assert.deepEqual(plain(refresh.faster({min:1,max:4,distance:5})),{min:1,max:4,distance:5});

  // A settings download merges onto the server's values and is shortened again.
  const merge=hooks.get('Holoholo.Rpc.MapSettingsProto.MergeFrom');
  const frame={};merge.onEnter.call(frame,[proto.handle]);
  assert.deepEqual(settingsTimers(),[10,30,10],'the merge sees the original values');
  proto.values.GetMapObjectsMaxRefreshSeconds=20;throttleValues.maxIntervalS=20;
  merge.onLeave.call(frame);await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(plain(refresh.status()),{original:{min:10,max:20,distance:10},applied:{min:3,max:5,distance:10}});
  assert.deepEqual(settingsTimers(),[3,5,10]);assert.deepEqual(timers(),[3,5,10]);
  // An unrelated or empty message is ignored.
  const other=managed({GetMapObjectsMinRefreshSeconds:0,GetMapObjectsMaxRefreshSeconds:0,GetMapObjectsMinDistanceMeters:0});
  const frame2={};merge.onEnter.call(frame2,[other.handle]);merge.onLeave.call(frame2);
  assert.deepEqual(other.values,{GetMapObjectsMinRefreshSeconds:0,GetMapObjectsMaxRefreshSeconds:0,GetMapObjectsMinDistanceMeters:0});
  assert.equal(refresh.status().original.max,20);

  // Disable restores the server's latest values on the next game frame.
  cleanups.forEach(fn=>fn());
  assert.deepEqual(timers(),[3,5,10]);
  attached.get('UnityEngine.UnitySynchronizationContext.ExecuteTasks').onLeave();
  assert.deepEqual(timers(),[10,20,10]);assert.deepEqual(settingsTimers(),[10,20,10]);assert.equal(attached.size,0);
  const late={};merge.onEnter.call(late,[proto.handle]);merge.onLeave.call(late);
  assert.deepEqual(settingsTimers(),[10,20,10],'the hook is inert after disable');
  console.log('Map refresh version gate, shortening, settings merge, and restore tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
