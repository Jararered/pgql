# Read-only native attachment review

Reviewed framework/native/runner.c, SessionService.java, local build/session/probe logs, adb crash log, a read-only copy of the installed libNianticLabsPlugin.so, and baseline process maps/memory for PID25265. No process was launched, killed, attached, restarted, modified or installed in this review. The library copy SHA256 is 409a2aa7ebf5aa3f54c863bea16e9d43374a2f4806e6f50f2b8515259c1f4abe; crash BuildId 69bb7bb6b2576b35cffab9e660bded6299a42585.

## Concrete failure mechanism

Recent repeated crashes are instruction-fetch permission faults (SEGV_ACCERR / ESR 0x82000006) on app worker threads. Top frame is [anon:libwebview reservation], with return to Niantic plugin offset0x254328. That instruction is BLR X8. Immediately preceding code is:

0x254314 LDR W8,[SP,#0x55c]
0x254318 ADRP X9,0xbf2000
0x25431c ADD X9,X9,#0xcb0
0x254320 ADD X8,X9,X8
0x254324 STR X8,[SP,#0x550]
0x254328 BLR X8

The first instruction zero-extends a 32-bit value; pluginbase+0xbf2cb0 is the dispatch-table base. Three crash samples show the table offset is a 32-bit value in 0xff... range. Subtracting 2^32 from the fault PC yields a valid address inside the same plugin code section:

PID22841: pluginbase0x75e610a000; faultPC0x76e625ae3c; tableoffset0xff55e18c; corrected arithmetic candidate plugin+0x150e3c.
PID24122: pluginbase0x75e70fd000; faultPC0x76e73595a8; tableoffset0xff6698f8; corrected arithmetic candidate plugin+0x25c5a8.
PID24823: pluginbase0x75e5997000; faultPC0x76e5ca2068; tableoffset0xff7183b8; corrected arithmetic candidate plugin+0x30b068.

This arithmetic is diagnostic, NOT evidence that patching signedness is valid or safe. The surrounding plugin is heavily obfuscated, with opaque predicates, encoded dispatch table, and syscall wrappers. The on-disk table's entries are scrambled; a read-only live pre-attach table copy was byte-identical to those disk values. Thus dynamic table decoding/state or intentional failure routing needs further evidence. The NX address is not a normal Frida callback/trampoline location.

## Fresh baseline before next parent attach

PID25265 fully loaded, baseline maps saved to /tmp/qol-native-review-baseline-25265.maps. Pluginbase0x75edb6c000 has executable text map through0x75ee280000. Entire candidate plugin+4GiB alias span falls inside:

76b8928000-76f8928000 ---p [anon:libwebview reservation]

Therefore a callable+4GiB mirror does NOT exist before parent attachment. This undermines the hypothesis that detach alone unmapped an otherwise ordinary executable mirror. It does not distinguish an intentionally bad dispatcher result from protected mapping/state lifetime behavior. Table snapshot /tmp/qol-native-review-baseline-25265.table is48bytes at live0x75edb6c000+0xbf2cb0.

## Native source assessment

No direct game pointers/callbacks exist in runner.c; it follows Frida API attach/create/load and cleanup paths. Normal native shutdown unloads, whereas the explicit resident mode waits for runtime shutdown, eternalizes, then detaches. SessionService passes --resident-agent. The recorded ack/eternalized success proves the APIs completed, not long-term game stability. No concrete native source bug identified that explains the app's own obfuscated dispatch branch on first attachment. A signal-pipe write descriptor is intentionally left open until runner exit; that resource lifetime is host-side and cannot account for a remote plugin+4GiB branch.

Original unload-related crashes in the first session are different: null-pointer/unmapped-PC stack shortly after detach. The newer repeat signature is NX+Niantic dispatch during attachment. Treat them as separate until evidence connects them.

Earlier crash log Oct11 03:59 (before today's own framework tests) already contains NX [anon:libwebview reservation] with caller plugin+0x1518c4. Prior device instrumentation history is unknown, so this is not a clean uninjected baseline, but the signature predates current Mass Gift work.

## Next controlled test

Use one fresh user-started game process, once, with a plain native Frida script that only sends initial identity and an interval heartbeat; no Java bridge, Il2Cpp bridge, game metadata, hooks, object allocations, scheduler or game services. Keep runner/stdin attached for a representative observation period (>60s); capture PID/attach timestamps, heartbeat survival, and any exact crash signature. Do not detach during that window. Then assess metadata-only and scheduler-hook scripts as separate increments, without reattaching many eternalized agents to the same process.

If heartbeat-only attachment produces the same plugin dispatch fault, it isolates the issue below custom modules, consistent with engine/bootstrap compatibility or game response to instrumentation (neither proven). If heartbeat is stable but metadata causes it, separate bridge initialization/thread attach from metadata reads. If metadata is stable but a scheduler hook causes it, inspect execution-context, relocation and hook-lifetime concerns. If only physical detach fails, retain focus on engine agent teardown.

Do not attribute the current fault to anti-instrumentation solely from obfuscation or crash timing. Also do not promise that resident agents are inert when runtime cleanup acknowledgements hide cleanup errors or outstanding asynchronous requests; that needs separate module-resource validation.
