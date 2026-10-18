'use strict';
// Original contract audit. Runs every game adapter's bind step on the running
// build, whatever its version, and reports what each one resolved, so a new
// game build can be diffed against the last verified snapshot before any
// adapter is re-enabled. Adapters are bound, never started: no adapter hook
// is installed and no scene object is touched. The only hook is the shared
// frame scheduler's read-only ExecuteTasks observer, removed afterwards.
globalThis.PgqlContractAudit = (() => {
  const schema=1,noop=()=>{};
  let running=null;
  // [id, create(ctx), bind(adapter)] for each managed contract. Constructors
  // get stubs for their Java/Qol side channels; bind() never calls them.
  function adapters() {
    const store={load:async()=>null,save:async()=>{}};
    const plain=[
      ['main-menu',ctx=>new PgqlGameMainMenu(ctx,'PGQL',noop)],
      ['settings-screen',ctx=>new PgqlGameSettingsScreen(ctx)],
      ['instant-loading',ctx=>new PgqlGameMapRefresh(ctx)],
      ['performance-mode',ctx=>new PgqlGamePerformance(ctx)],
      ['inventory-ivs',ctx=>new PgqlGameInventoryIvs(ctx)],
      ['transfer-on-catch',ctx=>new PgqlGameTransferOnCatch(ctx)],
      ['shiny-scanner',ctx=>new PgqlGameShinyScanner(ctx)],
      ['tap-to-teleport',ctx=>new PgqlGameTapToTeleport(ctx)],
      ['cooldown-tracker',ctx=>new PgqlGameCooldown(ctx,{store})],
      ['pinap-master',ctx=>new PgqlGamePinapMaster(ctx,{select:noop})],
      ['tap-to-catch',ctx=>new PgqlGameTapToCatch(ctx,{select:noop,modules:()=>[]})],
      ['gym-feeder',ctx=>new PgqlGameGymFeeder(ctx)],
      ['auto-gym-battle',ctx=>new PgqlGameGymBattle(ctx)],
      ['raid-pack',ctx=>new PgqlGameRaidPack(ctx)],
    ].map(([id,create])=>({id,create,bind:adapter=>adapter.bind()}));
    const encounters=Object.keys(PgqlGameEncounters.features).map(id=>({id,create:ctx=>new PgqlGameEncounters(ctx),bind:adapter=>adapter.audit(id)}));
    return [...plain,...encounters];
  }
  // Mass Gift and Tamagotchi resolve their services from the live map scene,
  // so they cannot be bound offline; they stay covered by live checks.
  const unaudited={'mass-gift':'Binds against live scene services','tamagotchi':'Binds against live scene services'};
  // A ctx for one adapter. Anything beyond logging and cleanup registration
  // means the adapter tried to start, which the audit treats as a failure.
  function stub() {
    const refuse=name=>()=>{throw Error('Contract audit refused '+name);};
    return {config:{},log:noop,notify:noop,cleanup:fn=>fn,hook:refuse('hook'),interval:refuse('interval'),
      observeModules:refuse('observeModules'),teleport:refuse('teleport')};
  }
  const methodSignature=m=>(m.isStatic?'static ':'')+m.name+'('+m.parameters.map(p=>p.type.name).join(',')+'):'+m.returnType.name;
  const fieldSignature=f=>(f.isStatic?'static ':'')+f.name+':'+f.type.name;
  // Il2Cpp members found in a bind() result: the names behind every binding,
  // including obfuscated fields that adapters resolve by declared type.
  function members(value) {
    const found=new Set(),seen=new Set();
    const is=(item,name)=>typeof Il2Cpp[name]==='function' && item instanceof Il2Cpp[name];
    const visit=(item,depth)=>{
      if(!item || typeof item!=='object' || seen.has(item) || depth>4)return;
      seen.add(item);
      if(is(item,'Method')){found.add('method '+item.class.type.name+'::'+methodSignature(item));return;}
      if(is(item,'Field')){found.add('field '+item.class.type.name+'::'+fieldSignature(item));return;}
      if(is(item,'Class')){found.add('class '+item.type.name);return;}
      if(Array.isArray(item) || item instanceof Set){for(const entry of item)visit(entry,depth+1);return;}
      if(item instanceof Map){for(const entry of item.values())visit(entry,depth+1);return;}
      const proto=Object.getPrototypeOf(item);
      if(proto===Object.prototype || proto===null)for(const key of Object.keys(item))visit(item[key],depth+1);
    };
    visit(value,0);
    return [...found].sort();
  }
  function signature(klass) {
    return {parent:klass.parent?klass.parent.type.name:null,
      fields:klass.fields.map(fieldSignature).sort(),methods:klass.methods.map(methodSignature).sort()};
  }
  // Metadata thread. Returns the per-adapter results and the declared members
  // of every class any adapter resolved.
  function bindAll(version) {
    const results={},classes=new Map();
    for(const entry of adapters()) {
      let record=null;
      try {
        const adapter=entry.create(stub());
        const outcome=PgqlGameGifts.recording(()=>PgqlGameVersion.audit(version,()=>entry.bind(adapter)));
        record=outcome.record;
        results[entry.id]={ok:true,members:members(outcome.value)};
      }catch(error){
        record=error.record || null;
        results[entry.id]={ok:false,error:String(error)};
      }
      if(record) {
        results[entry.id].classes=[...record.classes.keys()].sort();
        if(record.missing.size)results[entry.id].missing=[...record.missing].sort();
        for(const [name,klass] of record.classes)classes.set(name,klass);
      }
    }
    const signatures={};
    for(const name of [...classes.keys()].sort()) {
      try{signatures[name]=signature(classes.get(name));}catch(error){signatures[name]={error:String(error)};}
    }
    return {results,signatures};
  }
  async function managed(ctx) {
    const cleanups=[];
    const game=new PgqlGameGifts({...stub(),log:ctx.log,cleanup:fn=>{cleanups.push(fn);return fn;}});
    try {
      return await game.metadata(()=>{
        const version=Il2Cpp.application.version;
        let unity=null;try{unity=Il2Cpp.unityVersion;}catch(_){}
        return {version,unity,...bindAll(version)};
      });
    }finally{for(const cleanup of cleanups.reverse())try{cleanup();}catch(error){ctx.log('Contract audit cleanup failed',{error:String(error)});}}
  }
  async function native() {
    if(!Process.findModuleByName('libholoholo.so'))return {ok:false,error:'libholoholo.so is not loaded'};
    const version=await PgqlPackageVersion();
    const adapter=new PgqlGameGoPlus(stub());
    try {
      PgqlGameVersion.audit(version,()=>adapter.bindExports(version));
      return {ok:true,version,exports:[...adapter.resolved].sort()};
    }catch(error){return {ok:false,version,error:String(error),exports:[...(adapter.resolved || [])].sort()};}
  }
  async function audit(ctx) {
    const report={schema,supported:PgqlGameVersion.supported,role:globalThis.PgqlRole || 'main',game:null,unity:null,
      adapters:{},unaudited:{...unaudited},classes:{},native:{}};
    if(report.role!=='pgp') {
      const result=await managed(ctx);
      Object.assign(report,{game:result.version,unity:result.unity,adapters:result.results,classes:result.signatures});
    }
    try{report.native['virtual-go-plus']=await native();}
    catch(error){report.native['virtual-go-plus']={ok:false,error:String(error)};}
    if(!report.game && report.native['virtual-go-plus'].version)report.game=report.native['virtual-go-plus'].version;
    const all=[...Object.values(report.adapters),...Object.values(report.native)];
    report.ok=all.length>0 && all.every(result=>result.ok);
    report.failed=[...Object.entries(report.adapters),...Object.entries(report.native)].filter(([,r])=>!r.ok).map(([id])=>id);
    ctx.log('Contract audit finished',{game:report.game,supported:report.supported,ok:report.ok,failed:report.failed});
    return report;
  }
  function run(ctx) {
    if(!running)running=audit(ctx).finally(()=>{running=null;});
    return running;
  }
  return Object.freeze({run,schema});
})();
