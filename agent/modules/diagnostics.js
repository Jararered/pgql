Qol.register({
  id: 'diagnostics', name: 'Target diagnostics', description: 'Logs process and game library details.',
  settings:[{key:'includeAddresses',label:'Include library addresses',type:'boolean',default:true}],
  enable(ctx) { ctx.log('Module enabled inside target process', this.snapshot(ctx.config)); },
  snapshot(config) {
    const modules=Process.enumerateModules();
    return {pid:Process.id,arch:Process.arch,platform:Process.platform,pointerSize:Process.pointerSize,
      moduleCount:modules.length,
      gameLibraries:modules.filter(m=>/il2cpp|unity|Niantic|holoholo/i.test(m.name)).map(m=>({name:m.name,...(config.includeAddresses?{base:m.base.toString()}:{}),size:m.size}))};
  },
  // {action:'contracts'} runs the contract audit (see docs/UPGRADING.md); it has
  // no menu entry and changes no saved setting.
  invoke(ctx,args={}) {
    if(args.action==='contracts')return PgqlContractAudit.run(ctx);
    const result=this.snapshot(ctx.config); ctx.log('Snapshot',result); return result;
  }
});
