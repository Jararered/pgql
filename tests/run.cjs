'use strict';
// Runs every tests/*.test.cjs suite in its own Node process, then the Python
// tool tests. New suites are picked up automatically; no package.json edit.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const only=process.argv.slice(2);
const suites=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.cjs')).sort()
  .filter(f=>!only.length||only.some(name=>f.includes(name)));
const failed=[];
for(const suite of suites) {
  const result=spawnSync(process.execPath,[path.join(__dirname,suite)],{stdio:'inherit'});
  if(result.status!==0)failed.push(suite);
}
if(!only.length) {
  const python=spawnSync('python3',['-m','unittest','discover','-s',__dirname,'-p','*_test.py'],{stdio:'inherit',cwd:path.join(__dirname,'..')});
  if(python.status!==0)failed.push('python unittest (*_test.py)');
}
console.log(`\n${suites.length-failed.filter(f=>f.endsWith('.cjs')).length}/${suites.length} JS suites passed`+(only.length?'':', plus Python tool tests')+'.');
if(failed.length){console.error('Failed: '+failed.join(', '));process.exit(1);}
