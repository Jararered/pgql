'use strict';
// Original sequential queue. All game access belongs to the caller's adapter.
globalThis.PgqlGiftQueue = class PgqlGiftQueue {
  constructor(adapter,onProgress=()=>{},options={}) {
    if (!adapter || ['preview','open','send'].some(key=>typeof adapter[key]!=='function')) throw new Error('Gift adapter requires preview, open and send');
    if (typeof onProgress!=='function') throw new Error('Progress callback must be a function');
    this.adapter=adapter;
    this.onProgress=onProgress;
    this.timeoutMs=options.timeoutMs===undefined?30000:options.timeoutMs;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs<=0) throw new Error('Timeout must be positive');
    this.busy=false;
    this.pendingOperations=0;
    this.cancelled=false;
    this.state={phase:'idle',completed:0,total:0,succeeded:0,skipped:0,failed:0,reason:null};
  }
  status() { return {...this.state}; }
  publish(changes) {
    Object.assign(this.state,changes);
    try { this.onProgress(this.status()); } catch (_) { /* UI failures must not replay an action. */ }
  }
  async request(operation) {
    let timer;
    this.pendingOperations++;
    const pending=Promise.resolve().then(operation).then(
      result=>{this.pendingOperations--;return result;},
      error=>{this.pendingOperations--;throw error;}
    );
    try {
      return await Promise.race([
        pending,
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Request timed out')),this.timeoutMs);})
      ]);
    } finally { clearTimeout(timer); }
  }
  async readPreview() {
    const result=await this.request(()=>this.adapter.preview());
    if (!result || !Array.isArray(result.friendIds) || result.friendIds.some(id=>typeof id!=='string'||!id) || new Set(result.friendIds).size!==result.friendIds.length || !Number.isInteger(result.giftCount) || result.giftCount<0) throw new Error('Invalid gift preview');
    return {friendIds:[...result.friendIds],giftCount:result.giftCount};
  }
  async preview(mode) {
    if(mode!==undefined && mode!=='open' && mode!=='send')throw new Error('Gift mode must be open or send');
    if (this.busy || this.pendingOperations) throw new Error('Gift queue is busy; a request may still be settling');
    this.busy=true;
    try {
      const preview=await this.readPreview();
      if(mode==='open' && typeof this.adapter.prepare==='function')await this.request(()=>this.adapter.prepare(mode,preview.friendIds));
      if(mode==='open' && typeof this.adapter.incomingCount==='function'){
        const count=await this.request(()=>this.adapter.incomingCount(preview.friendIds));
        if(!Number.isInteger(count)||count<0||count>preview.friendIds.length)throw new Error('Invalid incoming gift count');
        preview.incomingGifts=count;
      }
      return preview;
    }
    finally { this.busy=false; }
  }
  cancel() {
    if (this.busy) this.cancelled=true;
  }
  async run(mode) {
    if (mode!=='open' && mode!=='send') throw new Error('Gift mode must be open or send');
    if (this.busy || this.pendingOperations) throw new Error('Gift queue is busy; a request may still be settling');
    this.busy=true;
    this.cancelled=false;
    this.state={phase:'previewing',completed:0,total:0,succeeded:0,skipped:0,failed:0,reason:null,mode};
    this.publish({});
    let inAction=false;
    try {
      const preview=await this.readPreview();
      let giftsRemaining=preview.giftCount;
      if(!this.cancelled && typeof this.adapter.prepare==='function')await this.request(()=>this.adapter.prepare(mode,preview.friendIds));
      this.publish({total:preview.friendIds.length,phase:'running'});
      if (!this.cancelled && mode==='send' && giftsRemaining===0) {
        this.publish({phase:'stopped',reason:'No gifts available'});
        return this.status();
      }
      for (const friendId of preview.friendIds) {
        if (this.cancelled) break;
        if (mode==='send' && giftsRemaining===0) {
          this.publish({phase:'stopped',reason:'No gifts available'});
          return this.status();
        }
        inAction=true;
        const code=await this.request(()=>this.adapter[mode](friendId));
        inAction=false;
        const completed=this.state.completed+1;
        if (code===1) {
          if (mode==='send') giftsRemaining--;
          this.publish({completed,succeeded:this.state.succeeded+1});
        } else if ((mode==='open' && code===5) || (mode==='send' && [3,5,6].includes(code))) {
          this.publish({completed,skipped:this.state.skipped+1});
        } else {
          const reason=mode==='open'
            ? (code===3?'Bag is full':code===4?'Daily gift opening limit reached':'Unrecognized or unsuccessful open result: '+String(code))
            : (code===4?'No gifts available':'Unrecognized or unsuccessful send result: '+String(code));
          this.publish({completed,failed:this.state.failed+1,phase:'stopped',reason});
          return this.status();
        }
      }
      this.publish({phase:this.cancelled?'cancelled':'completed',reason:this.cancelled?'Cancelled':null});
      return this.status();
    } catch(error) {
      this.publish({phase:'stopped',failed:this.state.failed+(inAction?1:0),ambiguousAction:inAction,
        reason:(inAction?'Action outcome is ambiguous; stopped without retry: ':'Preview failed: ')+String(error)});
      return this.status();
    } finally { this.busy=false; }
  }
};
