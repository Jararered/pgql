'use strict';
Qol.register({
  id:'auto-gym-battle',name:'Auto Gym Battle',
  description:'Battles gyms of other teams for you: attacks with the most effective moves, dodges charged attacks and swaps to a Pokémon with a better type matchup.',
  settings:[
    {key:'autoAttack',label:'Auto-Attack',type:'boolean',default:true,description:'Uses fast attacks, and the most effective charged attack whenever there is energy for it.'},
    {key:'autoDodge',label:'Auto Dodging',type:'boolean',default:true,description:'Dodges the defender\'s charged attacks just before they land.'},
    {key:'autoSwap',label:'Swap to Better Matchups',type:'boolean',default:true,
      description:'Swaps to a party Pokémon whose moves are clearly more effective against the defender, once per defender.'},
    {key:'skipCountdown',label:'Skip Next Defender Countdown',type:'boolean',default:true,
      description:'Starts the next defender\'s battle right away instead of waiting for the countdown.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Auto Gym Battle requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Auto Gym Battle unavailable',{error:session.reason});
      Qol.disable('auto-gym-battle',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameGymBattle(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Auto Gym Battle action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')return {phase:'ready',reason:session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
