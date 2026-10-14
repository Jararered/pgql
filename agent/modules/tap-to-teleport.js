'use strict';
Qol.register({
  id:'tap-to-teleport',name:'Tap to Teleport',
  description:'Double tap the map to move there with GPS Joystick. Needs GPS Joystick installed and spoofing.',
  settings:[
    {key:'nearbyMenu',label:'Teleport via Nearby Menu',type:'boolean',default:true,
      description:'Tapping a Pokémon, raid, showcase or Power Spot in the Nearby menu, or See in Map on a stamp, teleports there.'},
    {key:'hideMock',label:'Hide Mock Location',type:'boolean',default:true,description:'Keeps the game from seeing that the location comes from a mock provider.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Tap to Teleport requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null,bypass:new PgqlMockLocationBypass(ctx),mockError:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';session.bypass.stop();});
    this.applyMock(ctx,session,ctx.config.hideMock);
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Tap to Teleport unavailable',{error:session.reason});
      Qol.disable('tap-to-teleport',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameTapToTeleport(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  // The bypass is optional: failing to hide the mock flag never stops teleporting.
  applyMock(ctx,session,enabled) {
    if(!enabled){session.bypass.stop();session.mockError=null;return;}
    try{session.bypass.start();session.mockError=null;}
    catch(error){session.mockError=String(error);ctx.log('Mock location bypass unavailable',{error:session.mockError});}
  },
  onConfigChanged(ctx,config) {
    const session=this.session;
    if(session && !session.closed)this.applyMock(ctx,session,config.hideMock);
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Tap to Teleport action');
    const session=this.session;
    if(session.phase!=='ready')return {phase:session.phase,reason:session.reason};
    const status=session.adapter.status(),lines=['Teleports: '+status.teleports];
    if(status.last)lines.push('Last: '+status.last.latitude.toFixed(6)+','+status.last.longitude.toFixed(6)+' ('+status.last.source+')');
    if(status.limits.nearby)lines.push('Nearby menu unavailable: '+status.limits.nearby);
    if(status.limits.stamp)lines.push('Stamp teleport unavailable: '+status.limits.stamp);
    lines.push('Mock location: '+(session.bypass.active?'hidden':session.mockError?'unavailable ('+session.mockError+')':'visible'));
    return {phase:'ready',reason:lines.join('\n')};
  }
});
