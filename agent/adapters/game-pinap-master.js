'use strict';
// Original adapter for Pinap Master. Feeds the chosen berry through the game's
// item bag whenever a wild encounter has no active berry, and adds a berry
// button opposite the info button of the encounter berry selector that opens a
// picker. PgqlBerryPolicy owns the rules. Names are verified from live managed
// metadata; there are no offsets. The button, picker, toast and request
// confirmation are optional parts: if one cannot be bound the feeding still works.
globalThis.PgqlGamePinapMaster = class PgqlGamePinapMaster {
  constructor(ctx,{select}={}) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.failed=false;this.limits={};
    this.select=select || (key=>Qol.setConfig('pinap-master','berry',key));
    this.stats={used:0,confirmed:0,refused:0,special:0,last:null};
    this.busy=false;this.pending=false;this.lastUse=-Infinity;this.quietUntil=0;this.specialSeen=new Set();
    this.delegate=null;this.delegatePin=null;
    ctx.cleanup(()=>this.close());
  }
  static get buttonName(){return 'PgqlBerryMaster';}
  static number(value){return typeof value==='number'?value:value.field('value__').value;}
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'Pinap Master supports');
    const type=name=>this.game.type(name),number=PgqlGamePinapMaster.number;
    const args=m=>m.parameters.map(p=>p.type.name).join('|');
    const plain=(klass,name,params,returns,isStatic=false)=>{
      const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&args(m)===params.join('|'));
      if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))throw Error('Unsupported Pinap Master method: '+klass.type.name+'.'+name);
      return matches[0];
    };
    // Obfuscated member names change between builds; bind the only field of a type.
    const typed=(klass,typeName)=>{
      const matches=klass.fields.filter(f=>!f.isStatic&&f.type.name===typeName);
      if(matches.length!==1)throw Error('Unsupported Pinap Master field: '+klass.type.name+' of type '+typeName);
      return matches[0];
    };
    const constant=(klass,name)=>number(klass.field(name).value);
    const interaction=type('Niantic.Holoholo.Encounter.EncounterInteractionState'),state=type('Niantic.Holoholo.Encounter.EncounterState');
    const bag=type('Niantic.Holoholo.IItemBag'),item=type('Holoholo.Rpc.Item');
    const ids={};
    for(const berry of PgqlBerryPolicy.berries) {
      ids[berry.key]=constant(item,berry.item);
      if(ids[berry.key]!==berry.id)throw Error('Unexpected item number for '+berry.item);
    }
    plain(bag,'GetItemCount',['Holoholo.Rpc.Item'],'System.Int32');
    plain(bag,'UseItemForEncounter',['Holoholo.Rpc.Item','Niantic.Holoholo.Map.IMapPokemon'],'Niantic.Promises.IPromise<Holoholo.Rpc.UseItemEncounterOutProto>');
    const bound={
      active:plain(interaction,'get_ActiveBerry',[],'Holoholo.Rpc.Item'),
      setActive:plain(interaction,'set_ActiveBerry',['Holoholo.Rpc.Item'],'System.Void'),
      canUse:plain(interaction,'get_CanUseBerry',[],'System.Boolean'),
      stateField:typed(interaction,'Zenject.LazyInject<Niantic.Holoholo.Encounter.IEncounterState>'),
      bagField:typed(interaction,'Niantic.Holoholo.IItemBag'),
      state,special:plain(state,'get_IsRaidOrIncidentEncounter',[],'System.Boolean'),
      mapPokemon:plain(state,'get_MapPokemon',[],'Niantic.Holoholo.Map.MapPokemon'),
      ids,confirm:null,button:null,picker:null,toast:null};
    const optional=(name,build)=>{
      try{bound[name]=build();}
      catch(error){this.limits[name]=String(error.message || error);this.ctx.log('Pinap Master: '+name+' unavailable',{error:String(error)});}
    };
    optional('confirm',()=>{
      const output=type('Holoholo.Rpc.UseItemEncounterOutProto');
      const fields=output.fields.filter(f=>!f.isStatic&&f.name.replace(/^_|_$/g,'').toLowerCase()==='status');
      if(fields.length!==1||!fields[0].type.class.isEnum)throw Error('Unsupported berry result status');
      return {status:fields[0],success:constant(fields[0].type.class,'Success')};
    });
    optional('button',()=>{
      const slider=type('Niantic.Holoholo.UI.Items.ItemSelectionSliderGuiController');
      const initialize=plain(slider,'Initialize',['Niantic.Holoholo.UI.Items.ItemSelectionSliderGuiController.Initializer'],'System.Void');
      const initializer=initialize.parameters[0].type;
      if(!initializer.class.isValueType||initializer.class.field('TitleKey').type.name!=='System.String')throw Error('Unsupported item slider initializer');
      if(slider.field('infoButtonGameObject').type.name!=='UnityEngine.GameObject')throw Error('Unsupported item slider info button');
      const entry=type('Niantic.Holoholo.UI.Items.ItemSelectionSliderEntryWidget');
      if(entry.field('iconImage').type.name!=='UnityEngine.UI.Image')throw Error('Unsupported item slider entry icon');
      plain(entry,'get_Item',[],'Holoholo.Rpc.Item');
      plain(slider,'get_ItemSelectionEntries',[],'System.Collections.Generic.IEnumerable<Niantic.Holoholo.UI.Items.IItemSelectionSliderEntryWidget>');
      const button=type('UnityEngine.UI.Button'),object=type('UnityEngine.Object'),rect=type('UnityEngine.RectTransform');
      const image=type('UnityEngine.UI.Image'),graphic=type('UnityEngine.UI.Graphic');
      const clicked=button.field('m_OnClick').type.class;
      if(clicked.type.name!=='UnityEngine.UI.Button.ButtonClickedEvent')throw Error('Unsupported button click event');
      plain(clicked,'.ctor',[],'System.Void');
      for(const [klass,name,params] of [
        [type('UnityEngine.GameObject'),'get_transform',[]],[type('UnityEngine.GameObject'),'GetComponent',['System.Type']],
        [type('UnityEngine.GameObject'),'SetActive',['System.Boolean']],[type('UnityEngine.GameObject'),'get_scene',[]],
        [type('UnityEngine.SceneManagement.Scene'),'IsValid',[]],
        [type('UnityEngine.Component'),'get_gameObject',[]],[type('UnityEngine.Transform'),'get_parent',[]],
        [type('UnityEngine.Transform'),'Find',['System.String']],[object,'set_name',['System.String']],
        [rect,'get_anchorMin',[]],[rect,'set_anchorMin',['UnityEngine.Vector2']],[rect,'set_anchorMax',['UnityEngine.Vector2']],
        [rect,'get_anchoredPosition',[]],[rect,'set_anchoredPosition',['UnityEngine.Vector2']],
        [image,'get_sprite',[]],[image,'set_sprite',['UnityEngine.Sprite']],
        [graphic,'get_color',[]],[graphic,'set_color',['UnityEngine.Color']],
        [type('UnityEngine.Events.UnityEvent'),'AddListener',['UnityEngine.Events.UnityAction']]])plain(klass,name,params);
      for(const name of ['x','y'])if(type('UnityEngine.Vector2').field(name).type.name!=='System.Single')throw Error('Unsupported vector');
      if(type('UnityEngine.Color').field('a').type.name!=='System.Single')throw Error('Unsupported color');
      return {slider,initialize,initializer,opened:plain(slider,'HandleOpenComplete',[],'System.Void'),title:initializer.class.field('TitleKey'),entry,button,image,rect,clicked,
        action:type('UnityEngine.Events.UnityAction'),
        instantiate:plain(object,'Instantiate',['UnityEngine.Object','UnityEngine.Transform'],null,true),
        destroy:plain(object,'Destroy',['UnityEngine.Object'],'System.Void',true),
        findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],'UnityEngine.Object[]',true),
        frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],'System.Void',true).virtualAddress};
    });
    if(bound.button)optional('picker',()=>{
      const prompts=type('Niantic.Holoholo.UI.IUserPromptsService'),modal=type('Niantic.Holoholo.UI.ModalButton');
      const show=plain(prompts,'ShowModal',['System.String','UnityEngine.Sprite','System.String','UnityEngine.Sprite','System.Boolean','Niantic.Holoholo.UI.IModalButton[]']);
      const create=plain(modal,'.ctor',['Niantic.Holoholo.UI.ModalEvent','System.String','System.Nullable<Niantic.Holoholo.UI.ModalButton.ButtonType>','System.Nullable<UnityEngine.Color>'],'System.Void');
      const events=type('Niantic.Holoholo.UI.ModalEvent');
      const options=['OptionA','OptionB','OptionC','OptionD','OptionE'].map(name=>events.field(name).value);
      if(options.length<PgqlBerryPolicy.berries.length)throw Error('Too few modal options');
      plain(type('Zenject.Context'),'get_Container',[],'Zenject.DiContainer');plain(type('Zenject.DiContainer'),'Resolve',['System.Type'],'System.Object');
      return {prompts,show,modal,create,iface:type('Niantic.Holoholo.UI.IModalButton'),options,
        off:events.field('AltOption').value,cancel:events.field('Cancel').value,systemAction:type('System.Action'),
        scene:type('Niantic.Holoholo.MapSceneContext'),
        findOne:plain(type('UnityEngine.Object'),'FindObjectOfType',['System.Type'],'UnityEngine.Object',true)};
    });
    optional('toast',()=>{
      const service=type('Niantic.Holoholo.UI.IToastService'),params=['System.String','Niantic.Holoholo.UI.ToastService.ToastParams'];
      const one=plain(service,'OneLine',params,'Niantic.Holoholo.UI.IToastReceipt'),options=one.parameters[1].type.class;
      plain(options,'.ctor',[],'System.Void');
      for(const [name,expected] of [['AutoDismiss','System.Boolean'],['DismissOnClick','System.Boolean'],['DisplaySecondsOverride','System.Nullable<System.Single>']])
        if(options.field(name).type.name!==expected)throw Error('Unsupported toast field: '+name);
      const nullable=options.field('DisplaySecondsOverride').type.class;
      nullable.field('hasValue');nullable.field('value');
      if(!bound.picker)throw Error('Toast needs the map scene lookup from the picker');
      return {service,params:options};
    });
    this.bound=bound;
    return bound;
  }
  unwrap(object) {
    if(object.isNull())throw Error('Encounter state unavailable');
    if(!object.class.name.startsWith('LazyInject'))return object;
    const value=object.field('_value').value;
    return value.isNull()?this.game.method(object,'get_Value').invoke():value;
  }
  problem(error) {
    if(this.closed||this.failed)return;
    this.failed=true;this.ctx.log('Pinap Master failed; disabling',{error:String(error)});
    setTimeout(()=>{if(!this.closed)Qol.disable('pinap-master');},0);
  }
  // Runs on the game thread inside the getter's listener whenever the
  // encounter reports no active berry.
  consider(interaction) {
    const b=this.bound,now=Date.now();
    if(this.busy||this.pending||now<this.quietUntil)return;
    const selected=this.ctx.config.berry;
    if(!PgqlBerryPolicy.parse(selected)){this.quietUntil=now+500;return;}
    this.busy=true;
    try {
      const state=this.unwrap(b.stateField.bind(interaction).value);
      if(!b.state.isAssignableFrom(state.class))throw Error('Unexpected encounter state class');
      const special=!!b.special.bind(state).invoke(),key=state.handle.toString();
      if(special&&!this.specialSeen.has(key)) {
        if(this.specialSeen.size>=32)this.specialSeen.clear();
        this.specialSeen.add(key);this.stats.special++;this.ctx.log('Pinap Master: raid or Rocket encounter skipped');
      }
      const bag=b.bagField.bind(interaction).value;
      if(bag.isNull())throw Error('Encounter item bag unavailable');
      const berry=PgqlBerryPolicy.parse(selected);
      const decision=PgqlBerryPolicy.decide({selected,special,activeBerry:0,
        canUseBerry:!!b.canUse.bind(interaction).invoke(),pending:this.pending,sinceLast:now-this.lastUse,
        count:special?0:this.game.method(bag,'GetItemCount',1).invoke(berry.id)});
      if(decision.item===null){if(decision.reason!=='throttled')this.quietUntil=now+500;return;}
      const pokemon=b.mapPokemon.bind(state).invoke();
      if(pokemon.isNull())throw Error('Encounter Pokémon unavailable');
      this.lastUse=now;this.pending=true;
      const request=this.game.method(bag,'UseItemForEncounter',2).invoke(decision.item,pokemon);
      b.setActive.bind(interaction).invoke(decision.item);
      this.stats.used++;this.stats.last=berry.label;
      this.ctx.log('Pinap Master fed a berry',{berry:berry.key});
      this.watch(request).then(ok=>{
        if(ok===true)this.stats.confirmed++;
        else if(ok===false){this.stats.refused++;this.ctx.log('Pinap Master: the game refused the berry');}
      },error=>{this.stats.refused++;this.ctx.log('Pinap Master: berry request failed',{error:String(error)});})
        .finally(()=>{this.pending=false;});
    }finally{this.busy=false;}
  }
  // true for a successful answer, false for a refusal, null when the result
  // cannot be read (confirmation part unavailable).
  watch(request) {
    const c=this.bound.confirm;
    if(!c||request.isNull())return Promise.resolve(null);
    return new Promise((resolve,reject)=>{
      const methods=[...request.class.hierarchy({includeCurrent:true})].flatMap(klass=>klass.methods);
      const callback=(name,argument)=>methods.find(m=>m.name===name&&!m.isStatic&&m.parameterCount===1&&m.parameters[0].type.name===argument);
      const then=callback('Then','System.Action<Holoholo.Rpc.UseItemEncounterOutProto>'),error=callback('Error','System.Action<System.String>');
      if(!then||!error){resolve(null);return;}
      const pins=[];let finished=false;
      const pin=object=>{
        const handle=this.game.handleNew(object.handle,1);
        if(handle.isNull())throw Error('Unable to retain berry callback');
        pins.push(handle);return object;
      };
      const settle=(fn,value)=>{
        if(finished)return;
        finished=true;fn(value);
        this.game.main(()=>{for(const handle of pins.splice(0))this.game.handleFree(handle);}).catch(()=>{});
      };
      try {
        pin(request);
        error.bind(request).invoke(pin(Il2Cpp.delegate(error.parameters[0].type.class,()=>settle(reject,Error('The game reported a request error')))));
        then.bind(request).invoke(pin(Il2Cpp.delegate(then.parameters[0].type.class,output=>{
          try{settle(resolve,PgqlGamePinapMaster.number(c.status.bind(output).value)===c.success);}catch(problem){settle(reject,problem);}
        })));
      }catch(problem){settle(reject,problem);}
    });
  }
  find(transform,name){return transform.method('Find',1).invoke(Il2Cpp.string(name));}
  component(gameObject,klass){return gameObject.method('GetComponent',1).overload('System.Type').invoke(klass.type.object);}
  // The berry button beside the info button of one berry selector; reused when
  // the game pools the selector.
  install(slider) {
    const b=this.bound.button,info=slider.field('infoButtonGameObject').value;
    if(info.isNull())throw Error('Berry selector info button not found');
    const parent=info.method('get_transform',0).invoke().method('get_parent',0).invoke();
    let clone=this.find(parent,PgqlGamePinapMaster.buttonName);
    if(clone.isNull()) {
      const made=b.instantiate.invoke(info,parent);
      try {
        made.method('set_name',1).invoke(Il2Cpp.string(PgqlGamePinapMaster.buttonName));
        const rect=this.component(made,b.rect),button=this.component(made,b.button);
        if(rect.isNull()||button.isNull())throw Error('Berry selector info button is not a button');
        // Mirror the info button to the top-left corner.
        const anchor=rect.method('get_anchorMin',0).invoke();
        anchor.field('x').value=0;
        rect.method('set_anchorMin',1).invoke(anchor);rect.method('set_anchorMax',1).invoke(anchor);
        const position=rect.method('get_anchoredPosition',0).invoke();
        position.field('x').value=Math.abs(position.field('x').value);
        rect.method('set_anchoredPosition',1).invoke(position);
        // A fresh event drops the cloned info-panel listener.
        const event=b.clicked.new();
        event.method('AddListener',1).invoke(this.delegate);
        button.field('m_OnClick').value=event;
      }catch(error){b.destroy.invoke(made);throw error;}
      clone=made.method('get_transform',0).invoke();
    }
    const go=clone.method('get_gameObject',0).invoke();
    go.method('SetActive',1).invoke(true);
    this.paint(slider,go);
  }
  // The selected berry's own icon from the selector, dimmed when off or when
  // the selector does not show it.
  paint(slider,go) {
    const b=this.bound.button,selected=PgqlBerryPolicy.parse(this.ctx.config.berry);
    let sprite=null,fallback=null;
    for(const entry of this.game.array(slider.method('get_ItemSelectionEntries',0).invoke())) {
      if(!b.entry.isAssignableFrom(entry.class))continue;
      const id=PgqlGamePinapMaster.number(entry.method('get_Item',0).invoke());
      if(!PgqlBerryPolicy.berries.some(berry=>berry.id===id))continue;
      const icon=entry.field('iconImage').value;if(icon.isNull())continue;
      const current=icon.method('get_sprite',0).invoke();if(current.isNull())continue;
      if(!fallback)fallback=current;
      if(selected&&id===selected.id)sprite=current;
    }
    const image=this.component(go,b.image);if(image.isNull())return;
    if(sprite||fallback)image.method('set_sprite',1).invoke(sprite||fallback);
    const color=image.method('get_color',0).invoke();
    color.field('a').value=sprite?1:0.4;
    image.method('set_color',1).invoke(color);
  }
  sliders() {
    const b=this.bound.button,all=b.findAll.invoke(b.slider.type.object),found=[];
    for(let i=0;i<all.length;i++) {
      const slider=all.get(i);
      if(slider.method('get_gameObject',0).invoke().method('get_scene',0).invoke().method('IsValid',0).invoke())found.push(slider);
    }
    return found;
  }
  remove() {
    let removed=0;
    for(const slider of this.sliders()) {
      const info=slider.field('infoButtonGameObject').value;if(info.isNull())continue;
      const clone=this.find(info.method('get_transform',0).invoke().method('get_parent',0).invoke(),PgqlGamePinapMaster.buttonName);
      if(!clone.isNull()){this.bound.button.destroy.invoke(clone.method('get_gameObject',0).invoke());removed++;}
    }
    return removed;
  }
  // The selector builds its entries after Initialize; repaint once it is open.
  repaint(slider) {
    const info=slider.field('infoButtonGameObject').value;if(info.isNull())return;
    const clone=this.find(info.method('get_transform',0).invoke().method('get_parent',0).invoke(),PgqlGamePinapMaster.buttonName);
    if(!clone.isNull())this.paint(slider,clone.method('get_gameObject',0).invoke());
  }
  // Hide the button on selectors other than the encounter berries.
  hide(slider) {
    const info=slider.field('infoButtonGameObject').value;if(info.isNull())return;
    const clone=this.find(info.method('get_transform',0).invoke().method('get_parent',0).invoke(),PgqlGamePinapMaster.buttonName);
    if(!clone.isNull())clone.method('get_gameObject',0).invoke().method('SetActive',1).invoke(false);
  }
  services() {
    const p=this.bound.picker,scene=p.findOne.invoke(p.scene.type.object);
    if(scene.isNull())throw Error('Game map unavailable');
    const resolve=scene.method('get_Container',0).invoke().method('Resolve',1).overload('System.Type');
    const get=klass=>{const service=resolve.invoke(klass.type.object);if(service.isNull())throw Error('Game service unavailable: '+klass.type.name);return service;};
    return {prompts:get(p.prompts),toast:this.bound.toast?get(this.bound.toast.service):null};
  }
  notify(text) {
    if(!this.bound.toast||this.limits.toast||!this.ctx.config.showToast)return;
    try {
      const t=this.bound.toast,service=this.services().toast,params=t.params.alloc();
      params.method('.ctor',0).invoke();
      params.field('AutoDismiss').value=true;params.field('DismissOnClick').value=true;
      const seconds=params.field('DisplaySecondsOverride').value;seconds.field('value').value=2;seconds.field('hasValue').value=true;
      const shown=service.class.methods.find(m=>m.name==='OneLine'&&!m.isStatic&&m.parameterCount===2&&
        m.parameters[1].type.name==='Niantic.Holoholo.UI.ToastService.ToastParams');
      if(!shown)throw Error('Unsupported game toast service');
      shown.bind(service).invoke(Il2Cpp.string(text),params);
    }catch(error){this.limits.toast=String(error.message || error);this.ctx.log('Pinap Master toast failed; continuing without toasts',{error:String(error)});}
  }
  choose(key) {
    if(this.closed)return;
    this.select(key);this.quietUntil=0;
    this.notify(key===PgqlBerryPolicy.off?'Pinap Master off':PgqlBerryPolicy.label(key)+' selected');
    try{for(const slider of this.sliders())this.repaint(slider);}
    catch(error){this.ctx.log('Pinap Master button refresh failed',{error:String(error)});}
  }
  // The game's modal with one button per berry, Off and Cancel. Without the
  // picker each tap moves to the next berry.
  clicked() {
    if(this.closed)return;
    try {
      if(!this.bound.picker||this.limits.picker){this.choose(PgqlBerryPolicy.next(this.ctx.config.berry));return;}
      this.openPicker();
    }catch(error){
      this.limits.picker=String(error.message || error);
      this.ctx.log('Pinap Master picker unavailable; tapping cycles berries',{error:String(error)});
      try{this.choose(PgqlBerryPolicy.next(this.ctx.config.berry));}catch(problem){this.ctx.log('Pinap Master selection failed',{error:String(problem)});}
    }
  }
  openPicker() {
    const p=this.bound.picker,prompts=this.services().prompts;
    const nullable=klass=>new Il2Cpp.ValueType(Memory.alloc(klass.valueTypeSize),klass.type);
    const types=p.create.parameters.map(parameter=>parameter.type.class);
    const button=(event,text)=>{
      const made=p.modal.alloc();
      p.create.bind(made).invoke(event,Il2Cpp.string(text),nullable(types[2]),nullable(types[3]));
      return made;
    };
    const choices=PgqlBerryPolicy.berries.map((berry,i)=>({event:p.options[i],key:berry.key,label:berry.label}));
    choices.push({event:p.off,key:PgqlBerryPolicy.off,label:'Off'});
    const buttons=choices.map(choice=>button(choice.event,choice.label));
    buttons.push(button(p.cancel,'Cancel'));
    const show=prompts.class.methods.find(m=>m.name==='ShowModal'&&!m.isStatic&&args(m)===args(p.show));
    if(!show)throw Error('Unsupported game prompt service');
    const none=new Il2Cpp.Object(NULL);
    const current=PgqlBerryPolicy.label(this.ctx.config.berry);
    const promise=show.bind(prompts).invoke(Il2Cpp.string('Pinap Master'),none,Il2Cpp.string('Berry fed automatically in wild encounters.\nCurrent: '+current),none,false,
      Il2Cpp.array(p.iface,buttons));
    const on=[...promise.class.hierarchy({includeCurrent:true})].flatMap(c=>c.methods)
      .find(m=>m.name==='On'&&!m.isStatic&&args(m)==='Niantic.Holoholo.UI.ModalEvent|System.Action');
    if(!on)throw Error('Unsupported game prompt result');
    const pins=[];let settled=false;
    const settle=key=>{
      if(settled)return;settled=true;
      for(const pin of pins.splice(0))this.game.handleFree(pin);
      if(key)try{this.choose(key);}catch(error){this.ctx.log('Pinap Master selection failed',{error:String(error)});}
    };
    try {
      for(const [event,key] of [...choices.map(c=>[c.event,c.key]),[p.cancel,null]]) {
        const delegate=Il2Cpp.delegate(p.systemAction,()=>settle(key));
        const pin=this.game.handleNew(delegate.handle,1);
        if(pin.isNull())throw Error('Unable to retain picker callback');
        pins.push(pin);
        on.bind(promise).invoke(event,delegate);
      }
    }catch(error){for(const pin of pins.splice(0))this.game.handleFree(pin);settled=true;throw error;}
    function args(m){return m.parameters.map(x=>x.type.name).join('|');}
  }
  installButton() {
    const b=this.bound.button,self=this;
    const delegate=Il2Cpp.delegate(b.action,()=>this.clicked());
    const pin=this.game.handleNew(delegate.handle,1);
    if(pin.isNull())throw Error('Unable to retain berry button callback');
    this.delegate=delegate;this.delegatePin=pin;
    // Transfer on Catch observes the same method's entry; both only attach.
    this.ctx.hook(b.initialize.virtualAddress,{
      onEnter(args){this.slider=args[0];this.title=args[1];},
      onLeave() {
        if(self.closed||self.failed||self.limits.button)return;
        try {
          const title=b.title.bind(new Il2Cpp.ValueType(this.title,b.initializer)).value;
          const slider=new Il2Cpp.Object(this.slider);
          if(!title.isNull()&&title.content==='encounter_item_berries')self.install(slider);else self.hide(slider);
        }catch(error){self.limits.button=String(error.message || error);self.ctx.log('Pinap Master button unavailable',{error:String(error)});}
      }
    });
    this.ctx.hook(b.opened.virtualAddress,{
      onEnter(args){this.slider=args[0];},
      onLeave() {
        if(self.closed||self.failed||self.limits.button)return;
        try{self.repaint(new Il2Cpp.Object(this.slider));}
        catch(error){self.ctx.log('Pinap Master button refresh failed',{error:String(error)});}
      }
    });
  }
  async start() {
    await this.game.initialize();
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      // Observed with a listener so other encounter features keep their hooks.
      this.ctx.hook(b.active.virtualAddress,{
        onEnter(args){this.interaction=args[0];},
        onLeave(result) {
          if(self.closed||self.failed||result.toInt32()!==0)return;
          try{self.consider(new Il2Cpp.Object(this.interaction));}catch(error){self.problem(error);}
        }
      });
      if(b.button) {
        try{this.installButton();}
        catch(error){this.limits.button=String(error.message || error);this.ctx.log('Pinap Master button unavailable',{error:String(error)});}
      }
      this.ctx.log('Pinap Master ready',{berry:this.ctx.config.berry,button:!!b.button&&!this.limits.button,picker:!!b.picker,confirm:!!b.confirm});
      return true;
    });
  }
  report() {
    const s=this.stats,lines=['Berry: '+PgqlBerryPolicy.label(this.ctx.config.berry),
      'Fed: '+s.used+(this.bound&&this.bound.confirm?' ('+s.confirmed+' confirmed'+(s.refused?', '+s.refused+' refused':'')+')':''),
      'Raid/Rocket encounters skipped: '+s.special];
    if(s.last)lines.push('Last: '+s.last);
    for(const [name,label] of [['button','Selector button'],['picker','Berry picker'],['toast','Toasts'],['confirm','Request confirmation']])
      if(this.limits[name])lines.push(label+' unavailable: '+this.limits[name]);
    return lines.join('\n');
  }
  // Hooks are ctx listeners. Unity objects may only be destroyed on the game
  // thread, so the button is removed on the next game frame.
  close() {
    if(this.closed)return;
    this.closed=true;
    const b=this.bound&&this.bound.button;
    if(!b||!this.delegatePin)return;
    let done=false;
    const listener=Interceptor.attach(b.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      try{this.remove();this.game.handleFree(this.delegatePin);}
      catch(error){this.ctx.log('Pinap Master button removal failed',{error:String(error)});}
    }});
    // No frame (game paused): leave the inert button; its callback ignores taps.
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
