const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const cleanup=[],callbacks=[],freed=[];
const context=vm.createContext({
  PgqlGameGifts:class {constructor(){this.handleNew=()=>({isNull:()=>false});this.handleTarget=()=>({equals:()=>true});this.handleFree=h=>freed.push(h);}},
  Il2Cpp:{delegate:(_type,fn)=>({handle:{},fn})},
});
for(const file of ['core/game-adapters.js','core/buddy-policy.js','adapters/game-buddy-profile.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
const {PgqlBuddyPolicy:policy,PgqlBuddyProfile:Profile}=context;
const state={ready:true,player:'account',buddy:'buddy',day:'20739',hearts:{1:[0,0,0],2:[0]},
  food:[{id:701,setting:'useRazz',count:5},{id:703,setting:'useNanab',count:4}],onMap:false,
  poffin:false,berriesFed:7,communication:10,mapExpiration:'123',souvenir:null,bagFull:false};
const config={feed:true,play:true,souvenir:true,useRazz:true};
const snap=policy(state,config);
assert.equal(snap.actions.feed.eligible,true);assert.equal(snap.actions.play.eligible,true);
assert.equal(policy({...state,onMap:true},config).actions.feed.eligible,false);
assert.equal(policy({...state,poffin:true},config).actions.feed.eligible,false);
assert.equal(policy(state,{...config,useRazz:false}).actions.feed.eligible,false);
assert.equal(policy({...state,hearts:{1:[1,1,1],2:[1]}},config).actions.play.eligible,false);
assert.equal(policy({...state,hearts:{}},config).actions.feed.eligible,false,'missing progress cannot spend items');
assert.equal(policy({...state,food:[{id:706,setting:'useGoldenRazz',count:9}]},{useGoldenRazz:true}).actions.feed.eligible,false);
assert.equal(policy({...state,onMap:true,souvenir:'gift'},config).actions.souvenir.eligible,true);
assert.equal(policy({...state,onMap:true,souvenir:'gift',bagFull:true},config).actions.souvenir.eligible,false);
assert.equal(policy({...state,day:'20740'},config).identity===snap.identity,false);
assert.notEqual(policy({...state,berriesFed:8},config).actions.feed.key,snap.actions.feed.key);
assert.equal(snap.actions.snapshot.supported,false);assert.equal(snap.actions.battle.supported,false);
assert.equal(context.PgqlGameAdapters.has('buddy'),true);
assert.throws(()=>context.PgqlGameAdapters.create('buddy','0.432.0',{}),/No verified/);

const profile=new Profile({cleanup:fn=>cleanup.push(fn)});
const actionType={class:{}};
const then={name:'Then',parameterCount:1,parameters:[{type:{name:'System.Action<Holoholo.Rpc.BuddyStatsOutProto>',...actionType}}],
  bind:()=>({invoke:delegate=>callbacks.push(delegate.fn)})};
const error={name:'Error',parameterCount:1,parameters:[{type:{name:'System.Action<System.String>',...actionType}}],
  bind:()=>({invoke:delegate=>callbacks.push(delegate.fn)})};
const managed={handle:{},class:{hierarchy:()=>[{methods:[]},{methods:[then,error]}]}};
(async()=>{
  // RpcPromise inherits its success/string-error overloads. Both must be bound.
  const result=profile.promise(managed,value=>value+1);
  assert.equal(callbacks.length,2);assert.equal(freed.length,0);
  callbacks[1](41);assert.equal(await result,42);assert.equal(freed.length,3);
  callbacks[0]();assert.equal(freed.length,3,'late callbacks do not release twice');
  const failed=profile.promise(managed,()=>{throw Error('bad response');});
  callbacks[3](null);await assert.rejects(failed,/bad response/);assert.equal(freed.length,6);
  const disabled=profile.promise(managed,()=>{throw Error('must not convert');});
  cleanup.forEach(fn=>fn());callbacks[5](null);
  await assert.rejects(disabled,/disabled/);assert.equal(freed.length,9,'in-flight callbacks release after disable');

  // Native dispatch validates the precise service signature and sends one berry.
  const dispatch=new Profile({cleanup:()=>{}});let invocation;
  dispatch.service=()=>({});
  dispatch.method=(_service,name,args,returns)=>({invoke:(...values)=>{
    invocation={name,args,returns,values};return {};
  }});
  dispatch.promise=(_managed,convert)=>convert({});
  dispatch.checkResult=()=>{};
  assert.equal(dispatch.dispatch('feed',state,config).outcome,'success');
  assert.deepEqual(invocation.values,[701,1]);assert.equal(invocation.name,'Feed');
  assert.equal(dispatch.dispatch('feed',state,{useRazz:false}).outcome,'skipped');
  assert.equal(dispatch.dispatch('feed',{...state,food:[{id:706,setting:'useGoldenRazz',count:9}]},{useGoldenRazz:true}).outcome,'skipped');
  assert.throws(()=>dispatch.dispatch('battle',state,config),/Unsupported/);
  assert.equal(dispatch.dispatch('souvenir',state,config).outcome,'success');
  assert.equal(invocation.name,'OpenGift');
  console.log('Buddy profile eligibility, exact version registration, inherited promises, callback lifetime and native dispatch passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
