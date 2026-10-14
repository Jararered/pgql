'use strict';
// Async installation is scoped to one enable generation, mirroring the
// encounter modules. Settings apply live to a ready adapter.
//
// The game's accessory stack runs in its :pgp service process, so the hooks
// are only installed by the agent loaded there (PgqlRole 'pgp'). In the main
// game process the module is a front: the controller mirrors its
// enable/disable/config events to the :pgp agent and reports that agent's
// log lines back through the internal 'companion' invoke.
globalThis.PgqlGoPlusModule = function(id,name) {
  return {
    id,name,description:'Pairs the game with a virtual GO Plus accessory.',
    settings:[
      {key:'auto-catch',label:'Auto catch Pokemon',type:'boolean',default:true},
      {key:'auto-spin',label:'Auto spin Pokestops',type:'boolean',default:true},
      {key:'auto-reconnect',label:'Auto reconnect device',type:'boolean',default:true}
    ],
    enable(ctx) {
      const session={phase:'initializing',reason:null,closed:false,adapter:null,companion:null};
      this.session=session;
      ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
      if(globalThis.PgqlRole!=='pgp') {
        session.phase='companion';
        ctx.log(name+' requested; hooks run in the game :pgp process');
        return;
      }
      const timer=setTimeout(()=>{
        if(session.closed)return;
        try {
          session.adapter=new PgqlGameGoPlus(ctx);
          applyConfig(ctx,session.adapter);
          Promise.resolve(session.adapter.install(id)).then(()=>{
            if(!session.closed){session.phase='ready';ctx.log(name+' ready',session.adapter.status());}
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
      if(args.action==='companion' && this.session.phase==='companion') {
        this.session.companion={message:String(args.message),details:{...this.session.companion?.details,...args.details}};
        return true;
      }
      if(args.action!=='status')throw Error('Unknown Virtual GO Plus action');
      const result={phase:this.session.phase,reason:this.session.reason};
      if(this.session.companion){
        result.companion=this.session.companion;
        const details=this.session.companion.details;
        for(const key of ['connected','device','counters','autoCatch','autoSpin','autoReconnect'])
          if(details[key]!==undefined)result[key]=details[key];
      }
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