'use strict';
// Pure orchestration: adapters supply authoritative eligibility and action keys.
// Never infer a successful interaction from a timer or an animation.
globalThis.PgqlBuddyCare = class PgqlBuddyCare {
  constructor(adapter,config,onProgress=()=>{},options={}) {
    if(!adapter || typeof adapter.snapshot!=='function' || typeof adapter.execute!=='function')throw Error('Buddy adapter requires snapshot and execute');
    this.adapter=adapter;this.config=config;this.onProgress=onProgress;
    this.timeoutMs=options.timeoutMs ?? 30000;
    this.resource='buddy-care';this.busy=false;this.closed=false;this.cancelled=false;
    this.receipts=options.receipts || new Set();
    this.state={phase:'idle',completed:0,skipped:0,failed:0,reason:null,action:null};
  }
  status(){return {...this.state,busy:this.busy,pending:PgqlAutomation.busy(this.resource)};}
  publish(changes){Object.assign(this.state,changes);try{this.onProgress(this.status());}catch(_) {}}
  cancel(){this.cancelled=true;this.publish({phase:'cancelled',reason:'Cancelled; any submitted action is still settling'});}
  close(){this.closed=true;this.cancel();}
  async request(fn){return PgqlAutomation.request(this.resource,fn,{timeoutMs:this.timeoutMs,cancelled:()=>this.closed||this.cancelled});}
  validate(snapshot) {
    if(!snapshot || typeof snapshot.ready!=='boolean')throw Error('Invalid buddy snapshot');
    if(!snapshot.ready)return snapshot;
    if(typeof snapshot.identity!=='string'||!snapshot.identity||!snapshot.actions||typeof snapshot.actions!=='object')throw Error('Invalid buddy identity or actions');
    for(const action of Object.values(snapshot.actions)) {
      if(!action||typeof action.supported!=='boolean'||typeof action.eligible!=='boolean')throw Error('Invalid buddy eligibility');
      if(action.eligible&&(!action.supported||typeof action.key!=='string'||!action.key))throw Error('Eligible action requires a supported, stable key');
    }
    return snapshot;
  }
  async preview() {
    if(this.closed)throw Error('Buddy care is disabled');
    if(this.busy||PgqlAutomation.busy(this.resource))throw Error('Buddy care is busy');
    this.busy=true;
    try{return this.validate(await PgqlAutomation.request(this.resource,()=>this.adapter.snapshot(this.config()),{timeoutMs:this.timeoutMs,cancelled:()=>this.closed}));}
    finally{this.busy=false;}
  }
  async run({resume=false}={}) {
    if(this.closed)throw Error('Buddy care is disabled');
    if(this.busy||PgqlAutomation.busy(this.resource))throw Error('Buddy care is busy; previous request may still be settling');
    if(!resume&&['stopped','cancelled'].includes(this.state.phase))return this.status();
    this.busy=true;this.cancelled=false;
    this.publish({phase:'checking',completed:0,skipped:0,failed:0,reason:null,action:null});
    let submitted=false;
    try {
      let snapshot=this.validate(await this.request(()=>this.adapter.snapshot(this.config())));
      if(!snapshot.ready){this.publish({phase:'waiting',reason:snapshot.reason||'Buddy is not ready'});this.busy=false;return this.status();}
      const identity=snapshot.identity;
      const attempted=new Set();
      // At most three normal berries and one of each other action per pass.
      const actions=['souvenir','feed','feed','feed','play','snapshot','battle'];
      for(const name of actions) {
        if(this.cancelled||this.closed)break;
        if(this.config()[name]!==true)continue;
        snapshot=this.validate(await this.request(()=>this.adapter.snapshot(this.config())));
        if(this.cancelled||this.closed)break;
        if(!snapshot.ready||snapshot.identity!==identity) {
          this.publish({phase:'waiting',reason:'Buddy or session changed; waiting for a fresh pass'});this.busy=false;return this.status();
        }
        const candidate=snapshot.actions[name];
        const key=candidate?JSON.stringify([identity,name,candidate.key]):null;
        if(!candidate||!candidate.supported||!candidate.eligible||this.receipts.has(key)||attempted.has(key)) {
          this.publish({skipped:this.state.skipped+1});continue;
        }
        // Reserve before dispatch: a lost response must never replay this key.
        if(this.receipts.size>=4096)throw Error('Buddy receipt journal is full; care stopped');
        this.receipts.add(key);attempted.add(key);
        submitted=true;this.publish({phase:'running',action:name});
        const result=await this.request(()=>this.adapter.execute(name,{identity,key:candidate.key,config:this.config()}));
        if(!result||!['success','skipped'].includes(result.outcome))throw Error(result?.reason||'Unconfirmed buddy action');
        // A confirmed pre-dispatch skip can become eligible in a later pass.
        if(result.outcome==='skipped')this.receipts.delete(key);
        submitted=false;
        this.publish(result.outcome==='success'?{completed:this.state.completed+1}:{skipped:this.state.skipped+1});
      }
      this.publish({phase:this.cancelled||this.closed?'cancelled':'waiting',action:null,
        reason:this.cancelled||this.closed?'Cancelled':'Care pass finished; waiting for eligible interactions'});
    } catch(error) {
      this.publish({phase:this.cancelled||this.closed?'cancelled':'stopped',action:null,
        failed:this.state.failed+1,reason:(submitted?'Action outcome may be unknown; no automatic retry. ':'')+String(error)});
    } finally {this.busy=false;}
    return this.status();
  }
};
