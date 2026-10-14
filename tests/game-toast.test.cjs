const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({Math});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-toast.js'),'utf8'),context);
const Toast=context.PgqlGameToast;

// The toast sits at the ceiling, or lower when the safe area leaves out a taller inset.
assert.equal(Toast.position(1731,1731),Toast.ceiling,'game drawn under the status bar: full safe area');
assert.equal(Toast.position(2000,2400).toFixed(4),(2000/2400-0.1).toFixed(4));
assert.equal(Toast.position(0,2400),Toast.ceiling,'unknown safe area');
assert.equal(Toast.position(500,2400),Toast.floor,'never below the middle');

// Metadata: PivotY and the screen getters.
const field=(name,typeName,klass)=>({name,isStatic:false,type:{name:typeName,class:klass}});
const screen={methods:[{name:'get_safeArea',isStatic:true,parameterCount:0,returnType:{name:'UnityEngine.Rect'},invoke:()=>rect},
  {name:'get_height',isStatic:true,parameterCount:0,returnType:{name:'System.Int32'},invoke:()=>2400}]};
const rectType={field:()=>({type:{name:'System.Single'}})};
const types={'UnityEngine.Screen':screen,'UnityEngine.Rect':rectType};
const type=name=>{if(!types[name])throw Error('Unsupported game metadata: '+name);return types[name];};
let rect={field:name=>({value:{m_YMin:0,m_Height:2000}[name]})};
const logs=[],log=(message,details)=>logs.push({message,details});
const params=fields=>({fields});
const pivot=()=>field('PivotY','System.Single');

let bound=Toast.bind(type,params([field('VerticalScreenPosition','System.Nullable<System.Single>'),pivot()]),log);
assert(bound);assert.equal(logs.length,0);
let written=null;
const instance={field:name=>{assert.equal(name,'PivotY');return {set value(v){written=v;}};}};
assert.equal(Toast.place(bound,instance),Toast.position(2000,2400));assert.equal(written,Toast.position(2000,2400));

// Not this game's field: toasts stay centred.
assert.equal(Toast.bind(type,params([field('VerticalScreenPosition','System.Nullable<System.Single>')]),log),null);
assert.match(logs.at(-1).message,/stay centred/);assert.match(logs.at(-1).details.error,/PivotY/);
assert.equal(Toast.bind(type,params([field('PivotY','System.Nullable<System.Single>')]),log),null);
assert.equal(Toast.place(null,instance),null);

// A placement failure is logged once and never thrown.
bound=Toast.bind(type,params([pivot()]),log);
rect={field:()=>{throw Error('rect gone');}};
const before=logs.length;
assert.equal(Toast.place(bound,instance),null);assert.equal(Toast.place(bound,instance),null);
assert.equal(logs.length,before+1);assert.equal(bound.failed,true);
console.log('Game toast placement tests passed.');
