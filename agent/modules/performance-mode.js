'use strict';
Qol.register({
  id:'performance-mode',name:'Performance Mode',description:'Reduces lag and heat by lowering visual quality.',
  settings:[
    {key:'weather',label:'Hide weather effects',description:'Rain, snow, wind and fog effects on the map.',type:'boolean',default:true},
    {key:'sky',label:'Hide clouds',description:'Stops drawing the cloud layers in the sky.',type:'boolean',default:true},
    {key:'quality',label:'Lower render quality',description:'Lowest quality level at reduced resolution.',type:'boolean',default:true},
    {key:'roads',label:'Remove roads',description:'Stops drawing roads on the map.',type:'boolean',default:false}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Performance Mode requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null,state:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Performance Mode unavailable',{error:session.reason});
      Qol.disable('performance-mode',{failed:true});
    };
    session.apply=()=>Promise.resolve(session.adapter.apply(ctx.config)).then(state=>{
      if(session.closed)return;
      session.state=state;session.phase='ready';
    });
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try{session.adapter=new PgqlGamePerformance(ctx);session.apply().catch(fail);}catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
    // The game can switch weather or clouds back on; re-assert periodically.
    ctx.interval(()=>{
      if(!session.closed && session.phase==='ready')session.apply().catch(error=>ctx.log('Performance Mode refresh failed',{error:String(error)}));
    },30000);
  },
  onConfigChanged(ctx) {
    const session=this.session;
    if(session && !session.closed && session.adapter)session.apply().catch(error=>ctx.log('Performance Mode change failed',{error:String(error)}));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Performance Mode action');
    const session=this.session,labels={weather:'Weather effects hidden',sky:'Clouds hidden',quality:'Lower render quality',roads:'Roads removed'};
    return {phase:session.phase,reason:session.state?Object.entries(session.state).map(([key,value])=>labels[key]+': '+value).join('\n'):session.reason};
  }
});
