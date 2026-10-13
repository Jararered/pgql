Qol.register({
  id:'library-watch',name:'Library load observer',
  settings:[{key:'logUnloads',label:'Log library unloads',type:'boolean',default:true}],
  enable(ctx) {
    let initialized=false;
    ctx.observeModules({
      onAdded(module) { if(initialized) ctx.log('Library loaded',{name:module.name,base:module.base.toString()}); },
      onRemoved(module) { if(ctx.config.logUnloads) ctx.log('Library unloaded',{name:module.name}); }
    });
    initialized=true;
    ctx.log('Observer installed; disable module to detach it');
  }
});
