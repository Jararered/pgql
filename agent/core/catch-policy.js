'use strict';
// Game-independent Tap to Catch rules. The adapter supplies plain state;
// nothing here touches game objects.
globalThis.PgqlCatchPolicy = (() => {
  // Ordinary balls, cheapest first, with their Holoholo.Rpc.Item constant names
  // and numbers (verified against the game's enum at bind time). Master and
  // premium balls are never used for a map catch.
  const balls=Object.freeze([
    Object.freeze({key:'poke',label:'Poké Ball',item:'PokeBall',id:1}),
    Object.freeze({key:'great',label:'Great Ball',item:'GreatBall',id:2}),
    Object.freeze({key:'ultra',label:'Ultra Ball',item:'UltraBall',id:3})
  ]);
  function parse(text) {
    const value=String(text).trim().toLowerCase();
    const ball=balls.find(b=>b.key===value);
    if(!ball)throw Error('Unknown ball. Use one of: '+balls.map(b=>b.key).join(', ')+'.');
    return ball;
  }
  // The setting key for a ball item number, or null for any other item.
  function key(id){const ball=balls.find(b=>b.id===id);return ball?ball.key:null;}
  // state: {preferred:setting text, counts:{item id:bag count}}
  // The preferred ball when in stock, otherwise the cheapest ball in stock.
  function pickBall(state) {
    const preferred=parse(state.preferred),has=ball=>(state.counts[ball.id]||0)>0;
    if(has(preferred))return {ball:preferred,fallback:false};
    const other=balls.find(has);
    return other?{ball:other,fallback:true}:{ball:null,reason:'empty'};
  }
  // Mirrors the throw modules: Perfect Throw is an Excellent curveball with the
  // same AR+ values its request hook writes; Headshot lands the ball inside the
  // ring; otherwise a plain hit outside the ring. A tapped catch never misses.
  function throwFor({perfectThrow=false,headshot=false}={}) {
    if(perfectThrow)return {reticle:0.05,bullseye:true,spinning:true,missed:false,ar:{proximity:0.475,awareness:0,frightened:false}};
    return {reticle:1,bullseye:!!headshot,spinning:false,missed:false,ar:null};
  }
  // CatchPokemonOutProto.Types.Status constant name to an outcome.
  const outcomes={CatchSuccess:'caught',CatchFlee:'fled',CatchEscape:'escaped',CatchMissed:'missed'};
  function outcome(name){return outcomes[name] || 'error';}
  return Object.freeze({balls,parse,key,pickBall,throwFor,outcome});
})();
