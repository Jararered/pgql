'use strict';
// Original 0.431.0 adapter. Shows PGQL settings pages built from the game's own
// Notifications settings prefab: its title, section cards, toggle rows, indented
// sub-toggle groups and buttons. The copy is never opened through the game's GUI
// stack or dependency-injected as a controller, so none of the game's own
// notification settings logic runs; every cloned control gets a fresh event.
// Names are verified from live managed metadata; there are no offsets.
globalThis.PgqlGameSettingsScreen = class PgqlGameSettingsScreen {
  constructor(ctx,game) {
    this.ctx=ctx;this.game=game || new PgqlGameGifts(ctx);this.closed=false;this.bound=null;
    this.paths=new Map();this.callbacks=[];this.generation=0;
    ctx.cleanup(()=>this.close());
  }
  static get screenName(){return 'PgqlSettingsScreen';}
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    if(version!=='0.431.0')throw Error('Native settings support game 0.431.0; found '+version);
    const type=name=>this.game.type(name);
    const plain=(klass,name,args,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&
        m.parameters.map(p=>p.type.name).join('|')===args.join('|'));
      if(matches.length!==1)throw Error('Unsupported settings screen method: '+name);
      return matches[0];
    };
    const field=(klass,name,expected)=>{
      const found=klass.field(name);
      if(found.type.name!==expected)throw Error('Unsupported settings screen field: '+name);
      return found.type.class;
    };
    const object=type('UnityEngine.Object'),toggle=type('UnityEngine.UI.Toggle'),button=type('UnityEngine.UI.Button');
    const pgoButton=type('Niantic.Holoholo.UI.PgoButton'),pgoText=type('Niantic.Holoholo.UI.PgoText');
    const holoText=type('Niantic.Holoholo.UI.UIWidgets.HoloText'),panel=type('Niantic.Holoholo.UI.GpuPanel');
    const canvas=type('UnityEngine.Canvas'),container=type('Zenject.DiContainer'),modal=type('Niantic.Holoholo.UI.ModalButton');
    const prompts=type('Niantic.Holoholo.UI.IUserPromptsService'),transform=type('UnityEngine.Transform');
    const scroller=type('Niantic.Holoholo.Widget.ScrollerEvent');
    const toggled=field(toggle,'onValueChanged','UnityEngine.UI.Toggle.ToggleEvent');
    const listen=toggled.parent.methods.filter(m=>m.name==='AddListener'&&m.parameterCount===1);
    if(listen.length!==1||listen[0].parameters[0].type.name!=='UnityEngine.Events.UnityAction<System.Boolean>')throw Error('Unsupported settings toggle event');
    for(const [klass,name] of [[pgoText,'textKey'],[holoText,'textKey']])
      if(klass.field(name).type.name!=='System.String')throw Error('Unsupported settings label');
    // Fail before touching the scene if any member used below has changed.
    for(const [klass,name,args] of [
      [pgoText,'set_text',['System.String']],[holoText,'set_text',['System.String']],
      [type('UnityEngine.GameObject'),'SetActive',['System.Boolean']],[type('UnityEngine.GameObject'),'get_scene',[]],
      [type('UnityEngine.GameObject'),'GetComponent',['System.Type']],[type('UnityEngine.GameObject'),'get_transform',[]],
      [type('UnityEngine.Component'),'get_gameObject',[]],[type('UnityEngine.Component'),'get_transform',[]],
      [object,'set_name',['System.String']],[object,'get_name',[]],
      [transform,'Find',['System.String']],[transform,'get_childCount',[]],[transform,'GetChild',['System.Int32']],
      [canvas,'set_renderMode',['UnityEngine.RenderMode']],[canvas,'get_renderMode',[]],
      [canvas,'set_worldCamera',['UnityEngine.Camera']],[canvas,'get_worldCamera',[]],
      [canvas,'set_planeDistance',['System.Single']],[canvas,'get_planeDistance',[]],
      [canvas,'set_sortingLayerID',['System.Int32']],[canvas,'get_sortingLayerID',[]],[canvas,'set_sortingOrder',['System.Int32']],
      [container,'Inject',['System.Object']],[container,'Resolve',['System.Type']],[panel,'Initialize',[]],
      [type('Niantic.Holoholo.UI.SettingsToggle'),'set_ToggleEnabled',['System.Boolean']],
      [type('UnityEngine.Events.UnityEvent'),'AddListener',['UnityEngine.Events.UnityAction']],
      [type('Zenject.Context'),'get_Container',[]],
    ])plain(klass,name,args);
    for(const name of ['OkButton','ContinueCancelButtons'])
      if(modal.field(name).type.name!=='Niantic.Holoholo.UI.IModalButton[]')throw Error('Unsupported modal buttons');
    const events=type('Niantic.Holoholo.UI.ModalEvent');
    this.bound={toggle,button,pgoButton,pgoText,holoText,panel,canvas,toggled,modal,prompts,scroller,
      pulled:field(scroller,'ScrollEvent','UnityEngine.Events.UnityEvent'),
      toggleAction:listen[0].parameters[0].type.class,action:type('UnityEngine.Events.UnityAction'),
      systemAction:type('System.Action'),
      clicked:field(button,'m_OnClick','UnityEngine.UI.Button.ButtonClickedEvent'),
      pressed:field(pgoButton,'_onClick','Niantic.Holoholo.UI.PgoButtonClickedEvent'),
      controller:type('Niantic.Holoholo.UI.NotificationSettingsGuiController'),
      menu:type('Niantic.Holoholo.Map.UI.MainMenuGuiController'),scene:type('Niantic.Holoholo.MapSceneContext'),
      ok:events.field('OK').value,cancel:events.field('Cancel').value,
      showModal:plain(prompts,'ShowModal',['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]']),
      frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],true).virtualAddress,
      quiet:plain(type('Niantic.Holoholo.Settings.SettingsToggle_Ext'),'SetIsOnWithoutNotify_Settings',['UnityEngine.UI.Toggle','System.Boolean'],true),
      instantiate:plain(object,'Instantiate',['UnityEngine.Object'],true),
      instantiateIn:plain(object,'Instantiate',['UnityEngine.Object','UnityEngine.Transform'],true),
      destroy:plain(object,'Destroy',['UnityEngine.Object'],true),
      // Immediate removal keeps discarded template rows out of later clones.
      destroyNow:plain(object,'DestroyImmediate',['UnityEngine.Object'],true),
      findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],true),
      findOne:plain(object,'FindObjectOfType',['System.Type'],true)};
    return this.bound;
  }
  text(value){return Il2Cpp.string(value);}
  find(transform,path) {
    const found=transform.method('Find',1).invoke(this.text(path));
    if(found.isNull())throw Error('Settings screen part not found: '+path);
    return found;
  }
  component(object,type) {
    const found=object.method('GetComponent',1).overload('System.Type').invoke(type.type.object);
    if(found.isNull())throw Error('Settings screen component not found: '+type.type.name);
    return found;
  }
  object(part){return part.method('get_gameObject',0).invoke();}
  inScene(part){return this.object(part).method('get_scene',0).invoke().method('IsValid',0).invoke();}
  children(transform) {
    const list=[],count=transform.method('get_childCount',0).invoke();
    for(let i=0;i<count;i++)list.push(transform.method('GetChild',1).invoke(i));
    return list;
  }
  // Clearing the localization key stops the game restoring its own caption.
  label(transform,type,value) {
    const text=this.component(transform,type);
    text.field('textKey').value=this.text('');
    text.method('set_text',1).invoke(this.text(value));
  }
  delegate(type,fn) {
    const made=Il2Cpp.delegate(type,fn);
    this.callbacks.push(made.handle.toString());
    return made;
  }
  // A fresh event drops the prefab's persistent listeners, which target the
  // game's notification settings controller.
  listen(component,fieldName,eventClass,delegate) {
    const event=eventClass.new();
    event.method('AddListener',1).invoke(delegate);
    component.field(fieldName).value=event;
  }
  controllers() {
    const all=this.bound.findAll.invoke(this.bound.controller.type.object),found=[];
    for(let i=0;i<all.length;i++)found.push(all.get(i));
    return found;
  }
  screens(){return this.controllers().filter(c=>this.inScene(c)&&c.method('get_name',0).invoke().content===PgqlGameSettingsScreen.screenName);}
  container() {
    const scene=this.bound.findOne.invoke(this.bound.scene.type.object);
    if(scene.isNull())throw Error('Load the game map before opening PGQL settings');
    return scene.method('get_Container',0).invoke();
  }
  // The game's panels take their material from an injected factory; without it
  // they render plain white.
  paint(container,transform) {
    const panel=this.component(transform,this.bound.panel);
    container.method('Inject',1).invoke(panel);
    panel.method('Initialize',0).invoke();
  }
  run(handler,...args) {
    if(this.closed)return;
    try{handler(...args);}catch(error){this.ctx.log('Settings screen handler failed',{error:String(error)});}
  }
  toggleRow(template,parent,row,handlers,path) {
    const b=this.bound,made=b.instantiateIn.invoke(this.object(template),parent),transform=made.method('get_transform',0).invoke();
    const name='Pgql_'+row.id;
    made.method('set_name',1).invoke(this.text(name));
    this.label(this.find(transform,'ToggleContent/Toggle/Label'),b.pgoText,row.label);
    const tip=this.find(transform,'ToggleContent/Tip');
    this.object(tip).method('SetActive',1).invoke(!!row.description);
    if(row.description)this.label(tip,b.pgoText,row.description);
    const toggle=this.component(made,b.toggle);
    this.listen(toggle,'onValueChanged',b.toggled,this.delegate(b.toggleAction,value=>this.run(handlers.toggle,row,!!value)));
    b.quiet.invoke(toggle,!!row.value);
    if(row.disabled)toggle.method('set_ToggleEnabled',1).invoke(false);
    made.method('SetActive',1).invoke(true);
    this.paths.set(row.id,path+'/'+name);
  }
  buttonRow(template,parent,row,handler,container) {
    const b=this.bound,made=b.instantiateIn.invoke(this.object(template),parent),transform=made.method('get_transform',0).invoke();
    made.method('set_name',1).invoke(this.text('Pgql_'+row.id));
    const control=this.find(transform,'PgoButton'),background=this.find(control,'Background');
    this.label(this.find(background,'Text'),b.holoText,row.label);
    this.paint(container,background);
    this.listen(this.component(control,b.pgoButton),'_onClick',b.pressed,this.delegate(b.action,()=>this.run(handler,row)));
    made.method('SetActive',1).invoke(true);
  }
  build(page,handlers) {
    const b=this.bound,container=this.container();
    const prefab=this.controllers().find(c=>!this.inScene(c));
    if(!prefab)throw Error('Game settings prefab is not loaded');
    const menus=b.findAll.invoke(b.menu.type.object);let reference=null;
    for(let i=0;i<menus.length;i++)if(this.inScene(menus.get(i)))reference=this.component(menus.get(i),b.canvas);
    if(!reference)throw Error('Game menu canvas not found');
    const screen=b.instantiate.invoke(this.object(prefab));
    try {
      screen.method('set_name',1).invoke(this.text(PgqlGameSettingsScreen.screenName));
      // Render like the game's own camera-space GUIs: above the map and main
      // menu, below toasts and modal dialogs.
      const canvas=this.component(screen,b.canvas);
      canvas.method('set_renderMode',1).invoke(reference.method('get_renderMode',0).invoke());
      canvas.method('set_worldCamera',1).invoke(reference.method('get_worldCamera',0).invoke());
      canvas.method('set_planeDistance',1).invoke(reference.method('get_planeDistance',0).invoke());
      canvas.method('set_sortingLayerID',1).invoke(reference.method('get_sortingLayerID',0).invoke());
      canvas.method('set_sortingOrder',1).invoke(3000);
      const root=screen.method('get_transform',0).invoke();
      this.paint(container,this.find(root,'Content/Background'));
      this.label(this.find(root,'Content/Title/HeadingText'),b.pgoText,page.title);
      const back=this.delegate(b.action,()=>this.run(handlers.back));
      this.listen(this.component(this.find(root,'Content/Btn_Back'),b.button),'m_OnClick',b.clicked,back);
      // Pulling the list down past its top is the game's close gesture; left on
      // the game's own listener it fails on this copy and locks scrolling.
      this.listen(this.component(this.find(root,'Content/ScrollPanel'),b.scroller),'ScrollEvent',b.pulled,back);
      const content=this.find(root,'Content/ScrollPanel/Viewport/Content');
      const original=this.find(content,'PushNotificationWidget'),elements=this.find(original,'WidgetElements');
      const templates={row:this.find(elements,'TogglePokemonReturnPN'),group:this.find(elements,'WeeklyChallengeIndentGroup'),
        button:this.find(elements,'TurnOnNotifications')};
      templates.child=this.find(templates.group,'Indent/ToggleWeeklyChallengeProgress');
      this.find(elements,'Background');
      // One empty section card, cloned per section.
      const blank=b.instantiateIn.invoke(this.object(original),content),blankTransform=blank.method('get_transform',0).invoke();
      for(const child of this.children(this.find(blankTransform,'WidgetElements')))
        if(child.method('get_name',0).invoke().content!=='Background')b.destroyNow.invoke(this.object(child));
      this.paths.clear();
      page.sections.forEach((section,index)=>{
        const made=b.instantiateIn.invoke(blank,content),transform=made.method('get_transform',0).invoke();
        const name='Pgql_section'+index,path='Content/ScrollPanel/Viewport/Content/'+name+'/WidgetElements';
        made.method('set_name',1).invoke(this.text(name));
        this.label(this.find(transform,'SettingsWidgetHeader/Label'),b.pgoText,section.title);
        const card=this.find(transform,'WidgetElements');let indent=null,groups=0,indentPath=null;
        for(const row of section.rows) {
          if(!row.indent)indent=null;
          else if(!indent) {
            // Sub-rows share one indented group below their parent row.
            const group=b.instantiateIn.invoke(this.object(templates.group),card),groupTransform=group.method('get_transform',0).invoke();
            const groupName='Pgql_group'+groups++;
            group.method('set_name',1).invoke(this.text(groupName));
            this.object(this.find(groupTransform,'Label')).method('SetActive',1).invoke(false);
            indent=this.find(groupTransform,'Indent');indentPath=path+'/'+groupName+'/Indent';
            for(const child of this.children(indent))b.destroyNow.invoke(this.object(child));
          }
          const parent=indent || card,parentPath=indent?indentPath:path;
          if(row.kind==='toggle')this.toggleRow(indent?templates.child:templates.row,parent,row,handlers,parentPath);
          else this.buttonRow(templates.button,parent,row,row.kind==='link'?handlers.link:handlers.action,container);
        }
      });
      for(const leftover of [blankTransform,original,this.find(content,'InGameNotificationWidget')])b.destroyNow.invoke(this.object(leftover));
    }catch(error){b.destroy.invoke(screen);this.release();throw error;}
  }
  destroyScreens() {
    let removed=0;
    for(const screen of this.screens()){this.bound.destroy.invoke(this.object(screen));removed++;}
    this.release();
    return removed;
  }
  // Destroyed rows can no longer raise their events; let their native
  // callbacks go once the frame that destroys them has passed.
  release() {
    this.paths.clear();
    const stale=this.callbacks.splice(0);
    if(stale.length)setTimeout(()=>{for(const key of stale)delete Il2Cpp._callbacksToKeepAlive[key];},2000);
  }
  // handlers: toggle(row,value), action(row), link(row), back(). They are called
  // on the game thread.
  async show(page,handlers) {
    await this.game.initialize();
    const generation=++this.generation;
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      if(generation!==this.generation)return false;
      this.bind();this.destroyScreens();this.build(page,handlers);
      this.ctx.log('Native settings page shown',{page:page.id,rows:this.paths.size});
      return true;
    });
  }
  async hide() {
    if(!this.bound)return 0;
    ++this.generation;
    return this.game.main(()=>this.destroyScreens());
  }
  // values: row id -> boolean, for rows changed outside the screen.
  async update(values) {
    if(!this.bound||!this.paths.size)return 0;
    return this.game.main(()=>{
      if(this.closed)return 0;
      const screen=this.screens()[0];if(!screen)return 0;
      const root=screen.method('get_transform',0).invoke();let changed=0;
      for(const [id,path] of this.paths) {
        if(typeof values[id]!=='boolean')continue;
        const row=root.method('Find',1).invoke(this.text(path));
        if(row.isNull())continue;
        this.bound.quiet.invoke(this.component(row,this.bound.toggle),values[id]);changed++;
      }
      return changed;
    });
  }
  // Resolves true for OK/Continue and false for Cancel, using the game's modal.
  async prompt(title,message,confirm=false) {
    await this.game.initialize();
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind();
      const service=this.container().method('Resolve',1).overload('System.Type').invoke(b.prompts.type.object);
      if(service.isNull())throw Error('Game prompt service unavailable');
      const show=service.class.methods.find(m=>m.name==='ShowModal'&&!m.isStatic&&
        m.parameters.map(p=>p.type.name).join('|')===b.showModal.parameters.map(p=>p.type.name).join('|'));
      if(!show)throw Error('Unsupported game prompt service');
      const none=new Il2Cpp.Object(NULL);
      const promise=show.bind(service).invoke(this.text(title),none,this.text(message),none,false,
        b.modal.field(confirm?'ContinueCancelButtons':'OkButton').value);
      const on=[...promise.class.hierarchy({includeCurrent:true})].flatMap(c=>c.methods)
        .find(m=>m.name==='On'&&!m.isStatic&&m.parameters.map(p=>p.type.name).join('|')==='Niantic.Holoholo.UI.ModalEvent|System.Action');
      if(!on)throw Error('Unsupported game prompt result');
      return new Promise((resolve,reject)=>{
        const pins=[];let settled=false;
        const settle=value=>{
          if(settled)return;settled=true;
          for(const pin of pins)this.game.handleFree(pin);
          resolve(value);
        };
        try {
          for(const [event,value] of [[b.ok,true],[b.cancel,false]]) {
            const delegate=Il2Cpp.delegate(b.systemAction,()=>settle(value));
            const pin=this.game.handleNew(delegate.handle,1);
            if(pin.isNull())throw Error('Unable to retain prompt callback');
            pins.push(pin);
            on.bind(promise).invoke(event,delegate);
          }
        }catch(error){for(const pin of pins.splice(0))this.game.handleFree(pin);settled=true;reject(error);}
      });
    });
  }
  // Unity objects may only be destroyed on the game thread, so removal runs on
  // the next game frame, after the synchronous module cleanup has returned.
  close() {
    if(this.closed)return;
    this.closed=true;++this.generation;
    if(!this.bound)return;
    let done=false;
    const listener=Interceptor.attach(this.bound.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      try{this.destroyScreens();}
      catch(error){this.ctx.log('Settings screen removal failed',{error:String(error)});}
    }});
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
