'use strict';
Qol.register({
  id:'tamagotchi',name:'Tamagotchi',availability:'experimental',description:'Automatic buddy care: feeding, play and souvenirs.',
  unavailableReason:'Feeding, play and souvenirs bound for 0.433.0; automatic camera and battle flows await verification.',
  settings:[
    {key:'feed',label:'Feed buddy',type:'boolean',default:true},
    {key:'souvenir',label:'Open buddy souvenirs',type:'boolean',default:true},
    {key:'play',label:'Play with buddy',type:'boolean',default:true},
    {key:'snapshot',label:'Take buddy snapshots',type:'boolean',default:true},
    {key:'battle',label:'Battle together',type:'boolean',default:false},
    {key:'useRazz',label:'Allow Razz Berries',type:'boolean',default:true},
    {key:'useNanab',label:'Allow Nanab Berries',type:'boolean',default:false},
    {key:'usePinap',label:'Allow Pinap Berries',type:'boolean',default:false}
  ],
  actions:[{id:'preview',label:'Preview buddy care'},{id:'run',label:'Run / resume care'},
    {id:'cancel',label:'Pause care'},{id:'status',label:'Care status'}],
  enable(ctx) {
    if(globalThis.PgqlRole==='pgp')throw Error('Buddy care requires the main game process');
    if(this.retired?.busy||PgqlAutomation.busy('buddy-care'))throw Error('Previous buddy request is still settling');
    if(!this.receipts)this.receipts=new Set();
    const care=new PgqlBuddyCare(new PgqlGameBuddy(ctx),()=>ctx.config,state=>ctx.log('Buddy care progress',state),{receipts:this.receipts});
    this.session=care;
    ctx.cleanup(()=>{care.close();this.retired=care;if(this.session===care)this.session=null;});
    const tick=()=>{
      if(care.closed||care.busy||PgqlAutomation.busy('buddy-care'))return;
      care.run().catch(error=>ctx.log('Buddy care unavailable',{error:String(error)}));
    };
    ctx.interval(tick,60000);
    const timer=setTimeout(tick,0);ctx.cleanup(()=>clearTimeout(timer));
  },
  invoke(ctx,args={}) {
    const care=this.session;if(!care)throw Error('Buddy care is disabled');
    switch(args.action) {
      case 'preview':return care.preview().then(snapshot=>({ready:snapshot.ready,reason:snapshot.reason,
        actions:Object.fromEntries(Object.entries(snapshot.actions||{}).map(([name,value])=>[name,
          {enabled:ctx.config[name]===true,supported:value.supported,eligible:value.eligible,reason:value.reason}]))}));
      case 'run':return care.run({resume:true});
      case 'cancel':care.cancel();return care.status();
      case 'status':return care.status();
      default:throw Error('Unknown buddy care action');
    }
  }
});
