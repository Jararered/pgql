'use strict';
Qol.register({
  id:'transfer-on-catch',name:'Transfer on Catch',
  description:'Automatically transfers Pokémon right after you catch them, by hand or with a GO Plus, unless a keep rule below protects them. 100% and 0% IV, legendary, mythical, raid, research and egg Pokémon are always kept.',
  settings:[
    {key:'showToast',label:'Show Toast',type:'boolean',default:true,description:'Shows what happened to each caught Pokémon.'},
    {key:'minIv',label:'Min. IV',type:'text',default:'100',maxLength:8,validate:value=>{PgqlTransferPolicy.parseMinIv(value);},
      description:'Transfer Pokémon below this IV. Enter a percentage (0-100) or Attack/Defense/HP minimums such as 15/14/13. 0 turns the IV rule off.'},
    {key:'keepXxs',label:'Keep XXS',type:'boolean',default:false,description:'Protect XXS Pokémon from being transferred.'},
    {key:'keepXxl',label:'Keep XXL',type:'boolean',default:false,description:'Protect XXL Pokémon from being transferred.'},
    {key:'transferShiny',label:'Transfer Shiny',type:'boolean',default:false,description:'When ON, shiny Pokémon WILL be transferred.'},
    {key:'transferBackground',label:'Transfer Background',type:'boolean',default:false,description:'When ON, Pokémon with a background card WILL be transferred.'},
    {key:'transferShadow',label:'Transfer Shadow',type:'boolean',default:false,description:'When ON, shadow Pokémon WILL be transferred.'},
    {key:'ignoreList',label:'Ignore List',type:'text',default:'132,201,352,570,999',maxLength:400,validate:value=>{PgqlTransferPolicy.parseIgnoreList(value);},
      description:'Pokédex numbers that are never transferred, separated by commas.'}
  ],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Transfer on Catch requires the main game process');
    const session={phase:'initializing',reason:null,closed:false,adapter:null};
    this.session=session;
    ctx.cleanup(()=>{session.closed=true;session.phase='disabled';});
    const fail=error=>{
      if(session.closed || this.session!==session)return;
      session.reason=String(error);session.phase='failed';
      ctx.log('Transfer on Catch unavailable',{error:session.reason});
      Qol.disable('transfer-on-catch',{failed:true});
    };
    const timer=setTimeout(()=>{
      if(session.closed)return;
      try {
        session.adapter=new PgqlGameTransferOnCatch(ctx);
        Promise.resolve(session.adapter.start()).then(()=>{if(!session.closed)session.phase='ready';}).catch(fail);
      }catch(error){fail(error);}
    },0);
    ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    if(args.action!=='status')throw Error('Unknown Transfer on Catch action');
    const session=this.session;
    if(session.adapter && session.phase==='ready')
      return {phase:session.adapter.failed?'failed':'ready',reason:(session.adapter.failed?'Stopped after an error; see the session log.\n':'')+session.adapter.report()};
    return {phase:session.phase,reason:session.reason};
  }
});
