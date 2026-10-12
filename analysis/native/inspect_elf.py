import struct, hashlib, json, pathlib, math, collections

paths=[pathlib.Path('analysis/extracted/assets/pokemod-injector'),*pathlib.Path('analysis/extracted/lib/arm64-v8a').glob('*.so')]
for p in paths:
 b=p.read_bytes(); h=struct.unpack_from('<16sHHIQQQIHHHHHH',b)
 ph=[]
 for i in range(h[10]):
  z=struct.unpack_from('<IIQQQQQQ',b,h[5]+i*h[9]); ph.append(dict(type=z[0],flags=z[1],offset=z[2],vaddr=z[3],filesz=z[5],memsz=z[6],align=z[7]))
 def off(va):
  for x in ph:
   if x['type']==1 and x['vaddr']<=va<x['vaddr']+x['filesz']: return x['offset']+va-x['vaddr']
  return None
 dyn={}
 for x in ph:
  if x['type']==2:
   for i in range(x['offset'],x['offset']+x['filesz'],16):
    tag,val=struct.unpack_from('<qQ',b,i)
    if tag==0: break
    dyn.setdefault(tag,[]).append(val)
 def cstr(o):
  if o is None: return ''
  return b[o:b.find(b'\0',o)].decode('utf-8','replace')
 st=off(dyn[5][0]) if 5 in dyn else None
 needed=[cstr(st+v) for v in dyn.get(1,[])]
 symbols=[]
 sy=off(dyn[6][0]) if 6 in dyn else None
 count=None
 method='unknown'
 if 4 in dyn:
  ho=off(dyn[4][0]); count=struct.unpack_from('<II',b,ho)[1]
  method='SYSV hash nchain'
 elif 0x6ffffef5 in dyn:
  ho=off(dyn[0x6ffffef5][0]); buckets,symoffset,bloomsize,bloomshift=struct.unpack_from('<IIII',b,ho)
  bo=ho+16+8*bloomsize; co=bo+4*buckets
  maximum=symoffset-1
  for j in range(buckets):
   n=struct.unpack_from('<I',b,bo+4*j)[0]
   if n==0: continue
   while True:
    v=struct.unpack_from('<I',b,co+4*(n-symoffset))[0]; maximum=max(maximum,n)
    if v&1: break
    n+=1
  count=maximum+1; method='GNU hash bucket/chain bound'
 elif sy is not None and st>sy:
  count=(st-sy)//dyn.get(11,[24])[0]; method='symbol/string table offset bound (may include padding)'
 if count:
  for i in range(count):
   name,info,other,shndx,value,size=struct.unpack_from('<IBBHQQ',b,sy+i*24)
   symbols.append(dict(name=cstr(st+name),defined=shndx!=0,value=hex(value),size=size,binding=info>>4,type=info&15))
 counts=collections.Counter(b); entropy=-sum((n/len(b))*math.log2(n/len(b)) for n in counts.values())
 r=dict(path=str(p),sha256=hashlib.sha256(b).hexdigest(),size=len(b),elf_type=h[1],machine=h[2],entry=hex(h[4]),section_offset=h[6],section_count=h[12],program_headers=ph,dynamic_tags={hex(k):v for k,v in dyn.items()},needed=needed,symbol_count_method=method,symbols=symbols,byte_entropy=entropy)
 pathlib.Path('analysis/native/'+p.name+'.json').write_text(json.dumps(r,indent=2))
 print(p.name, 'size',len(b),'sha256',r['sha256'],'sections',h[12], 'entropy',round(entropy,3),'needed',needed,'symbols',len(symbols))
 print('exports', [s['name'] for s in symbols if s['defined'] and s['name']])
