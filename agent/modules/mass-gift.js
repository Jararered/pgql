'use strict';
Qol.register({
  id:'mass-gift',name:'Mass Gift',description:'Send or open gifts for all friends in one batch.',
  actions:[{id:'preview',label:'Preview friends and gifts'},{id:'send',label:'Send gifts',confirm:true},{id:'open',label:'Open gifts',confirm:true},{id:'cancel',label:'Cancel batch'},{id:'status',label:'Batch status'}],
  enable(ctx) {
    if(this.retiredQueue && (this.retiredQueue.busy || this.retiredQueue.pendingOperations))throw Error('Previous gift request is still settling');
    const adapter=new PgqlGameGifts(ctx);
    const queue=new PgqlGiftQueue(adapter,state=>ctx.log('Gift batch progress',state));
    this.session={adapter,queue};
    ctx.cleanup(()=>{queue.cancel();this.retiredQueue=queue;this.session=null;});
    ctx.log('Mass Gift enabled; preview before starting a batch');
  },
  invoke(ctx,args={}) {
    const session=this.session;if(!session)throw Error('Mass Gift is disabled');
    switch(args.action) {
      case 'preview':return session.queue.preview(args.mode).then(preview=>({friendCount:preview.friendIds.length,giftCount:preview.giftCount,...(preview.incomingGifts!==undefined?{incomingGifts:preview.incomingGifts}:{})}));
      case 'open':case 'send':return session.queue.run(args.action);
      case 'cancel':session.queue.cancel();return session.queue.status();
      case 'status':return session.queue.status();
      default:throw Error('Unknown Mass Gift action');
    }
  }
});
