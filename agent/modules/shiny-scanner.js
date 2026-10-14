'use strict';
Qol.register({
  id:'shiny-scanner',name:'Shiny Scanner',
  description:'Checks nearby wild, lure, incense, route, photobomb and station Pokémon within 100 m and alerts you about shinies and other notable spawns. Each check is a real encounter request to the game server.',
  settings:[
    {key:'notifyShiny',label:'Notify Shinies',type:'boolean',default:true,description:'Alerts about shiny Pokémon nearby. Shiny 100% and 0% IV Pokémon are always alerted.'},
    {key:'minIv',label:'Minimum IV',type:'text',default:'100',maxLength:3,validate:value=>{PgqlScannerPolicy.parseMinIv(value);},
      description:'Alerts about Pokémon at or above this IV percentage. 0 turns IV alerts off.'},
    {key:'notifyNundo',label:'Notify Zero IVs',type:'boolean',default:false,description:'Alerts about 0% IV Pokémon nearby.'},
    {key:'notifyDitto',label:'Notify Ditto',type:'boolean',default:false,description:'Alerts about Pokémon whose stats show they are a hidden Ditto.'},
    {key:'notifyLegendary',label:'Notify Legendaries/Mythicals',type:'boolean',default:true,description:'Alerts about legendary and mythical Pokémon nearby.'},
    {key:'notifyBackground',label:'Notify Background Card',type:'boolean',default:true,description:'Alerts about Pokémon with a location background card.'},
    {key:'notifyBadge',label:'Tiny Rattata / Big Magikarp',type:'boolean',default:true,description:'Alerts about Pokémon that count toward the Youngster or Fisher medal.'},
    {key:'notifyXxlXxs',label:'Notify XXL/XXS',type:'boolean',default:false,description:'Alerts about XXL and XXS Pokémon nearby.'},
    {key:'showToast',label:'Show Toast',type:'boolean',default:true,description:'Shows alerts as a message in the game.'},
    {key:'androidNotify',label:'Android Notification',type:'boolean',default:true,description:'Also posts alerts as Android notifications from the PGQL app. Tap one to teleport there with GPS Joystick.'},
    {key:'updateModels',label:'Update Map Models',type:'boolean',default:true,description:'Shows scanned shinies as shiny, hidden Dittos as Ditto and XXS/XXL sizes on the map. Ripples are tinted either way: gold for shiny, red for 100% IV, green for scanned.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Shiny Scanner requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Shiny Scanner unavailable',{error:session.reason});
      Qol.disable('shiny-scanner');
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameShinyScanner(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Shiny Scanner action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')return {phase:'ready',reason:session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
