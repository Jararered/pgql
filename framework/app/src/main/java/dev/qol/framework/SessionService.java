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
    public static final String ATTACH="dev.qol.framework.ATTACH", STOP="dev.qol.framework.STOP", UPDATE="dev.qol.framework.UPDATE";
    private static final Object LOCK=new Object();
    private static final ArrayDeque<String> LOG=new ArrayDeque<>();
    private static String sessionState="idle";
    private static JSONArray moduleList=new JSONArray();
    private static volatile SessionService current;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile Process runner, pidProbe;
    private volatile boolean stopping=false, destroyed=false;
    private BufferedWriter input;
    private long commandId=0;
    public static String state() { synchronized(LOCK){return sessionState;} }
    public static JSONArray modules() { synchronized(LOCK){ try{return new JSONArray(moduleList.toString());}catch(JSONException e){return new JSONArray();} } }
    public static String logText() { synchronized(LOCK){StringBuilder out=new StringBuilder();for(String line:LOG) out.append(line).append('\n'); return out.toString();} }
    public static void clearLog() { synchronized(LOCK){LOG.clear();} }
    public static void command(String action,String moduleId) {
        SessionService service=current;
        if(service!=null) service.post(action,moduleId);
    }
    private void update() { sendBroadcast(new Intent(UPDATE).setPackage(getPackageName())); }
    private void state(String value) { synchronized(LOCK){sessionState=value;} update(); }
    private void log(String value) {
        android.util.Log.i("QolLab",value);
        synchronized(LOCK){if(LOG.size()>=300) LOG.removeFirst();LOG.addLast(value.length()>8192?value.substring(0,8192):value);} update();
    }
    @Override public void onCreate() {
        super.onCreate(); current=this;
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("session","Development session",NotificationManager.IMPORTANCE_LOW));
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,SessionService.class).setAction(STOP),PendingIntent.FLAG_IMMUTABLE);
        Notification notification=new Notification.Builder(this,"session").setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setContentTitle("PGQL 0.1 session").setContentText("Pokemon Go QoL").setContentIntent(open)
            .addAction(new Notification.Action.Builder(null,"Detach",stop).build()).setOngoing(true).build();
        startForeground(1,notification);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if(intent==null || STOP.equals(intent.getAction())) { detach(); return START_NOT_STICKY; }
        if(ATTACH.equals(intent.getAction()) && !state().equals("connecting") && !state().equals("attached")) {
            stopping=false; state("connecting"); worker.execute(this::attach);
        }
        return START_NOT_STICKY;
    }
    private static String quote(String value) { return "'"+value.replace("'","'\\''")+"'"; }
    private void attach() {
        boolean failed=false;
        try {
            File script=new File(getFilesDir(),"agent.js");
            try(InputStream src=getAssets().open("agent.js");OutputStream dst=new FileOutputStream(script)) {
                byte[] bytes=new byte[16384]; int count; while((count=src.read(bytes))!=-1) dst.write(bytes,0,count);
            }
            String executable=getApplicationInfo().nativeLibraryDir+"/libqolrunner.so";
            if(!new File(executable).isFile()) throw new IOException("Native runner missing; build arm64 APK first");
            log("Checking root and locating the running game…");
            // The launcher may replace an old cached process. Resolve PID afterwards.
            Thread.sleep(1250);
            if(stopping || destroyed) return;
            Process probe=new ProcessBuilder("su","-c","pidof -s "+TARGET).redirectErrorStream(true).start(); pidProbe=probe;
            if(!probe.waitFor(20,TimeUnit.SECONDS)) {probe.destroy();throw new IOException("Root/PID check timed out");}
            StringBuilder response=new StringBuilder();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(probe.getInputStream(),StandardCharsets.UTF_8))) {
                String line; while((line=reader.readLine())!=null) response.append(line);
            }
            pidProbe=null;
            if(stopping || destroyed) return;
            String pid=response.toString().trim();
            if(probe.exitValue()!=0 || !pid.matches("[0-9]+")) throw new IOException("Root denied or game is not running. Launch the game and allow root for PGQL.");
            String shell="exec "+quote(executable)+" --pid "+pid+" --script "+quote(script.getAbsolutePath())+" --resident-agent";
            if(getSharedPreferences("lab",MODE_PRIVATE).getBoolean("prepare_selinux",false))shell+=" --prepare-selinux";
            Process process=new ProcessBuilder("su","-c",shell).start(); runner=process;
            synchronized(this){input=new BufferedWriter(new OutputStreamWriter(process.getOutputStream(),StandardCharsets.UTF_8));}
            if(stopping || destroyed) {synchronized(this){input.close();input=null;}}
            Thread errors=new Thread(()->readErrors(process),"qol-stderr"); errors.start();
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(process.getInputStream(),StandardCharsets.UTF_8))) {
                String line; while((line=reader.readLine())!=null) handle(line);
            }
            int exit=process.waitFor();
            if(exit!=0 && !stopping){failed=true; log("Runner exited with code "+exit);}
        } catch(Exception e) {if(!stopping){failed=true;log("Session error: "+e.getMessage());}}
        finally {
            synchronized(this){if(input!=null)try{input.close();}catch(IOException ignored){} input=null;}
            Process process=runner; runner=null; if(process!=null && process.isAlive()) process.destroy();
            synchronized(LOCK){moduleList=new JSONArray();}
            state(failed?"error":"idle"); stopSelf();
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
            if(type.equals("ready")) {state("attached");post("list",null);}
            JSONObject message=event.optJSONObject("message");
            JSONObject payload=message==null?null:message.optJSONObject("payload");
            if(payload!=null && payload.optString("source").equals("qol")) {
                JSONArray list=payload.optJSONArray("modules");
                if(list==null && payload.optString("type").equals("response") && payload.optBoolean("ok")) list=payload.optJSONArray("result");
                if(list!=null) synchronized(LOCK){moduleList=list;}
                String change=payload.optString("type");
                if(change.equals("enabled") || change.equals("disabled") || change.equals("config")) synchronized(LOCK) {
                    String id=payload.optString("moduleId");
                    for(int i=0;i<moduleList.length();i++) {
                        JSONObject module=moduleList.optJSONObject(i);
                        if(module==null || !module.optString("id").equals(id))continue;
                        if(change.equals("config"))module.put("config",payload.getJSONObject("config"));
                        else module.put("enabled",change.equals("enabled"));
                    }
                }
            }
        }catch(JSONException ignored){}
        log(line);
    }
    private synchronized void post(String action,String moduleId) {
        if(input==null || stopping) return;
        try {
            JSONObject message=new JSONObject().put("type","command").put("id",Long.toString(++commandId)).put("action",action);
            if(moduleId!=null) message.put("moduleId",moduleId);
            input.write(message.toString());input.newLine();input.flush();
        } catch(Exception e){log("Command error: "+e.getMessage());}
    }
    private void detach() {
        stopping=true;
        if(!state().equals("idle") && !state().equals("error")) state("detaching");
        Process probe=pidProbe;if(probe!=null)probe.destroy();
        synchronized(this){if(input!=null)try{input.close();}catch(IOException ignored){} input=null;}
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
        worker.shutdown(); if(current==this)current=null;
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
