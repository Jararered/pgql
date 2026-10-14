'use strict';
Qol.register({
  id:'pinap-master',name:'Pinap Master',
  description:'Feeds your chosen berry automatically in wild encounters, again after every throw. Raid and Team GO Rocket encounters are skipped. Tap the berry button in the encounter berry list to change the berry.',
  settings:[
    {key:'berry',label:'Berry',type:'text',default:'pinap',maxLength:16,validate:value=>{PgqlBerryPolicy.parse(value);},
      description:'pinap, razz, nanab, golden-razz, silver-pinap or off.'},
    {key:'showToast',label:'Show Toast',type:'boolean',default:true,description:'Confirms a berry change from the encounter button.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Pinap Master requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Pinap Master unavailable',{error:session.reason});
      Qol.disable('pinap-master',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGamePinapMaster(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Pinap Master action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')
      return {phase:session.adapter.failed?'failed':'ready',reason:(session.adapter.failed?'Stopped after an error; see the session log.\n':'')+session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
