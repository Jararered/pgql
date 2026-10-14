'use strict';
Qol.register({
  id:'raid-pack',name:'Raid Pack',
  description:'Battles raids for you using type effectiveness, dodges charged attacks and skips raid transitions. Shows the boss and its moves when you tap a raid or a Power Spot.',
  settings:[
    {key:'autoAttack',label:'Auto-Attack',type:'boolean',default:true,description:'Uses fast attacks, and the most effective charged attack whenever there is energy for it.'},
    {key:'manualMaxBattles',label:'Disable Auto-Attack in Max Battles',type:'boolean',default:false,description:'Lets you battle Max Battle bosses yourself.'},
    {key:'autoDodge',label:'Auto Dodging',type:'boolean',default:true,description:'Dodges the boss charged attacks in raids.'},
    {key:'skipAnimations',label:'Skip Raid Transitions',type:'boolean',default:true,description:'Shortens the raid intro, approach camera, boss intro and fades, and skips the raid result screen.'},
    {key:'skipMaxBattleResult',label:'Skip Max Battle Result',type:'boolean',default:true,description:'Skips straight to the catch after winning a Max Battle.'},
    {key:'bossMovesets',label:'Boss Movesets',type:'boolean',default:true,description:'Shows the boss and its moves when you tap a raid or a Power Spot.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Raid Pack requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Raid Pack unavailable',{error:session.reason});
      Qol.disable('raid-pack',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameRaidPack(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Raid Pack action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')return {phase:'ready',reason:session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
