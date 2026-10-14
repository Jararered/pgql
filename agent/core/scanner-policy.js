'use strict';
// Game-independent Shiny Scanner rules. The adapter supplies a plain snapshot
// of each scanned Pokemon; nothing here touches game objects.
globalThis.PgqlScannerPolicy = (() => {
  // Public CP multipliers for levels 1, 1.5, ... 51 (game master data).
  const CPM=[0.094,0.1351374318,0.16639787,0.192650919,0.21573247,0.2365726613,0.25572005,0.2735303812,0.29024988,0.3060573775,
    0.3210876,0.3354450362,0.34921268,0.3624577511,0.3752356,0.387592416,0.39956728,0.4111935514,0.4225,0.4329264091,
    0.44310755,0.4530599591,0.4627984,0.472336093,0.48168495,0.4908558003,0.49985844,0.508701765,0.51739395,0.5259425113,
    0.5343543,0.5426357375,0.5507927,0.5588305862,0.5667545,0.5745691333,0.5822789,0.5898879072,0.5974,0.6048236651,
    0.6121573,0.6194041216,0.6265671,0.6336491432,0.64065295,0.6475809666,0.65443563,0.6612192524,0.667934,0.6745818959,
    0.6811649,0.6876849038,0.69414365,0.70054287,0.7068842,0.7131691091,0.7193991,0.7255756136,0.7317,0.7347410093,
    0.7377695,0.7407855938,0.74378943,0.7467812109,0.74976104,0.7527290867,0.7556855,0.7586303683,0.76156384,0.7644861,
    0.76739717,0.7702973,0.7731865,0.77606493,0.77893275,0.7817901,0.784637,0.78747356,0.7903,0.79280394,
    0.7953,0.79780394,0.8003,0.8028039,0.8053,0.80780387,0.8103,0.81280386,0.8153,0.8178038,0.8203,
    0.8228038,0.8253,0.82780373,0.8303,0.8328037,0.8353,0.8378038,0.8403,0.84279999,0.8453];
  // Species Ditto can currently disguise itself as.
  const DISGUISES=new Set([1,4,7,14,21,23,25,27,33,43,44,50,56,58,60,74,81,88,100,104,107,109,111,118,123,161,167,183,185,209,
    216,273,283,287,293,322,341,355,396,399,415,524,529,532,535,574,577,667,704,712,759]);
  const DITTO=132,RATTATA=19,MAGIKARP=129,GIMMIGHOUL=999;
  const SCALE={XXS:0.6,XXL:1.5,gimmighoul:5.5};
  function level(cpm) {
    let best=0;
    for(let i=1;i<CPM.length;i++)if(Math.abs(cpm-CPM[i])<Math.abs(cpm-CPM[best]))best=i;
    return 1+best/2;
  }
  function iv(p){return Math.round((p.attack+p.defense+p.stamina)/45*100);}
  // A wild spawn whose stats cannot belong to the species it shows. Ditto is
  // capped at level 30 without weather boost; boosted spawns are levelled up
  // from a 4/4/4 floor.
  function isDitto(p) {
    if(p.species===DITTO)return true;
    if(!DISGUISES.has(p.species))return false;
    if(!p.weatherBoosted)return !p.strong && level(p.cpm)>30;
    return p.attack<4 || p.defense<4 || p.stamina<4 || p.cpm<0.3;
  }
  // Youngster (tiny Rattata) and Fisher (big Magikarp) medal candidates.
  function badge(p) {
    if(p.species===RATTATA && p.weight>0 && p.weight<=2.41625)return 'tiny';
    if(p.species===MAGIKARP && p.weightStd>0 && p.pokedexWeight>0 && (p.weight-p.pokedexWeight)/p.weightStd>=2.5)return 'big';
    return null;
  }
  // 0 turns the IV alert off.
  function parseMinIv(text) {
    const value=String(text).trim();
    if(!/^\d{1,3}$/.test(value) || Number(value)>100)throw Error('Invalid IV. Enter a percentage from 0 to 100; 0 turns IV alerts off.');
    return Number(value);
  }
  // One alert per Pokemon, the most notable first. Returns {kind,text,important} or null.
  function classify(p,config) {
    const percent=iv(p),name=p.name,extra=p.background?' with background':'';
    const alert=(kind,text,important=false)=>({kind,text,important});
    if(p.shiny && percent>=100)return alert('shundo','A shundo 💯 ✨'+name+'✨'+extra+' is nearby!',true);
    if(p.shiny && percent<=0)return alert('shero','A shiny 0% ✨'+name+'✨'+extra+' is nearby!',true);
    if(config.notifyShiny && p.shiny)return alert('shiny','A shiny ✨'+name+'✨'+extra+' is nearby!',true);
    if(config.notifyNundo && percent<=0)return alert('nundo','A 0% '+name+extra+' is nearby!');
    if(config.notifyDitto && isDitto(p))return alert('ditto','Wild '+name+extra+' is a hidden Ditto!');
    if(config.notifyLegendary && (p.pokemonClass==='legendary' || p.pokemonClass==='mythic'))
      return alert('legendary',(p.pokemonClass==='mythic'?'Mythical ':'Legendary ')+name+extra+' is nearby!',true);
    const medal=config.notifyBadge?badge(p):null;
    if(medal)return alert('badge','A '+medal+' '+name+extra+' is nearby!');
    const minimum=parseMinIv(config.minIv);
    if(minimum>0 && percent>=minimum)return alert('iv',percent+'% '+name+extra+' is nearby!',percent>=100);
    if(config.notifyBackground && p.background)return alert('background','A '+name+' with background is nearby!');
    if(config.notifyXxlXxs && (p.size==='XXS' || p.size==='XXL'))return alert('size',p.size+' '+name+extra+' is nearby!');
    return null;
  }
  // How the map should show a scanned Pokemon.
  function marker(p) {
    const ditto=isDitto(p);
    return {shiny:!!p.shiny,ditto:ditto && p.species!==DITTO,hundo:iv(p)>=100,
      scale:p.species===GIMMIGHOUL?SCALE.gimmighoul:SCALE[p.size] || null};
  }
  // Great-circle distance in metres.
  function distance(lat1,lon1,lat2,lon2) {
    const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
    return 2*6371008.8*Math.asin(Math.min(1,Math.sqrt(a)));
  }
  // Scan results and sent alerts for one account. Wild spawns live up to 30
  // minutes, stop spawns 5. After a 100% IV sighting, scans within 100 m pause
  // for 20 seconds.
  class ScanCache {
    constructor(now=()=>Date.now()) {
      this.now=now;this.entries=new Map();this.sent=new Map();this.swept=now();this.account=null;this.hundo=null;
    }
    static get limits(){return {wild:30*60000,poi:5*60000,sweep:60000,hundo:20000,near:100};}
    key(id){return String(id);}
    ttl(type){return type==='lure'||type==='poweruppoi'?ScanCache.limits.poi:ScanCache.limits.wild;}
    // A different account starts over; returns true when it cleared.
    useAccount(account) {
      if(this.account===account)return false;
      this.account=account;this.clear();return true;
    }
    clear(){this.entries.clear();this.sent.clear();this.hundo=null;}
    get(id) {
      this.sweep();
      const entry=this.entries.get(this.key(id));
      return entry && this.now()-entry.checkedAt<=this.ttl(entry.type)?entry:null;
    }
    has(id){return !!this.get(id);}
    set(id,type,marker){const entry={type,marker,checkedAt:this.now()};this.entries.set(this.key(id),entry);return entry;}
    delete(id){this.entries.delete(this.key(id));}
    // True the first time an alert is sent for this encounter.
    markSent(id) {
      const key=this.key(id);
      if(this.sent.has(key))return false;
      this.sent.set(key,this.now());return true;
    }
    sawHundo(lat,lon){this.hundo={at:this.now(),lat,lon};}
    hundoPause(lat,lon) {
      const h=this.hundo,limits=ScanCache.limits;
      return !!h && this.now()-h.at<limits.hundo && distance(h.lat,h.lon,lat,lon)<limits.near;
    }
    sweep() {
      const now=this.now();
      if(now-this.swept<ScanCache.limits.sweep)return;
      this.swept=now;
      for(const [key,entry] of this.entries)if(now-entry.checkedAt>this.ttl(entry.type))this.entries.delete(key);
      for(const [key,at] of this.sent)if(now-at>ScanCache.limits.wild)this.sent.delete(key);
    }
  }
  return Object.freeze({level,iv,isDitto,badge,parseMinIv,classify,marker,distance,ScanCache});
})();
