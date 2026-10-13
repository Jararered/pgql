const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0;const byPointer=new Map();
const calls=fn=>({invoke:fn,overload:()=>({invoke:fn})});
const NULL_OBJECT={isNull:()=>true,handle:{id:0,toString:()=>'0'}};
function managed(values,methods={},valid=true) {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,isNull:()=>false,
    method:name=>calls(name==='get_gameObject'?()=>({method:()=>calls(()=>({method:()=>calls(()=>valid)}))}):methods[name])};
  byPointer.set(id,self);return self;
}
const label=text=>{const state={text};return Object.assign(managed(state,{get_text:()=>({content:state.text}),set_text:v=>{state.text=v.content;}}),{state});};
const pokemon=(a,d,s,egg=false)=>managed({individualAttack_:a,individualDefense_:d,individualStamina_:s,isEgg_:egg});
const cellOf=(name,valid=true)=>managed({nameText:label(name)},{},valid);
const M=(name,args=[],isStatic=false)=>[name,args,isStatic];
const initializer={type:{name:'Niantic.Holoholo.UI.PokemonInventoryCellView.Initializer'},
  field:key=>({type:{name:fieldTypes[key]},bind:object=>({get value(){return object.values[key];}})})};
const signatures={
  'Niantic.Holoholo.UI.PokemonInventoryCellView':[M('Initialize',['Niantic.Holoholo.UI.PokemonInventoryCellView.Initializer'])],
  'Holoholo.Rpc.PokemonProto':[],'UnityEngine.UI.Text':[M('get_text'),M('set_text',['System.String'])],
  'UnityEngine.GameObject':[M('get_scene')],'UnityEngine.Component':[M('get_gameObject')],'UnityEngine.SceneManagement.Scene':[M('IsValid')],
  'UnityEngine.UnitySynchronizationContext':[M('ExecuteTasks',[],true)],'UnityEngine.Resources':[M('FindObjectsOfTypeAll',['System.Type'],true)],
};
const fieldTypes={nameText:'UnityEngine.UI.Text',PokemonProto:'Holoholo.Rpc.PokemonProto',individualAttack_:'System.Int32',individualDefense_:'System.Int32',
  individualStamina_:'System.Int32',isEgg_:'System.Boolean'};
let cells=[],version='0.431.0';
const types=new Map();
function type(name) {
  if(!signatures[name])throw Error('Unsupported game metadata: '+name);
  if(!types.has(name))types.set(name,{type:{name,object:{name}},
    field:key=>({type:{name:fieldTypes[key]},bind:object=>({get value(){return object.values[key];}})}),
    methods:signatures[name].map(([method,args,isStatic])=>({name:method,isStatic,isGeneric:false,virtualAddress:name+'.'+method,
      parameters:args.map(arg=>({type:{name:arg,class:initializer}})),invoke:()=>({length:cells.length,get:i=>cells[i]})}))});
  return types.get(name);
}
const cleanups=[],logs=[],hooks=new Map(),attached=new Map();
const context=vm.createContext({setTimeout,clearTimeout,
  PgqlGameGifts:class {type(name){return type(name);}async initialize(){}async main(fn){return fn();}},
  Il2Cpp:{get application(){return {version};},string:content=>({content}),Object:class {constructor(handle){return byPointer.get(handle.id)||NULL_OBJECT;}}},
  Interceptor:{attach:(address,callbacks)=>{attached.set(address,callbacks);return {detach:()=>attached.delete(address)};}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-inventory-ivs.js'),'utf8'),context);
const Ivs=context.PgqlGameInventoryIvs;
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details}),hook:(address,callbacks)=>hooks.set(address,callbacks)};
(async()=>{
  assert.equal(Ivs.text(15,14,0),'15/14/0');
  for(const bad of [[16,0,0],[-1,0,0],[1.5,0,0],[undefined,0,0]])assert.equal(Ivs.text(...bad),null);

  version='0.432.0';
  await assert.rejects(new Ivs({...ctx,cleanup:()=>{}}).start(),/support game 0\.431\.0/);
  version='0.431.0';assert.equal(hooks.size,0);
  fieldTypes.nameText='TMPro.TMP_Text';
  await assert.rejects(new Ivs({...ctx,cleanup:()=>{}}).start(),/Unsupported inventory field: nameText/);
  fieldTypes.nameText='UnityEngine.UI.Text';assert.equal(hooks.size,0,'a changed contract installs nothing');

  const ivs=new Ivs(ctx);
  assert.equal(await ivs.start(),true);
  const hook=hooks.get('Niantic.Holoholo.UI.PokemonInventoryCellView.Initialize');
  const fill=(cell,name,data)=>{cell.values.nameText.state.text=name;const frame={};hook.onEnter.call(frame,[cell.handle,data.handle]);hook.onLeave.call(frame);};
  const a=cellOf(''),b=cellOf(''),egg=cellOf(''),prefab=cellOf('',false);cells=[prefab,a,b,egg];
  fill(a,'Glameow',managed({PokemonProto:pokemon(15,14,6)}));
  fill(b,'Buddy',managed({PokemonProto:pokemon(0,12,3)}));
  fill(egg,'Egg',managed({PokemonProto:pokemon(0,0,0,true)}));
  assert.equal(a.values.nameText.state.text,'15/14/6');assert.equal(b.values.nameText.state.text,'0/12/3');
  assert.equal(egg.values.nameText.state.text,'Egg','eggs keep their label');
  // A pooled cell reused for another Pokemon, an empty slot or odd data.
  fill(a,'Natu',managed({PokemonProto:pokemon(6,3,10)}));assert.equal(a.values.nameText.state.text,'6/3/10');
  fill(b,'',managed({PokemonProto:NULL_OBJECT}));assert.equal(b.values.nameText.state.text,'');
  fill(b,'Odd',managed({PokemonProto:pokemon(99,0,0)}));assert.equal(b.values.nameText.state.text,'Odd');
  assert.equal(logs.some(entry=>/failed/.test(entry.message)),false);

  // Disable puts the game's names back on the next game frame.
  fill(b,'Buddy',managed({PokemonProto:pokemon(0,12,3)}));
  cleanups.forEach(fn=>fn());
  assert.equal(a.values.nameText.state.text,'6/3/10');
  attached.get('UnityEngine.UnitySynchronizationContext.ExecuteTasks').onLeave();
  assert.equal(a.values.nameText.state.text,'Natu');assert.equal(b.values.nameText.state.text,'Buddy');
  assert.equal(logs.at(-1).details.cells,2);assert.equal(attached.size,0);
  fill(a,'Late',managed({PokemonProto:pokemon(1,1,1)}));assert.equal(a.values.nameText.state.text,'Late','the hook is inert after disable');

  // One failing label stops further changes instead of repeating the error.
  const second=new Ivs({...ctx,cleanup:()=>{}});await second.start();
  const broken=hooks.get('Niantic.Holoholo.UI.PokemonInventoryCellView.Initialize');
  const bad=managed({nameText:managed({},{get_text:()=>{throw Error('gone');}})}),frame={};
  broken.onEnter.call(frame,[bad.handle,managed({PokemonProto:pokemon(1,2,3)}).handle]);broken.onLeave.call(frame);
  assert.equal(second.failed,true);assert.match(logs.at(-1).message,/leaving names unchanged/);
  const c=cellOf('Keep'),frame2={};broken.onEnter.call(frame2,[c.handle,managed({PokemonProto:pokemon(1,2,3)}).handle]);broken.onLeave.call(frame2);
  assert.equal(c.values.nameText.state.text,'Keep');
  console.log('Inventory IV formatting, version gate, relabeling, pooled cells, restore and failure handling tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
