'use strict';
// Game-independent Auto Gym Battle rules. The adapter reads the gym battle
// frame (legacy, client-driven battle system) and hands plain numbers here; the
// answer says which of the game's own battle actions to try now, if any.
globalThis.PgqlGymBattlePolicy = (() => {
  // Niantic.Holoholo.Battle.BattleFrame.PokemonFrame.FrameAction.ActionType (0.433.0).
  const actionTypes=Object.freeze({attack:0,special:1,special2:2,dodge:3});
  // Seconds before a charged attack lands in which a dodge is tried.
  const dodgeLeadSec=0.5;
  // A bench Pokemon must score this much better than the active one to swap in.
  const swapRatio=1.5,minSwapHealth=0.25;
  const manualPauseMs=1500,maxErrors=5;
  // A refused swap (the game is still bringing a Pokemon in) is retried after this.
  const swapRetryMs=1000;
  function battle() {
    return {dodged:new Set(),defender:null,swapLock:null,swapRetryAt:0,activeId:null,pauseUntil:0,errors:0,
      stats:{fast:0,charged:0,dodges:0,swaps:0,rejected:0,manual:0},lastSwap:null};
  }
  // Type matchup of a party member against the current defender.
  // fast/charged: effectiveness of its moves against the defender; defence: the
  // defender's move effectiveness against this member (1 when unknown).
  function score({fast,charged=[],defence=[]}) {
    const best=charged.length?Math.max(...charged):(fast || 1);
    const offence=0.6*(fast || 1)+0.4*best;
    const taken=defence.length?defence.reduce((a,b)=>a+b,0)/defence.length:1;
    return offence/Math.max(taken,0.1);
  }
  // The best bench member worth swapping in for the active one, or null.
  function chooseSwap(state,{now=0,active,bench}) {
    if(state.swapLock===state.defender || now<state.swapRetryAt)return null;
    let best=null;
    for(const member of bench) {
      if(member.fainted || member.health<minSwapHealth)continue;
      if(!best || member.score>best.score)best=member;
    }
    if(!best || best.score<active.score*swapRatio)return null;
    return best;
  }
  // Tracks the defender and the active member; a new defender, or an active
  // member that replaced a fainted one, allows one more swap.
  function observe(state,{defender,activeId,activeFainted}) {
    if(defender!==state.defender){state.defender=defender;state.swapLock=null;state.dodged.clear();}
    if(state.activeId!==null && activeId!==state.activeId && state.previousFainted)state.swapLock=null;
    state.activeId=activeId;state.previousFainted=!!activeFainted;
  }
  // input: {now, status (1 = active), busy (swapping or dodging), queued,
  //   enemy:{key, type, landsInSec} | null,
  //   active:{id, score, energy, fainted}, bench:[{id, index, score, health, fainted}],
  //   charged:[{move3, energy, effectiveness}],
  //   config:{autoAttack, autoDodge, autoSwap}}.
  function decide(state,input) {
    const {now,config}=input;
    if(input.status!==1)return {kind:'none',reason:'inactive'};
    if(now<state.pauseUntil)return {kind:'none',reason:'manual'};
    if(input.busy)return {kind:'none',reason:'busy'};
    if(!input.active || input.active.fainted)return {kind:'none',reason:'fainted'};
    const enemy=input.enemy;
    if(config.autoDodge && enemy && (enemy.type===actionTypes.special || enemy.type===actionTypes.special2) &&
      !state.dodged.has(enemy.key) && enemy.landsInSec>0 && enemy.landsInSec<=dodgeLeadSec)
      return {kind:'dodge',key:enemy.key};
    if(config.autoSwap) {
      const member=chooseSwap(state,input);
      if(member)return {kind:'swap',member,ratio:member.score/Math.max(input.active.score,0.01)};
    }
    if(!config.autoAttack)return {kind:'none',reason:'off'};
    if(input.queued)return {kind:'none',reason:'queued'};
    let charged=null;
    // The most effective charged move; between equally effective ones, the cheaper.
    for(const move of input.charged || [])
      if(!charged || move.effectiveness>charged.effectiveness || (move.effectiveness===charged.effectiveness && move.energy>charged.energy))charged=move;
    if(charged && charged.energy<0 && input.active.energy>=Math.abs(charged.energy))return {kind:'charged',move:charged};
    return {kind:'fast'};
  }
  // Records a tried action; ok is the game's own answer where it gives one.
  function tried(state,decision,ok,now=0) {
    if(!ok){state.stats.rejected++;if(decision.kind==='swap')state.swapRetryAt=now+swapRetryMs;return;}
    if(decision.kind==='dodge'){state.dodged.add(decision.key);state.stats.dodges++;}
    else if(decision.kind==='swap'){state.swapLock=state.defender;state.stats.swaps++;state.lastSwap=decision;}
    else state.stats[decision.kind]++;
  }
  // The player tapped swap: let the game's own action go first.
  function manual(state,now){state.pauseUntil=now+manualPauseMs;state.stats.manual++;}
  function error(state){return ++state.errors>=maxErrors;}
  function ok(state){state.errors=0;}
  // Only gyms held by another team are battled; teams are Niantic.Holoholo.Team numbers.
  function rival({gymTeam,playerTeam}) {
    if(!gymTeam)return {ok:false,reason:'neutral'};
    if(!playerTeam)return {ok:false,reason:'unknown-team'};
    if(gymTeam===playerTeam)return {ok:false,reason:'friendly'};
    return {ok:true};
  }
  return Object.freeze({actionTypes,dodgeLeadSec,swapRatio,minSwapHealth,manualPauseMs,maxErrors,swapRetryMs,
    battle,score,chooseSwap,observe,decide,tried,manual,error,ok,rival});
})();
