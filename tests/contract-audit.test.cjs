const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Contract audit: binds every adapter on an unverified build without hooks,
// records the classes and members each one resolved, and leaves the strict
// version gate in place for everything else.
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const hooks=new Map(),attaches=[];
let version='0.435.0',packageVersion='0.435.0',holoholo=true;
class Method {constructor(klass,name,params=[],returns='System.Void'){Object.assign(this,{class:klass,name,isStatic:false,parameters:params.map(name=>({type:{name}})),returnType:{name:returns}});}}
class Field {constructor(klass,name,type){Object.assign(this,{class:klass,name,isStatic:false,type:{name:type}});}}
class Klass {
  constructor(name){this.type={name,object:{name}};this.parent=null;this.fields=[];this.methods=[];}
  method(name){const m=this.methods.find(m=>m.name===name);if(!m)throw Error('No method '+name);return m;}
}
const types={};
const add=(name,fields=[],methods=[])=>{const k=new Klass(name);k.fields=fields.map(([n,t])=>new Field(k,n,t));k.methods=methods.map(([n,p,r])=>new Method(k,n,p,r));types[name]=k;return k;};
add('UnityEngine.UnitySynchronizationContext',[],[['ExecuteTasks',[],'System.Void']]).method('ExecuteTasks').virtualAddress='execute';
add('UnityEngine.Object',[],[['FindObjectOfType',['System.Type'],'UnityEngine.Object']]).methods[0].parameterCount=1;
add('Niantic.Holoholo.MapSceneContext');
add('Niantic.Holoholo.Map.UI.MainMenuGuiController',[['xYzQ','Niantic.Holoholo.UI.UIWidgets.HoloText']],[['CloseMenu',[],'System.Void']]);
add('Niantic.Holoholo.Encounter.Pokeball',[['aBcD','Niantic.Holoholo.Encounter.IReticle']],[['Launch',[],'System.Void']]);
const image={tryClass:name=>types[name]||null,get classes(){return Object.values(types);}};
const context=vm.createContext({
  setTimeout,clearTimeout,setImmediate,
  Process:{
    findModuleByName:name=>name==='libil2cpp.so'?{findExportByName:()=>'il2cpp_get_corlib'}:name==='libholoholo.so'&&holoholo?{}:null,
    getModuleByName:()=>({getExportByName:name=>name}),
  },
  NativeFunction:function(address){return address==='il2cpp_get_corlib'?()=>({isNull:()=>false}):()=>null;},
  Interceptor:{attach:(address,callbacks)=>{attaches.push(address);hooks.set(address,callbacks);return {detach:()=>hooks.delete(address)};}},
  Il2Cpp:{Method,Field,Class:Klass,unityVersion:'6000.3.22f1',get application(){return {version};},domain:{assemblies:[{image}]},perform:async fn=>fn()},
  PgqlPackageVersion:async()=>packageVersion,
});
for(const file of ['core/game-version.js','adapters/game-gifts.js','core/contract-audit.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
// Stand-in adapters with the real ones' constructor and bind() shape.
const bound=[];
vm.runInContext(`
  const adapter=(claim,bind)=>class {
    constructor(ctx){this.ctx=ctx;this.game=new PgqlGameGifts(ctx);}
    bind(){PgqlGameVersion.require(Il2Cpp.application.version,claim+' supports');globalThis.bound.push(claim);return bind.call(this);}
  };
  globalThis.PgqlGameMainMenu=adapter('Main menu',function(){
    const controller=this.game.type('Niantic.Holoholo.Map.UI.MainMenuGuiController');
    return {close:controller.method('CloseMenu'),label:controller.fields[0],nested:[{controller}]};
  });
  for(const name of ['SettingsScreen','MapRefresh','Performance','InventoryIvs','TransferOnCatch','ShinyScanner','TapToTeleport',
    'Cooldown','PinapMaster','TapToCatch','GymFeeder','GymBattle'])globalThis['PgqlGame'+name]=adapter(name,function(){return {};});
  globalThis.PgqlGameRaidPack=adapter('Raid Pack',function(){return {missing:this.game.type('Niantic.Holoholo.Raid.Missing')};});
  globalThis.PgqlGameEncounters=class {
    static get features(){return {headshot:'headshot'};}
    constructor(ctx){this.game=new PgqlGameGifts(ctx);}
    audit(feature){PgqlGameVersion.require(Il2Cpp.application.version,'Encounters');this.game.type('Niantic.Holoholo.Encounter.Pokeball');}
  };
  globalThis.PgqlGameGoPlus=class {
    constructor(ctx){this.ctx=ctx;}
    bindExports(version){PgqlGameVersion.require(version,'GO Plus');this.resolved=['_ZN3pgp5sfida6Module12HandleUpdateEv'];}
  };
`,Object.assign(context,{bound}));
const logs=[];
const ctx={log:(message,details)=>logs.push({message,details}),cleanup:()=>{throw Error('audit must not register module cleanups');}};
(async()=>{
  assert.throws(()=>context.PgqlGameVersion.require(version,'Before'),/Before game 0\.433\.0; found 0\.435\.0/);
  const pending=context.PgqlContractAudit.run(ctx);
  assert.equal(context.PgqlContractAudit.run(ctx),pending,'one audit at a time');
  for(let i=0;i<5 && !hooks.has('execute');i++)await settle();
  assert(hooks.has('execute'),'the frame scheduler observes ExecuteTasks');
  hooks.get('execute').onLeave();
  // The report crosses the runner as JSON.
  const report=JSON.parse(JSON.stringify(await pending));
  assert.deepEqual(attaches,['execute'],'no adapter hook is installed');
  assert.equal(hooks.size,0,'the scheduler hook is removed afterwards');
  assert.equal(report.schema,1);assert.equal(report.game,'0.435.0');assert.equal(report.supported,'0.433.0');assert.equal(report.unity,'6000.3.22f1');
  // Unverified build: every bind ran, the gate is strict again afterwards.
  assert.equal(bound.length,14,'every managed adapter bound');
  assert.throws(()=>context.PgqlGameVersion.require('0.435.0','After'),/After game 0\.433\.0/);
  const menu=report.adapters['main-menu'];
  assert.equal(menu.ok,true);
  assert.deepEqual(menu.classes,['Niantic.Holoholo.Map.UI.MainMenuGuiController']);
  assert.deepEqual(menu.members,['class Niantic.Holoholo.Map.UI.MainMenuGuiController',
    'field Niantic.Holoholo.Map.UI.MainMenuGuiController::xYzQ:Niantic.Holoholo.UI.UIWidgets.HoloText',
    'method Niantic.Holoholo.Map.UI.MainMenuGuiController::CloseMenu():System.Void']);
  assert.equal(report.adapters.headshot.ok,true);
  assert.deepEqual(report.adapters.headshot.classes,['Niantic.Holoholo.Encounter.Pokeball']);
  // A failing adapter is reported with what it could not find; others still run.
  const raid=report.adapters['raid-pack'];
  assert.equal(raid.ok,false);assert.match(raid.error,/Unsupported game metadata: Niantic\.Holoholo\.Raid\.Missing/);
  assert.deepEqual(raid.missing,['Niantic.Holoholo.Raid.Missing']);
  assert.equal(report.ok,false);assert.deepEqual(report.failed,['raid-pack']);
  assert.equal(Object.keys(report.adapters).length,15);
  assert.deepEqual(Object.keys(report.unaudited).sort(),['mass-gift','tamagotchi']);
  // Declared members of every resolved class, for diffing builds.
  assert.deepEqual(report.classes['Niantic.Holoholo.Encounter.Pokeball'],
    {parent:null,fields:['aBcD:Niantic.Holoholo.Encounter.IReticle'],methods:['Launch():System.Void']});
  assert.deepEqual(report.native['virtual-go-plus'],{ok:true,version:'0.435.0',exports:['_ZN3pgp5sfida6Module12HandleUpdateEv']});
  assert(logs.some(entry=>entry.message==='Contract audit finished' && entry.details.failed[0]==='raid-pack'));
  // Recording is scoped to the audit.
  assert.equal(context.PgqlGameGifts.frame.record,null);
  // :pgp companion: no Unity, so only the native contract is audited.
  context.PgqlRole='pgp';holoholo=false;
  const companion=JSON.parse(JSON.stringify(await context.PgqlContractAudit.run(ctx)));
  assert.deepEqual(companion.adapters,{});
  assert.deepEqual(companion.native['virtual-go-plus'],{ok:false,error:'libholoholo.so is not loaded'});
  assert.equal(companion.ok,false);
  console.log('Contract audit unverified-build binding, hook-free run, scoped gate, class recording, failure reporting and companion tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
