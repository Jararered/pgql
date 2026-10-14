'use strict';
// Game-independent Pinap Master rules. The adapter supplies plain encounter
// state; nothing here touches game objects.
globalThis.PgqlBerryPolicy = (() => {
  // Setting names, in picker order, with their Holoholo.Rpc.Item constant names
  // and numbers (verified against the game's enum at bind time).
  const berries=Object.freeze([
    Object.freeze({key:'pinap',label:'Pinap Berry',item:'PinapBerry',id:705}),
    Object.freeze({key:'razz',label:'Razz Berry',item:'RazzBerry',id:701}),
    Object.freeze({key:'nanab',label:'Nanab Berry',item:'NanabBerry',id:703}),
    Object.freeze({key:'golden-razz',label:'Golden Razz Berry',item:'GoldenRazzBerry',id:706}),
    Object.freeze({key:'silver-pinap',label:'Silver Pinap Berry',item:'GoldenPinapBerry',id:708})
  ]);
  const off='off';
  function parse(text) {
    const value=String(text).trim().toLowerCase();
    if(value===off)return null;
    const berry=berries.find(b=>b.key===value);
    if(!berry)throw Error('Unknown berry. Use one of: '+berries.map(b=>b.key).join(', ')+' or off.');
    return berry;
  }
  function label(text){const berry=parse(text);return berry?berry.label:'Off';}
  // The setting value after this one, wrapping through "off".
  function next(text) {
    const berry=parse(text),keys=[...berries.map(b=>b.key),off];
    return keys[(keys.indexOf(berry?berry.key:off)+1)%keys.length];
  }
  // state: {selected:setting text, activeBerry:item id or 0, canUseBerry,
  //   special:raid/incident encounter, count:bag count of the selected berry,
  //   pending:a request is in flight, sinceLast:ms since the last use}
  // Returns {item:id} to feed, or {item:null,reason}.
  function decide(state) {
    const berry=parse(state.selected);
    if(!berry)return {item:null,reason:'off'};
    if(state.special)return {item:null,reason:'special'};
    if(state.activeBerry)return {item:null,reason:'active'};
    if(!state.canUseBerry)return {item:null,reason:'unavailable'};
    if(state.pending)return {item:null,reason:'pending'};
    if(state.sinceLast!==undefined && state.sinceLast<2000)return {item:null,reason:'throttled'};
    if(!(state.count>0))return {item:null,reason:'empty'};
    return {item:berry.id};
  }
  return Object.freeze({berries,off,parse,label,next,decide});
})();
