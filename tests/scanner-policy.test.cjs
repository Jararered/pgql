const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({Date});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/scanner-policy.js'),'utf8'),context);
const policy=context.PgqlScannerPolicy;

// Levels from CP multipliers, IV percentages rounded as the game shows them.
assert.equal(policy.level(0.094),1);assert.equal(policy.level(0.7317),30);assert.equal(policy.level(0.7347410093),30.5);assert.equal(policy.level(0.8453),51);
assert.equal(policy.iv({attack:15,defense:15,stamina:15}),100);assert.equal(policy.iv({attack:14,defense:15,stamina:15}),98);assert.equal(policy.iv({attack:0,defense:0,stamina:0}),0);

// Minimum IV.
assert.equal(policy.parseMinIv(' 90 '),90);assert.equal(policy.parseMinIv('0'),0);assert.equal(policy.parseMinIv('100'),100);
for(const bad of ['','101','-1','abc','9.5','15/15/15'])assert.throws(()=>policy.parseMinIv(bad),/Invalid IV/,bad);

// Ditto: the species itself, or impossible stats for a disguise species.
const pidgey={species:21,attack:10,defense:10,stamina:10,cpm:0.5974,weatherBoosted:false,strong:false};
assert.equal(policy.isDitto({...pidgey,species:132}),true);
assert.equal(policy.isDitto(pidgey),false,'level 20 unboosted Spearow is ordinary');
assert.equal(policy.isDitto({...pidgey,cpm:0.7377695}),true,'level 31 unboosted is above the wild cap');
assert.equal(policy.isDitto({...pidgey,cpm:0.7377695,strong:true}),false,'strong Pokemon may exceed the cap');
assert.equal(policy.isDitto({...pidgey,weatherBoosted:true,attack:3}),true,'boosted spawns never have IVs below 4');
assert.equal(policy.isDitto({...pidgey,weatherBoosted:true,cpm:0.29}),true,'boosted spawns are at least level 6');
assert.equal(policy.isDitto({...pidgey,weatherBoosted:true}),false);
assert.equal(policy.isDitto({...pidgey,species:150,cpm:0.79}),false,'not a disguise species');

// Medal sizes.
assert.equal(policy.badge({species:19,weight:2.4}),'tiny');assert.equal(policy.badge({species:19,weight:2.5}),null);
assert.equal(policy.badge({species:129,weight:16,pokedexWeight:10,weightStd:1.5}),'big');
assert.equal(policy.badge({species:129,weight:13,pokedexWeight:10,weightStd:1.5}),null);
assert.equal(policy.badge({species:129,weight:16,pokedexWeight:0,weightStd:0}),null,'unknown settings never match');

// One alert per Pokemon, by priority.
const config={notifyShiny:true,minIv:'100',notifyNundo:false,notifyDitto:false,notifyLegendary:true,notifyBackground:true,notifyBadge:true,notifyXxlXxs:false};
const base={...pidgey,name:'Spearow',shiny:false,background:false,size:'other',weight:1.8,pokedexWeight:1.8,weightStd:0.2,pokemonClass:'normal'};
const kind=(p,c={})=>policy.classify({...base,...p},{...config,...c})?.kind ?? null;
const hundo={attack:15,defense:15,stamina:15},zero={attack:0,defense:0,stamina:0};
assert.equal(kind({shiny:true,...hundo}),'shundo');
assert.equal(kind({shiny:true,...hundo},{notifyShiny:false,minIv:'0'}),'shundo','always alerted');
assert.equal(kind({shiny:true,...zero},{notifyShiny:false}),'shero','always alerted');
assert.equal(kind({shiny:true}),'shiny');assert.equal(kind({shiny:true},{notifyShiny:false}),null);
assert.equal(kind(zero),null);assert.equal(kind(zero,{notifyNundo:true}),'nundo');
assert.equal(kind({species:132,name:'Ditto'},{notifyDitto:true}),'ditto');assert.equal(kind({cpm:0.7377695},{notifyDitto:true}),'ditto');
assert.equal(kind({pokemonClass:'legendary',species:144}),'legendary');assert.equal(kind({pokemonClass:'mythic'}),'legendary');
assert.equal(kind({pokemonClass:'legendary'},{notifyLegendary:false}),null);
assert.equal(kind({species:19,weight:2}),'badge');assert.equal(kind({species:19,weight:2},{notifyBadge:false}),null);
assert.equal(kind(hundo),'iv');assert.equal(kind({attack:14,defense:14,stamina:14},{minIv:'90'}),'iv');assert.equal(kind(hundo,{minIv:'0'}),null);
assert.equal(kind({background:true}),'background');assert.equal(kind({background:true},{notifyBackground:false}),null);
assert.equal(kind({size:'XXL'}),null);assert.equal(kind({size:'XXL'},{notifyXxlXxs:true}),'size');
assert.equal(kind({shiny:true,background:true,pokemonClass:'legendary'}),'shiny','shiny wins over lower kinds');
assert.equal(kind({background:true,...hundo}),'iv','IV wins over background');
let alert=policy.classify({...base,shiny:true,background:true},config);
assert.equal(alert.text,'A shiny ✨Spearow✨ with background is nearby!');assert.equal(alert.important,true);
alert=policy.classify({...base,attack:14,defense:14,stamina:14},{...config,minIv:'90'});
assert.equal(alert.text,'93% Spearow is nearby!');assert.equal(alert.important,false);
assert.equal(policy.classify({...base,size:'XXS'},{...config,notifyXxlXxs:true}).text,'XXS Spearow is nearby!');

// Map markers.
assert.deepEqual({...policy.marker({...base,shiny:true,size:'XXS'})},{shiny:true,ditto:false,hundo:false,scale:0.6});
assert.deepEqual({...policy.marker({...base,...hundo,size:'XXL'})},{shiny:false,ditto:false,hundo:true,scale:1.5});
assert.deepEqual({...policy.marker({...base,cpm:0.7377695})},{shiny:false,ditto:true,hundo:false,scale:null},'disguised Ditto is redrawn');
assert.equal(policy.marker({...base,species:132}).ditto,false,'a visible Ditto needs no redraw');
assert.equal(policy.marker({...base,species:999}).scale,5.5);

// Distance: one degree of latitude is about 111.2 km.
assert.ok(Math.abs(policy.distance(0,0,1,0)-111195)<5);
assert.ok(policy.distance(51.5,-0.12,51.5009,-0.12)<101 && policy.distance(51.5,-0.12,51.5009,-0.12)>99);

// Scan cache: TTL by spawn type, sent once, hundo pause and account changes.
let now=1e6;
const cache=new policy.ScanCache(()=>now),Limits=policy.ScanCache.limits;
assert.equal(cache.useAccount('a'),true);assert.equal(cache.useAccount('a'),false);
cache.set('1','wild',{shiny:true});cache.set('2','lure',{shiny:false});
assert.equal(cache.get('1').marker.shiny,true);assert.equal(cache.has('2'),true);assert.equal(cache.has('3'),false);
now+=Limits.poi+1;
assert.equal(cache.has('2'),false,'stop spawns expire after 5 minutes');assert.equal(cache.has('1'),true);
assert.equal(cache.entries.size,1,'swept after the interval');
now+=Limits.wild;
assert.equal(cache.has('1'),false,'wild spawns expire after 30 minutes');
assert.equal(cache.markSent('9'),true);assert.equal(cache.markSent('9'),false);
cache.set('5','wild',{});cache.delete('5');assert.equal(cache.has('5'),false);
cache.sawHundo(51.5,-0.12);
assert.equal(cache.hundoPause(51.5003,-0.12),true);assert.equal(cache.hundoPause(51.502,-0.12),false,'farther than 100 m');
now+=Limits.hundo;assert.equal(cache.hundoPause(51.5003,-0.12),false,'pause ends after 20 seconds');
cache.set('6','wild',{});cache.sawHundo(0,0);
assert.equal(cache.useAccount('b'),true);
assert.equal(cache.has('6'),false);assert.equal(cache.markSent('9'),true);assert.equal(cache.hundo,null);
console.log('scanner policy tests passed');
