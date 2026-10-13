'use strict';
// A timeout does not cancel a native request. Retain the resource lease until it
// actually settles, including across module disable/re-enable.
globalThis.PgqlAutomation = (() => {
  const leases=new Map();
  async function request(resource,operation,{timeoutMs=30000,cancelled=()=>false}={}) {
    if(typeof resource!=='string'||!resource||typeof operation!=='function')throw Error('Invalid automation request');
    if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid request timeout');
    if(leases.has(resource))throw Error('Resource still busy: '+resource);
    if(cancelled())throw Error('Cancelled');
    const token={};leases.set(resource,token);
    let timer;
    const pending=Promise.resolve().then(()=>{
      if(cancelled())throw Error('Cancelled');
      return operation();
    }).finally(()=>{if(leases.get(resource)===token)leases.delete(resource);});
    try {
      return await Promise.race([pending,new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error('Request timed out; outcome may be unknown')),timeoutMs);
      })]);
    } finally {clearTimeout(timer);}
  }
  return Object.freeze({request,busy:resource=>leases.has(resource)});
})();
