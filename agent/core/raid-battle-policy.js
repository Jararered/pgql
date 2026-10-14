'use strict';
// Game-independent Raid Pack battle rules. The adapter reads the battle state
// each frame and hands plain numbers here; the answer says what to submit for
// this turn, if anything. Nothing here touches game objects.
globalThis.PgqlRaidBattlePolicy = (() => {
  // Holoholo.Rpc.BattlePokemonProto.Types.MoveType (0.433.0).
  const moveTypes=Object.freeze({fast:1,charge:2,charge2:3});
  const manualPauseMs=1500,maxErrors=5;
  function battle() {
    return {lastTurn:-1,busyUntil:-1,dodge:null,seen:new Set(),pauseUntil:0,errors:0,
      stats:{fast:0,charged:0,dodges:0,rejected:0,manual:0}};
  }
  // Turns of a boss charged attack in which our Pokemon can still dodge it.
  function dodgeWindow({turn,msPerTurn,startMs,endMs}) {
    if(!(msPerTurn>0) || !(endMs>0))return null;
    return {start:turn+Math.floor(startMs/msPerTurn),end:turn+Math.ceil(endMs/msPerTurn)};
  }
  // A boss charged attack the adapter saw; each attack (by key) is dodged once.
  function bossAttack(state,{key,turn,msPerTurn,startMs,endMs}) {
    if(state.seen.has(key))return false;
    state.seen.add(key);
    const window=dodgeWindow({turn,msPerTurn,startMs,endMs});
    if(!window)return false;
    state.dodge={key,start:window.start,end:window.end,done:false};
    return true;
  }
  // The charged move with the best type effectiveness against the boss; ties keep the first.
  function bestCharged(charged) {
    let best=null;
    for(const move of charged)if(!best || move.effectiveness>best.effectiveness)best=move;
    return best;
  }
  // input: {turn, now, energy, fast:{move,type,energy,turns}, charged:[{move,type,energy,turns,effectiveness,slot}],
  // isMax, inputBlocked, config:{autoAttack, autoDodge, manualMaxBattles}}.
  function decide(state,input) {
    const {turn,now,config}=input;
    if(state.dodge && turn>state.dodge.end)state.dodge=null;
    if(input.inputBlocked)return {kind:'none',reason:'blocked'};
    if(now<state.pauseUntil)return {kind:'none',reason:'manual'};
    if(config.autoDodge && !input.isMax && state.dodge && !state.dodge.done && turn>=state.dodge.start)
      return {kind:'dodge'};
    if(!config.autoAttack)return {kind:'none',reason:'off'};
    if(input.isMax && config.manualMaxBattles)return {kind:'none',reason:'max'};
    if(turn<=state.lastTurn || turn<state.busyUntil)return {kind:'none',reason:'busy'};
    const charged=bestCharged(input.charged || []);
    if(charged && charged.energy<0 && input.energy>=Math.abs(charged.energy))return {kind:'charged',move:charged};
    if(input.fast)return {kind:'fast',move:input.fast};
    return {kind:'none',reason:'no-moves'};
  }
  // Records a submitted action so the next attack waits for this one to finish.
  function submitted(state,decision,turn) {
    if(decision.kind==='dodge'){state.dodge.done=true;state.stats.dodges++;return;}
    state.lastTurn=turn;state.busyUntil=turn+Math.max(1,decision.move.turns || 0);
    state.stats[decision.kind]++;
  }
  // The game's answer to a submitted action; a refused attack may be retried next turn.
  function answered(state,accepted) {
    if(accepted)return;
    state.stats.rejected++;state.busyUntil=-1;
  }
  // The player tapped swap, a battle item or a trainer ability: let the game's own action go first.
  function manual(state,now){state.pauseUntil=now+manualPauseMs;state.stats.manual++;}
  // Consecutive errors; true means automation should stop for this battle.
  function error(state){return ++state.errors>=maxErrors;}
  function ok(state){state.errors=0;}
  return Object.freeze({moveTypes,manualPauseMs,maxErrors,battle,dodgeWindow,bossAttack,bestCharged,decide,submitted,answered,manual,error,ok});
})();
