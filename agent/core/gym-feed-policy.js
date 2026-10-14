'use strict';
// Game-independent Gym Feeder rules. The adapter supplies plain gym and
// defender state; nothing here touches game objects. Berries are shared with
// Pinap Master through PgqlBerryPolicy.
globalThis.PgqlGymFeedPolicy = (() => {
  const gapMs=1500,retryMs=4000,maxRetries=3,full=0.999,maxCap=100;
  // GymFeedPokemonOutProto.Result names (0.433.0) and what each means for the visit.
  const outcomes=Object.freeze({
    Success:'fed',
    ErrorPokemonFull:'defender-done',ErrorTooFrequent:'defender-done',ErrorPokemonNotThere:'defender-done',
    ErrorTooFast:'retry',
    ErrorNoBerriesLeft:'stop',ErrorWrongTeam:'stop',ErrorNotInRange:'stop',ErrorGymBusy:'stop',ErrorRaidActive:'stop',
    ErrorGymClosed:'stop',ErrorCannotUse:'stop',ErrorWrongCount:'stop',Unset:'stop'
  });
  function classify(name){return outcomes[name] || 'stop';}
  function parseCap(text) {
    const value=String(text).trim();
    if(!/^\d+$/.test(value) || +value<1 || +value>maxCap)throw Error('Use a whole number from 1 to '+maxCap+'.');
    return +value;
  }
  // gym: {selected, playerTeam, gymTeam, inRange}; teams are Holoholo.Rpc.Team numbers.
  function eligible(gym) {
    const berry=PgqlBerryPolicy.parse(gym.selected);
    if(!berry)return {ok:false,reason:'off'};
    if(!gym.gymTeam)return {ok:false,reason:'neutral'};
    if(!gym.playerTeam || gym.gymTeam!==gym.playerTeam)return {ok:false,reason:'rival'};
    if(!gym.inRange)return {ok:false,reason:'out-of-range'};
    return {ok:true,berry};
  }
  function visit({cap,defenders=[]}) {
    return {cap,fed:0,retries:0,pending:false,lastAt:-Infinity,retryAt:0,stopped:null,
      defenders:defenders.map(d=>({id:d.id,motivation:d.motivation,fed:0,done:null}))};
  }
  // Fresh motivation from the game; defenders that left are dropped, new ones added.
  function refresh(state,defenders) {
    const known=new Map(state.defenders.map(d=>[d.id,d]));
    state.defenders=defenders.map(d=>{const old=known.get(d.id);return old?Object.assign(old,{motivation:d.motivation}):{id:d.id,motivation:d.motivation,fed:0,done:null};});
  }
  // Next defender to feed: everyone gets a berry before anyone gets a second,
  // lowest motivation first. count is the bag count of the chosen berry.
  function next(state,{now,count}) {
    if(state.stopped)return {reason:state.stopped};
    if(state.pending)return {reason:'pending'};
    if(state.fed>=state.cap)return {reason:'cap'};
    const open=state.defenders.filter(d=>!d.done && !(d.motivation>=full));
    if(!open.length)return {reason:'done'};
    if(!(count>0))return {reason:'empty'};
    const wait=Math.max(state.lastAt+gapMs,state.retryAt)-now;
    if(wait>0)return {reason:'wait',waitMs:wait};
    open.sort((a,b)=>a.fed-b.fed || a.motivation-b.motivation);
    return {id:open[0].id};
  }
  function started(state,id,now){state.pending=true;state.lastAt=now;state.current=id;}
  // Applies one server answer. Returns the outcome.
  function answered(state,id,resultName,now) {
    state.pending=false;state.current=null;
    const outcome=classify(resultName),defender=state.defenders.find(d=>d.id===id);
    if(outcome==='fed'){state.fed++;state.retries=0;if(defender)defender.fed++;}
    else if(outcome==='defender-done'){if(defender)defender.done=resultName;}
    else if(outcome==='retry'){if(++state.retries>maxRetries)state.stopped='too-fast';else state.retryAt=now+retryMs;}
    else state.stopped=resultName;
    return outcome;
  }
  function failed(state,reason){state.pending=false;state.current=null;state.stopped=reason;}
  return Object.freeze({outcomes,classify,parseCap,eligible,visit,refresh,next,started,answered,failed,gapMs,retryMs,maxRetries,maxCap});
})();
