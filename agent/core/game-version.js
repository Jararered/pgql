'use strict';
// The one Pokemon GO build every game adapter is verified against. Adapters
// call require() before binding anything; any other build fails cleanly.
globalThis.PgqlGameVersion = Object.freeze({
  supported:'0.433.0',
  require(version,claim) {
    if(version!==this.supported)throw Error(claim+' game '+this.supported+'; found '+version);
  },
});
