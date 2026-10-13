'use strict';
// Select the exact version profile; unsupported actions remain explicitly gated.
globalThis.PgqlGameBuddy = class PgqlGameBuddy {
  constructor(ctx) {
    this.ctx=ctx;this.closed=false;this.backend=null;
    ctx.cleanup(()=>{this.closed=true;});
  }
  async initialize() {
    if(this.closed)throw Error('Buddy adapter is disabled');
    if(this.backend)return this.backend;
    if(!PgqlGameAdapters.has('buddy'))return null;
    if(!this.initializing)this.initializing=(async()=>{
      if(globalThis.PgqlLoadIl2cpp)PgqlLoadIl2cpp();
      const version=await Il2Cpp.perform(()=>Il2Cpp.application.version,'main');
      if(this.closed)throw Error('Buddy adapter is disabled');
      const backend=PgqlGameAdapters.create('buddy',version,this.ctx);
      if(!backend||typeof backend.snapshot!=='function'||typeof backend.execute!=='function')throw Error('Invalid buddy game adapter');
      this.backend=backend;return backend;
    })();
    return this.initializing;
  }
  async snapshot(config) {
    const backend=await this.initialize();
    if(this.closed)throw Error('Buddy adapter is disabled');
    if(!backend)return {ready:false,reason:'Buddy game bindings are not verified. No buddy actions will be sent.',
      actions:Object.fromEntries(['feed','souvenir','play','snapshot','battle'].map(name=>[name,{supported:false,eligible:false}]))};
    return backend.snapshot(config);
  }
  async execute(action,request) {
    const backend=await this.initialize();
    if(this.closed)throw Error('Buddy adapter is disabled');
    if(!backend)throw Error('Buddy game bindings are not verified');
    if(!['feed','souvenir','play','snapshot','battle'].includes(action))throw Error('Unknown buddy action');
    return backend.execute(action,request);
  }
};
