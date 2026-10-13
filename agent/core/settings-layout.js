'use strict';
// Pure view model for the settings screens: plain data, no game or UI calls.
// Developer modules live on the Advanced Settings page; everything else is
// grouped by catalog category on the main page. Sub-toggles are indented under
// their module; action buttons span the card, as the game's own buttons do.
globalThis.PgqlSettingsLayout = function(modules) {
  const advanced='Developer';
  function rows(module) {
    if(module.availability==='planned')
      return [{kind:'toggle',id:module.id+':enabled',moduleId:module.id,label:module.name,description:'Planned',value:false,disabled:true,indent:false}];
    const list=[{kind:'toggle',id:module.id+':enabled',moduleId:module.id,label:module.name,
      description:module.description || module.unavailableReason || null,value:module.enabled,disabled:false,indent:false}];
    for(const setting of module.settings)list.push({kind:'toggle',id:module.id+':'+setting.key,moduleId:module.id,key:setting.key,
      label:setting.label,description:setting.description || null,value:module.config[setting.key],disabled:false,indent:true});
    for(const action of module.actions)list.push({kind:'action',id:module.id+':action:'+action.id,moduleId:module.id,
      actionId:action.id,label:action.label,indent:false});
    return list;
  }
  function sections(list) {
    const found=new Map();
    for(const module of list) {
      if(!found.has(module.category))found.set(module.category,[]);
      found.get(module.category).push(...rows(module));
    }
    return [...found].map(([title,items])=>({title:title.toUpperCase(),rows:items}));
  }
  const main=sections(modules.filter(module=>module.category!==advanced));
  const developer=modules.filter(module=>module.category===advanced);
  if(developer.length)main.push({title:'MORE',rows:[{kind:'link',id:'page:advanced',page:'advanced',label:'Advanced Settings',indent:false}]});
  return {main:{id:'main',title:'PGQL',sections:main},
    advanced:{id:'advanced',title:'Advanced Settings',sections:[{title:'DEVELOPER',rows:developer.flatMap(rows)}]}};
};
// Current toggle values by row id, for refreshing an open screen.
globalThis.PgqlSettingsLayout.values = function(modules) {
  const values={};
  for(const module of modules) {
    values[module.id+':enabled']=module.enabled;
    for(const setting of module.settings)values[module.id+':'+setting.key]=module.config[setting.key];
  }
  return values;
};
