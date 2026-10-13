const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Minimal Unity scene model: nodes are both GameObject and Transform.
const NULL={isNull:()=>true};
function node(name,children=[],extra={}) {
  const self={name,children,parent:null,destroyed:false,...extra};
  for(const child of children)child.parent=self;
  return self;
}
function copy(source){return node(source.name,source.children.map(copy),{label:source.label&&{...source.label},button:source.button&&{...source.button}});}
function lookup(from,target) {
  let current=from;
  for(const part of target.split('/')){current=current.children.find(c=>c.name===part);if(!current)return null;}
  return current;
}
const calls=n=>({invoke:n,overload:()=>({invoke:n})});
function wrap(n) {
  if(!n)return NULL;
  const api={
    get_transform:()=>wrap(n),get_gameObject:()=>wrap(n),
    get_scene:()=>({method:()=>calls(()=>n.scene!==false)}),
    Find:name=>wrap(lookup(n,name.content)),
    set_name:name=>{n.name=name.content;},
    GetSiblingIndex:()=>n.parent.children.indexOf(n),
    SetSiblingIndex:index=>{const list=n.parent.children;list.splice(list.indexOf(n),1);list.splice(index,0,n);},
    GetComponent:type=>type.name==='Niantic.Holoholo.UI.UIWidgets.HoloText'?(n.label?wrapLabel(n.label):NULL):(n.button?wrapButton(n.button):NULL),
    get_MenuOpen:()=>n.open===true,CloseMenu:()=>{n.open=false;},
  };
  return {node:n,isNull:()=>false,method:name=>calls(api[name])};
}
const wrapLabel=label=>({isNull:()=>false,field:()=>({set value(v){label.textKey=v.content;}}),method:()=>calls(v=>{label.text=v.content;})});
const wrapButton=button=>({isNull:()=>false,field:()=>({set value(v){button.event=v;}})});
function menuNode(scene) {
  return node('MainMenuGui',[node('TopMenu',[
    node('ButtonSettings',[node('Image'),node('TextLabel',[],{label:{textKey:'SCREEN_TITLE_SETTINGS',text:'SETTINGS'}})],{button:{event:'settings'}}),
    node('ButtonNews'),node('ButtonEvents'),node('ButtonScanUploads')])],{scene});
}
const prefab=menuNode(false);let scene=[menuNode(true)];
const signatures={
  'UnityEngine.Object':[['Instantiate',['UnityEngine.Object','UnityEngine.Transform'],true],['Instantiate',['UnityEngine.Object'],true],
    ['Destroy',['UnityEngine.Object'],true],['Destroy',['UnityEngine.Object','System.Single'],true],['set_name',['System.String']]],
  'UnityEngine.Resources':[['FindObjectsOfTypeAll',['System.Type'],true]],
  'Niantic.Holoholo.Map.UI.MainMenuGuiController':[['OpenMenu',[]],['CloseMenu',[]],['get_MenuOpen',[]]],
  'Niantic.Holoholo.UI.UIWidgets.HoloText':[['set_text',['System.String']]],
  'UnityEngine.Component':[['get_transform',[]],['get_gameObject',[]],['GetComponent',['System.Type']],['GetComponent',['System.String']]],
  'UnityEngine.GameObject':[['get_transform',[]],['get_scene',[]],['GetComponent',['System.Type']]],
  'UnityEngine.Transform':[['Find',['System.String']],['GetSiblingIndex',[]],['SetSiblingIndex',['System.Int32']]],
  'UnityEngine.SceneManagement.Scene':[['IsValid',[]]],
  'UnityEngine.Events.UnityEvent':[['AddListener',['UnityEngine.Events.UnityAction']]],
  'UnityEngine.UnitySynchronizationContext':[['ExecuteTasks',[],true]],
  'UnityEngine.UI.Button':[],'UnityEngine.Events.UnityAction':[],
};
const statics={
  Instantiate:(original,parent)=>{const made=copy(original.node);made.parent=parent.node;parent.node.children.push(made);return wrap(made);},
  Destroy:object=>{const n=object.node;n.destroyed=true;n.parent.children.splice(n.parent.children.indexOf(n),1);},
  FindObjectsOfTypeAll:()=>{const all=[prefab,...scene];return {length:all.length,get:i=>wrap(all[i])};},
};
const fields={m_OnClick:{type:{class:{type:{name:'UnityEngine.UI.Button.ButtonClickedEvent'},new:()=>{const event={listeners:[]};return {...event,listeners:event.listeners,method:()=>calls(d=>event.listeners.push(d))};}}}},
  textKey:{type:{name:'System.String'}}};
const types=new Map();
function type(name) {
  if(!signatures[name])throw Error('Unsupported game metadata: '+name);
  if(!types.has(name))types.set(name,{type:{name,object:{name}},field:key=>fields[key],
    methods:signatures[name].map(([method,args,isStatic=false])=>({name:method,isStatic,isGeneric:false,virtualAddress:name+'.'+method,
      parameters:args.map(arg=>({type:{name:arg}})),invoke:statics[method]}))});
  return types.get(name);
}
const cleanups=[],logs=[],hooks=new Map(),attached=new Map(),freed=[];let version='0.431.0';
const context=vm.createContext({setTimeout,clearTimeout,
  PgqlGameGifts:class {constructor(){this.handleNew=handle=>({isNull:()=>false,handle});this.handleTarget=pin=>({equals:other=>other===pin.handle});this.handleFree=pin=>freed.push(pin);}
    type(name){return type(name);}async initialize(){}async main(fn){return fn();}},
  Il2Cpp:{get application(){return {version};},string:content=>({content}),delegate:(_type,fn)=>({handle:{},fn}),Object:class {constructor(pointer){return wrap(pointer);}}},
  Interceptor:{attach:(address,callbacks)=>{attached.set(address,callbacks);return {detach:()=>attached.delete(address)};}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-main-menu.js'),'utf8'),context);
const Menu=context.PgqlGameMainMenu;
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details}),hook:(address,callbacks)=>hooks.set(address,callbacks)};
const names=menu=>menu.children[0].children.map(child=>child.name);
(async()=>{
  // Other game versions are refused before the scene is touched.
  version='0.432.0';
  await assert.rejects(new Menu({...ctx,cleanup:()=>{}},'PGQL',()=>{}).start(),/supports game 0\.431\.0/);
  assert.deepEqual(names(scene[0]),['ButtonSettings','ButtonNews','ButtonEvents','ButtonScanUploads']);
  version='0.431.0';

  let opened=0;
  const menu=new Menu(ctx,'PGQL',()=>opened++);
  assert.equal(await menu.start(),1);
  // The row sits directly below In-Person Event Tickets; the prefab is untouched.
  assert.deepEqual(names(scene[0]),['ButtonSettings','ButtonNews','ButtonEvents','PgqlMenuButton','ButtonScanUploads']);
  assert.deepEqual(names(prefab),['ButtonSettings','ButtonNews','ButtonEvents','ButtonScanUploads']);
  const row=scene[0].children[0].children[3];
  assert.deepEqual(row.children[1].label,{textKey:'',text:'PGQL'});
  assert.equal(scene[0].children[0].children[0].children[1].label.text,'SETTINGS','the original row keeps its label');
  assert.equal(row.button.event.listeners.length,1,'only the PGQL listener remains on the clone');
  assert.equal(scene[0].children[0].children[0].button.event,'settings');

  // Opening the menu again does not duplicate the row; a rebuilt menu gets one.
  const open=hooks.get('Niantic.Holoholo.Map.UI.MainMenuGuiController.OpenMenu');
  const invoke=target=>{const frame={};open.onEnter.call(frame,[target]);open.onLeave.call(frame);};
  invoke(scene[0]);
  assert.equal(names(scene[0]).filter(name=>name==='PgqlMenuButton').length,1);
  scene=[menuNode(true)];invoke(scene[0]);
  assert.equal(names(scene[0])[3],'PgqlMenuButton');
  const rebuilt=scene[0].children[0].children[3];

  // A tap closes the game's menu and then opens the PGQL panel.
  scene[0].open=true;
  rebuilt.button.event.listeners[0].fn();
  assert.equal(scene[0].open,false);assert.equal(opened,1);

  // A menu without the expected rows is reported, not guessed at.
  const odd=node('MainMenuGui',[node('TopMenu',[node('ButtonEvents')])],{scene:true});
  invoke(odd);
  assert.match(logs.at(-1).details.error,/Settings row not found/);assert.equal(odd.children[0].children.length,1);
  const unlabelled=node('MainMenuGui',[node('TopMenu',[node('ButtonSettings',[node('TextLabel')],{button:{}})])],{scene:true});
  invoke(unlabelled);
  assert.match(logs.at(-1).details.error,/not a labelled button/);
  assert.deepEqual(names(unlabelled),['ButtonSettings'],'a failed clone is destroyed');

  // Disable removes the row on the next game frame and ignores late taps.
  cleanups.forEach(fn=>fn());
  assert.equal(names(scene[0])[3],'PgqlMenuButton');
  const frame=attached.get('UnityEngine.UnitySynchronizationContext.ExecuteTasks');
  frame.onLeave();
  assert.deepEqual(names(scene[0]),['ButtonSettings','ButtonNews','ButtonEvents','ButtonScanUploads']);
  assert.equal(freed.length,1);assert.equal(attached.size,0);
  rebuilt.button.event.listeners[0].fn();assert.equal(opened,1);
  invoke(scene[0]);assert.equal(names(scene[0]).length,4,'no row is added after disable');
  console.log('main menu tests passed');
})().catch(error=>{console.error(error);process.exit(1);});
