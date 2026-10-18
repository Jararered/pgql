import bisect
import hashlib
import json
import re
import struct
from pathlib import Path

p = Path("com.pokemod.app.public/files/injector/pokemod-injector-arm64")
b = p.read_bytes()
h = struct.unpack_from("<16sHHIQQQIHHHHHH", b)
ss = [struct.unpack_from("<IIQQQQIIQQ", b, h[6] + i * h[11]) for i in range(h[12])]
ns = ss[h[13]]
names = b[ns[4] : ns[4] + ns[5]]
secs = {names[s[0] : names.find(b"\0", s[0])].decode(): s for s in ss}
t = secs[".text"]
eh = secs[".eh_frame_hdr"]
eho = eh[4]
n = struct.unpack_from("<I", b, eho + 8)[0]
fun = [eh[3] + struct.unpack_from("<i", b, eho + 12 + i * 8)[0] for i in range(n)]
strings = {}
for m in re.finditer(rb"[ -~]{4,}", b[0x99190:0xEF000]):
    s = m.group().decode()
    if len(s) < 240 and re.search(
        r"SELinux policy|floyd_memfd|floyd_file|frida_file|frida_memfd", s
    ):
        strings[m.start() + 0x99190] = s
results = []
for fo in range(t[4], t[4] + t[5], 4):
    w = struct.unpack_from("<I", b, fo)[0]
    if w & 0x9F000000 != 0x90000000:
        continue
    va = t[3] + fo - t[4]
    rd = w & 31
    imm = ((w >> 29) & 3) | (((w >> 5) & 0x7FFFF) << 2)
    imm = imm - (1 << 21) if imm & (1 << 20) else imm
    page = (va & ~0xFFF) + (imm << 12)
    if not any((a & ~0xFFF) == page for a in strings):
        continue
    for j in range(1, 9):
        if fo + j * 4 >= len(b):
            break
        a = struct.unpack_from("<I", b, fo + j * 4)[0]
        if a & 0x7F000000 == 0x11000000 and ((a >> 5) & 31) == rd:
            dest = page + (((a >> 10) & 0xFFF) << (12 if a & (1 << 22) else 0))
            if dest in strings:
                idx = bisect.bisect_right(fun, va) - 1
                results.append(
                    {
                        "string_offset": hex(dest),
                        "string": strings[dest],
                        "adrp_address": hex(va),
                        "add_address": hex(va + j * 4),
                        "candidate_function_unwind_start": hex(fun[idx])
                        if idx >= 0
                        else None,
                        "candidate_next_unwind_start": hex(fun[idx + 1])
                        if idx + 1 < len(fun)
                        else None,
                    }
                )
Path("analysis/native/copied-selinux-xrefs.json").write_text(
    json.dumps(
        {
            "sha256": hashlib.sha256(b).hexdigest(),
            "method": "bounded ADRP + ADD (within 8 instructions), no control/data-flow validation; function starts from .eh_frame_hdr",
            "xrefs": results,
        },
        indent=2,
    )
)
for r in results:
    print(r)
