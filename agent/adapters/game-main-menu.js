'use strict';
// Original adapter. Adds one row to the game's own main menu, beside
// Settings and In-Person Event Tickets, by cloning the Settings row. Object and
// member names are verified from live managed metadata; there are no offsets.
globalThis.PgqlGameMainMenu = class PgqlGameMainMenu {
  constructor(ctx,label,onClick) {
    this.ctx=ctx;this.label=label;this.onClick=onClick;this.closed=false;this.bound=null;
    this.game=new PgqlGameGifts(ctx);
    // Registered after the frame scheduler's cleanup, so it runs before it.
    ctx.cleanup(()=>this.close());
  }
  static get entryName(){return 'PgqlMenuButton';}
  bind() {
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Main menu entry supports');
    const type=name=>this.game.type(name);
    const {method:plain}=PgqlBinding.create('main menu');
    const object=type('UnityEngine.Object'),controller=type('Niantic.Holoholo.Map.UI.MainMenuGuiController');
    const button=type('UnityEngine.UI.Button'),text=type('Niantic.Holoholo.UI.UIWidgets.HoloText');
    const clicked=button.field('m_OnClick').type.class;
    if(clicked.type.name!=='UnityEngine.UI.Button.ButtonClickedEvent')throw Error('Unsupported main menu click event');
    if(text.field('textKey').type.name!=='System.String')throw Error('Unsupported main menu label');
    // Fail before touching the scene if any member used below has changed.
    for(const [klass,name,args] of [
      [controller,'CloseMenu',[]],[controller,'get_MenuOpen',[]],[text,'set_text',['System.String']],
      [type('UnityEngine.Component'),'get_transform',[]],[type('UnityEngine.Component'),'get_gameObject',[]],
      [type('UnityEngine.Component'),'GetComponent',['System.Type']],
      [type('UnityEngine.GameObject'),'get_transform',[]],[type('UnityEngine.GameObject'),'get_scene',[]],
      [type('UnityEngine.GameObject'),'GetComponent',['System.Type']],[object,'set_name',['System.String']],
      [type('UnityEngine.Transform'),'Find',['System.String']],[type('UnityEngine.Transform'),'GetSiblingIndex',[]],
      [type('UnityEngine.Transform'),'SetSiblingIndex',['System.Int32']],
      [type('UnityEngine.SceneManagement.Scene'),'IsValid',[]],
      [type('UnityEngine.Events.UnityEvent'),'AddListener',['UnityEngine.Events.UnityAction']],
    ])plain(klass,name,args,null,false);
    return {controller,button,text,clicked,action:type('UnityEngine.Events.UnityAction'),
      open:plain(controller,'OpenMenu',[],null,false),
      frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],null,true).virtualAddress,
      instantiate:plain(object,'Instantiate',['UnityEngine.Object','UnityEngine.Transform'],null,true),
      destroy:plain(object,'Destroy',['UnityEngine.Object'],null,true),
      findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],null,true)};
  }
  find(transform,name){return transform.method('Find',1).invoke(Il2Cpp.string(name));}
  component(object,type){return object.method('GetComponent',1).overload('System.Type').invoke(type.type.object);}
  // Scene instances only: the prefab asset is also a loaded MainMenuGuiController.
  menus() {
    const all=this.bound.findAll.invoke(this.bound.controller.type.object),found=[];
    for(let i=0;i<all.length;i++) {
      const menu=all.get(i);
      if(menu.method('get_gameObject',0).invoke().method('get_scene',0).invoke().method('IsValid',0).invoke())found.push(menu);
    }
    return found;
  }
  install(menu) {
    const top=this.find(menu.method('get_transform',0).invoke(),'TopMenu');
    if(top.isNull())throw Error('Main menu list not found');
    if(!this.find(top,PgqlGameMainMenu.entryName).isNull())return false;
    const settings=this.find(top,'ButtonSettings');
    if(settings.isNull())throw Error('Main menu Settings row not found');
    const clone=this.bound.instantiate.invoke(settings.method('get_gameObject',0).invoke(),top);
    try {
      clone.method('set_name',1).invoke(Il2Cpp.string(PgqlGameMainMenu.entryName));
      const row=clone.method('get_transform',0).invoke(),caption=this.find(row,'TextLabel');
      if(caption.isNull())throw Error('Main menu row label not found');
      const label=this.component(caption,this.bound.text),button=this.component(clone,this.bound.button);
      if(label.isNull()||button.isNull())throw Error('Main menu row is not a labelled button');
      // Clear the localization key so the game does not restore "Settings".
      label.field('textKey').value=Il2Cpp.string('');
      label.method('set_text',1).invoke(Il2Cpp.string(this.label));
      // A fresh event drops the cloned persistent Settings listener.
      const event=this.bound.clicked.new();
      event.method('AddListener',1).invoke(this.delegate);
      button.field('m_OnClick').value=event;
      const events=this.find(top,'ButtonEvents');
      if(!events.isNull())row.method('SetSiblingIndex',1).invoke(events.method('GetSiblingIndex',0).invoke()+1);
    }catch(error){this.bound.destroy.invoke(clone);throw error;}
    return true;
  }
  remove() {
    let removed=0;
    for(const menu of this.menus()) {
      const entry=this.find(menu.method('get_transform',0).invoke(),'TopMenu/'+PgqlGameMainMenu.entryName);
      if(!entry.isNull()){this.bound.destroy.invoke(entry.method('get_gameObject',0).invoke());removed++;}
    }
    return removed;
  }
  clicked() {
    if(this.closed)return;
    try {
      for(const menu of this.menus())if(menu.method('get_MenuOpen',0).invoke())menu.method('CloseMenu',0).invoke();
      this.onClick();
    }catch(error){this.ctx.log('Main menu entry click failed',{error:String(error)});}
  }
  async start() {
    // Metadata binding runs on the agent thread; only scene work uses a frame.
    const bound=await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      // The click event only references the delegate while a row exists; pin it
      // so one delegate survives the game rebuilding its menu.
      const delegate=Il2Cpp.delegate(bound.action,()=>this.clicked());
      const pin=this.game.handleNew(delegate.handle,1);
      if(pin.isNull())throw Error('Unable to retain main menu callback');
      if(!this.game.handleTarget(pin).equals(delegate.handle)){this.game.handleFree(pin);throw Error('Unsupported managed handle ABI');}
      this.bound=bound;this.delegate=delegate;this.pin=pin;
      const self=this;
      // The game may recreate the menu with the map scene; re-add on each open.
      this.ctx.hook(bound.open.virtualAddress,{
        onEnter(args){this.menu=args[0];},
        onLeave() {
          if(self.closed)return;
          try{self.install(new Il2Cpp.Object(this.menu));}
          catch(error){self.ctx.log('Main menu entry install failed',{error:String(error)});}
        }
      });
      let installed=0;
      for(const menu of this.menus())if(this.install(menu))installed++;
      this.ctx.log('Main menu entry ready',{label:this.label,installed});
      return installed;
    });
  }
  // Unity objects may only be destroyed on the game thread, so removal runs on
  // the next game frame, after the synchronous module cleanup has returned.
  close() {
    if(this.closed)return;
    this.closed=true;
    if(!this.bound)return;
    let done=false;
    const listener=Interceptor.attach(this.bound.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      try{this.remove();this.game.handleFree(this.pin);}
      catch(error){this.ctx.log('Main menu entry removal failed',{error:String(error)});}
    }});
    // No frame (game paused): leave the inert row; its callback ignores clicks.
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
