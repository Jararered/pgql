'use strict';
// Register original, version-specific implementations here. Factories own their
// resources through ctx.cleanup; core automation receives only plain JS values.
globalThis.PgqlGameAdapters = (() => {
  const contracts=new Map();
  function register(capability,version,create) {
    if(typeof capability!=='string'||!capability||typeof version!=='string'||!version||typeof create!=='function')throw Error('Invalid game adapter contract');
    const key=capability+'@'+version;
    if(contracts.has(key))throw Error('Duplicate game adapter: '+key);
    contracts.set(key,create);
  }
  function has(capability){return [...contracts.keys()].some(key=>key.startsWith(capability+'@'));}
  function create(capability,version,ctx) {
    const factory=contracts.get(capability+'@'+version);
    if(!factory)throw Error('No verified '+capability+' adapter for game '+version);
    return factory(ctx);
  }
  return Object.freeze({register,has,create});
})();
