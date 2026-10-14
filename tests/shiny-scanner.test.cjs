const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let serial=0,version='0.433.0';const byPointer=new Map();
const NULL_OBJECT={isNull:()=>true,handle:{toString:()=>'0'}};
function managed(values={},methods={}) {
  const id=++serial,self={handle:{id,toString:()=>String(id)},values,isNull:()=>false,method:name=>({invoke:(...args)=>methods[name](...args)})};
  byPointer.set(id,self);return self;
}
const fieldOf=key=>({bind:object=>({get value(){return object.values[key];},set value(v){object.values[key]=v;}})});
const read=file=>fs.readFileSync(path.join(__dirname,'../agent',file),'utf8');
const lookup=class {constructor(handle){return byPointer.get(handle.id)||NULL_OBJECT;}};
const pinned=[],freed=[];
const sandbox={setTimeout,clearTimeout,Date,
  Il2Cpp:{get application(){return {version};},string:content=>({content}),Object:lookup,delegate:(type,fn)=>managed({fn})},
  Interceptor:{flush:()=>{}},
  PgqlGameGifts:class {
    type(name){throw Error('Unsupported game metadata: '+name);}
    async initialize(){}
    async main(fn){return fn();}async metadata(fn){return fn();}
    handleNew(handle){pinned.push(handle.id);return {isNull:()=>false,id:handle.id};}
    handleTarget(pin){return {id:pin.id};}
    handleFree(pin){freed.push(pin.id);}
  }};
const context=vm.createContext(sandbox);
vm.runInContext(read('core/scanner-policy.js'),context);
vm.runInContext(read('core/game-version.js'),context);
vm.runInContext(read('adapters/game-toast.js'),context);
vm.runInContext(read('adapters/game-shiny-scanner.js'),context);
const Adapter=context.PgqlGameShinyScanner;
const settle=async()=>{for(let i=0;i<6;i++){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setTimeout(resolve,0));}};
const defaults={notifyShiny:true,minIv:'100',notifyNundo:false,notifyDitto:false,notifyLegendary:true,notifyBackground:true,notifyBadge:true,
  notifyXxlXxs:false,showToast:true,androidNotify:true,updateModels:true};
const common={species:21,name:'Spearow',attack:10,defense:10,stamina:10,cpm:0.5974,shiny:false,background:false,weatherBoosted:false,strong:false,
  size:'other',weight:2,pokedexWeight:2,weightStd:0.25,pokemonClass:'normal'};

function fixture(config={}) {
  const logs=[],hooks=new Map(),cleanups=[],intervals=[],notices=[],toasts=[],marks=[],requests=[];
  const state={config:{...defaults,...config},services:true,player:'p1',count:10,max:100,answer:'auto'};
  const ctx={get config(){return state.config;},log:(message,details)=>logs.push({message,details}),cleanup:fn=>cleanups.push(fn),
    hook:(address,callbacks)=>hooks.set(address,callbacks),interval:(fn,ms)=>intervals.push({fn,ms}),
    notify:(title,text,details)=>notices.push({title,text,details})};
  const adapter=new Adapter(ctx);
  const wildClass={isAssignableFrom:klass=>klass==='wild'},lureClass={isAssignableFrom:klass=>klass==='lure'};
  adapter.bound={destroyed:fieldOf('Destroyed'),
    kinds:[{type:'wild',klass:wildClass,inits:[{virtualAddress:'wild-proto'},{virtualAddress:'wild-data'}]},
      {type:'lure',klass:lureClass,inits:[{virtualAddress:'place'}]}],
    toast:{},model:{},ripple:{},names:null};
  adapter.services=()=>state.services?{player:managed({},{get_PlayerId:()=>({content:state.player}),get_MaxPokemon:()=>state.max}),
    bag:managed({},{get_Count:()=>state.count}),toast:{},proximity:{},master:{},names:null}:null;
  adapter.place=(services,object)=>({latitude:object.values.lat,longitude:object.values.lon,distance:object.values.distance});
  const pending=[];
  adapter.request=object=>{
    requests.push(object.values.id);
    if(state.answer==='auto')return Promise.resolve();
    return new Promise((resolve,reject)=>pending.push({resolve,reject}));
  };
  adapter.result=object=>object.values.pokemon || null;
  adapter.snapshot=(services,pokemon,where,type)=>({...common,...pokemon,latitude:where.latitude,longitude:where.longitude,type});
  adapter.mark=(object,kind,marker)=>marks.push({id:object.values.id,type:kind.type,marker:{...marker}});
  adapter.toast=(service,alert)=>toasts.push(alert.text);
  const spawn=(id,{type='wild',distance=40,pokemon={},lat=38.9,lon=-77}={})=>
    managed({id,distance,pokemon,lat,lon,Destroyed:false,klass:type},{get_EncounterId:()=>BigInt(id)});
  const init=async(object,address='wild-proto')=>{
    const frame={},hook=hooks.get(address);
    object.class=object.values.klass;
    hook.onEnter.call(frame,[object.handle]);hook.onLeave.call(frame);await settle();
  };
  return {adapter,ctx,logs,hooks,cleanups,intervals,notices,toasts,marks,requests,state,spawn,init,pending};
}
(async()=>{
  // Other game versions and changed metadata install nothing.
  const installed=[],bare={log:()=>{},cleanup:()=>{},hook:address=>installed.push(address),interval:()=>{},config:defaults};
  version='0.434.0';
  await assert.rejects(new Adapter(bare).start(),/supports game 0\.433\.0; found 0\.434\.0/);
  version='0.433.0';
  await assert.rejects(new Adapter(bare).start(),/Unsupported game metadata: Niantic\.Holoholo\.Map\.MapPokemon/);
  assert.equal(installed.length,0);

  // Start hooks every Initialize overload and schedules the retry timer.
  let t=fixture();
  assert.equal(await t.adapter.start(),true);
  assert.deepEqual([...t.hooks.keys()],['wild-proto','wild-data','place']);
  assert.equal(t.intervals[0].ms,10000);
  assert.equal(t.logs.at(-1).message,'Shiny Scanner ready');

  // A shiny wild spawn: one request, a toast, an Android notification and a redraw.
  let shiny=t.spawn('101',{pokemon:{shiny:true},lat:38.9001,lon:-77.0002});
  await t.init(shiny);
  assert.deepEqual(t.requests,['101']);
  assert.deepEqual(t.toasts,['A shiny ✨Spearow✨ is nearby!']);
  assert.equal(t.notices.length,1);
  assert.deepEqual({...t.notices[0],details:{...t.notices[0].details}},{title:'Shiny Scanner',text:'A shiny ✨Spearow✨ is nearby!',details:{latitude:38.9001,longitude:-77.0002}});
  assert.deepEqual(t.marks,[{id:'101',type:'wild',marker:{shiny:true,ditto:false,hundo:false,scale:null}}]);
  assert.equal(t.adapter.stats.alerts,1);assert.equal(t.adapter.stats.results,1);
  assert.ok(pinned.length>0 && pinned.every(id=>freed.includes(id)),'every retained object released');

  // Seen again (a new map object for the same spawn): redrawn from the cache,
  // no new request and no second alert.
  await t.init(t.spawn('101',{pokemon:{shiny:true}}),'wild-data');
  assert.deepEqual(t.requests,['101']);assert.equal(t.toasts.length,1);assert.equal(t.notices.length,1);
  assert.equal(t.marks.length,2);assert.equal(t.marks[1].marker.shiny,true);

  // Ordinary results are marked but not alerted; settings switch outputs off.
  await t.init(t.spawn('102'));
  assert.equal(t.toasts.length,1);assert.equal(t.marks.at(-1).id,'102');
  t.state.config={...defaults,showToast:false,androidNotify:false};
  await t.init(t.spawn('103',{pokemon:{background:true}}));
  assert.equal(t.toasts.length,1);assert.equal(t.notices.length,1);assert.equal(t.adapter.stats.alerts,2);
  assert.equal(t.adapter.stats.last.text,'A Spearow with background is nearby!');
  t.state.config={...defaults};

  // A spawn of the wrong class on a shared Initialize is ignored.
  await t.init(t.spawn('104',{type:'wild'}),'place');
  assert.equal(t.requests.includes('104'),false);
  // A lure spawn uses its own kind.
  await t.init(t.spawn('105',{type:'lure',pokemon:{pokemonClass:'legendary',name:'Articuno',species:144}}),'place');
  assert.equal(t.marks.at(-1).type,'lure');assert.equal(t.toasts.at(-1),'Legendary Articuno is nearby!');

  // Far spawns wait and are scanned once the player is close.
  const far=t.spawn('106',{distance:150});
  await t.init(far);
  assert.equal(t.requests.includes('106'),false);assert.equal(t.adapter.stats.far,1);assert.equal(t.adapter.waiting.has('106'),true);
  await t.init(t.spawn('106'));
  assert.equal(t.requests.includes('106'),false,'a waiting spawn is not queued twice');
  far.values.distance=60;t.intervals[0].fn();await settle();
  assert.equal(t.requests.filter(id=>id==='106').length,1);assert.equal(t.adapter.waiting.has('106'),false);
  // Destroyed map objects are released without a request.
  const gone=t.spawn('107',{distance:150});
  await t.init(gone);gone.values.Destroyed=true;t.intervals[0].fn();await settle();
  assert.equal(t.adapter.waiting.has('107'),false);assert.equal(t.requests.includes('107'),false);

  // A 100% IV pauses scans within 100 m for 20 seconds.
  await t.init(t.spawn('108',{pokemon:{attack:15,defense:15,stamina:15},lat:40,lon:-75}));
  assert.equal(t.toasts.at(-1),'100% Spearow is nearby!');
  await t.init(t.spawn('109',{lat:40.0003,lon:-75}));
  assert.equal(t.requests.includes('109'),false);assert.equal(t.adapter.stats.hundoPause,1);
  await t.init(t.spawn('110',{lat:41,lon:-75}));
  assert.equal(t.requests.includes('110'),true,'farther spawns are still scanned');

  // Full storage pauses scans; account changes start a fresh cache.
  t.state.count=100;t.adapter.storage.checkedAt=0;
  await t.init(t.spawn('111'));
  assert.equal(t.requests.includes('111'),false);assert.equal(t.adapter.stats.storageFull,1);
  assert.equal(t.logs.some(entry=>entry.message==='Pokémon storage is full; pausing scans'),true);
  t.state.count=10;t.state.player='p2';const noticed=t.notices.length;
  await t.init(t.spawn('101',{pokemon:{shiny:true}}));
  assert.equal(t.requests.filter(id=>id==='101').length,2,'cache cleared for the new account');
  assert.equal(t.notices.length,noticed+1,'alerts are per account');

  // Request errors and empty results are logged and do not stop scanning.
  t.adapter.request=()=>Promise.reject(Error('boom'));
  await t.init(t.spawn('112'));
  assert.equal(t.adapter.stats.errors,1);assert.match(t.logs.at(-1).details.error,/boom/);
  t.adapter.request=()=>Promise.resolve();
  await t.init(t.spawn('113',{pokemon:null}));
  assert.equal(t.logs.at(-1).message,'Shiny Scanner got no encounter result');
  await t.close?.();

  // One request at a time; a request without an answer clears the queue.
  t=fixture();t.state.answer='hold';
  await t.adapter.start();
  Object.defineProperty(Adapter,'timeoutMs',{get:()=>30,configurable:true});
  for(const id of ['201','202','203'])await t.init(t.spawn(id));
  assert.deepEqual(t.requests,['201']);assert.equal(t.adapter.queue.length,2);
  t.pending[0].resolve();await settle();
  assert.deepEqual(t.requests,['201','202']);
  await new Promise(resolve=>setTimeout(resolve,60));await settle();
  assert.equal(t.adapter.stats.timeouts,1);assert.equal(t.adapter.queue.length,0);assert.equal(t.adapter.active,null);
  assert.equal(t.logs.some(entry=>entry.message==='Shiny Scanner request timed out; clearing the queue'),true);
  t.pending[1].resolve();await settle();
  assert.deepEqual(t.requests,['201','202'],'a late answer schedules nothing new');
  // The queue is bounded.
  t.state.answer='hold';Object.defineProperty(Adapter,'timeoutMs',{get:()=>15000,configurable:true});
  for(let i=0;i<70;i++)await t.init(t.spawn(String(300+i)));
  assert.equal(t.adapter.queue.length,Adapter.maxQueue);
  assert.equal(t.logs.at(-1).message,'Shiny Scanner queue full; spawn skipped');

  // Closing releases every retained object and ignores later hooks.
  const waiting=t.spawn('400',{distance:500});
  t.adapter.queue.splice(0);t.adapter.queued.clear();clearTimeout(t.adapter.active.timer);t.adapter.active=null;
  await t.init(waiting);
  const before=freed.length;
  for(const cleanup of t.cleanups)cleanup();
  assert.equal(t.adapter.closed,true);assert.equal(t.adapter.waiting.size,0);assert.ok(freed.length>before);
  await t.init(t.spawn('401'));
  assert.equal(t.requests.includes('401'),false);

  // The report names results, skips and unavailable optional parts.
  t=fixture();
  t.adapter.stats={requests:5,results:4,alerts:1,far:2,hundoPause:1,storageFull:0,timeouts:1,errors:0,last:{text:'A shiny ✨Spearow✨ is nearby!',latitude:38.9,longitude:-77}};
  t.adapter.limits={route:'Unsupported encounter result',model:'boom'};
  assert.equal(t.adapter.report(),['Scanned: 4 of 5 requests (1 timed out)','Alerts: 1','Skipped: 2 too far, 1 near a 100%, 0 storage full',
    'Last: A shiny ✨Spearow✨ is nearby! (38.90000, -77.00000)','Route spawns unavailable: Unsupported encounter result','Model updates unavailable: boom'].join('\n'));

  // Ripple tint picks the color by priority.
  t=fixture();
  const set=[];
  const color={field:name=>({set value(v){set.push([name,v]);}}),unbox:()=>'color'};
  t.adapter.bound.ripple={particles:{type:{object:'ps'}},color:{alloc:()=>color}};
  const particles=managed({},{set_startColor:value=>set.push(['start',value]),get_gameObject:()=>holder});
  const holder=managed({},{SetActive:value=>set.push(['active',value]),GetComponent:()=>particles});
  holder.method=name=>name==='GetComponent'?{overload:()=>({invoke:()=>particles})}:{invoke:value=>set.push(['active',value])};
  const kind={ripple:{type:{name:'UnityEngine.GameObject'},bind:()=>({value:holder})}};
  t.adapter.tint({},kind,{hundo:true,shiny:true});
  assert.deepEqual(set,[['r',1],['g',0.392],['b',0.431],['a',1],['active',true],['start','color']]);
  set.length=0;t.adapter.tint({},kind,{hundo:false,shiny:true});assert.deepEqual(set.slice(0,3),[['r',1],['g',0.875],['b',0.333]]);
  set.length=0;t.adapter.tint({},kind,{hundo:false,shiny:false});assert.deepEqual(set.slice(0,3),[['r',0.2],['g',0.42],['b',0.282]]);
  console.log('Shiny Scanner adapter tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
