"""Offline reconstruction of copied arm64 injector loader. No target execution.
Constants read from SHA256-bound binary, never logged. Default native mode=2.
"""
from pathlib import Path
import base64,hashlib,json
root=Path(__file__).resolve().parents[2]
p=root/'com.pokemod.app.public/files/injector/pokemod-injector-arm64'
b=p.read_bytes()
assert hashlib.sha256(b).hexdigest()=='726eb015167e4408ef4dc2ac95c0986a3ae7f19ce5d384929e88505c07f65d1e'
def cstr(offset): return b[offset:b.index(b'\0',offset)]
def rc4(key,data):
 s=list(range(256));j=0
 for i in range(256):
  j=(j+s[i]+key[i%len(key)])%256;s[i],s[j]=s[j],s[i]
 i=j=0;out=bytearray()
 for a in data:
  i=(i+1)%256;j=(j+s[i])%256;s[i],s[j]=s[j],s[i]
  out.append(a^s[(s[i]+s[j])%256])
 return bytes(out)
# 0x43b088 + 0x43b0e8 + 0x43b26c for mode 2, unencrypted flag 0.
key=cstr(0xb7184)+cstr(0xa6cfc).decode().replace('\x00','')[::-1].encode()+cstr(0xde95d)+b'7'+cstr(0xd64b4)
outdir=root/'analysis/agents-decoded';outdir.mkdir(exist_ok=True)
records=[]
for name in ['main_agent','vpgp_agent']:
 src=root/'com.pokemod.app.public/files/agents'/name;raw=src.read_bytes();payload=base64.b64decode(raw,validate=True);decoded=rc4(key,payload)
 ratio=sum(v in (9,10,13) or 32<=v<=126 for v in decoded)/len(decoded)
 try: text=decoded.decode('utf-8');utf8=True
 except UnicodeDecodeError: utf8=False
 target=outdir/(name+'.js' if utf8 else name+'.bin');target.write_bytes(decoded)
 r={'source':str(src),'source_sha256':hashlib.sha256(raw).hexdigest(),'base64_payload_sha256':hashlib.sha256(payload).hexdigest(),'output':str(target),'output_sha256':hashlib.sha256(decoded).hexdigest(),'output_size':len(decoded),'utf8':utf8,'ascii_text_ratio':ratio,'reconstructed_mode':2,'unencrypted_flag':0}
 records.append(r);print(json.dumps(r))
(outdir/'manifest.json').write_text(json.dumps(records,indent=2))
