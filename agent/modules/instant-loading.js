'use strict';
Qol.register({
  id:'instant-loading',name:'Instant Loading',description:'Refreshes nearby Pokémon on the map much sooner.',
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Instant Loading requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Instant Loading unavailable',{error:session.reason});
      Qol.disable('instant-loading',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameMapRefresh(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Instant Loading action');
    const session=this.session,timers=session.adapter?session.adapter.status():{};
    const text=value=>value?value.min+'s moving / '+value.max+'s idle / '+value.distance+'m':'unknown';
    return {phase:session.phase,reason:session.phase==='ready'?'Game default: '+text(timers.original)+'\nNow: '+text(timers.applied):session.reason};
  }
});
