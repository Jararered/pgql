const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const replacements=new Map(),attachments=new Map(),events=[];
let uid=0;const objects=new Map();
const pointer=id=>({id,toString(){return String(id);},equals(p){return id===p.id;},isNull(){return id===0;}});
const nil={handle:pointer(0),isNull:()=>true};
const managed=fields=>{const o={handle:pointer(++uid),isNull:()=>false,fields};objects.set(o.handle.id,o);return o};
function klass(name){return {name,fullName:name,type:{name},methods:[],fields:[],isAssignableFrom:()=>true,hierarchy(){return [this]},alloc(){return managed({})}};}
function method(type,name,count,returns,implementation=()=>{},params=[]) {
 const m={name,parameterCount:count,returnType:{name:returns},parameters:params.map(type=>({type:{name:type}})),virtualAddress:pointer(++uid),
  wrap:f=>f,bind:object=>({invoke:(...args)=>implementation(object,...args)}),invoke:(...args)=>implementation(null,...args)};
 type.methods.push(m);return m;
}
function field(type,name,valueType){const f={name,isStatic:false,type:valueType,bind:object=>({get value(){return object.fields[name]??nil},set value(value){object.fields[name]=value}})};type.fields.push(f);return f;}
const context=vm.createContext({
 Interceptor:{replace:(address,fn)=>{assert(!replacements.has(address.id));replacements.set(address.id,fn)},revert:address=>replacements.delete(address.id),flush(){},attach:(address,callbacks)=>{attachments.set(address.id,callbacks);return {detach:()=>attachments.delete(address.id)}}},
 Il2Cpp:{Object:function(handle){return objects.get(handle.id)||nil},delegate:(type,fn)=>Object.assign(managed({}),{callback:fn})},
 setTimeout:fn=>fn(),Qol:{disable:()=>events.push('disabled')}
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../agent/core/game-version.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../agent/adapters/game-encounters.js'),'utf8'),context);
const Adapter=context.PgqlGameEncounters;
function fixture() {
 const adapter=Object.create(Adapter.prototype),types=new Map(),calls=[];
 Object.assign(adapter,{ctx:{log:(...args)=>calls.push(args)},scheduler:{handleFree(){},main(fn){fn();return {catch(){return {finally:finish=>{finish();return Promise.resolve()}}}}}},closed:false,failed:false,undo:[],pins:new Set(),callbacks:[],feature:'perfect-throw'});
 adapter.type=name=>{if(!types.has(name))throw Error('Missing '+name);return types.get(name)};
 adapter.pin=object=>{if(object.isNull())return null;adapter.pins.add(object);return object};
 adapter.object=object=>object||nil;adapter.release=object=>adapter.pins.delete(object);adapter.unwrap=object=>object;
 const add=name=>{const c=klass(name);types.set(name,c);return c};
 const pokemon=add('Niantic.Holoholo.Encounter.EncounterPokemon');
 const actions=method(pokemon,'SetCanPerformActions',1,'System.Void',(o,enabled)=>{o.enabled=enabled},['System.Boolean']);
 const invulnerable=method(pokemon,'get_Invulnerable',0,'System.Boolean',()=>true);
 const reticle=add('Niantic.Holoholo.Encounter.Reticle');
 const normalized=method(reticle,'get_NormalizedSize',0,'System.Single',()=>0.9);
 const bullseye=method(reticle,'ScreenPositionOverBullseye',1,'System.Boolean',()=>false,['UnityEngine.Vector2']);
 const ball=add('Niantic.Holoholo.Encounter.Pokeball');
 const initialize=method(ball,'Initialize',0,'System.Void',o=>{o.initialized=true});
 const activate=method(ball,'SetActive',1,'System.Void',(o,active)=>{o.active=active},['System.Boolean']);
 const launch=method(ball,'Launch',0,'System.Void');
 field(ball,'HitGround',{name:'System.Action',class:{}});field(ball,'HitKillZone',{name:'System.Action',class:{}});
 const state=add('Niantic.Holoholo.Encounter.EncounterState');field(state,'<RaidBallCount>k__BackingField',{name:'System.Int32'});method(state,'EncounterStateComplete',1,'System.Void',()=>{},['System.Int32']);
 field(ball,'encounterState',{name:'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>',class:state});
 const request=add('CatchPokemonProto'),ar=add('ARPlusEncounterValuesProto');
 const calculate=method(request,'CalculateSize',0,'System.Int32',o=>{o.sized=o.fields.SpinModifier;return 23});
 field(request,'SpinModifier',{name:'System.Single'});
 method(request,'get_ArPlusValues',0,'ARPlusEncounterValuesProto',o=>o.fields.ArPlusValues||nil);
 field(request,'ArPlusValues',{name:'ARPlusEncounterValuesProto'});
 method(ar,'.ctor',0,'System.Void');
 for(const key of ['Proximity','Awareness','PokemonFrightened'])field(ar,key,{name:key==='PokemonFrightened'?'System.Boolean':'System.Single'});
 return {adapter,types,calls,actions,invulnerable,normalized,bullseye,initialize,activate,launch,calculate};
}
function call(m,o,...args){return replacements.has(m.virtualAddress.id)?replacements.get(m.virtualAddress.id).call(o,...args):m.bind(o).invoke(...args)}
{
 const f=fixture();f.adapter.perfectThrow();
 const p=managed({});call(f.actions,p,true);assert.equal(p.enabled,false);
 assert.equal(call(f.invulnerable,p),false);assert.equal(call(f.normalized,p),0.05);assert.equal(call(f.bullseye,p),true);
 const originalGround=managed({}),originalKill=managed({});
 const state=managed({'<RaidBallCount>k__BackingField':5});
 const ball=managed({HitGround:originalGround,HitKillZone:originalKill,encounterState:state});
 call(f.initialize,ball);assert(ball.initialized);assert.equal(ball.fields.HitGround,ball.fields.HitKillZone);
 ball.fields.HitGround.callback();ball.fields.HitKillZone.callback();
 assert.equal(state.fields['<RaidBallCount>k__BackingField'],6);assert(ball.active);
 attachments.get(f.launch.virtualAddress.id).onEnter([ball.handle]);ball.fields.HitGround.callback();
 assert.equal(state.fields['<RaidBallCount>k__BackingField'],7);
 const staleRecovery=ball.fields.HitGround;call(f.initialize,ball);staleRecovery.callback();
 assert.equal(state.fields['<RaidBallCount>k__BackingField'],7);
 const request=managed({});assert.equal(call(f.calculate,request),23);assert.equal(request.sized,1);
 assert.equal(request.fields.ArPlusValues.fields.Proximity,0.475);assert.equal(request.fields.ArPlusValues.fields.Awareness,0);
 assert.equal(request.fields.ArPlusValues.fields.PokemonFrightened,false);
 const values=request.fields.ArPlusValues;call(f.calculate,request);assert.equal(request.fields.ArPlusValues,values);
 // Disabling restores saved delegates; regular methods use their originals.
 f.adapter.dispose();assert.equal(p.enabled,true);assert.equal(ball.fields.HitGround,originalGround);assert.equal(ball.fields.HitKillZone,originalKill);
 assert.equal(f.adapter.pins.size,0);assert.equal(replacements.size,0);assert.equal(attachments.size,0);
 call(f.actions,p,true);assert.equal(p.enabled,true);assert.equal(call(f.invulnerable,p),true);
}
{
 // Validate every required method before installing any feature hook.
 const f=fixture();f.types.get('Niantic.Holoholo.Encounter.Pokeball').methods=f.types.get('Niantic.Holoholo.Encounter.Pokeball').methods.filter(m=>m.name!=='Launch');
 assert.throws(()=>f.adapter.perfectThrow(),/Unsupported encounter method/);assert.equal(replacements.size,0);
}
{
 // Respect a newer owner of a delegate field during cleanup.
 const f=fixture();f.adapter.perfectThrow();const ball=managed({HitGround:nil,HitKillZone:nil,encounterState:managed({'<RaidBallCount>k__BackingField':0})});
 call(f.initialize,ball);ball.fields.HitGround.callback();assert.equal(ball.fields.encounterState.fields['<RaidBallCount>k__BackingField'],0);
 const other=managed({});ball.fields.HitGround=other;f.adapter.dispose();assert.equal(ball.fields.HitGround,other);
}
{
 const f=fixture(),a=f.adapter,frames=[];a.scheduler.main=fn=>{frames.push(fn);return Promise.resolve()};
 const interaction=klass('Niantic.Holoholo.Encounter.EncounterInteractionState');f.types.set(interaction.name,interaction);
 const intro=method(interaction,'IntroCompleted',0,'System.Void');field(interaction,'encounterState',{name:'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>'});
 const stateClass=f.types.get('Niantic.Holoholo.Encounter.EncounterState');stateClass.methods=[];let exits=0;
 const complete=method(stateClass,'EncounterStateComplete',1,'System.Void',()=>{exits++},['System.Int32']);complete.parameters[0].type.class={isEnum:false};
 const output=klass('CatchPokemonOutProto');f.types.set(output.name,output);
 field(output,'status',{name:'System.Int32'});
 const parse=method(output,'IMergeFrom',1,'System.Void',()=>{},['Google.Protobuf.ParseContext&']);
 a.instantCatch();const state=managed({}),active=managed({encounterState:state});
 call(intro,active);call(parse,managed({status:2}),{});assert.equal(frames.length,0);
 call(parse,managed({status:1}),{});call(parse,managed({status:1}),{});assert.equal(frames.length,1);assert.equal(exits,0);
 frames.shift()();assert.equal(exits,1);
 call(intro,active);call(parse,managed({status:1}),{});call(intro,managed({encounterState:managed({})}));frames.shift()();assert.equal(exits,1);
 call(parse,managed({status:1}),{});attachments.get(complete.virtualAddress.id).onEnter([a.object([...a.pins][0]).handle]);frames.shift()();assert.equal(exits,1);
 a.dispose();assert.equal(replacements.size,0);assert.equal(attachments.size,0);
}
{
 const f=fixture(),a=f.adapter,ball=f.types.get('Niantic.Holoholo.Encounter.Pokeball');
 const pokemon=f.types.get('Niantic.Holoholo.Encounter.EncounterPokemon'),reticle=f.types.get('Niantic.Holoholo.Encounter.Reticle');
 field(ball,'pokemon',{name:'Niantic.Holoholo.Encounter.IEncounterPokemon',class:pokemon});field(ball,'reticle',{name:'Niantic.Holoholo.Encounter.IReticle',class:reticle});field(ball,'<BallType>k__BackingField',{});
 const transform=klass('Transform'),go=klass('GameObject'),collider=klass('UnityEngine.Collider'),vector=klass('UnityEngine.Vector3'),collisionClass=klass('Collision'),pairClass=klass('Pair');
 f.types.set(collider.name,collider);f.types.set(vector.name,vector);
 const ballTransform=method(ball,'get_Transform',0,'Transform',o=>o.fields.transform);ballTransform.returnType.class=transform;
 method(reticle,'get_Transform',0,'Transform',o=>o.fields.transform);
 method(pokemon,'set_Invulnerable',1,'System.Void',(o,v)=>o.fields.invulnerable=v);
 const gameObject=method(pokemon,'get_GameObject',0,'GameObject',o=>o.fields.go);gameObject.returnType.class=go;
 method(go,'GetComponentInChildren',1,'Collider',o=>o.fields.collider,['System.Type']);
 method(collider,'GetEntityId',0,'System.Int32',()=>42);
 const collision=method(ball,'OnCollisionEnter',1,'System.Void',()=>{},['Collision']);collision.parameters[0].type.class=collisionClass;
 field(collisionClass,'m_Pair',{class:pairClass});field(pairClass,'m_OtherColliderID',{name:'System.Int32'});
 method(transform,'get_position',0,'Vector3',o=>o.fields.position);
 method(transform,'set_position',1,'System.Void',(o,v)=>o.fields.position=v);
 method(vector,'Lerp',3,'Vector3',(_,from,to,t)=>from+(to-from)*t);
 a.headshot();const target=managed({go:managed({collider:managed({})})}),position=managed({position:0});
 const ballObject=managed({pokemon:target,reticle:managed({transform:managed({position:10})}),transform:position,'<BallType>k__BackingField':1});
 attachments.get(f.launch.virtualAddress.id).onEnter([ballObject.handle]);assert.equal(position.fields.position,9);assert.equal(target.fields.invulnerable,false);
 const pair=managed({m_OtherColliderID:7,otherData:99}),hit=managed({m_Pair:pair});call(collision,ballObject,hit);
 assert.equal(pair.fields.m_OtherColliderID,42);assert.equal(pair.fields.otherData,99);
 ballObject.fields['<BallType>k__BackingField']=4;position.fields.position=0;attachments.get(f.launch.virtualAddress.id).onEnter([ballObject.handle]);assert.equal(position.fields.position,0);
 a.dispose();assert.equal(replacements.size,0);assert.equal(attachments.size,0);
}
{
 // Skip Encounter Intro zeroes the camera intro, except for raid/Rocket encounters, and restores it.
 const f=fixture(),a=f.adapter;
 const interaction=klass('Niantic.Holoholo.Encounter.EncounterInteractionState');f.types.set(interaction.name,interaction);
 const enter=method(interaction,'EnterState',0,'System.Void',o=>{o.entered=(o.entered||0)+1});
 const camera=klass('Niantic.Holoholo.Encounter.EncounterParkCameraController');
 field(camera,'tweenDurationSeconds',{name:'System.Single'});field(camera,'introDurationSeconds',{name:'System.Single'});
 field(interaction,'encounterState',{name:'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>'});field(interaction,'parkCameraController',{name:camera.name,class:camera});
 const stateClass=f.types.get('Niantic.Holoholo.Encounter.EncounterState');field(stateClass,'<IsRaidOrIncidentEncounter>k__BackingField',{name:'System.Boolean'});
 a.skipIntro();
 const park=managed({tweenDurationSeconds:0.5,introDurationSeconds:0.2}),state=managed({'<IsRaidOrIncidentEncounter>k__BackingField':false});
 const active=managed({encounterState:state,parkCameraController:park});
 const timings=()=>[park.fields.tweenDurationSeconds,park.fields.introDurationSeconds];
 call(enter,active);assert.equal(active.entered,1,'the game still enters its state');assert.deepEqual(timings(),[0,0]);
 state.fields['<IsRaidOrIncidentEncounter>k__BackingField']=true;call(enter,active);assert.deepEqual(timings(),[0.5,0.2]);
 state.fields['<IsRaidOrIncidentEncounter>k__BackingField']=false;call(enter,active);assert.deepEqual(timings(),[0,0]);
 call(enter,managed({encounterState:state}));assert.equal(f.calls.some(c=>/failed/.test(c[0])),false,'a missing camera is ignored');
 a.dispose();assert.deepEqual(timings(),[0.5,0.2]);assert.equal(a.pins.size,0);assert.equal(replacements.size,0);
 call(enter,active);assert.deepEqual(timings(),[0.5,0.2]);
}
{
 // A changed camera contract installs nothing.
 const f=fixture(),a=f.adapter;
 const interaction=klass('Niantic.Holoholo.Encounter.EncounterInteractionState');f.types.set(interaction.name,interaction);
 method(interaction,'EnterState',0,'System.Void');field(interaction,'encounterState',{name:'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>'});
 field(interaction,'parkCameraController',{name:'SomethingElse',class:klass('SomethingElse')});
 assert.throws(()=>a.skipIntro(),/Unsupported encounter field/);assert.equal(replacements.size,0);
}
{
 // Typed fields must be unique; a second field of the same type is ambiguous.
 const f=fixture(),a=f.adapter,lazy='Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>';
 const interaction=klass('Niantic.Holoholo.Encounter.EncounterInteractionState');
 field(interaction,'drqd',{name:lazy});assert.equal(a.typedField(interaction,lazy).name,'drqd');
 field(interaction,'other',{name:lazy});
 assert.throws(()=>a.typedField(interaction,lazy),/Unsupported encounter field/);
 assert.throws(()=>a.typedField(interaction,'Missing.Type'),/Unsupported encounter field/);
}
{
 // Contract audit: the feature's members are all resolved, nothing is installed.
 const f=fixture(),replaced=replacements.size,attached=attachments.size;
 f.adapter.audit('perfect-throw');
 assert.equal(replacements.size,replaced);assert.equal(attachments.size,attached);
 assert.equal(f.adapter.restoreActions,null);
 f.types.delete('CatchPokemonProto');
 assert.throws(()=>f.adapter.audit('perfect-throw'),/Missing CatchPokemonProto/);
 assert.throws(()=>f.adapter.audit('unknown'),/Unknown encounter feature/);
 assert.equal(replacements.size,replaced);
}
console.log('Encounter adapter catch sequencing, throw overrides, recovery, collision targeting, intro skipping, cleanup and contract validation tests passed.');
