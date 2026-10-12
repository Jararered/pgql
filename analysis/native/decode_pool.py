"""Static extraction of LInit$dg <clinit> const-string operands.
MUTF-8 is decoded to UTF-16 code units, then each unit XORed with 0xffff.
This transformation is a hypothesis until tied to its DEX decoder method.
"""
import pathlib,struct,json,hashlib
methods=json.loads(pathlib.Path('analysis/app-methods.json').read_text())
method=next(m for m in methods if m['method']=='LInit$dg;-><clinit>()V')
p=pathlib.Path('analysis/extracted')/method['dex']; b=p.read_bytes()
size,table=struct.unpack_from('<II',b,56)
def uleb(o):
 n=0;shift=0
 while True:
  z=b[o];o+=1;n|=(z&127)<<shift
  if not z&128:return n,o
  shift+=7
def decode(o):
 count,o=uleb(o); start=o;units=[]
 while b[o]:
  c=b[o];o+=1
  if c<128:units.append(c)
  elif c&0xe0==0xc0:
   d=b[o];o+=1;assert d&0xc0==0x80;units.append(((c&31)<<6)|(d&63))
  elif c&0xf0==0xe0:
   d,e=b[o:o+2];o+=2;assert d&0xc0==e&0xc0==0x80;units.append(((c&15)<<12)|((d&63)<<6)|(e&63))
  else:raise ValueError(('invalid MUTF8',o-1,c))
 assert count==len(units),(count,len(units))
 return count,start,o,units
records=[]
for k,s in enumerate(method['strings']):
 o=s['file_offset'];opcode=b[o]
 idx=struct.unpack_from('<H' if opcode==0x1a else '<I',b,o+2)[0]
 assert opcode in (0x1a,0x1b)
 data=struct.unpack_from('<I',b,table+4*idx)[0]
 count,start,end,units=decode(data);decoded=[n^65535 for n in units]
 # Preserve exact UTF-16 units as JSON escapes even if lone surrogates remain.
 records.append(dict(pool_number=k,string_index=idx,instruction_offset=o,string_data_offset=data,mutf8_offset=start,mutf8_bytes=end-start,utf16_units=count,decoded_units=decoded,decoded=''.join(map(chr,decoded))))
pathlib.Path('analysis/decoded-pool.json').write_text(json.dumps(dict(dex=str(p),sha256=hashlib.sha256(b).hexdigest(),method=method['method'],transform='XOR each exact MUTF8 UTF16 code unit with 0xffff; semantics unverified',records=records),indent=2,ensure_ascii=True))
lines=['Exact MUTF-8/UTF-16 code-unit extraction; XOR 0xffff hypothesis.','Only 11 const-string operands in LInit$dg <clinit>; static evidence, no execution.','Controls and length fields retained as escaped literals; records may require further segmentation.','']
for r in records:
 lines.append('POOL %d string_index=%d instruction_offset=0x%x UTF16_units=%d' % (r['pool_number'],r['string_index'],r['instruction_offset'],r['utf16_units']))
 # Display printable runs, retaining control boundaries visibly.
 lines.append(''.join(c if ord(c)>=32 and ord(c)!=127 and not 0xd800<=ord(c)<=0xdfff else '\\u%04x'%ord(c) for c in r['decoded']))
 lines.append('')
pathlib.Path('analysis/decoded-pool.txt').write_text('\n'.join(lines))
all_units=[u for r in records for u in r['decoded_units']]; pos=0; entries=[]
while pos<len(all_units):
 start=pos;n=all_units[pos];pos+=1
 assert pos+n<=len(all_units)
 units=all_units[pos:pos+n];pos+=n
 raw=struct.pack('<'+'H'*len(units),*units)
 value=raw.decode('utf-16-le',errors='surrogatepass')
 entries.append(dict(index=len(entries),utf16_offset=start,utf16_length=n,value=value))
assert pos==len(all_units)
pathlib.Path('analysis/decoded-pool-strings.json').write_text(json.dumps(entries,indent=2,ensure_ascii=True))
pathlib.Path('analysis/decoded-pool-strings.txt').write_text('\n'.join('%d @%d %s'%(e['index'],e['utf16_offset'],json.dumps(e['value'],ensure_ascii=True)) for e in entries))
print('records',len(records),'UTF16_units',sum(r['utf16_units'] for r in records),'DEX SHA256',hashlib.sha256(b).hexdigest())
print('length-prefixed entries',len(entries),'consumed UTF16 units',pos)
