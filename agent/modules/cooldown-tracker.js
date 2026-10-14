'use strict';
Qol.register({
  id:'cooldown-tracker',name:'Cooldown Tracker',
  description:'Tracks your cooldown and prevents accidental Poké Ball throws.',
  settings:[
    {key:'preventThrows',label:'Prevent Throws',type:'boolean',default:true,description:'Prevent throws while on a cooldown.'},
    {key:'rocketTp',label:'Rocket Teleport',type:'boolean',default:true,
      description:'Teleport to previous location for Shadow encounters while on cooldown (10+ seconds).'}
  ],
  actions:[
    {id:'show',label:'Show Cooldown'},
    {id:'save',label:'Manual Save'},
    {id:'return',label:'Teleport to Origin'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Cooldown Tracker requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Cooldown Tracker unavailable',{error:session.reason});
      Qol.disable('cooldown-tracker',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameCooldown(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    const session=this.session,adapter=session && session.phase==='ready'?session.adapter:null;
    if(args.action==='status') {
      if(adapter)return {phase:adapter.failed?'failed':'ready',reason:(adapter.failed?'Stopped after an error; see the session log.\n':'')+adapter.report()};
      return {phase:session?session.phase:'disabled',reason:session?session.reason:null};
    }
    if(!['show','save','return'].includes(args.action))throw Error('Unknown Cooldown Tracker action');
    if(!adapter || adapter.failed)throw Error('Cooldown Tracker is not ready'+(session&&session.reason?': '+session.reason:''));
    if(args.action==='show')return adapter.report();
    if(args.action==='save') {
      const saved=adapter.manualSave();
      return 'Saved your current position as the cooldown origin.\n'+saved.lat.toFixed(6)+','+saved.lon.toFixed(6);
    }
    const origin=adapter.history.current;
    if(!origin)throw Error('No cooldown recorded');
    if(!ctx.teleport(origin.lat,origin.lon))throw Error('Teleport refused; try again');
    return 'Teleporting to '+PgqlCooldownPolicy.title(origin)+'\n'+origin.lat.toFixed(6)+','+origin.lon.toFixed(6);
  }
});
