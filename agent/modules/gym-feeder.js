'use strict';
Qol.register({
  id:'gym-feeder',name:'Gym Feeder',
  description:'Feeds your chosen berry to the defenders when you open a gym of your team in range, a berry each in turn, until the game says they are full or the visit limit is reached.',
  settings:[
    {key:'berry',label:'Berry',type:'text',default:'razz',maxLength:16,validate:value=>{PgqlBerryPolicy.parse(value);},
      description:'pinap, razz, nanab, golden-razz, silver-pinap or off.'},
    {key:'maxPerVisit',label:'Berries per Visit',type:'text',default:'20',maxLength:3,validate:value=>{PgqlGymFeedPolicy.parseCap(value);},
      description:'The most berries fed in one gym visit, from 1 to '+PgqlGymFeedPolicy.maxCap+'.'},
    {key:'showToast',label:'Show Toast',type:'boolean',default:true,description:'Shows what was fed when a visit ends.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Gym Feeder requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Gym Feeder unavailable',{error:session.reason});
      Qol.disable('gym-feeder');
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameGymFeeder(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Gym Feeder action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')
      return {phase:session.adapter.failed?'failed':'ready',reason:(session.adapter.failed?'Stopped after an error; see the session log.\n':'')+session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
