'use strict';
Qol.register({
  id:'inventory-ivs',name:'Shows IVs in Inventory',description:'Replaces Pokémon names in your inventory with their Attack/Defense/HP IVs.',
  actions:[{id:'status',label:'Feature status'}],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('IVs in inventory require the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('IVs in inventory unavailable',{error:session.reason});
      Qol.disable('inventory-ivs');
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameInventoryIvs(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown inventory IV action');
    const session=this.session;
    if(session.adapter && session.adapter.failed)return {phase:'failed',reason:'A label could not be updated; names are left unchanged.'};
    return {phase:session.phase,reason:session.reason};
  }
});
