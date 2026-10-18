const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
// Minimal Unity scene model: nodes are both GameObject and Transform, and carry
// at most one component of each kind the adapter asks for.
const NULL_OBJECT={isNull:()=>true};
function N(name,children=[],parts={}) {
  const self={name,children,parent:null,active:true,...parts};
  for(const child of children)child.parent=self;
  return self;
}
const kinds=['label','toggle','button','pgoButton','panel','canvas','scroller'];
function copy(source) {
  const made=N(source.name,source.children.map(copy));
  made.active=source.active;made.controller=source.controller;
  for(const kind of kinds)if(source[kind])made[kind]={...source[kind]};
  return made;
}
function lookup(from,target) {
  let current=from;
  for(const part of target.split('/')){current=current.children.find(c=>c.name===part);if(!current)return null;}
  return current;
}
const calls=fn=>({invoke:fn,overload:()=>({invoke:fn})});
const componentKind={'Niantic.Holoholo.UI.PgoText':'label','Niantic.Holoholo.UI.UIWidgets.HoloText':'label','UnityEngine.UI.Toggle':'toggle',
  'UnityEngine.UI.Button':'button','Niantic.Holoholo.UI.PgoButton':'pgoButton','Niantic.Holoholo.UI.GpuPanel':'panel','UnityEngine.Canvas':'canvas','Niantic.Holoholo.Widget.ScrollerEvent':'scroller'};
const eventField={toggle:'onValueChanged',button:'m_OnClick',pgoButton:'_onClick',scroller:'ScrollEvent'};
function part(node,kind) {
  const data=node[kind];
  if(!data)return NULL_OBJECT;
  const api={set_text:v=>{data.text=v.content;},set_ToggleEnabled:v=>{data.enabled=v;},Initialize:()=>{assert(data.injected,'panel painted before injection');data.ready=true;}};
  for(const name of ['renderMode','worldCamera','planeDistance','sortingLayerID','sortingOrder']){api['get_'+name]=()=>data[name];api['set_'+name]=v=>{data[name]=v;};}
  return {data,kind,isNull:()=>false,method:name=>calls(api[name]),
    field:name=>({get value(){return data[name];},set value(v){
      if(name==='textKey')data.textKey=v.content;else{assert.equal(name,eventField[kind]);data.event=v;}}})};
}
let sceneRoots=[],pending=[];
function detach(node) {
  const list=node.parent?node.parent.children:sceneRoots,index=list.indexOf(node);
  if(index>=0)list.splice(index,1);
  node.destroyed=true;
}
function wrap(node) {
  if(!node)return NULL_OBJECT;
  const api={
    get_transform:()=>wrap(node),get_gameObject:()=>wrap(node),get_name:()=>({content:node.name}),
    get_scene:()=>({method:()=>calls(()=>sceneRoots.includes(root(node)))}),
    Find:name=>wrap(lookup(node,name.content)),set_name:name=>{node.name=name.content;},
    SetActive:value=>{node.active=value;},get_childCount:()=>node.children.length,GetChild:index=>wrap(node.children[index]),
    GetComponent:type=>part(node,componentKind[type.name]),get_Container:()=>container,
  };
  return {node,isNull:()=>false,method:name=>calls(api[name])};
}
const root=node=>node.parent?root(node.parent):node;
const row=name=>N(name,[N('ToggleContent',[N('Toggle',[N('Label',[],{label:{textKey:'key',text:''}})]),N('Tip',[],{label:{textKey:'tip',text:''}})])],
  {toggle:{isOn:true,event:'game',enabled:true}});
const widget=name=>N(name,[N('SettingsWidgetHeader',[N('Label',[],{label:{textKey:'header'}})]),N('WidgetElements',[N('Background'),
  N('TurnOnNotifications',[N('PgoButton',[N('Background',[N('Text',[],{label:{textKey:'button'}})],{panel:{}})],{pgoButton:{event:'game'}})]),
  row('ToggleDailyIncensePN'),row('TogglePokemonReturnPN'),
  N('WeeklyChallengeIndentGroup',[N('Label',[],{label:{textKey:'group'}}),N('Indent',[row('ToggleWeeklyChallengeProgress'),row('ToggleWeeklyChallengeInvitations')])]),
  row('ToggleMarketingPN')])]);
const prefab=N('NotificationSettingsGuiV2',[N('Content',[N('Background',[],{panel:{}}),N('Title',[N('HeadingText',[],{label:{textKey:'title'}})]),
  N('ScrollPanel',[N('Viewport',[N('Content',[widget('PushNotificationWidget'),widget('InGameNotificationWidget')])])],{scroller:{event:'game'}}),
  N('Btn_Back',[],{button:{event:'game'}})])],{controller:true,canvas:{renderMode:'Overlay',sortingOrder:0}});
const menu=N('MainMenuGui(Clone)',[],{canvas:{renderMode:'Camera',worldCamera:'UICamera',planeDistance:100,sortingLayerID:7,sortingOrder:1010}});
const mapScene=N('MapSceneContext');sceneRoots=[menu,mapScene];
const modals=[];
const promptService={isNull:()=>false,class:{methods:[{name:'ShowModal',isStatic:false,
  parameters:['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]'].map(name=>({type:{name}})),
  bind:()=>({invoke:(title,_icon,message,_icon2,closeable,buttons)=>{
    const modal={title:title.content,message:message.content,closeable,buttons,on:new Map()};modals.push(modal);
    return {class:{hierarchy:()=>[{methods:[{name:'On',isStatic:false,parameters:[{type:{name:'Niantic.Holoholo.UI.ModalEvent'}},{type:{name:'System.Action'}}],
      bind:()=>({invoke:(event,delegate)=>modal.on.set(event,delegate)})}]}]}};
  }})}]}};
const container={method:name=>calls(name==='Inject'?panel=>{panel.data.injected=true;}:()=>promptService)};
const M=(name,args=[],isStatic=false)=>[name,args,isStatic];
const signatures={
  'UnityEngine.Object':[M('Instantiate',['UnityEngine.Object'],true),M('Instantiate',['UnityEngine.Object','UnityEngine.Transform'],true),
    M('Instantiate',['UnityEngine.Object','UnityEngine.Transform','System.Boolean'],true),M('Destroy',['UnityEngine.Object'],true),
    M('Destroy',['UnityEngine.Object','System.Single'],true),M('DestroyImmediate',['UnityEngine.Object'],true),
    M('DestroyImmediate',['UnityEngine.Object','System.Boolean'],true),M('FindObjectOfType',['System.Type'],true),
    M('FindObjectOfType',['System.Type','System.Boolean'],true),M('set_name',['System.String']),M('get_name')],
  'UnityEngine.Resources':[M('FindObjectsOfTypeAll',['System.Type'],true)],
  'UnityEngine.UnitySynchronizationContext':[M('ExecuteTasks',[],true)],
  'Niantic.Holoholo.Settings.SettingsToggle_Ext':[M('SetIsOnWithoutNotify_Settings',['UnityEngine.UI.Toggle','System.Boolean'],true)],
  'Niantic.Holoholo.UI.PgoText':[M('set_text',['System.String'])],'Niantic.Holoholo.UI.UIWidgets.HoloText':[M('set_text',['System.String'])],
  'UnityEngine.GameObject':[M('SetActive',['System.Boolean']),M('get_scene'),M('GetComponent',['System.Type']),M('GetComponent',['System.String']),M('get_transform')],
  'UnityEngine.Component':[M('get_gameObject'),M('get_transform')],
  'UnityEngine.Transform':[M('Find',['System.String']),M('get_childCount'),M('GetChild',['System.Int32'])],
  'UnityEngine.Canvas':[M('set_renderMode',['UnityEngine.RenderMode']),M('get_renderMode'),M('set_worldCamera',['UnityEngine.Camera']),M('get_worldCamera'),
    M('set_planeDistance',['System.Single']),M('get_planeDistance'),M('set_sortingLayerID',['System.Int32']),M('get_sortingLayerID'),M('set_sortingOrder',['System.Int32'])],
  'Zenject.DiContainer':[M('Inject',['System.Object']),M('Inject',['System.Object','System.Collections.Generic.IEnumerable<System.Object>']),M('Resolve',['System.Type'])],
  'Niantic.Holoholo.UI.GpuPanel':[M('Initialize')],'Niantic.Holoholo.UI.SettingsToggle':[M('set_ToggleEnabled',['System.Boolean'])],
  'UnityEngine.Events.UnityEvent':[M('AddListener',['UnityEngine.Events.UnityAction'])],'Zenject.Context':[M('get_Container')],
  'Niantic.Holoholo.UI.IUserPromptsService':[M('ShowModal',['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]']),
    M('ShowModal',['System.String','Niantic.Holoholo.UI.IModalButton[]'])],
};
for(const name of ['UnityEngine.UI.Toggle','UnityEngine.UI.Button','Niantic.Holoholo.UI.PgoButton','Niantic.Holoholo.UI.ModalButton','Niantic.Holoholo.UI.ModalEvent',
  'UnityEngine.Events.UnityAction','System.Action','Niantic.Holoholo.UI.NotificationSettingsGuiController','Niantic.Holoholo.Map.UI.MainMenuGuiController',
  'Niantic.Holoholo.MapSceneContext','Niantic.Holoholo.Widget.ScrollerEvent'])signatures[name]=[];
const statics={
  Instantiate:(original,parent)=>{const made=copy(original.node);if(parent){made.parent=parent.node;parent.node.children.push(made);}else sceneRoots.push(made);return wrap(made);},
  Destroy:object=>{pending.push(object.node);},DestroyImmediate:object=>detach(object.node),
  FindObjectsOfTypeAll:type=>{
    const all=type.name.endsWith('MainMenuGuiController')?[menu]:[prefab,...sceneRoots].filter(n=>n.controller);
    return {length:all.length,get:i=>wrap(all[i])};
  },
  FindObjectOfType:()=>mapSceneLoaded?wrap(mapScene):NULL_OBJECT,
  SetIsOnWithoutNotify_Settings:(toggle,value)=>{toggle.data.isOn=value;},
};
let mapSceneLoaded=true,version='0.433.0',serial=0;
const event=name=>({type:{name},new:()=>{const listeners=[];return {listeners,method:()=>calls(d=>listeners.push(d))};}});
const toggleEvent={...event('UnityEngine.UI.Toggle.ToggleEvent'),
  parent:{methods:[{name:'AddListener',parameterCount:1,parameters:[{type:{name:'UnityEngine.Events.UnityAction<System.Boolean>',class:{}}}]}]}};
const fields={onValueChanged:{type:{name:toggleEvent.type.name,class:toggleEvent}},
  m_OnClick:{type:{name:'UnityEngine.UI.Button.ButtonClickedEvent',class:event('UnityEngine.UI.Button.ButtonClickedEvent')}},
  _onClick:{type:{name:'Niantic.Holoholo.UI.PgoButtonClickedEvent',class:event('Niantic.Holoholo.UI.PgoButtonClickedEvent')}},
  ScrollEvent:{type:{name:'UnityEngine.Events.UnityEvent',class:event('UnityEngine.Events.UnityEvent')}},
  textKey:{type:{name:'System.String'}},OkButton:{type:{name:'Niantic.Holoholo.UI.IModalButton[]'},value:'ok-buttons'},
  ContinueCancelButtons:{type:{name:'Niantic.Holoholo.UI.IModalButton[]'},value:'continue-cancel-buttons'},OK:{value:'OK'},Cancel:{value:'Cancel'}};
const types=new Map();
function type(name) {
  if(!signatures[name])throw Error('Unsupported game metadata: '+name);
  if(!types.has(name))types.set(name,{type:{name,object:{name}},field:key=>fields[key],
    methods:signatures[name].map(([method,args,isStatic])=>({name:method,isStatic,isGeneric:false,virtualAddress:name+'.'+method,
      parameters:args.map(arg=>({type:{name:arg}})),invoke:statics[method]}))});
  return types.get(name);
}
const cleanups=[],logs=[],attached=new Map(),freed=[];
const context=vm.createContext({setTimeout,clearTimeout,NULL:null,
  Il2Cpp:{get application(){return {version};},string:content=>({content}),_callbacksToKeepAlive:{},
    delegate(_type,fn){const key='d'+(++serial);this._callbacksToKeepAlive[key]=fn;return {handle:{toString:()=>key},fn};},Object:class {}},
  Interceptor:{attach:(address,callbacks)=>{attached.set(address,callbacks);return {detach:()=>attached.delete(address)};}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/game-version.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/metadata-binding.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/adapters/game-settings-screen.js'),'utf8'),context);
const Screen=context.PgqlGameSettingsScreen;
const game={type,async initialize(){},async main(fn){return fn();},async metadata(fn){return fn();},handleNew:handle=>({isNull:()=>false,handle}),handleFree:pin=>freed.push(pin)};
const ctx={cleanup:fn=>cleanups.push(fn),log:(message,details)=>logs.push({message,details})};
const flush=()=>{for(const node of pending.splice(0))detach(node);};
const shown=()=>sceneRoots.filter(n=>n.controller);
const page={id:'main',title:'PGQL',sections:[
  {title:'BUDDY',rows:[
    {kind:'toggle',id:'tamagotchi:enabled',moduleId:'tamagotchi',label:'Tamagotchi',description:'Automatic buddy care.',value:false,disabled:false,indent:false},
    {kind:'toggle',id:'tamagotchi:feed',moduleId:'tamagotchi',key:'feed',label:'Feed buddy',description:null,value:true,disabled:false,indent:true},
    {kind:'toggle',id:'tamagotchi:play',moduleId:'tamagotchi',key:'play',label:'Play with buddy',description:'Quick play.',value:false,disabled:false,indent:true},
    {kind:'value',id:'tamagotchi:snack',moduleId:'tamagotchi',key:'snack',label:'Snack',description:null,value:'berry',disabled:false,indent:false},
    {kind:'action',id:'tamagotchi:action:run',moduleId:'tamagotchi',actionId:'run',label:'Run care',indent:false},
    {kind:'toggle',id:'magic-bag:enabled',moduleId:'magic-bag',label:'Magic Bag',description:'Planned',value:false,disabled:true,indent:false}]},
  {title:'MORE',rows:[{kind:'link',id:'page:advanced',page:'advanced',label:'Advanced Settings',indent:false}]}]};
(async()=>{
  const events=[];
  const handlers={toggle:(item,value)=>events.push(['toggle',item.id,value]),action:item=>events.push(['action',item.id]),
    link:item=>events.push(['link',item.page]),back:()=>events.push(['back']),
    edit:item=>events.push(['edit',item.id])};
  // Other game versions, a missing map and changed prefabs leave the scene alone.
  version='0.434.0';
  await assert.rejects(new Screen({...ctx,cleanup:()=>{}},game).show(page,handlers),/support game 0\.433\.0/);
  version='0.433.0';mapSceneLoaded=false;
  await assert.rejects(new Screen({...ctx,cleanup:()=>{}},game).show(page,handlers),/Load the game map/);
  mapSceneLoaded=true;assert.equal(shown().length,0);
  const tip=lookup(prefab,'Content/ScrollPanel/Viewport/Content/PushNotificationWidget/WidgetElements/TogglePokemonReturnPN/ToggleContent/Tip');
  tip.name='Renamed';
  await assert.rejects(new Screen({...ctx,cleanup:()=>{}},game).show(page,handlers),/part not found: ToggleContent\/Tip/);
  flush();assert.equal(shown().length,0,'a failed build is destroyed');
  tip.name='Tip';

  const screen=new Screen(ctx,game);
  assert.equal(await screen.show(page,handlers),true);
  const [built]=shown();
  assert.equal(built.name,'PgqlSettingsScreen');
  // Drawn like the game's camera GUIs, between the main menu and its modals.
  assert.deepEqual(built.canvas,{renderMode:'Camera',worldCamera:'UICamera',planeDistance:100,sortingLayerID:7,sortingOrder:3000});
  assert.deepEqual(lookup(built,'Content/Background').panel,{injected:true,ready:true});
  assert.deepEqual(lookup(built,'Content/Title/HeadingText').label,{textKey:'',text:'PGQL'});
  const content=lookup(built,'Content/ScrollPanel/Viewport/Content');
  assert.deepEqual(content.children.map(c=>c.name),['Pgql_section0','Pgql_section1'],'only PGQL sections remain');
  assert.equal(lookup(content,'Pgql_section0/SettingsWidgetHeader/Label').label.text,'BUDDY');
  const card=lookup(content,'Pgql_section0/WidgetElements');
  assert.deepEqual(card.children.map(c=>c.name),['Background','Pgql_tamagotchi:enabled','Pgql_group0','Pgql_tamagotchi:snack','Pgql_tamagotchi:action:run','Pgql_magic-bag:enabled']);
  const group=card.children[2];
  assert.equal(group.children[0].active,false,'the group caption is hidden');
  assert.deepEqual(group.children[1].children.map(c=>c.name),['Pgql_tamagotchi:feed','Pgql_tamagotchi:play'],'sub-toggles replace the game rows');
  // A text setting is a button showing its value; pressing it asks to edit.
  const snack=lookup(card,'Pgql_tamagotchi:snack/PgoButton');
  assert.equal(lookup(snack,'Background/Text').label.text,'Snack: berry');
  snack.pgoButton.event.listeners[0].fn();assert.deepEqual(events.splice(0),[['edit','tamagotchi:snack']]);
  const parent=card.children[1],feed=group.children[1].children[0],play=group.children[1].children[1],planned=card.children[5];
  assert.equal(lookup(parent,'ToggleContent/Toggle/Label').label.text,'Tamagotchi');
  assert.deepEqual(lookup(parent,'ToggleContent/Tip').label,{textKey:'',text:'Automatic buddy care.'});
  assert.equal(lookup(feed,'ToggleContent/Tip').active,false);assert.equal(lookup(play,'ToggleContent/Tip').active,true);
  assert.deepEqual([parent.toggle.isOn,feed.toggle.isOn,play.toggle.isOn],[false,true,false]);
  assert.equal(planned.toggle.enabled,false);assert.equal(parent.toggle.enabled,true);
  // No control keeps a game listener.
  for(const control of [parent.toggle,feed.toggle,planned.toggle,lookup(built,'Content/Btn_Back').button,lookup(built,'Content/ScrollPanel').scroller,lookup(card,'Pgql_tamagotchi:action:run/PgoButton').pgoButton]) {
    assert.notEqual(control.event,'game');assert.equal(control.event.listeners.length,1);
  }
  const button=lookup(card,'Pgql_tamagotchi:action:run/PgoButton');
  assert.equal(lookup(button,'Background/Text').label.text,'Run care');assert.equal(lookup(button,'Background').panel.ready,true);
  // The prefab asset itself is untouched.
  assert.equal(lookup(prefab,'Content/Title/HeadingText').label.textKey,'title');
  assert.equal(lookup(prefab,'Content/ScrollPanel/Viewport/Content').children.length,2);

  feed.toggle.event.listeners[0].fn(false);play.toggle.event.listeners[0].fn(1);
  button.pgoButton.event.listeners[0].fn();
  lookup(content,'Pgql_section1/WidgetElements/Pgql_page:advanced/PgoButton').pgoButton.event.listeners[0].fn();
  lookup(built,'Content/Btn_Back').button.event.listeners[0].fn();
  // Pulling the list down past its top closes the page like the back button.
  lookup(built,'Content/ScrollPanel').scroller.event.listeners[0].fn();
  assert.deepEqual(events,[['toggle','tamagotchi:feed',false],['toggle','tamagotchi:play',true],['action','tamagotchi:action:run'],['link','advanced'],['back'],['back']]);
  // A throwing handler is contained on the game thread.
  handlers.toggle=()=>{throw Error('boom');};
  parent.toggle.event.listeners[0].fn(true);
  assert.match(logs.at(-1).details.error,/boom/);

  // Changes made elsewhere are reflected without raising toggle events.
  assert.equal(await screen.update({'tamagotchi:enabled':true,'tamagotchi:feed':false,'unknown:row':true,'tamagotchi:play':'yes','tamagotchi:snack':true}),2);
  assert.equal(await screen.update({'tamagotchi:snack':'poffin'}),1);assert.equal(lookup(snack,'Background/Text').label.text,'Snack: poffin');
  assert.equal(await screen.update({'tamagotchi:snack':'poffin'}),0,'unchanged text is left alone');
  assert.equal(await screen.update({'tamagotchi:snack':''}),1);assert.equal(lookup(snack,'Background/Text').label.text,'Snack: —');
  assert.deepEqual([parent.toggle.isOn,feed.toggle.isOn,play.toggle.isOn],[true,false,false]);

  // Showing another page replaces the screen and releases the old callbacks.
  const before=Object.keys(context.Il2Cpp._callbacksToKeepAlive).length;
  assert.equal(await screen.show({id:'advanced',title:'Advanced Settings',sections:[{title:'DEVELOPER',rows:[page.sections[0].rows[0]]}]},handlers),true);
  flush();
  assert.equal(shown().length,1);assert.equal(lookup(shown()[0],'Content/Title/HeadingText').label.text,'Advanced Settings');
  await new Promise(resolve=>setTimeout(resolve,2100));
  assert.equal(Object.keys(context.Il2Cpp._callbacksToKeepAlive).length,2,'only the current page callbacks stay alive (was '+before+')');

  // Prompts use the game's modal and release their callbacks once answered.
  const confirm=screen.prompt('Mass Gift — Send gifts','Friends: 3',true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual([modals[0].title,modals[0].message,modals[0].closeable,modals[0].buttons],['Mass Gift — Send gifts','Friends: 3',false,'continue-cancel-buttons']);
  modals[0].on.get('Cancel').fn();
  assert.equal(await confirm,false);assert.equal(freed.length,2);
  modals[0].on.get('OK').fn();assert.equal(freed.length,2,'late answers do not release twice');
  const notice=screen.prompt('Result','Done');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(modals[1].buttons,'ok-buttons');modals[1].on.get('OK').fn();assert.equal(await notice,true);

  // Hide and module disable remove the screen on the game thread.
  assert.equal(await screen.hide(),1);flush();assert.equal(shown().length,0);
  await screen.show(page,handlers);assert.equal(shown().length,1);
  cleanups.forEach(fn=>fn());
  assert.equal(shown().length,1);
  attached.get('UnityEngine.UnitySynchronizationContext.ExecuteTasks').onLeave();flush();
  assert.equal(shown().length,0);assert.equal(attached.size,0);
  await assert.rejects(screen.show(page,handlers),/Module disabled/);
  console.log('Native settings screen contract, rows, sub-toggles, events, updates, prompts and cleanup tests passed.');
})().catch(error=>{console.error(error);process.exit(1);});
