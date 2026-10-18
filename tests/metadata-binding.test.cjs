const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../agent/core/metadata-binding.js'),'utf8'),context);
const binding=context.PgqlBinding.create('Example');

const method=(name,params,returns='System.Void',extra={})=>({name,isGeneric:false,isStatic:false,returnType:{name:returns},
  parameters:params.map(p=>({type:{name:p}})),...extra});
const field=(name,typeName,isStatic=false)=>({name,isStatic,type:{name:typeName}});
const klass=(name,{methods=[],fields=[],parent=null}={})=>({type:{name},methods,fields,parent,
  field(fieldName){for(let k=this;k;k=k.parent){const f=k.fields.find(f=>f.name===fieldName);if(f)return f;}throw Error("couldn't find field "+fieldName);},
  *hierarchy({includeCurrent=true}={}){for(let k=includeCurrent?this:this.parent;k;k=k.parent)yield k;}});

// args: parameter signature.
assert.equal(binding.args(method('M',['System.Int32','System.Boolean'])),'System.Int32|System.Boolean');
assert.equal(binding.args(method('M',[])),'');

// method: exactly one non-generic match by name, parameters and static-ness.
const tap=method('OnTap',['System.Object','System.EventArgs']);
const find=method('Find',['System.Type'],'UnityEngine.Object',{isStatic:true});
const service=klass('Game.Service',{methods:[tap,find,method('OnTap',['System.Object'],'System.Void',{isGeneric:true}),
  method('Twice',[]),method('Twice',[]),method('Get',[],'System.Int32')]});
assert.equal(binding.method(service,'OnTap',['System.Object','System.EventArgs']),tap);
assert.equal(binding.method(service,'OnTap',['System.Object','System.EventArgs'],'System.Void'),tap);
assert.equal(binding.method(service,'Find',['System.Type'],null,true),find);
assert.equal(binding.method(service,'Find',['System.Type'],'UnityEngine.Object',true),find);
assert.throws(()=>binding.method(service,'Find',['System.Type']),/Unsupported Example method: Find on Game\.Service/);
assert.throws(()=>binding.method(service,'OnTap',['System.Object']),/Unsupported Example method: OnTap/,'generic overloads are ignored');
assert.throws(()=>binding.method(service,'Twice',[]),/Unsupported Example method: Twice/,'ambiguous matches fail');
assert.throws(()=>binding.method(service,'Get',[],'System.Boolean'),/Unsupported Example method: Get/,'wrong return type');
assert.throws(()=>binding.method(service,'Missing',[]),/Unsupported Example method: Missing/);

// field: by name, type checked only when given.
const base=klass('Game.Base',{fields:[field('shared','System.Int32'),field('Constant','System.Int32',true)]});
const derived=klass('Game.Derived',{fields:[field('own','System.String'),field('a','Game.Thing'),field('b','Game.Thing'),
  field('c','Game.Other'),field('d','Game.Other',true)],parent:base});
assert.equal(binding.field(derived,'own','System.String').name,'own');
assert.equal(binding.field(derived,'own').name,'own');
assert.throws(()=>binding.field(derived,'own','System.Int32'),/Unsupported Example field: own on Game\.Derived/);

// inheritedField: instance field declared on the class or a base class.
assert.equal(binding.inheritedField(derived,'shared','System.Int32').name,'shared');
assert.throws(()=>binding.inheritedField(derived,'Constant','System.Int32'),/Unsupported Example field: Constant/,'static fields are rejected');
assert.throws(()=>binding.inheritedField(derived,'shared','System.String'),/Unsupported Example field: shared/);
assert.throws(()=>binding.inheritedField(derived,'missing','System.Int32'),/Unsupported Example field: missing/);

// fieldOfType: the single instance field of a type on that class.
assert.equal(binding.fieldOfType(derived,'Game.Other').name,'c','static fields of the type are ignored');
assert.throws(()=>binding.fieldOfType(derived,'Game.Thing'),/Unsupported Example field: of type Game\.Thing on Game\.Derived/);
assert.throws(()=>binding.fieldOfType(derived,'System.Int32'),/Unsupported Example field: of type System\.Int32/,'base class fields are not searched');

// Errors still read when a mock class has no type.
assert.throws(()=>binding.method({methods:[]},'X',[]),/Unsupported Example method: X on \?/);

console.log('Metadata binding signature, unique method, static, return type, field, inherited field and field-of-type tests passed.');
