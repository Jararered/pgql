'use strict';
// Eligibility comes from server progress, never from the polling clock.
globalThis.PgqlBuddyPolicy = (state, config) => {
  if(!state.ready)return {ready:false,reason:state.reason};
  const identity=JSON.stringify([state.player,state.buddy,state.day]);
  const opportunity=(eligible,key,reason)=>({supported:true,eligible,key:JSON.stringify(key),reason});
  const remaining=category=>Array.isArray(state.hearts[category])&&state.hearts[category].includes(0);
  const allowed={701:'useRazz',703:'useNanab',705:'usePinap'};
  const berry=state.food.find(item=>allowed[item.id]===item.setting&&config[item.setting]===true&&item.count>0);
  return {ready:true,identity,actions:{
    feed:opportunity(!!berry&&!state.onMap&&!state.poffin&&remaining(1),
      ['feed',state.berriesFed,state.mapExpiration],!berry?'No permitted ordinary berries':state.onMap?'Buddy is already on the map':'Feed while hungry'),
    play:opportunity(remaining(2),['play',state.communication],'Daily play heart already earned'),
    souvenir:opportunity(!!state.souvenir&&state.onMap&&!state.bagFull,
      ['souvenir',state.souvenir],!state.souvenir?'No souvenir available':state.bagFull?'Item bag is full':'Souvenir available'),
    snapshot:{supported:false,eligible:false,reason:'Automatic camera flow is not verified'},
    battle:{supported:false,eligible:false,reason:'Automatic battle participation is not verified'}
  }};
};
