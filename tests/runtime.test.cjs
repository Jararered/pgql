const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const events=[], disposals=[]; let receiver, observer;
const context=vm.createContext({
  send:event=>events.push(event),
  recv:(type,fn)=>{assert.equal(type,'command');receiver=fn;},
  Process:{id:123,arch:'arm64',platform:'linux',pointerSize:8,
    enumerateModules:()=>[{name:'libil2cpp.so',base:{toString:()=> '0x1000'},size:4096}],
    attachModuleObserver:callbacks=>{observer=callbacks;callbacks.onAdded({name:'existing',base:{toString:()=> '0'}});return {detach:()=>disposals.push('observer')};}},
  Interceptor:{attach:()=>({detach:()=>disposals.push('hook')})},
  setInterval:()=>1, clearInterval:()=>disposals.push('timer')
});
for(const file of ['runtime.js','modules/diagnostics.js','modules/library-watch.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
vm.runInContext('Qol.start();',context);
async function command(action,moduleId,fields={}) {
  const id=String(events.length); receiver({type:'command',id,action,moduleId,...fields});
  await new Promise(resolve=>setImmediate(resolve));
  return events.find(e=>e.type==='response'&&e.id===id);
}
(async()=>{
  assert(events.some(e=>e.type==='agent-ready'&&e.pid===123));
  assert.equal(context.Qol.project.name,'PGQL');
  assert.equal(context.Qol.project.version,'0.1');
  let descriptions=context.Qol.describe();
  const diagnostics=descriptions.find(m=>m.id==='diagnostics');
  assert.equal(diagnostics.config.includeAddresses,true);
  assert.equal(diagnostics.settings[0].label,'Include library addresses');
  diagnostics.config.includeAddresses=false;
  diagnostics.settings[0].label='changed';
  assert.equal(context.Qol.describe()[0].config.includeAddresses,true);
  assert.equal(context.Qol.describe()[0].settings[0].label,'Include library addresses');
  const changes=[];
  const unsubscribe=context.Qol.subscribe(change=>changes.push(change));
  assert.throws(()=>context.Qol.setConfig('diagnostics','includeAddresses','false'),/boolean/);
  assert.throws(()=>context.Qol.setConfig('diagnostics','unknown',true),/Unknown setting/);
  assert.throws(()=>context.Qol.setConfig('missing','includeAddresses',true),/Unknown module/);
  for (const source of [
    `Qol.register({id:'bad',enable(){},settings:[{key:'flag',label:'Flag',type:'boolean',default:'true'}]})`,
    `Qol.register({id:'bad',enable(){},settings:[{key:'flag',label:'Flag',type:'boolean',default:true},{key:'flag',label:'Duplicate',type:'boolean',default:false}]})`
  ]) assert.throws(()=>vm.runInContext(source,context));
  assert.equal(context.Qol.describe().some(m=>m.id==='bad'),false);
  for (const source of [
    `Qol.register({id:'bad-actions',enable(){},invoke(){},actions:[{id:'send',label:'Send',confirm:'yes'}]})`,
    `Qol.register({id:'bad-actions',enable(){},invoke(){},actions:[{id:'send',label:'Send'},{id:'send',label:'Duplicate'}]})`,
    `Qol.register({id:'bad-actions',enable(){},actions:[{id:'send',label:'Send'}]})`,
    `Qol.register({id:'bad-actions',enable(){},invoke(){},actions:[{id:'send',label:''}]})`
  ]) assert.throws(()=>vm.runInContext(source,context));
  assert.equal(context.Qol.describe().some(m=>m.id==='bad-actions'),false);
  vm.runInContext(`Qol.register({id:'actions',name:'Actions',enable(){},actions:[{id:'preview',label:'Preview'},{id:'send',label:'Send gifts',confirm:true},{id:'cancel',label:'Cancel'}],invoke(ctx,args){return args.action}})`,context);
  const describedActions=context.Qol.describe().find(m=>m.id==='actions').actions;
  assert.equal(describedActions[0].confirm,false);assert.equal(describedActions[1].confirm,true);
  describedActions[1].label='Changed';
  assert.equal(context.Qol.describe().find(m=>m.id==='actions').actions[1].label,'Send gifts');
  await assert.rejects(context.Qol.invoke('actions',{action:'preview'}),/disabled/);
  context.Qol.enable('actions');
  assert.equal(await context.Qol.invoke('actions',{action:'preview'}),'preview');
  assert.equal(await context.Qol.invoke('actions',{action:'send'}),'send');
  let response=await command('invoke','diagnostics');assert.equal(response.ok,true);assert.equal(response.result.gameLibraries[0].name,'libil2cpp.so');
  response=await command('config','diagnostics',{key:'includeAddresses',value:false});
  assert.equal(response.ok,true);assert.equal(response.result.includeAddresses,false);
  response=await command('invoke','diagnostics');
  assert.equal('base' in response.result.gameLibraries[0],false);
  assert(changes.some(c=>c.type==='config'&&c.key==='includeAddresses'&&c.value===false));
  const previousChangeCount=changes.length;
  context.Qol.setConfig('diagnostics','includeAddresses',false);
  assert.equal(changes.length,previousChangeCount);
  // Disabled modules retain config; callback applies only when enabled.
  vm.runInContext(`globalThis.applied=[];Qol.register({id:'configured',enable(ctx){applied.push(ctx.config.flag)},settings:[{key:'flag',label:'Flag',type:'boolean',default:true}],onConfigChanged(ctx,config){if(config.flag!==ctx.config.flag)throw Error('stale config');applied.push(config.flag);if(config.flag)throw Error('rejected config')}})`,context);
  context.Qol.setConfig('configured','flag',false);
  assert.equal(context.applied.length,0);
  context.Qol.enable('configured');assert.equal(context.applied[0],false);
  assert.throws(()=>context.Qol.setConfig('configured','flag',true),/rejected config/);
  assert.equal(context.Qol.describe().find(m=>m.id==='configured').config.flag,false);
  assert(changes.some(c=>c.type==='registered'&&c.moduleId==='configured'));
  // Text settings: bounded strings with an optional validator, alongside booleans.
  for (const source of [
    `Qol.register({id:'bad-text',enable(){},settings:[{key:'note',label:'Note',type:'text',default:'x'}]})`,
    `Qol.register({id:'bad-text',enable(){},settings:[{key:'note',label:'Note',type:'text',default:5,maxLength:4}]})`,
    `Qol.register({id:'bad-text',enable(){},settings:[{key:'note',label:'Note',type:'text',default:'toolong',maxLength:4}]})`,
    `Qol.register({id:'bad-text',enable(){},settings:[{key:'note',label:'Note',type:'text',default:'x',maxLength:4,validate:'no'}]})`,
    `Qol.register({id:'bad-text',enable(){},settings:[{key:'note',label:'Note',type:'text',default:'x',maxLength:4,validate(){throw Error('bad default')}}]})`,
    `Qol.register({id:'bad-text',enable(){},settings:[{key:'note',label:'Note',type:'number',default:1}]})`
  ]) assert.throws(()=>vm.runInContext(source,context));
  assert.equal(context.Qol.describe().some(m=>m.id==='bad-text'),false);
  vm.runInContext(`Qol.register({id:'texted',enable(){},settings:[{key:'level',label:'Level',type:'text',default:'10',maxLength:3,validate(value){if(!/^\\d*$/.test(value))throw Error('digits only')}},{key:'flag',label:'Flag',type:'boolean',default:false}]})`,context);
  const texted=()=>context.Qol.describe().find(m=>m.id==='texted');
  assert.deepEqual({...texted().settings[0]},{key:'level',label:'Level',type:'text',default:'10',maxLength:3});
  assert.equal(texted().config.level,'10');
  assert.throws(()=>context.Qol.setConfig('texted','level',42),/must be text/);
  assert.throws(()=>context.Qol.setConfig('texted','level','1234'),/at most 3/);
  assert.throws(()=>context.Qol.setConfig('texted','level','abc'),/digits only/);
  assert.throws(()=>context.Qol.setConfig('texted','flag','yes'),/boolean/);
  assert.equal(texted().config.level,'10');
  assert.equal(context.Qol.setConfig('texted','level','').level,'');
  response=await command('config','texted',{key:'level',value:'77'});
  assert.equal(response.ok,true);assert.equal(response.result.level,'77');
  assert(changes.some(c=>c.type==='config'&&c.moduleId==='texted'&&c.value==='77'));
  await command('enable','library-watch');
  context.Qol.setConfig('library-watch','logUnloads',false);
  observer.onRemoved({name:'quiet.so'});
  assert.equal(events.some(e=>e.message==='Library unloaded'&&e.details.name==='quiet.so'),false);
  context.Qol.setConfig('library-watch','logUnloads',true);
  observer.onRemoved({name:'logged.so'});
  assert(events.some(e=>e.message==='Library unloaded'&&e.details.name==='logged.so'));
  observer.onAdded({name:'new.so',base:{toString:()=> '0x2000'}});
  assert(events.some(e=>e.message==='Library loaded'&&e.details.name==='new.so'));
  await command('disable','library-watch');assert.equal(disposals.filter(x=>x==='observer').length,1);
  assert(changes.some(c=>c.type==='enabled'&&c.moduleId==='library-watch'));
  assert(changes.some(c=>c.type==='disabled'&&c.moduleId==='library-watch'));
  unsubscribe();const unsubscribedCount=changes.length;
  context.Qol.setConfig('library-watch','logUnloads',false);
  assert.equal(changes.length,unsubscribedCount);
  await command('disable','library-watch');assert.equal(disposals.filter(x=>x==='observer').length,1);
  vm.runInContext(`Qol.register({id:'broken',name:'Broken',enable(ctx){ctx.hook('address',{});ctx.interval(()=>{},10);throw Error('failed init')}})`,context);
  response=await command('enable','broken');assert.equal(response.ok,false);
  assert(disposals.includes('hook')&&disposals.includes('timer'));
  response=await command('list');assert.equal(response.result.find(x=>x.id==='broken').enabled,false);
  response=await command('invoke','library-watch');assert.equal(response.ok,false);
  // Notifications are bounded and carry only valid coordinates.
  vm.runInContext(`globalThis.notifyCtx=null;Qol.register({id:'notifier',name:'Notifier',enable(ctx){notifyCtx=ctx}})`,context);
  await command('enable','notifier');
  const notify=context.notifyCtx.notify;
  notify('Shiny Scanner','A shiny is nearby!',{latitude:51.5,longitude:-0.12,extra:'dropped'});
  notify('Scanner','No place',{latitude:Infinity,longitude:0});
  notify('Scanner','Out of range',{latitude:91,longitude:0});
  const notices=events.filter(e=>e.type==='notify');
  assert.deepEqual(notices.map(e=>[e.moduleId,e.title,e.text,{...e.details}]),[
    ['notifier','Shiny Scanner','A shiny is nearby!',{latitude:51.5,longitude:-0.12}],['notifier','Scanner','No place',{}],['notifier','Scanner','Out of range',{}]]);
  for(const [title,text] of [['','x'],['x'.repeat(81),'x'],['x',''],['x','y'.repeat(201)],[5,'x']])assert.throws(()=>notify(title,text),/Notification/);
  await command('disable','notifier');
  await command('enable','library-watch');
  response=await command('shutdown');assert.equal(response.result.stopped,true);
  assert(events.some(e=>e.type==='shutdown-complete'&&e.modules.every(m=>!m.enabled)));
  assert.equal(disposals.filter(x=>x==='observer').length,2);
  assert.throws(()=>context.Qol.enable('diagnostics'),/stopped/);
  assert.throws(()=>context.Qol.setConfig('diagnostics','includeAddresses',true),/stopped/);
  assert(events.every(e=>e.source==='qol'));
  console.log('Module runtime schema, configuration, subscriptions, lifecycle and rollback tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
