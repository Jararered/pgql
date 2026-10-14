'use strict';
// Game-independent Transfer on Catch rules. The adapter supplies a plain
// snapshot of the caught Pokemon; nothing here touches game objects.
globalThis.PgqlTransferPolicy = (() => {
  // "" (keep only 100%), a percentage 0-100, or attack/defense/stamina minimums.
  function parseMinIv(text) {
    const value=String(text).trim();
    if(value==='')return {percent:100};
    if(value.includes('/')) {
      const parts=value.split('/').map(part=>part.trim());
      if(parts.length!==3 || !parts.every(part=>/^\d{1,2}$/.test(part)))throw Error('Invalid IV format. Use a percentage or Attack/Defense/HP, e.g. 90 or 15/14/13.');
      const [attack,defense,stamina]=parts.map(Number);
      if([attack,defense,stamina].some(iv=>iv>15))throw Error("Individual IV can't be greater than 15 or less than 0.");
      return attack+defense+stamina===0?{percent:0}:{attack,defense,stamina};
    }
    if(!/^\d{1,3}$/.test(value) || Number(value)>100)throw Error('Invalid IV. Enter 0-100 or Attack/Defense/HP.');
    return {percent:Number(value)};
  }
  // Comma or space separated Pokedex numbers.
  function parseIgnoreList(text) {
    const parts=String(text).split(/[\s,]+/).filter(Boolean);
    if(!parts.every(part=>/^\d{1,4}$/.test(part) && Number(part)>0))throw Error('Enter Pokédex numbers separated by commas, e.g. 132,201.');
    return [...new Set(parts.map(Number))];
  }
  function meetsIv(pokemon,minimum) {
    if(minimum.attack!==undefined)return pokemon.attack>=minimum.attack && pokemon.defense>=minimum.defense && pokemon.stamina>=minimum.stamina;
    return minimum.percent>0 && (pokemon.attack+pokemon.defense+pokemon.stamina)/45*100>=minimum.percent;
  }
  // pokemon: {attack,defense,stamina,species,size:'XXS'|'XXL'|other,shiny,background,
  //   shadow,wildOrigin,specialBall,normalClass,transferable}
  // Returns {outcome:'transferred'|'kept-preference'|'kept-protected',reason}.
  function decide(pokemon,config,options={}) {
    const kept=(outcome,reason)=>({outcome,reason});
    if(meetsIv(pokemon,parseMinIv(config.minIv)))return kept('kept-preference','meets minimum IV');
    if((config.keepXxs && pokemon.size==='XXS') || (config.keepXxl && pokemon.size==='XXL'))return kept('kept-preference','protected size '+pokemon.size);
    if(parseIgnoreList(config.ignoreList).includes(pokemon.species))return kept('kept-preference','species on the ignore list');
    const total=pokemon.attack+pokemon.defense+pokemon.stamina,extreme=total===45 || total===0;
    if(extreme)return kept('kept-protected',total?'100% IV':'0% IV');
    if(pokemon.shadow && !config.transferShadow)return kept('kept-protected','shadow');
    if(pokemon.shiny && (!config.transferShiny || pokemon.shadow))return kept('kept-protected','shiny');
    if(pokemon.background && !config.transferBackground)return kept('kept-protected','background');
    if(!pokemon.shadow && pokemon.specialBall)return kept('kept-protected','caught with a special ball');
    if(!pokemon.normalClass)return kept('kept-protected','legendary, mythical or ultra beast');
    if(!pokemon.transferable)return kept('kept-protected','not transferable');
    if(!pokemon.wildOrigin)return kept('kept-protected','not a wild catch');
    if(options.bypassed)return kept('kept-protected','disabled for this encounter');
    return {outcome:'transferred',reason:'no keep rule matched'};
  }
  return Object.freeze({parseMinIv,parseIgnoreList,decide});
})();
