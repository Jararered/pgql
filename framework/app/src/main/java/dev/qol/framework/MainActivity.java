package dev.qol.framework;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.*;
import org.json.*;

public class MainActivity extends Activity {
    private TextView status, logs;
    private LinearLayout modules;
    private Button attach, detach, snapshot;
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { render(); }
    };
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        LinearLayout page=new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(24,36,24,16);
        page.setOnApplyWindowInsetsListener((view,insets)-> {
            if(Build.VERSION.SDK_INT>=30) {
                android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());
                view.setPadding(24+bars.left,36+bars.top,24+bars.right,16+bars.bottom);
            } else view.setPadding(24,36+insets.getSystemWindowInsetTop(),24,16+insets.getSystemWindowInsetBottom());
            return insets;
        });
        TextView title=new TextView(this); title.setText("PGQL 0.1"); title.setTextSize(28); page.addView(title);
        TextView subtitle=new TextView(this); subtitle.setText("Pokemon Go QoL · module development"); page.addView(subtitle);
        status=new TextView(this); status.setPadding(0,20,0,12); page.addView(status);
        CheckBox policy=new CheckBox(this);
        policy.setText("Apply Frida SELinux setup (system-wide, until reboot)");
        policy.setChecked(getSharedPreferences("lab",MODE_PRIVATE).getBoolean("prepare_selinux",false));
        policy.setOnCheckedChangeListener((view,checked)->getSharedPreferences("lab",MODE_PRIVATE).edit().putBoolean("prepare_selinux",checked).apply());
        page.addView(policy);
        LinearLayout controls=new LinearLayout(this);
        Button launch=button("Launch game", v -> {
            Intent intent=getPackageManager().getLaunchIntentForPackage(SessionService.TARGET);
            if(intent==null) Toast.makeText(this,"Pokémon GO is not installed",Toast.LENGTH_LONG).show(); else startActivity(intent);
        }); controls.addView(launch);
        attach=button("Attach",v -> {
            Intent game=getPackageManager().getLaunchIntentForPackage(SessionService.TARGET);
            if(game==null) {Toast.makeText(this,"Pokémon GO is not installed",Toast.LENGTH_LONG).show();return;}
            Intent intent=new Intent(this,SessionService.class).setAction(SessionService.ATTACH);
            startForegroundService(intent);
            startActivity(game);
        }); controls.addView(attach);
        detach=button("Detach",v -> {
            Intent game=getPackageManager().getLaunchIntentForPackage(SessionService.TARGET);
            if(game!=null)startActivity(game);
            startService(new Intent(this,SessionService.class).setAction(SessionService.STOP));
        });
        controls.addView(detach); page.addView(controls);
        TextView heading=new TextView(this); heading.setText("Modules"); heading.setTextSize(20); page.addView(heading);
        modules=new LinearLayout(this); modules.setOrientation(LinearLayout.VERTICAL); page.addView(modules);
        snapshot=button("Run diagnostics",v -> {SessionService.command("invoke","diagnostics"); foregroundGame();}); page.addView(snapshot);
        TextView caption=new TextView(this); caption.setText("Session log"); page.addView(caption);
        ScrollView scroll=new ScrollView(this);
        logs=new TextView(this); logs.setTypeface(Typeface.MONOSPACE); logs.setTextSize(11); scroll.addView(logs);
        page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        page.addView(button("Clear log",v -> { SessionService.clearLog(); render(); }));
        setContentView(page);
        if(Build.VERSION.SDK_INT>=30)page.post(()-> {
            android.view.WindowInsetsController controller=getWindow().getInsetsController();
            if(controller!=null)controller.setSystemBarsAppearance(
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        });
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);
        render();
    }
    private Button button(String label,View.OnClickListener listener) {
        Button result=new Button(this); result.setText(label); result.setOnClickListener(listener); return result;
    }
    @Override protected void onStart() {
        super.onStart();
        IntentFilter filter=new IntentFilter(SessionService.UPDATE);
        if(Build.VERSION.SDK_INT>=33) registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,filter);
        render();
    }
    @Override protected void onStop() { unregisterReceiver(receiver); super.onStop(); }
    private void render() {
        String state=SessionService.state(); status.setText("Session: "+state);
        boolean idle=state.equals("idle") || state.equals("error");
        attach.setEnabled(idle); detach.setEnabled(!idle); snapshot.setEnabled(state.equals("attached"));
        logs.setText(SessionService.logText());
        modules.removeAllViews();
        JSONArray list=SessionService.modules();
        if(list.length()==0) { TextView hint=new TextView(this); hint.setText("Open the game, then attach to load modules."); modules.addView(hint); }
        for(int i=0;i<list.length();i++) {
            JSONObject item=list.optJSONObject(i); if(item==null) continue;
            String id=item.optString("id"); CheckBox check=new CheckBox(this);
            check.setText(item.optString("name",id)); check.setChecked(item.optBoolean("enabled"));
            check.setEnabled(state.equals("attached"));
            check.setOnCheckedChangeListener((view,enabled) -> {SessionService.command(enabled?"enable":"disable",id);foregroundGame();});
            modules.addView(check);
        }
    }
    private void foregroundGame(){Intent intent=getPackageManager().getLaunchIntentForPackage(SessionService.TARGET);if(intent!=null)startActivity(intent);}
}
