'use strict';
// Pure cooldown rules for the Cooldown Tracker: distance, the distance-to-time
// curve Pokemod 13.8.0 shows, text formats and the saved action history.
// Plain data only; no game or Frida calls.
globalThis.PgqlCooldownPolicy = (() => {
  const maxSeconds=7200,historySize=4;
  const triggers=Object.freeze({catch:'Catch Attempt',manual:'Manual',pokestop:'Pokéstop',healing:'Gym Healing',
    battle:'Gym Battle',defending:'Gym Allocation',pgp:'Go Plus'});
  // Map Pokémon kinds that never count as a cooldown action, by managed class name.
  const exemptEncounters=Object.freeze(['QuestMapPokemon','DailyEncounterMapPokemon','PokestopSpawnPokemon',
    'PhotobombingMapPokemon','StationMapPokemon','RouteMapPokemon']);
  const shadowEncounter='IncidentMapPokemon';
  // Protocol enum values (CatchPokemonOutProto.Status, FortSearchOutProto.Result).
  const catchSuccess=1,spinSuccess=1,spinOutOfRange=2;

  const validPoint=point=>!!point&&Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&
    Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180&&!(point.lat===0&&point.lon===0);
  // Haversine, in metres.
  function distance(a,b) {
    const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
    return 2*6371e3*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }
  // Cooldown seconds for a jump of the given metres.
  function seconds(meters) {
    if(meters<50)return 0;
    if(meters<30000)return Math.ceil(meters/Math.asinh(20*meters)/2)+1;
    if(meters<300000)return Math.ceil(5*Math.sqrt(16000+meters))+5;
    if(meters<1350000)return Math.min(maxSeconds,Math.ceil(meters/500+Math.sqrt(16*meters))+15);
    return maxSeconds;
  }
  // Milliseconds left before acting at `position` is safe, never negative.
  function remaining(record,position,now) {
    if(!record||!validPoint(record)||!validPoint(position))return 0;
    return Math.max(0,record.ts+seconds(distance(record,position))*1000-now);
  }
  const outOfCooldown=(record,now)=>!record||now-record.ts>=maxSeconds*1000;

  function formatTime(ms) {
    const total=Math.floor(Math.max(0,ms)/1000),s=total%60,m=Math.floor(total/60)%60,h=Math.floor(total/3600);
    if(h>2)return h+'h';
    return (h?h+'h ':'')+(m?m+'m ':'')+s+'s';
  }
  function formatShort(ms) {
    if(ms<=0)return '0s';
    const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60);
    const parts=[];if(h)parts.push(h+'h');if(m)parts.push(m+'m');
    return parts.length?parts.join(''):total%60+'s';
  }
  const formatDistance=meters=>meters<1000?Math.ceil(meters)+'m':Math.round(meters/1000)+'km';
  // The text shown while a throw is held back.
  function toast(record,position,now) {
    const left=remaining(record,position,now);
    if(!left)return null;
    return 'Cooldown: '+formatTime(left)+'\n(Distance: '+formatDistance(distance(record,position))+')';
  }
  const title=record=>(triggers[record.trigger] || 'Unknown')+(record.label?' '+record.label:'');
  // One history line: "<type> <name> — <elapsed> ago · <distance> · lat,lon".
  function describe(record,position,now) {
    const parts=[formatShort(now-record.ts)+' ago'];
    if(validPoint(position))parts.push(formatDistance(distance(record,position)));
    parts.push(record.lat.toFixed(6)+','+record.lon.toFixed(6));
    return title(record)+' — '+parts.join(' · ');
  }

  // Rules for whether a parsed response starts a cooldown.
  const catchCounts=({status,hasScores,exempt})=>!exempt&&(status===catchSuccess||hasScores);
  const spinCounts=({result,xp})=>!(result===spinSuccess&&!xp)&&result!==spinOutOfRange;
  // Error, success and flee end the encounter; an escape leaves it open.
  const catchEnds=status=>status===0||status===catchSuccess||status===3;

  function record(value) {
    if(!value||typeof value!=='object'||!Object.hasOwn(triggers,value.trigger)||!validPoint(value)||
      !Number.isFinite(value.ts)||value.ts<=0)return null;
    const label=typeof value.label==='string'&&value.label.length<=80?value.label:null;
    return Object.freeze({trigger:value.trigger,label,lat:value.lat,lon:value.lon,ts:value.ts});
  }
  // The current cooldown origin plus the previous few, newest first.
  class History {
    constructor(){this.current=null;this.previous=[];}
    save(trigger,label,position,now) {
      const next=record({trigger,label:label||null,lat:position&&position.lat,lon:position&&position.lon,ts:now});
      if(!next)throw Error('No valid player location for a cooldown record');
      if(this.current){this.previous.unshift(this.current);this.previous.length=Math.min(this.previous.length,historySize);}
      this.current=next;
      return next;
    }
    list(){return this.current?[this.current,...this.previous]:[];}
    toJSON(){return {current:this.current,previous:this.previous};}
    // Corrupt or foreign data is ignored entry by entry.
    static fromJSON(value) {
      const history=new History();
      if(value&&typeof value==='object') {
        history.current=record(value.current);
        if(Array.isArray(value.previous))history.previous=value.previous.map(record).filter(Boolean).slice(0,historySize);
      }
      return history;
    }
  }
  return Object.freeze({maxSeconds,historySize,triggers,exemptEncounters,shadowEncounter,validPoint,distance,seconds,remaining,
    outOfCooldown,formatTime,formatShort,formatDistance,toast,title,describe,catchCounts,spinCounts,catchEnds,History});
})();
