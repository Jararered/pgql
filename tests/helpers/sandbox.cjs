'use strict';
// Shared plumbing for suites that run real agent/** sources in a vm sandbox.
// Frida/Il2Cpp mocks stay in each suite: they differ per adapter on purpose.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const agent=path.join(__dirname,'../../agent');
// Source of agent/<file>, e.g. read('core/game-version.js').
const read=file=>fs.readFileSync(path.join(agent,file),'utf8');
// Evaluate agent files into a vm context, in order.
const load=(context,...files)=>{for(const file of files.flat())vm.runInContext(read(file),context);return context;};
// Let pending promise chains run: `rounds` turns of setImmediate (or setTimeout 0).
const flush=async(rounds=1,tick='immediate')=>{
  for(let i=0;i<rounds;i++)await new Promise(resolve=>tick==='timeout'?setTimeout(resolve,0):setImmediate(resolve));
};
module.exports={read,load,flush};
