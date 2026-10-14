'use strict';
// Async installation is scoped to one enable generation. A late completion must
// never resurrect a disabled module or disable a newer enable attempt.
globalThis.PgqlEncounterModule = function(id,name,description) {
  return {
    id,name,description,
    enable(ctx) {
      const session={phase:'initializing',reason:null,closed:false,adapter:null};
      this.session=session;
      ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
      const timer=setTimeout(()=>{
        if(session.closed)return;
        try {
          session.adapter=new PgqlGameEncounters(ctx);
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
        Qol.disable(id,{failed:true});
      };
    },
    invoke(ctx,args={}) {
      if(args.action!=='status')throw Error('Unknown encounter action');
      return {phase:this.session.phase,reason:this.session.reason};
    }
  };
};
