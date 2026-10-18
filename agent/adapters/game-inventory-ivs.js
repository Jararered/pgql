'use strict';
// Original adapter. Shows each Pokemon's IVs in place of its name in
// the inventory grid. It only rewrites the cell's own name label after the game
// has filled it, from the Pokemon data the game passed to that cell. Names are
// verified from live managed metadata; there are no offsets.
globalThis.PgqlGameInventoryIvs = class PgqlGameInventoryIvs {
  constructor(ctx) {
    this.ctx=ctx;this.game=new PgqlGameGifts(ctx);this.closed=false;this.bound=null;this.names=new Map();this.failed=false;
    ctx.cleanup(()=>this.close());
  }
  // "attack/defense/stamina", or null when the values are not valid IVs.
  static text(attack,defense,stamina) {
    const values=[attack,defense,stamina];
    return values.every(value=>Number.isInteger(value)&&value>=0&&value<=15)?values.join('/'):null;
  }
  bind() {
    if(this.bound)return this.bound;
    const version=Il2Cpp.application.version;
    PgqlGameVersion.require(version,'IVs in inventory support');
    const type=name=>this.game.type(name);
    const {method:plain,field}=PgqlBinding.create('inventory');
    const cell=type('Niantic.Holoholo.UI.PokemonInventoryCellView'),pokemon=type('Holoholo.Rpc.PokemonProto'),text=type('UnityEngine.UI.Text');
    const initialize=plain(cell,'Initialize',['Niantic.Holoholo.UI.PokemonInventoryCellView.Initializer']);
    plain(text,'get_text',[]);plain(text,'set_text',['System.String']);
    for(const [klass,name,args] of [[type('UnityEngine.GameObject'),'get_scene',[]],[type('UnityEngine.Component'),'get_gameObject',[]],
      [type('UnityEngine.SceneManagement.Scene'),'IsValid',[]]])plain(klass,name,args);
    this.bound={cell,initialize,name:field(cell,'nameText','UnityEngine.UI.Text'),
      pokemon:field(initialize.parameters[0].type.class,'PokemonProto','Holoholo.Rpc.PokemonProto'),
      attack:field(pokemon,'individualAttack_','System.Int32'),defense:field(pokemon,'individualDefense_','System.Int32'),
      stamina:field(pokemon,'individualStamina_','System.Int32'),egg:field(pokemon,'isEgg_','System.Boolean'),
      frame:plain(type('UnityEngine.UnitySynchronizationContext'),'ExecuteTasks',[],null,true).virtualAddress,
      findAll:plain(type('UnityEngine.Resources'),'FindObjectsOfTypeAll',['System.Type'],null,true)};
    return this.bound;
  }
  // Runs on the game thread, right after the game filled the cell.
  relabel(cell,data) {
    const b=this.bound,key=cell.handle.toString(),label=b.name.bind(cell).value;
    if(label.isNull())return;
    const pokemon=data.isNull()?data:b.pokemon.bind(data).value;
    const text=pokemon.isNull()||b.egg.bind(pokemon).value?null:
      PgqlGameInventoryIvs.text(b.attack.bind(pokemon).value,b.defense.bind(pokemon).value,b.stamina.bind(pokemon).value);
    if(!text){this.names.delete(key);return;}
    // Cells are pooled; remember the name the game wrote so disable can put it back.
    if(!this.names.has(key)&&this.names.size>=1024)this.names.clear();
    this.names.set(key,label.method('get_text',0).invoke().content);
    label.method('set_text',1).invoke(Il2Cpp.string(text));
  }
  async start() {
    await this.game.initialize();
    await this.game.metadata(()=>this.bind());
    return this.game.main(()=>{
      if(this.closed)throw Error('Module disabled');
      const b=this.bind(),self=this;
      this.ctx.hook(b.initialize.virtualAddress,{
        onEnter(args){this.cell=args[0];this.data=args[1];},
        onLeave() {
          if(self.closed||self.failed)return;
          try{self.relabel(new Il2Cpp.Object(this.cell),new Il2Cpp.Object(this.data));}
          catch(error){self.failed=true;self.ctx.log('Inventory IV label failed; leaving names unchanged',{error:String(error)});}
        }
      });
      this.ctx.log('IVs in inventory ready');
      return true;
    });
  }
  restore() {
    const b=this.bound,all=b.findAll.invoke(b.cell.type.object);let restored=0;
    for(let i=0;i<all.length;i++) {
      const cell=all.get(i),name=this.names.get(cell.handle.toString());
      if(typeof name!=='string')continue;
      if(!cell.method('get_gameObject',0).invoke().method('get_scene',0).invoke().method('IsValid',0).invoke())continue;
      const label=b.name.bind(cell).value;
      if(!label.isNull()){label.method('set_text',1).invoke(Il2Cpp.string(name));restored++;}
    }
    this.names.clear();
    return restored;
  }
  // Unity objects may only be used on the game thread, so names are put back
  // on the next game frame, after the synchronous module cleanup has returned.
  close() {
    if(this.closed)return;
    this.closed=true;
    if(!this.bound||!this.names.size)return;
    let done=false;
    const listener=Interceptor.attach(this.bound.frame,{onLeave:()=>{
      if(done)return;
      done=true;clearTimeout(timer);listener.detach();
      try{this.ctx.log('Inventory names restored',{cells:this.restore()});}
      catch(error){this.ctx.log('Inventory name restore failed',{error:String(error)});}
    }});
    const timer=setTimeout(()=>{if(!done){done=true;listener.detach();}},5000);
  }
};
