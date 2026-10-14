const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0;const byPointer=new Map();
const calls=fn=>({invoke:fn,overload:()=>({invoke:fn})});
const NULL_OBJECT={isNull:()=>true};
const sceneCheck=valid=>()=>({method:()=>calls(()=>({method:()=>calls(()=>valid)}))});
function managed(values,methods={},valid=true) {
  const self={handle:{id:++serial},values,isNull:()=>false,method:name=>calls(name==='get_gameObject'?sceneCheck(valid):methods[name]),
    field:name=>({get value(){return values[name];}})};
  byPointer.set(self.handle.id,self);return self;
}
const renderer=enabled=>{const state={enabled};return Object.assign(managed(state,{get_enabled:()=>state.enabled,set_enabled:v=>{state.enabled=v;}}),{state});};
const list=items=>({isNull:()=>false,length:items.length,get:i=>items[i]});
const weatherState={display:true};
const weather=managed(weatherState,{get_DisplayWeatherEffects:()=>weatherState.display,set_DisplayWeatherEffects:v=>{weatherState.display=v;}});
const clouds=[renderer(true),renderer(false),renderer(true)];
const skydome=managed({cloudRenderers:list(clouds)});
const tile=()=>managed({roadMeshRenderer:renderer(true),roadOutlinesMeshRenderer:renderer(true)});
const tiles=[tile(),tile()],prefabTile=managed({roadMeshRenderer:renderer(true),roadOutlinesMeshRenderer:NULL_OBJECT},{},false);
const quality={level:0,names:['Ultra High','High','Standard']},renderState={scale:1};
const renderService=managed(renderState,{get_CurrentResolutionScale:()=>renderState.scale,ApplyResolutionScale:v=>{renderState.scale=v;}});
const scene=managed({}, {get_Container:()=>({method:()=>calls(()=>renderService)})});
let version='0.433.0',skyLoaded=true;
const M=(name,args=[],isStatic=false)=>[name,args,isStatic];
const signatures={
  'Niantic.Holoholo.Map.WeatherService':[M('get_DisplayWeatherEffects'),M('set_DisplayWeatherEffects',['System.Boolean'])],
  'Niantic.Holoholo.Map.Skydome':[],'Niantic.Holoholo.MapSceneContext':[],
  'Niantic.Holoholo.Map.GameMapTile':[M('Initialize',['Niantic.Lightship.Maps.Core.IMapTile'])],
  'UnityEngine.QualitySettings':[M('GetQualityLevel',[],true),M('SetQualityLevel',['System.Int32','System.Boolean'],true),M('SetQualityLevel',['System.Int32'],true),M('get_names',[],true)],
  'Niantic.Holoholo.Performance.Rendering.IRenderQualityService':[M('ApplyResolutionScale',['System.Single']),M('get_CurrentResolutionScale')],
  'UnityEngine.Renderer':[M('get_enabled'),M('set_enabled',['System.Boolean'])],
  'UnityEngine.GameObject':[M('get_scene')],'UnityEngine.Component':[M('get_gameObject')],'UnityEngine.SceneManagement.Scene':[M('IsValid')],
  'Zenject.DiContainer':[M('Resolve',['System.Type'])],'Zenject.Context':[M('get_Container')],
  'UnityEngine.UnitySynchronizationContext':[M('ExecuteTasks',[],true)],'UnityEngine.Resources':[M('FindObjectsOfTypeAll',['System.Type'],true)],
  'UnityEngine.Object':[M('FindObjectOfType',['System.Type'],true)],
};
const fieldTypes={cloudRenderers:'UnityEngine.MeshRenderer[]',roadMeshRenderer:'UnityEngine.MeshRenderer',roadOutlinesMeshRenderer:'UnityEngine.MeshRenderer'};
const statics={
  FindObjectsOfTypeAll:type=>{
    const all=type.name.endsWith('WeatherService')?[weather]:type.name.endsWith('Skydome')?(skyLoaded?[skydome]:[]):[prefabTile,...tiles];
    return {length:all.length,get:i=>all[i]};
  },
  FindObjectOfType:()=>scene,GetQualityLevel:()=>quality.level,SetQualityLevel:(level,expensive)=>{assert.equal(expensive,true);quality.level=level;},
  get_names:()=>quality.names,
};
const types=new Map();
function type(name) {
  if(!signatures[name])throw Error('Unsupported game metadata: '+name);
  if(!types.has(name))types.set(name,{type:{name,object:{name}},field:key=>({type:{name:fieldTypes[key]}}),
    methods:signatures[name].map(([method,args,isStatic])=>({name:method,isStatic,isGeneric:false,virtualAddress:name+'.'+method,
      parameters:args.map(arg=>({type:{name:arg}})),invoke:statics[method]}))});
  return types.get(name);
}
const cleanups=[],logs=[],attached=new Map();
const context=vm.createContext({setTimeout,clearTimeout,
  PgqlGameGifts:class {type(name){return type(name);}async initialize(){}async main(fn){return fn();}},
  Il2Cpp:{get application(){return {version};},Object:class {constructor(handle){return byPointer.get(handle.id);}}},
  Interceptor:{attach:(address,callbacks)=>{attached.set(address,callbacks);return {detach:()=>attached.delete(address)};}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/game-version.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-performance.js'),'utf8'),context);
const Performance=context.PgqlGamePerformance;
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details})};
const plain=value=>JSON.parse(JSON.stringify(value));
const cloudStates=()=>clouds.map(cloud=>cloud.state.enabled);
const roadStates=()=>tiles.map(t=>[t.values.roadMeshRenderer.state.enabled,t.values.roadOutlinesMeshRenderer.state.enabled]);
(async()=>{
  version='0.434.0';
  await assert.rejects(new Performance({...ctx,cleanup:()=>{}}).apply({weather:true}),/supports game 0\.433\.0/);
  version='0.433.0';assert.equal(weatherState.display,true);

  const mode=new Performance(ctx);
  assert.deepEqual(plain(await mode.apply({weather:true,sky:true,quality:true,roads:false})),{weather:'on',sky:'on',quality:'on',roads:'off'});
  assert.equal(weatherState.display,false);assert.deepEqual(cloudStates(),[false,false,false]);
  assert.equal(quality.level,2);assert.ok(Math.abs(renderState.scale-0.7)<1e-9);
  assert.deepEqual(roadStates(),[[true,true],[true,true]]);assert.equal(attached.size,0);

  // The game switching an effect back on is corrected by the next apply,
  // without stacking the resolution scale.
  weatherState.display=true;clouds[0].state.enabled=true;
  await mode.apply({weather:true,sky:true,quality:true,roads:false});
  assert.equal(weatherState.display,false);assert.equal(clouds[0].state.enabled,false);assert.ok(Math.abs(renderState.scale-0.7)<1e-9);

  // Turning one reduction off restores exactly what it changed.
  await mode.apply({weather:true,sky:false,quality:true,roads:false});
  assert.deepEqual(cloudStates(),[true,false,true],'a cloud layer that was already off stays off');
  assert.equal(weatherState.display,false);

  // Roads: live tiles and every tile the game builds afterwards.
  assert.equal((await mode.apply({weather:true,sky:false,quality:true,roads:true})).roads,'on');
  assert.deepEqual(roadStates(),[[false,false],[false,false]]);
  assert.equal(prefabTile.values.roadMeshRenderer.state.enabled,true,'prefab assets are left alone');
  const hook=attached.get('Niantic.Holoholo.Map.GameMapTile.Initialize');
  const fresh=tile();tiles.push(fresh);const frame={};hook.onEnter.call(frame,[fresh.handle]);hook.onLeave.call(frame);
  assert.deepEqual(roadStates()[2],[false,false]);
  await mode.apply({weather:true,sky:false,quality:true,roads:false});
  assert.deepEqual(roadStates(),[[true,true],[true,true],[true,true]]);assert.equal(attached.size,0);

  // One reduction failing does not block the others.
  skyLoaded=false;
  const partial=plain(await mode.apply({weather:true,sky:true,quality:true,roads:true}));
  assert.match(partial.sky,/^unavailable: .*Sky dome/);assert.equal(partial.roads,'on');assert.equal(partial.weather,'on');
  skyLoaded=true;
  assert.equal((await mode.apply({weather:true,sky:true,quality:true,roads:true})).sky,'on');

  // Disable restores everything on the next game frame.
  cleanups.forEach(fn=>fn());
  assert.equal(attached.has('Niantic.Holoholo.Map.GameMapTile.Initialize'),false,'the tile hook is removed immediately');
  assert.equal(weatherState.display,false);
  attached.get('UnityEngine.UnitySynchronizationContext.ExecuteTasks').onLeave();
  assert.equal(weatherState.display,true);assert.deepEqual(cloudStates(),[true,false,true]);
  assert.equal(quality.level,0);assert.equal(renderState.scale,1);
  assert.deepEqual(roadStates(),[[true,true],[true,true],[true,true]]);assert.equal(attached.size,0);
  await assert.rejects(mode.apply({weather:true}),/Module disabled/);
  console.log('Performance Mode version gate, independent reductions, re-assertion, partial failure and restore tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
