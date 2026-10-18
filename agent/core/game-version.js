'use strict';
// The one Pokemon GO build every game adapter is verified against. Adapters
// call require() before binding anything; any other build fails cleanly.
globalThis.PgqlGameVersion = (() => {
  let candidate=null;
  return Object.freeze({
    supported:'0.433.0',
    require(version,claim) {
      if(version===this.supported || (candidate!==null && version===candidate))return;
      throw Error(claim+' game '+this.supported+'; found '+version);
    },
    // Contract audit only: accepts one unverified build for the synchronous
    // duration of fn. JS cannot interleave inside it, so a module enabled at
    // the same time still sees the strict gate. fn must bind metadata only.
    audit(version,fn) {
      if(typeof version!=='string' || !version || typeof fn!=='function')throw Error('Invalid contract audit');
      if(candidate!==null)throw Error('Contract audit already running');
      candidate=version;
      try{return fn();}finally{candidate=null;}
    },
  });
})();
