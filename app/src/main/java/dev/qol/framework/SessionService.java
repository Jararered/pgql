package dev.qol.framework;

import android.app.*;
import android.content.*;
import android.os.IBinder;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.concurrent.*;
import org.json.*;

public class SessionService extends Service {
    public static final String TARGET="com.nianticlabs.pokemongo";
    // The game hosts its GO Plus accessory stack in a separate service process.
    private static final String COMPANION_TARGET=TARGET+":pgp", GOPLUS="virtual-go-plus";
    public static final String ATTACH_GOPLUS="dev.qol.framework.ATTACH_GOPLUS";
    public static final String ATTACH="dev.qol.framework.ATTACH", STOP="dev.qol.framework.STOP", UPDATE="dev.qol.framework.UPDATE";
    // GPS Joystick's public service action; it reads float "lat"/"lng" extras.
    private static final String TELEPORT="dev.qol.framework.TELEPORT", JOYSTICK_TELEPORT="theappninjas.gpsjoystick.TELEPORT";
    private static final Object LOCK=new Object();
    private static final ArrayDeque<String> LOG=new ArrayDeque<>();
    private static String sessionState="idle";
    private static String sessionDetail="";
    private static JSONArray moduleList=new JSONArray();
    private static JSONObject goPlusStatus=new JSONObject();
    private static boolean accessorySession;
    private boolean accessoryOnly;
    private static volatile SessionService current;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final ExecutorService companionWorker=Executors.newSingleThreadExecutor();
    private final ExecutorService teleporter=Executors.newSingleThreadExecutor();
    private volatile Process runner, pidProbe, companion;
    private BufferedWriter companionInput;
    // Guarded by this: whether the :pgp agent's module is believed active, and
    // how many of its "disabled" events answer a disable we mirrored ourselves.
    private boolean companionActive;
    private int companionDisables;
    private volatile boolean stopping=false, destroyed=false;
    private BufferedWriter input;
    private long commandId=0;
    public static String state() { synchronized(LOCK){return sessionState;} }
    public static String detail() { synchronized(LOCK){return sessionDetail;} }
    public static JSONArray modules() { synchronized(LOCK){ try{return new JSONArray(moduleList.toString());}catch(JSONException e){return new JSONArray();} } }
    public static String logText() { synchronized(LOCK){StringBuilder out=new StringBuilder();for(String line:LOG) out.append(line).append('\n'); return out.toString();} }
    public static void clearLog() { synchronized(LOCK){LOG.clear();} }
    public static void command(String action,String moduleId) {
        SessionService service=current;
        if(service!=null) service.post(action,moduleId);
    }
    public static boolean accessorySession() {synchronized(LOCK){return accessorySession;}}
    public static JSONObject goPlusStatus() {synchronized(LOCK){try{return new JSONObject(goPlusStatus.toString());}catch(JSONException e){return new JSONObject();}}}
    public static void config(String moduleId,String key,boolean value) {
        SessionService service=current;if(service!=null)service.configure(moduleId,key,value);
    }
    private synchronized void configure(String moduleId,String key,boolean value) {
        if(input==null || stopping)return;
        try {
            JSONObject message=new JSONObject().put("type","command").put("id",Long.toString(++commandId))
                .put("action","config").put("moduleId",moduleId).put("key",key).put("value",value);
            input.write(message.toString());input.newLine();input.flush();
            if(accessoryOnly && GOPLUS.equals(moduleId))getSharedPreferences("lab",MODE_PRIVATE).edit().putBoolean("goplus."+key,value).apply();
        }catch(Exception e){log("Configuration error: "+e.getMessage());}
    }
    private void update() { sendBroadcast(new Intent(UPDATE).setPackage(getPackageName())); }
    private void state(String value) { synchronized(LOCK){sessionState=value;} update(); }
    private void detail(String value) { synchronized(LOCK){sessionDetail=value;} update(); }
    private void log(String value) {
        android.util.Log.i("QolLab",value);
        synchronized(LOCK){if(LOG.size()>=300) LOG.removeFirst();LOG.addLast(value.length()>8192?value.substring(0,8192):value);} update();
    }
    @Override public void onCreate() {
        super.onCreate(); current=this;
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("session","Development session",NotificationManager.IMPORTANCE_LOW));
        manager.createNotificationChannel(new NotificationChannel("alerts","Module alerts",NotificationManager.IMPORTANCE_HIGH));
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,SessionService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE);
        Notification notification=new Notification.Builder(this,"session").setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setContentTitle("PGQL 0.1 session").setContentText("Pokemon Go QoL").setContentIntent(open)
            .addAction(new Notification.Action.Builder(null,"Detach",stop).build()).setOngoing(true).build();
        startForeground(1,notification);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if(intent==null || STOP.equals(intent.getAction())) { detach(); return START_NOT_STICKY; }
        if(TELEPORT.equals(intent.getAction())) {
            double latitude=intent.getDoubleExtra("latitude",Double.NaN),longitude=intent.getDoubleExtra("longitude",Double.NaN);
            teleporter.execute(()->{
                teleport(latitude,longitude);
                // An alert tapped with no session must not leave the service running.
                if(state().equals("idle") || state().equals("error"))stopSelf(startId);
            });
            return START_NOT_STICKY;
        }
        if((ATTACH.equals(intent.getAction()) || ATTACH_GOPLUS.equals(intent.getAction())) && !state().equals("connecting") && !state().equals("attached") && !state().equals("detaching")) {
            accessoryOnly=ATTACH_GOPLUS.equals(intent.getAction());
            synchronized(LOCK){accessorySession=accessoryOnly;goPlusStatus=new JSONObject();}
            stopping=false; state("connecting"); worker.execute(this::attach);
        }
        return START_NOT_STICKY;
    }
    // A module alert (ctx.notify). Tapping one with coordinates offers any
    // installed map or GPS app for them; ids rotate so recent alerts stay listed.
    private int alertId=0;
    private void alert(JSONObject payload) {
        String title=payload.optString("title"),text=payload.optString("text");
        if(title.isEmpty() || text.isEmpty())return;
        JSONObject details=payload.optJSONObject("details");
        Notification.Builder builder=new Notification.Builder(this,"alerts").setSmallIcon(android.R.drawable.star_on)
            .setContentTitle(title.length()>80?title.substring(0,80):title).setContentText(text.length()>200?text.substring(0,200):text)
            .setStyle(new Notification.BigTextStyle().bigText(text)).setAutoCancel(true);
        int id;
        synchronized(this){alertId=(alertId+1)%50;id=100+alertId;}
        PendingIntent target=PendingIntent.getActivity(this,id,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        if(details!=null && details.has("latitude") && details.has("longitude")) {
            double latitude=details.optDouble("latitude"),longitude=details.optDouble("longitude");
            if(validPlace(latitude,longitude)) {
                // Tapping teleports there with GPS Joystick; the action still offers any map app.
                String place=String.format(java.util.Locale.ROOT,"%.6f,%.6f",latitude,longitude);
                builder.setSubText(place);
                target=PendingIntent.getService(this,id,new Intent(this,SessionService.class).setAction(TELEPORT)
                    .putExtra("latitude",latitude).putExtra("longitude",longitude),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
                Intent map=Intent.createChooser(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse("geo:"+place+"?q="+place)),"Open location");
                builder.addAction(new Notification.Action.Builder(null,"Open map",
                    PendingIntent.getActivity(this,id,map,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT)).build());
            }
        }
        builder.setContentIntent(target);
        try{getSystemService(NotificationManager.class).notify(id,builder.build());}
        catch(SecurityException e){log("Alert notification blocked: "+e.getMessage());}
    }
    private static boolean validPlace(double latitude,double longitude) {
        return !Double.isNaN(latitude) && !Double.isNaN(longitude) && !Double.isInfinite(latitude) && !Double.isInfinite(longitude)
            && Math.abs(latitude)<=90 && Math.abs(longitude)<=180 && !(latitude==0 && longitude==0);
    }
    // Moves GPS Joystick's spoofed location. Its exported service is started
    // explicitly; Android refuses that while GPS Joystick is not running, so
    // root am starts it instead. A cold start begins at GPS Joystick's saved
    // location and drops the target, so the jump is repeated once it runs.
    private void teleport(double latitude,double longitude) {
        if(!validPlace(latitude,longitude)){log("Teleport ignored: invalid location");return;}
        String place=String.format(java.util.Locale.ROOT,"%.6f,%.6f",latitude,longitude);
        Intent intent=new Intent(JOYSTICK_TELEPORT).putExtra("lat",(float)latitude).putExtra("lng",(float)longitude);
        if(startJoystick(intent,place))return;
        String command=String.format(java.util.Locale.ROOT,"am start-foreground-service -a %s --ef lat %.6f --ef lng %.6f",JOYSTICK_TELEPORT,(float)latitude,(float)longitude);
        try {
            Process process=new ProcessBuilder("su","-c",command).redirectErrorStream(true).start();
            StringBuilder output=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(process.getInputStream(),StandardCharsets.UTF_8))) {
                String line; while((line=reader.readLine())!=null) output.append(line).append(' ');
            }
            if(!process.waitFor(10,TimeUnit.SECONDS))process.destroy();
            log("Teleport "+place+" via root am: "+output.toString().trim());
            Thread.sleep(2000);
            if(!startJoystick(intent,place))log("Teleport repeat failed; GPS Joystick may still be at its saved location");
        }catch(InterruptedException e){Thread.currentThread().interrupt();}
        catch(Exception e){log("Teleport failed: "+e.getMessage());}
    }
    private boolean startJoystick(Intent intent,String place) {
        try {
            java.util.List<android.content.pm.ResolveInfo> found=getPackageManager().queryIntentServices(intent,0);
            if(found.isEmpty()){log("Teleport: GPS Joystick is not installed or not visible");return false;}
            android.content.pm.ServiceInfo info=found.get(0).serviceInfo;
            ComponentName component=new ComponentName(info.packageName,info.name);
            if(startService(new Intent(intent).setComponent(component))==null)return false;
            log("Teleport "+place+" via "+component.flattenToShortString());
            return true;
        }catch(RuntimeException e){log("Teleport service start refused: "+e.getMessage());return false;}
    }
    private static String quote(String value) { return "'"+value.replace("'","'\\''")+"'"; }
    // Start: a clean game process every time (no resident agents from earlier
    // sessions), attached as soon as libil2cpp.so is mapped, which is during the
    // loading screen. The agent itself waits for il2cpp_init and the map scene.
    private static final int MAX_ATTEMPTS=3;
    private static final long ATTACH_GRACE_MS=1500, CRASH_WINDOW_MS=30000;
    private enum Outcome {DONE,CRASHED,FAILED}
    private volatile long attemptStarted, readyAt;
    private volatile boolean targetDied;
    private void attach() {
        boolean failed=false;
        try {
            File script=new File(getFilesDir(),"agent.js");
            writeAgent(getAssets().open("agent.js"),script,accessoryOnly);
            String executable=getApplicationInfo().nativeLibraryDir+"/libqolrunner.so";
            if(!new File(executable).isFile()) throw new IOException("Native runner missing; build arm64 APK first");
            if(accessoryOnly) {
                attemptStarted=System.currentTimeMillis();
                detail("Locating the accessory service…");
                // The launcher may replace an old cached process. Resolve PID afterwards.
                Thread.sleep(1250);
                String pid=rootOutput("pidof -s "+quote(COMPANION_TARGET),20);
                if(stopping || destroyed) return;
                if(pid==null || !pid.matches("[0-9]+")) throw new IOException("Accessory service is not running. Open game Settings → Connected Devices and Services → Accessory Devices, then start GO Plus session.");
                failed=runRunner(executable,script,pid)!=Outcome.DONE;
                return;
            }
            Intent launch=getPackageManager().getLaunchIntentForPackage(TARGET);
            if(launch==null || launch.getComponent()==null) throw new IOException("Pokémon GO is not installed");
            String component=launch.getComponent().flattenToShortString();
            for(int attempt=1;;attempt++) {
                Outcome outcome=launchAndAttach(executable,script,component,attempt);
                if(outcome==Outcome.CRASHED && attempt<MAX_ATTEMPTS && !stopping && !destroyed) {
                    log("Attach crashed the game; relaunching (attempt "+(attempt+1)+" of "+MAX_ATTEMPTS+")");
                    continue;
                }
                if(outcome==Outcome.CRASHED && !stopping) log("Attach crashed the game "+MAX_ATTEMPTS+" times; giving up. Tap Start to try again.");
                failed=outcome!=Outcome.DONE && !stopping;
                return;
            }
        } catch(Exception e) {if(!stopping){failed=true;log("Session error: "+e.getMessage());}}
        finally {
            synchronized(this){if(input!=null)try{input.close();}catch(IOException ignored){} input=null;}
            Process process=runner; runner=null; if(process!=null && process.isAlive()) process.destroy();
            closeCompanion();
            synchronized(LOCK){moduleList=new JSONArray();}
            detail(""); state(failed?"error":"idle"); stopSelf();
        }
    }
    private Outcome launchAndAttach(String executable,File script,String component,int attempt) throws IOException,InterruptedException {
        attemptStarted=System.currentTimeMillis();
        String suffix=attempt>1?" (attempt "+attempt+"/"+MAX_ATTEMPTS+")":"";
        state("connecting");detail("Restarting the game…"+suffix);
        log("Restarting "+TARGET+suffix);
        rootOutput("am force-stop "+quote(TARGET)+" && am start -n "+quote(component)+" >/dev/null",20);
        if(stopping || destroyed) return Outcome.DONE;
        detail("Waiting for the game to load…"+suffix);
        String pid=rootOutput("i=0; while [ $i -lt 225 ]; do p=$(pidof -s "+quote(TARGET)+"); "
            +"if [ -n \"$p\" ] && grep -q libil2cpp.so /proc/$p/maps 2>/dev/null; then echo $p; exit 0; fi; i=$((i+1)); sleep 0.2; done; exit 1",60);
        if(stopping || destroyed) return Outcome.DONE;
        if(pid==null || !pid.matches("[0-9]+")) throw new IOException("Root denied or the game did not start. Allow root for PGQL and try again.");
        log("Game started (pid "+pid+"); libil2cpp.so loaded after "+(System.currentTimeMillis()-attemptStarted)+" ms");
        Thread.sleep(ATTACH_GRACE_MS);
        if(stopping || destroyed) return Outcome.DONE;
        detail("Attaching (pid "+pid+")…"+suffix);
        return runRunner(executable,script,pid);
    }
    // Runs one runner to completion. CRASHED means the game died before or soon
    // after the agent became ready, which is the attach-time crash worth retrying.
    private Outcome runRunner(String executable,File script,String pid) throws IOException,InterruptedException {
        readyAt=0;targetDied=false;
        String shell=(accessoryOnly?"":"[ \"$(pidof -s "+quote(TARGET)+")\" = "+pid+" ] || { echo '{\"event\":\"error\",\"stage\":\"target\",\"message\":\"Game restarted before attach\"}'; exit 4; }; ")
            +"exec "+quote(executable)+" --pid "+pid+" --script "+quote(script.getAbsolutePath())+" --resident-agent";
        if(getSharedPreferences("lab",MODE_PRIVATE).getBoolean("prepare_selinux",false))shell+=" --prepare-selinux";
        Process process=new ProcessBuilder("su","-c",shell).start(); runner=process;
        synchronized(this){input=new BufferedWriter(new OutputStreamWriter(process.getOutputStream(),StandardCharsets.UTF_8));}
        if(stopping || destroyed) {synchronized(this){input.close();input=null;}}
        Thread errors=new Thread(()->readErrors(process),"qol-stderr"); errors.start();
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(process.getInputStream(),StandardCharsets.UTF_8))) {
            String line; while((line=reader.readLine())!=null) handle(line);
        }
        int exit=process.waitFor();
        synchronized(this){if(input!=null)try{input.close();}catch(IOException ignored){} input=null;}
        runner=null;
        synchronized(LOCK){moduleList=new JSONArray();}
        closeCompanion();
        if(stopping || destroyed || exit==0) return Outcome.DONE;
        log("Runner exited with code "+exit);
        long ready=readyAt;
        boolean early=ready==0 || System.currentTimeMillis()-ready<CRASH_WINDOW_MS;
        if(!accessoryOnly && early && (targetDied || "gone".equals(rootOutput("[ -d /proc/"+pid+" ] || echo gone",10)))) {crashEvidence(pid);return Outcome.CRASHED;}
        return Outcome.FAILED;
    }
    // Copies the signal and top frames of the lost game process's tombstone into
    // the session log; tombstoned writes it a few seconds after the process dies.
    private void crashEvidence(String pid) {
        try {
            String lines=rootOutput("for i in 1 2 3 4 5 6 7 8 9 10; do "
                +"f=$(grep -l '^pid: "+pid+",' $(ls -t /data/tombstones/ | grep -v pb | head -3 | sed 's#^#/data/tombstones/#') 2>/dev/null | head -1); "
                +"[ -n \"$f\" ] && break; sleep 1; done; "
                +"[ -n \"$f\" ] && { echo $f; grep -m1 '^pid:' $f; grep -m1 '^signal' $f; grep -m1 'Process uptime' $f; grep -m3 -E '^ +#0[0-2] ' $f | sed -E 's/ *\\(BuildId.*//; s#/data/app/[^ ]*/##'; }",20);
            log(lines==null || lines.isEmpty()?"Crash (pid "+pid+"): no tombstone found":"Crash (pid "+pid+"):\n"+lines);
        }catch(InterruptedException e){Thread.currentThread().interrupt();}
        catch(Exception ignored){}
    }
    // Runs a root shell command and returns its trimmed stdout, or null when it
    // fails. Detach interrupts it.
    private String rootOutput(String command,int seconds) throws IOException,InterruptedException {
        Process probe=new ProcessBuilder("su","-c",command).redirectErrorStream(false).start(); pidProbe=probe;
        try {
            StringBuilder response=new StringBuilder();
            Thread drain=new Thread(()->{
                try(BufferedReader reader=new BufferedReader(new InputStreamReader(probe.getInputStream(),StandardCharsets.UTF_8))) {
                    String line; while((line=reader.readLine())!=null) synchronized(response){if(response.length()>0)response.append('\n');response.append(line);}
                }catch(IOException ignored){}
            },"qol-root");
            drain.start();
            if(!probe.waitFor(seconds,TimeUnit.SECONDS)) {probe.destroy();if(stopping||destroyed)return null;throw new IOException("Root command timed out");}
            drain.join(1000);
            if(probe.exitValue()!=0) return null;
            synchronized(response){return response.toString().trim();}
        } finally { if(pidProbe==probe) pidProbe=null; }
    }
    private static void writeAgent(InputStream source,File target,boolean pgp) throws IOException {
        try(InputStream src=source;OutputStream dst=new FileOutputStream(target)) {
            if(pgp)dst.write("globalThis.PgqlRole='pgp';\n".getBytes(StandardCharsets.UTF_8));
            byte[] bytes=new byte[16384]; int count; while((count=src.read(bytes))!=-1) dst.write(bytes,0,count);
        }
    }
    private void readErrors(Process process) {
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(process.getErrorStream(),StandardCharsets.UTF_8))) {
            String line; while((line=reader.readLine())!=null) log("Native: "+line);
        }catch(IOException ignored){}
    }
    private void handle(String line) {
        try {
            JSONObject event=new JSONObject(line); String type=event.optString("event");
            if(type.equals("detached") && (event.optInt("reason")==3 || event.optBoolean("crashed"))) targetDied=true;
            if(type.equals("ready")) {
                readyAt=System.currentTimeMillis();
                log("Agent ready "+(readyAt-attemptStarted)+" ms after "+(accessoryOnly?"attach":"restart"));
                if(event.optString("frida_hiding").equals("names-v1")) log("Frida attach names masked (names-v1)");
                detail("");state("attached");post("list",null);
                if(accessoryOnly) {
                    for(String key:new String[]{"auto-catch","auto-spin","auto-reconnect"})
                        configure(GOPLUS,key,getSharedPreferences("lab",MODE_PRIVATE).getBoolean("goplus."+key,true));
                    post("enable",GOPLUS);
                }
            }
            JSONObject message=event.optJSONObject("message");
            JSONObject payload=message==null?null:message.optJSONObject("payload");
            if(payload!=null && payload.optString("source").equals("qol")) {
                JSONArray list=payload.optJSONArray("modules");
                if(list==null && payload.optString("type").equals("response") && payload.optBoolean("ok")) list=payload.optJSONArray("result");
                if(list!=null) synchronized(LOCK){
                    if(accessoryOnly) {
                        JSONArray filtered=new JSONArray();
                        for(int i=0;i<list.length();i++) {
                            JSONObject module=list.optJSONObject(i);
                            if(module!=null && GOPLUS.equals(module.optString("id")))filtered.put(module);
                        }
                        moduleList=filtered;
                    } else moduleList=list;
                }
                if(accessoryOnly && GOPLUS.equals(payload.optString("moduleId")) && payload.optString("type").equals("log")) {
                    JSONObject details=payload.optJSONObject("details");
                    if(details!=null && details.has("connected"))synchronized(LOCK){goPlusStatus=new JSONObject(details.toString());}
                }
                String change=payload.optString("type");
                if(change.equals("notify"))alert(payload);
                if(change.equals("teleport")) {
                    double latitude=payload.optDouble("latitude"),longitude=payload.optDouble("longitude");
                    teleporter.execute(()->teleport(latitude,longitude));
                }
                if(change.equals("enabled") || change.equals("disabled") || change.equals("config")) synchronized(LOCK) {
                    String id=payload.optString("moduleId");
                    for(int i=0;i<moduleList.length();i++) {
                        JSONObject module=moduleList.optJSONObject(i);
                        if(module==null || !module.optString("id").equals(id))continue;
                        if(change.equals("config"))module.put("config",payload.getJSONObject("config"));
                        else module.put("enabled",change.equals("enabled"));
                    }
                }
                if(!accessoryOnly && GOPLUS.equals(payload.optString("moduleId")) && (change.equals("enabled") || change.equals("disabled") || change.equals("config"))) mirror(change,payload);
            }
        }catch(JSONException ignored){}
        log(line);
    }
    private void post(String action,String moduleId) { post(action,moduleId,null); }
    private synchronized void post(String action,String moduleId,JSONObject args) {
        if(input==null || stopping) return;
        try {
            JSONObject message=new JSONObject().put("type","command").put("id",Long.toString(++commandId)).put("action",action);
            if(moduleId!=null) message.put("moduleId",moduleId);
            if(args!=null) message.put("args",args);
            input.write(message.toString());input.newLine();input.flush();
        } catch(Exception e){log("Command error: "+e.getMessage());}
    }
    private JSONObject goPlusModule() throws JSONException {
        synchronized(LOCK) {
            for(int i=0;i<moduleList.length();i++) {
                JSONObject module=moduleList.optJSONObject(i);
                if(module!=null && GOPLUS.equals(module.optString("id")))return new JSONObject(module.toString());
            }
        }
        return null;
    }
    // Mirror the main-process Virtual GO Plus front onto the agent in the :pgp process.
    private void mirror(String change,JSONObject payload) {
        try {
            JSONObject module=goPlusModule();
            JSONObject config=module==null?null:module.optJSONObject("config");
            String key=payload.optString("key"); boolean value=payload.optBoolean("value");
            companionWorker.execute(()->{
                try {
                    if(change.equals("enabled")) {
                        if(!ensureCompanion()) {post("disable",GOPLUS);return;}
                        if(config!=null) for(java.util.Iterator<String> keys=config.keys();keys.hasNext();) {
                            String name=keys.next();
                            companionPost(new JSONObject().put("action","config").put("key",name).put("value",config.getBoolean(name)));
                        }
                        synchronized(this){companionActive=true;}
                        companionPost(new JSONObject().put("action","enable"));
                    } else if(change.equals("disabled")) {
                        synchronized(this){if(companionActive)companionDisables++;}
                        companionPost(new JSONObject().put("action","disable"));
                    }
                    else companionPost(new JSONObject().put("action","config").put("key",key).put("value",value));
                } catch(JSONException e){log("GO Plus companion command error: "+e.getMessage());}
            });
        } catch(JSONException | RejectedExecutionException e){log("GO Plus companion command error: "+e.getMessage());}
    }
    private synchronized void companionPost(JSONObject message) {
        if(companionInput==null || stopping) return;
        try {
            message.put("type","command").put("id","pgp-"+(++commandId)).put("moduleId",GOPLUS);
            companionInput.write(message.toString());companionInput.newLine();companionInput.flush();
        } catch(Exception e){log("GO Plus companion command error: "+e.getMessage());}
    }
    // Runs on companionWorker. Attaches a second runner to the :pgp process on first use.
    private boolean ensureCompanion() {
        Process existing=companion;
        if(existing!=null && existing.isAlive()) return true;
        if(stopping || destroyed) return false;
        try {
            String pid=companionPid();
            if(pid==null || !pid.matches("[0-9]+")) {log("Virtual GO Plus unavailable: "+COMPANION_TARGET+" is not running");return false;}
            File script=new File(getFilesDir(),"agent-pgp.js");
            writeAgent(new FileInputStream(new File(getFilesDir(),"agent.js")),script,true);
            String executable=getApplicationInfo().nativeLibraryDir+"/libqolrunner.so";
            String shell="exec "+quote(executable)+" --pid "+pid+" --script "+quote(script.getAbsolutePath())+" --resident-agent";
            Process process=new ProcessBuilder("su","-c",shell).start();
            synchronized(this) {
                companion=process;
                companionInput=new BufferedWriter(new OutputStreamWriter(process.getOutputStream(),StandardCharsets.UTF_8));
            }
            if(stopping || destroyed) {closeCompanion();return false;}
            CountDownLatch readiness=new CountDownLatch(1);
            java.util.concurrent.atomic.AtomicBoolean ready=new java.util.concurrent.atomic.AtomicBoolean(false);
            new Thread(()->readErrors(process),"qol-pgp-stderr").start();
            new Thread(()->{
                try(BufferedReader reader=new BufferedReader(new InputStreamReader(process.getInputStream(),StandardCharsets.UTF_8))) {
                    String line; while((line=reader.readLine())!=null) {
                        try {
                            if(new JSONObject(line).optString("event").equals("ready")) {
                                ready.set(true);readiness.countDown();
                            }
                        }catch(JSONException ignored){}
                        handleCompanion(line);
                    }
                }catch(IOException ignored){}
                readiness.countDown();
                boolean lost;
                synchronized(this) {
                    lost=companion==process;
                    if(lost) {
                        if(companionInput!=null)try{companionInput.close();}catch(IOException ignored){}
                        companionInput=null;companion=null;companionActive=false;companionDisables=0;
                    }
                }
                if(lost && !stopping) {log("Virtual GO Plus agent left "+COMPANION_TARGET+"; disabling the module");post("disable",GOPLUS);}
            },"qol-pgp-stdout").start();
            log("Attaching Virtual GO Plus agent to "+COMPANION_TARGET+" (pid "+pid+")");
            // Native startup pumps its GLib loop before creating the script.
            // Sending early consumes commands while there is no receiver.
            if(!readiness.await(20,TimeUnit.SECONDS) || !ready.get() || !process.isAlive())
                throw new IOException("GO Plus agent did not become ready");
            return !stopping && !destroyed;
        } catch(Exception e) {
            closeCompanion();
            if(e instanceof InterruptedException)Thread.currentThread().interrupt();
            log("GO Plus companion error: "+e.getMessage());return false;
        }
    }
    // Separate from rootOutput: it runs on companionWorker while the main
    // worker's probe may be in flight, and pidProbe tracks only one process.
    private static String companionPid() throws IOException,InterruptedException {
        Process probe=new ProcessBuilder("su","-c","pidof -s "+quote(COMPANION_TARGET)).redirectErrorStream(true).start();
        if(!probe.waitFor(20,TimeUnit.SECONDS)) {probe.destroy();throw new IOException("PID check timed out");}
        StringBuilder response=new StringBuilder();
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(probe.getInputStream(),StandardCharsets.UTF_8))) {
            String line; while((line=reader.readLine())!=null) response.append(line);
        }
        return probe.exitValue()==0?response.toString().trim():null;
    }
    private void handleCompanion(String line) {
        try {
            JSONObject event=new JSONObject(line);
            JSONObject message=event.optJSONObject("message");
            JSONObject payload=message==null?null:message.optJSONObject("payload");
            if(payload!=null && payload.optString("source").equals("qol") && GOPLUS.equals(payload.optString("moduleId"))) {
                String type=payload.optString("type");
                JSONObject front=goPlusModule();
                boolean enabled=front!=null && front.optBoolean("enabled"), own=false;
                synchronized(this) {
                    if(type.equals("enabled"))companionActive=true;
                    else if(type.equals("disabled")) {companionActive=false;if(companionDisables>0){companionDisables--;own=true;}}
                }
                // A companion that disabled itself (failed hook, unsupported build) turns the front off too.
                if(type.equals("disabled") && !own && enabled) post("disable",GOPLUS);
                else if(type.equals("log") && enabled) post("invoke",GOPLUS,new JSONObject().put("action","companion")
                    .put("message",payload.optString("message")).put("details",payload.optJSONObject("details")));
            }
        }catch(JSONException ignored){}
        log("GO Plus: "+line);
    }
    // Closing stdin makes the runner shut its agent down and detach.
    private void closeCompanion() {
        Process process;
        synchronized(this) {
            if(companionInput!=null)try{companionInput.close();}catch(IOException ignored){}
            companionInput=null; process=companion; companion=null; companionActive=false; companionDisables=0;
        }
        if(process==null)return;
        new Thread(()->{
            try { if(!process.waitFor(5,TimeUnit.SECONDS)) process.destroy(); }catch(InterruptedException e){Thread.currentThread().interrupt();}
        },"qol-pgp-detach").start();
    }
    private void detach() {
        stopping=true;
        if(!state().equals("idle") && !state().equals("error")) state("detaching");
        Process probe=pidProbe;if(probe!=null)probe.destroy();
        synchronized(this){if(input!=null)try{input.close();}catch(IOException ignored){} input=null;}
        closeCompanion();
        Process process=runner;
        if(process==null){state("idle");stopSelf();return;}
        new Thread(()->{
            try { if(!process.waitFor(5,TimeUnit.SECONDS)) process.destroy(); }catch(InterruptedException e){Thread.currentThread().interrupt();}
        },"qol-detach").start();
    }
    @Override public void onDestroy() {
        destroyed=true; stopping=true;
        Process probe=pidProbe;if(probe!=null)probe.destroy();
        synchronized(this){if(input!=null)try{input.close();}catch(IOException ignored){}input=null;}
        closeCompanion();
        worker.shutdown(); companionWorker.shutdown(); teleporter.shutdown(); if(current==this)current=null;
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
