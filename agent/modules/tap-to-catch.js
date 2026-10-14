'use strict';
Qol.register({
  id:'tap-to-catch',name:'Tap to Catch',
  description:'Tap a Pokémon on the map to catch it without opening the encounter. Uses your last ball, feeds the Pinap Master berry and applies Perfect Throw and Headshot when they are on. Hold the Pokémon to open the normal encounter.',
  settings:[
    {key:'ball',label:'Ball',type:'text',default:'poke',maxLength:8,validate:value=>{PgqlCatchPolicy.parse(value);},
      description:'poke, great or ultra. Follows the last ball you pick in an encounter; the cheapest ball you have is used when it runs out.'},
    {key:'holdToOpen',label:'Hold to Open',type:'boolean',default:true,description:'Press and hold a Pokémon to open the normal encounter.'},
    {key:'showToast',label:'Show Toast',type:'boolean',default:true,description:'Shows the result of each catch.'},
    {key:'showHalo',label:'Show Halo',type:'boolean',default:true,description:'Shows a pulsing ring around a Pokémon while it is being caught.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Tap to Catch requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Tap to Catch unavailable',{error:session.reason});
      Qol.disable('tap-to-catch',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameTapToCatch(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Tap to Catch action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')return {phase:'ready',reason:session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
