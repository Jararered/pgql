'use strict';
// Own module runtime. Concatenated into one script; never imports recovered code.
globalThis.Qol = (() => {
  const definitions = new Map(), active = new Map(), configurations = new Map(), subscribers = new Set();
  const project = Object.freeze({name:'PGQL',fullName:'Pokemon Go QoL',version:'0.1'});
  let accepting=true;
  function event(type, detail) { send({source: 'qol', type, ...detail}); }
  function changed(type, detail) {
    event(type, detail);
    for (const listener of [...subscribers]) {
      try { listener({type,...detail}); }
      catch(e) { event('error',{message:'Settings listener: '+String(e)}); }
    }
  }
  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('Listener must be a function');
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  }
  function describe() {
    return [...definitions.values()].map(m => ({id: m.id, name: m.name, enabled: active.has(m.id),
      category:globalThis.PgqlFeatures?.get(m.id)?.category || 'Developer',
      requires:[...(globalThis.PgqlFeatures?.get(m.id)?.requires || [])],
      availability:m.availability || 'implemented',unavailableReason:m.unavailableReason || null,description:m.description || null,
      settings:m.settings.map(s=>({...s})),actions:m.actions.map(a=>({...a})),config:{...configurations.get(m.id)}}));
  }
  function register(module) {
    if (!module || typeof module.id !== 'string' || !module.id || definitions.has(module.id)) throw new Error('Duplicate/missing module id');
    if (typeof module.enable !== 'function') throw new Error('Module requires enable');
    if(module.availability!==undefined && !['implemented','experimental','planned'].includes(module.availability))throw Error('Invalid module availability');
    if(module.description!==undefined && (typeof module.description!=='string' || !module.description))throw Error('Module description must be a non-empty string');
    const settings=module.settings || [], config={}, keys=new Set();
    if (!Array.isArray(settings)) throw new Error('Settings must be an array');
    const schemas=settings.map(setting=>{
      if (!setting || typeof setting.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(setting.key) || keys.has(setting.key)) throw new Error('Duplicate/invalid setting key');
      if (setting.type !== 'boolean' || typeof setting.default !== 'boolean') throw new Error('Setting requires boolean type and default');
      if (typeof setting.label !== 'string' || !setting.label) throw new Error('Setting requires label');
      if (setting.description!==undefined && (typeof setting.description!=='string' || !setting.description)) throw new Error('Setting description must be a non-empty string');
      keys.add(setting.key); config[setting.key]=setting.default;
      return Object.freeze({key:setting.key,label:setting.label,type:setting.type,default:setting.default,
        ...(setting.description?{description:setting.description}:{})});
    });
    const actions=module.actions || [], actionIds=new Set();
    if (!Array.isArray(actions)) throw new Error('Actions must be an array');
    const actionSchemas=actions.map(action=>{
      if (!action || typeof action.id!=='string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(action.id) || actionIds.has(action.id)) throw new Error('Duplicate/invalid action id');
      if (typeof action.label!=='string' || !action.label) throw new Error('Action requires label');
      if (action.confirm!==undefined && typeof action.confirm!=='boolean') throw new Error('Action confirmation must be boolean');
      actionIds.add(action.id);
      return Object.freeze({id:action.id,label:action.label,confirm:action.confirm===true});
    });
    if(actionSchemas.length && typeof module.invoke!=='function') throw new Error('Actions require module invoke');
    definitions.set(module.id, {...module,settings:schemas,actions:actionSchemas});
    configurations.set(module.id,Object.freeze(config));
    changed('registered',{moduleId:module.id});
  }
  function setConfig(id,key,value) {
    if (!accepting) throw new Error('Runtime is stopped');
    const module=definitions.get(id);
    if (!module) throw new Error('Unknown module: '+id);
    const setting=module.settings.find(s=>s.key===key);
    if (!setting) throw new Error('Unknown setting: '+key);
    if (typeof value !== 'boolean') throw new Error('Setting value must be boolean');
    const previous=configurations.get(id);
    if (previous[key]===value) return {...previous};
    const config=Object.freeze({...previous,[key]:value});
    configurations.set(id,config);
    const state=active.get(id);
    try { if(state && module.onConfigChanged) module.onConfigChanged(state.ctx,config); }
    catch(e) { configurations.set(id,previous); throw e; }
    changed('config',{moduleId:id,key,value,config:{...config}});
    return {...config};
  }
  function disable(id) {
    const state = active.get(id);
    if (!state) return;
    active.delete(id);
    if (state.module.disable) {
      try { state.module.disable(state.ctx); } catch(e) { event('error', {moduleId:id, message:String(e)}); }
    }
    for (const cleanup of state.cleanups.reverse()) {
      try { cleanup(); } catch(e) { event('error', {moduleId:id, message:String(e)}); }
    }
    changed('disabled', {moduleId:id});
  }
  function enable(id) {
    if (!accepting) throw new Error('Runtime is stopped');
    if (active.has(id)) return;
    const module = definitions.get(id);
    if (!module) throw new Error('Unknown module: '+id);
    if(module.availability==='planned')throw Error(module.unavailableReason || 'Feature is not implemented');
    const cleanups = [];
    const ctx = {
      get config() { return configurations.get(id); },
      log: (message, details={}) => event('log', {moduleId:id, message, details}),
      cleanup: fn => { cleanups.push(fn); return fn; },
      hook: (address, callbacks) => {
        const listener = Interceptor.attach(address, callbacks);
        cleanups.push(() => listener.detach()); return listener;
      },
      interval: (fn, ms) => { const timer=setInterval(fn,ms); cleanups.push(()=>clearInterval(timer)); return timer; },
      observeModules: callbacks => {
        const observer = Process.attachModuleObserver(callbacks);
        cleanups.push(()=>observer.detach()); return observer;
      }
    };
    active.set(id,{module,ctx,cleanups});
    try { module.enable(ctx); changed('enabled',{moduleId:id}); }
    catch(e) { disable(id); throw e; }
  }
  async function invoke(id,args={}) {
    if (!accepting) throw new Error('Runtime is stopped');
    const state=active.get(id);
    if(!state) throw new Error('Module is disabled');
    if(!state.module.invoke) throw new Error('Module has no actions');
    return state.module.invoke(state.ctx,args);
  }
  async function command(message) {
    const id=message.id;
    try {
      let result;
      switch(message.action) {
        case 'list': result=describe(); break;
        case 'enable': enable(message.moduleId); result=describe(); break;
        case 'disable': disable(message.moduleId); result=describe(); break;
        case 'config': result=setConfig(message.moduleId,message.key,message.value); break;
        case 'shutdown':
          accepting=false;
          for(const moduleId of [...active.keys()]) disable(moduleId);
          changed('shutdown-complete',{id,modules:describe()});
          result={stopped:true};break;
        case 'invoke': result=await invoke(message.moduleId,message.args || {}); break;
        default: throw new Error('Unknown action');
      }
      event('response',{id,ok:true,result});
    } catch(e) { event('response',{id,ok:false,error:String(e)}); }
  }
  function listen() {
    if(!accepting)return;
    recv('command',message=>{ command(message); listen(); });
  }
  function start() {
    listen(); enable('diagnostics');
    event('agent-ready',{pid:Process.id,arch:Process.arch,modules:describe()});
  }
  return {project,register,start,describe,enable,disable,setConfig,subscribe,invoke};
})();
