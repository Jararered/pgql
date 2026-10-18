'use strict';
// Shared managed-metadata lookups for adapter bind() methods. Every lookup
// must match exactly one member or it throws; ambiguous bindings never guess.
// Pure metadata only: no scene objects, no hooks (see contract-audit.js).
globalThis.PgqlBinding = Object.freeze({
  create(label) {
    const owner=klass=>klass&&klass.type?klass.type.name:'?';
    const fail=(kind,klass,detail)=>{throw Error('Unsupported '+label+' '+kind+': '+detail+' on '+owner(klass));};
    // Parameter type signature, e.g. 'System.Int32|System.Boolean'.
    const args=m=>m.parameters.map(p=>p.type.name).join('|');
    return Object.freeze({
      args,
      // The one non-generic method with these parameter types; the return
      // type is checked only when given.
      method(klass,name,params,returns=null,isStatic=false) {
        const matches=klass.methods.filter(m=>m.name===name&&!m.isGeneric&&m.isStatic===isStatic&&args(m)===params.join('|'));
        if(matches.length!==1||(returns&&matches[0].returnType.name!==returns))fail('method',klass,name);
        return matches[0];
      },
      // A field by name; its type is checked only when given.
      field(klass,name,expected) {
        const found=klass.field(name);
        if(expected&&found.type.name!==expected)fail('field',klass,name);
        return found;
      },
      // An instance field by name, declared on klass or any base class.
      inheritedField(klass,name,typeName) {
        const found=[...klass.hierarchy({includeCurrent:true})].map(k=>k.fields.find(f=>f.name===name)).find(Boolean);
        if(!found||found.isStatic||found.type.name!==typeName)fail('field',klass,name);
        return found;
      },
      // Obfuscated member names change between builds; bind the only
      // instance field declared on klass with this type.
      fieldOfType(klass,typeName) {
        const matches=klass.fields.filter(f=>!f.isStatic&&f.type.name===typeName);
        if(matches.length!==1)fail('field',klass,'of type '+typeName);
        return matches[0];
      },
    });
  },
});
