"""Offline DEX member inventory and bounded instruction-reference projection.

Not a decompiler; preserves file/code-unit offsets and skips unknown opcodes.
"""
import json
import pathlib
import struct


def inspect(path):
    b=path.read_bytes()
    def u32(p): return struct.unpack_from('<I',b,p)[0]
    def leb(p):
        v=0;s=0
        while True:
            x=b[p];p+=1;v|=(x&127)<<s;s+=7
            if not x&128:return v,p
    n,o=struct.unpack_from('<II',b,56);strings=[]
    for i in range(n):
        p=u32(o+4*i);_,p=leb(p);q=b.index(0,p)
        strings.append(b[p:q].decode('utf8',errors='replace'))
    n,o=struct.unpack_from('<II',b,64)
    types=[strings[u32(o+4*i)] for i in range(n)]
    n,o=struct.unpack_from('<II',b,72);protos=[]
    for i in range(n):
        _,r,p=struct.unpack_from('<III',b,o+12*i)
        args=[] if not p else [types[struct.unpack_from('<H',b,p+4+2*j)[0]] for j in range(u32(p))]
        protos.append('('+''.join(args)+')'+types[r])
    n,o=struct.unpack_from('<II',b,88);methods=[]
    for i in range(n):
        c,p,s=struct.unpack_from('<HHI',b,o+8*i)
        methods.append(types[c]+'->'+strings[s]+protos[p])
    # DEX standard opcode widths in 16-bit code units.
    widths={i:1 for i in range(256)}
    for i in [2,5,8,0x13,0x15,0x16,0x19,0x1a,0x1c,0x1f,0x20,0x22,0x23,0x29,*range(0x2d,0x3e),*range(0x44,0x6e),*range(0x90,0xb0),*range(0xd0,0xe3),0xfe,0xff]:widths[i]=2
    for i in [3,6,9,0x14,0x17,0x1b,0x24,0x25,0x26,0x2a,0x2b,0x2c,*range(0x6e,0x73),*range(0x74,0x79),0xfc,0xfd]:widths[i]=3
    widths[0x18]=5;widths[0xfa]=4;widths[0xfb]=4
    invalid={0x3e,0x3f,0x40,0x41,0x42,0x43,0x73,0x79,0x7a,*range(0xe3,0xfa)}
    n,o=struct.unpack_from('<II',b,96);out=[]
    for i in range(n):
        c,flags,sup,interfaces,source,annotations,data,statics=struct.unpack_from('<8I',b,o+32*i)
        if not data:continue
        p=data;counts=[]
        for _ in range(4):v,p=leb(p);counts.append(v)
        for _ in range(counts[0]+counts[1]):_,p=leb(p);_,p=leb(p)
        for count in counts[2:]:
            idx=0
            for _ in range(count):
                diff,p=leb(p);idx+=diff;access,p=leb(p);code,p=leb(p)
                if not types[c].startswith(('Lcom/pokemod/','LInit')):continue
                row={'method':methods[idx],'source_file':None if source==0xffffffff else strings[source],'access':access,'code_offset':code,'strings':[],'calls':[],'coverage':'no-code' if not code else 'linear-instruction-scan'}
                if code:
                    total=u32(code+12);units=struct.unpack_from('<'+'H'*total,b,code+16);k=0
                    while k<total:
                        op=units[k]&255;w=widths[op]
                        if op==0 and units[k]>>8:
                            tag=units[k]>>8
                            if tag==1:w=4+2*units[k+1]
                            elif tag==2:w=2+4*units[k+1]
                            elif tag==3:w=4+(units[k+1]*(units[k+2]|units[k+3]<<16)+1)//2
                            else:row['coverage']='stopped-unknown-payload';break
                        if op in invalid or k+w>total:row['coverage']='stopped-unknown-or-truncated';break
                        loc={'code_unit':k,'file_offset':code+16+2*k}
                        if op in (0x1a,0x1b):
                            si=units[k+1] if op==0x1a else units[k+1]|units[k+2]<<16
                            if si<len(strings):row['strings'].append(dict(loc,value=strings[si]))
                        if op in (*range(0x6e,0x73),*range(0x74,0x79),0xfa,0xfb):
                            mi=units[k+1]
                            if mi<len(methods):row['calls'].append(dict(loc,target=methods[mi]))
                        k+=w
                out.append(row)
    return out

if __name__=='__main__':
    root=pathlib.Path(__file__).parent
    rows=[]
    for path in (root/'extracted').glob('*.dex'):
        for row in inspect(path):rows.append(dict(row,dex=path.name))
    (root/'app-methods.json').write_text(json.dumps(rows,indent=2))
    print('App methods:',len(rows))
    print('Coverage:',{v:sum(x['coverage']==v for x in rows) for v in set(x['coverage'] for x in rows)})
