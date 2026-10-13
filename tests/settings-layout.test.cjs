const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({send:()=>{},recv:()=>{},Process:{id:1,arch:'arm64'}});
for(const file of ['runtime.js','core/feature-catalog.js','core/settings-layout.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent',file),'utf8'),context);
const {Qol,PgqlSettingsLayout:layout}=context;
Qol.register({id:'diagnostics',name:'Target diagnostics',description:'Logs process details.',
  settings:[{key:'includeAddresses',label:'Include library addresses',type:'boolean',default:true}],enable(){}});
Qol.register({id:'tamagotchi',name:'Tamagotchi',availability:'experimental',unavailableReason:'Partly bound.',
  settings:[{key:'feed',label:'Feed buddy',type:'boolean',default:true,description:'Uses berries.'},{key:'play',label:'Play with buddy',type:'boolean',default:false}],
  actions:[{id:'run',label:'Run care'}],enable(){},invoke(){}});
Qol.register({id:'instant-catch',name:'Instant Catch',description:'Ends the encounter early.',enable(){}});
Qol.register({id:'headshot',name:'Headshot',enable(){}});
Qol.register({id:'magic-bag',name:'Magic Bag',availability:'planned',unavailableReason:'Planned — not implemented.',enable(){}});
Qol.register({id:'pgql-menu',name:'PGQL settings menu',enable(){}});
Qol.enable('instant-catch');
assert.throws(()=>Qol.register({id:'bad',name:'Bad',description:'',enable(){}}),/description/);
assert.throws(()=>Qol.register({id:'bad',name:'Bad',settings:[{key:'a',label:'A',type:'boolean',default:true,description:5}],enable(){}}),/description/);
assert.equal(Qol.describe().find(m=>m.id==='tamagotchi').settings[0].description,'Uses berries.');
assert.equal(Qol.describe().find(m=>m.id==='headshot').description,null);

const pages=layout(Qol.describe().filter(module=>module.id!=='pgql-menu'));
const plain=value=>JSON.parse(JSON.stringify(value));
// Main page: catalog categories in registration order, then the Advanced link.
assert.deepEqual(plain(pages.main.sections.map(section=>section.title)),['BUDDY','ENCOUNTERS','INVENTORY','MORE']);
assert.equal(pages.main.title,'PGQL');
const [buddy,encounters,inventory,more]=pages.main.sections;
// A module row is followed by its indented sub-toggles, then its actions.
assert.deepEqual(plain(buddy.rows.map(row=>[row.kind,row.id,row.indent])),[
  ['toggle','tamagotchi:enabled',false],['toggle','tamagotchi:feed',true],['toggle','tamagotchi:play',true],['action','tamagotchi:action:run',false]]);
assert.equal(buddy.rows[0].description,'Partly bound.','experimental modules explain their limits');
assert.equal(buddy.rows[1].description,'Uses berries.');assert.equal(buddy.rows[2].description,null);
assert.equal(buddy.rows[1].value,true);assert.equal(buddy.rows[2].value,false);assert.equal(buddy.rows[1].key,'feed');
assert.equal(buddy.rows[3].actionId,'run');assert.equal(buddy.rows[3].label,'Run care');
assert.deepEqual(plain(encounters.rows.map(row=>[row.label,row.value,row.description])),[['Instant Catch',true,'Ends the encounter early.'],['Headshot',false,null]]);
// Planned features stay on the main page as disabled rows.
assert.deepEqual(plain(inventory.rows),[{kind:'toggle',id:'magic-bag:enabled',moduleId:'magic-bag',label:'Magic Bag',description:'Planned',value:false,disabled:true,indent:false}]);
assert.deepEqual(plain(more.rows),[{kind:'link',id:'page:advanced',page:'advanced',label:'Advanced Settings',indent:false}]);
// Developer modules appear only behind Advanced Settings.
const ids=page=>page.sections.flatMap(section=>section.rows.map(row=>row.id));
assert.deepEqual(plain(ids(pages.advanced)),['diagnostics:enabled','diagnostics:includeAddresses']);
assert.equal(pages.advanced.title,'Advanced Settings');
assert.equal(ids(pages.main).some(id=>id.startsWith('diagnostics')),false);
assert.equal(ids(pages.main).concat(ids(pages.advanced)).some(id=>id.startsWith('pgql-menu')),false);
// Without developer modules there is nothing to link to.
assert.equal(layout(Qol.describe().filter(module=>module.id==='headshot')).main.sections.some(section=>section.title==='MORE'),false);
const values=layout.values(Qol.describe());
assert.equal(values['instant-catch:enabled'],true);assert.equal(values['tamagotchi:play'],false);assert.equal(values['diagnostics:includeAddresses'],true);
console.log('Settings layout categories, sub-toggles, actions, planned rows and advanced page tests passed.');
