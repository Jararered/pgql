"""Build a signed debug APK using project-local official Android tools (macOS)."""
import os
import pathlib
import subprocess
import zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
BUILD=ROOT/'build';BUILD.mkdir(exist_ok=True)
SDK=ROOT/'toolchains'
TOOLS=SDK/'build-tools/android-15'
PLATFORM=SDK/'platform/android-35/android.jar'
NDK=pathlib.Path(os.environ.get('ANDROID_NDK_HOME',str(SDK/'ndk/android-ndk-r27c')))
JAVA=pathlib.Path(os.environ.get('JAVA_HOME','/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'))/'bin'
env=dict(os.environ,JAVA_HOME=str(JAVA.parent),ANDROID_NDK_HOME=str(NDK))
def run(*args):subprocess.run([str(a) for a in args],cwd=ROOT,env=env,check=True)
if not PLATFORM.is_file() or not TOOLS.is_dir() or not NDK.is_dir():
    raise SystemExit('Missing toolchain. Run python3 scripts/bootstrap.py first.')
run('python3',ROOT/'scripts/bundle-agent.py')
run('bash',ROOT/'native/build.sh')
generated=BUILD/'generated';generated.mkdir(exist_ok=True)
base=BUILD/'base.apk'
run(TOOLS/'aapt2','link','-I',PLATFORM,'--manifest',ROOT/'app/src/main/AndroidManifest.xml',
    '--min-sdk-version','28','--target-sdk-version','35','--version-code','2','--version-name','0.1',
    '--java',generated,'-A',ROOT/'app/src/main/assets','-o',base)
classes=BUILD/'classes';classes.mkdir(exist_ok=True)
sources=list((ROOT/'app/src/main/java').rglob('*.java'))+list(generated.rglob('*.java'))
run(JAVA/'javac','-source','8','-target','8','-classpath',PLATFORM,'-d',classes,*sources)
jar=BUILD/'classes.jar';run(JAVA/'jar','cf',jar,'-C',classes,'.')
dex=BUILD/'dex';dex.mkdir(exist_ok=True)
run(TOOLS/'d8','--lib',PLATFORM,'--min-api','28','--output',dex,jar)
with zipfile.ZipFile(base,'a',compression=zipfile.ZIP_DEFLATED) as apk:
    for file in dex.glob('*.dex'):apk.write(file,file.name)
    helper=ROOT/'app/src/main/jniLibs/arm64-v8a/libqolrunner.so'
    info=zipfile.ZipInfo('lib/arm64-v8a/libqolrunner.so');info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100755<<16
    apk.writestr(info,helper.read_bytes())
aligned=BUILD/'aligned.apk';run(TOOLS/'zipalign','-f','-p','4',base,aligned)
keystore=BUILD/'debug.keystore'
if not keystore.exists():
    run(JAVA/'keytool','-genkeypair','-keystore',keystore,'-storepass','android','-keypass','android',
        '-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=QoL Lab Debug')
output=BUILD/'pgql-debug.apk'
run(TOOLS/'apksigner','sign','--ks',keystore,'--ks-pass','pass:android','--key-pass','pass:android',
    '--ks-key-alias','androiddebugkey','--out',output,aligned)
run(TOOLS/'apksigner','verify','--verbose',output)
print('Built and verified:',output)
