from pathlib import Path
import subprocess
import shutil
import json
root=Path(__file__).resolve().parents[1]
inputs=[root/'agent/runtime.js',*sorted((root/'agent/core').glob('*.js')),*sorted((root/'agent/adapters').glob('*.js')),*sorted((root/'agent/modules').glob('*.js')),root/'agent/ui/settings-menu.js',root/'agent/entry.js']
output=root/'app/src/main/assets/agent.js';output.parent.mkdir(parents=True,exist_ok=True)
entry=root/'build/agent-entry.js';entry.parent.mkdir(exist_ok=True)
bridge=root/'build/java-bridge'
if bridge.exists():shutil.rmtree(bridge)
shutil.copytree(root/'node_modules/frida-java-bridge',bridge,dirs_exist_ok=True)
# Pinned upstream PR #400 / commit 41746885: temporary ART plugin setup
# workaround for live Android 17 VMs. Keep npm inputs unchanged/reproducible.
subprocess.run(['patch','--batch','-p1','-i',str(root/'patches/frida-java-bridge-android17.patch')],cwd=bridge,check=True)
# Avoid JNI initialization while Frida is still loading its script. The bridge
# already initializes lazily through its available getter; disable its eager probe.
javaIndex=bridge/'index.js'
javaSource=javaIndex.read_text()
eager='    try {\n      this._tryInitialize();\n    } catch (e) {\n    }'
if javaSource.count(eager)!=1:raise SystemExit('Pinned Java eager initialization changed; review lazy patch.')
javaIndex.write_text(javaSource.replace(eager,'',1))
compiler=root/'node_modules/.bin/esbuild'
if not compiler.exists():raise SystemExit('Run npm ci in the repository root first.')
ilEntry=root/'build/il2cpp-entry.js';ilEntry.write_text("import 'frida-il2cpp-bridge';\n")
ilSource=root/'build/il2cpp-bridge.js'
subprocess.run([str(compiler),str(ilEntry),'--bundle','--platform=neutral','--format=iife','--target=es2020','--outfile='+str(ilSource)],cwd=root,check=True)
lazy="globalThis.PgqlLoadIl2cpp=()=>{if(!globalThis.Il2Cpp)Script.evaluate('/pgql-il2cpp.js',"+json.dumps(ilSource.read_text())+");};\n"
entry.write_text(lazy+"import Java from './java-bridge/index.js';\nglobalThis.Java=Java;\n"+'\n'.join('// '+str(p.relative_to(root))+'\n'+p.read_text() for p in inputs))
compiler=root/'node_modules/.bin/esbuild'
if not compiler.exists():raise SystemExit('Run npm ci in the repository root first.')
subprocess.run([str(compiler),str(entry),'--bundle','--platform=neutral','--format=iife','--target=es2020','--outfile='+str(output)],cwd=root,check=True)
print(output)
