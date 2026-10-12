'use strict';
// Async installation is scoped to one enable generation, mirroring the
// encounter modules. Settings apply live to a ready adapter.
globalThis.PgqlGoPlusModule = function(id,name) {
  return {
    id,name,
    settings:[
      {key:'auto-catch',label:'Auto catch Pokemon',type:'boolean',default:true},
      {key:'auto-spin',label:'Auto spin Pokestops',type:'boolean',default:true},
      {key:'auto-reconnect',label:'Auto reconnect device',type:'boolean',default:true}
    ],
    actions:[{id:'status',label:'Feature status'}],
    enable(ctx) {
      const session={phase:'initializing',reason:null,closed:false,adapter:null};
      this.session=session;
      ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
      const timer=setTimeout(()=>{
        if(session.closed)return;
        try {
          session.adapter=new PgqlGameGoPlus(ctx);
          applyConfig(ctx,session.adapter);
          Promise.resolve(session.adapter.install(id)).then(()=>{
            if(!session.closed){session.phase='ready';ctx.log(name+' ready');}
          }).catch(fail);
        } catch(error){fail(error);}
      },0);
      ctx.cleanup(()=>clearTimeout(timer));
      const fail=error=>{
        if(session.closed || this.session!==session)return;
        session.reason=String(error);session.phase='failed';
        ctx.log(name+' unavailable',{error:session.reason});
        Qol.disable(id);
      };
    },
    onConfigChanged(ctx,config) {
      if(this.session && this.session.adapter)applyConfig(ctx,this.session.adapter);
    },
    invoke(ctx,args={}) {
      if(args.action!=='status')throw Error('Unknown Virtual GO Plus action');
      const result={phase:this.session.phase,reason:this.session.reason};
      if(this.session.adapter)Object.assign(result,this.session.adapter.status());
      return result;
    }
  };
};
function applyConfig(ctx,adapter) {
  adapter.setAutoCatch(ctx.config['auto-catch']);
  adapter.setAutoSpin(ctx.config['auto-spin']);
  adapter.setAutoReconnect(ctx.config['auto-reconnect']);
}