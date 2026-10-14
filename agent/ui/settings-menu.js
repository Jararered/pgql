// Original UI, created in the injected game's Activity (no overlay permission).
// A PGQL row in the game's own main menu opens native settings pages built by
// PgqlGameSettingsScreen. The Android dialog and floating button below are the
// fallbacks for when the game's UI cannot be used.
Qol.register({
  id:'pgql-menu',name:'PGQL settings menu',
  enable(ctx) {
    let stopped=false, activity=null, root=null, badge=null, dialog=null, prefs=null;
    let opening=false, building=false, widgets=new Map(), restoring=true, pendingRestore=new Set(), keepSaved=new Set();
    const callbacks=new Map(), unique='dev.pgql.injected.S'+Process.id+'_'+Date.now();
    const actionDialogs=new Set(), actionCallbackKeys=new Set(), pendingActions=new Set();
    let serial=0, classes=null, attempted=false, checked=false, badgeKey=null, entry=null, fallback=false;
    let screen=null, native=true, page='main';
    function fail(error){ctx.log('Settings UI error',{error:String(error)});}
    function main(fn) {
      if(stopped)return;
      try{Java.perform(()=>Java.scheduleOnMainThread(()=>{if(!stopped)try{fn();}catch(error){fail(error);}}));}
      catch(error){fail(error);}
    }
    function dp(value){return Math.round(value*activity.getResources().getDisplayMetrics().density.value);}
    function text(value,size=15,bold=false) {
      const view=classes.TextView.$new(activity);view.setText(classes.String.$new(value));view.setTextSize(size);
      view.setTextColor(classes.Color.parseColor('#183437'));
      if(bold)view.setTypeface(null,1);
      view.setPadding(0,dp(7),0,dp(7));return view;
    }
    function listener(kind,callback) {
      const key=String(++serial);callbacks.set(key,callback);
      const instance=classes[kind].$new();instance.key.value=key;return instance;
    }
    function persist() {
      if(restoring || !prefs)return;
      const config={};
      // Saved modules still waiting for the map, or that turned themselves off
      // after an error, stay saved as enabled until the user changes them.
      for(const module of Qol.describe())if(module.id!=='pgql-menu')
        config[module.id]={enabled:module.enabled || pendingRestore.has(module.id) || keepSaved.has(module.id),config:module.config};
      prefs.edit().putString('modules',classes.String.$new(JSON.stringify(config))).apply();
    }
    function sync() {
      if(building)return;
      building=true;
      try {
        for(const module of Qol.describe()) {
          const enabled=widgets.get(module.id+':enabled');if(enabled)enabled.setChecked(module.enabled);
          for(const setting of module.settings) {
            const widget=widgets.get(module.id+':'+setting.key);if(!widget)continue;
            if(setting.type==='text')widget.setText(classes.String.$new(setting.label+': '+module.config[setting.key]));
            else widget.setChecked(module.config[setting.key]);
          }
          for(const action of module.actions) {
            const widget=widgets.get(module.id+':action:'+action.id);
            if(widget)widget.setEnabled(module.enabled && (action.id==='cancel' || !pendingActions.has(module.id+':'+action.id)));
          }
        }
      }finally{building=false;}
    }
    function row(label,checked,onChange) {
      const view=classes.Switch.$new(activity);view.setText(classes.String.$new(label));view.setTextSize(15);
      view.setPadding(0,dp(8),0,dp(8));view.setChecked(checked);
      view.setOnCheckedChangeListener(listener('Checked',(value)=>{
        if(building || stopped)return;
        try{onChange(value);persist();}catch(error){fail(error);sync();}
      }));return view;
    }
    function resultText(result) {
      if(result===undefined || result===null)return 'Action finished.';
      if(typeof result!=='object')return String(result);
      const lines=[];
      if(result.phase)lines.push('Status: '+result.phase);
      if(result.completed!==undefined)lines.push('Completed: '+result.completed+(result.total!==undefined?' / '+result.total:''));
      for(const key of ['succeeded','skipped','failed'])if(result[key]!==undefined)lines.push(key[0].toUpperCase()+key.slice(1)+': '+result[key]);
      if(result.friendCount!==undefined || Array.isArray(result.friendIds))lines.push('Friends: '+(result.friendCount??result.friendIds.length));
      if(result.giftCount!==undefined)lines.push('Gifts available: '+result.giftCount);
      if(result.incomingGifts!==undefined)lines.push('Incoming gifts: '+result.incomingGifts);
      if(result.reason)lines.push(String(result.reason));
      return lines.length?lines.join('\n'):JSON.stringify(result,null,2);
    }
    function actionDialog(title,message,continueAction) {
      if(stopped)return;
      const keys=[];
      function ownedListener(kind,callback) {
        const instance=listener(kind,callback),key=String(serial);
        keys.push(key);actionCallbackKeys.add(key);return instance;
      }
      const builder=classes.Builder.$new(activity);
      builder.setTitle(classes.String.$new(title));builder.setMessage(classes.String.$new(message));
      builder.setPositiveButton(classes.String.$new(continueAction?'Continue':'Close'),continueAction?ownedListener('DialogClick',continueAction):null);
      if(continueAction)builder.setNegativeButton(classes.String.$new('Cancel'),null);
      const shown=Java.retain(builder.create());actionDialogs.add(shown);
      shown.setOnDismissListener(ownedListener('Dismiss',()=>{
        actionDialogs.delete(shown);
        for(const key of keys){callbacks.delete(key);actionCallbackKeys.delete(key);}
        shown.$dispose();
      }));
      shown.show();
    }
    // Text settings are edited in a small Android input dialog over the game.
    function editDialog(module,setting) {
      if(stopped)return;
      const keys=[];
      function ownedListener(kind,callback) {
        const instance=listener(kind,callback),key=String(serial);
        keys.push(key);actionCallbackKeys.add(key);return instance;
      }
      const input=classes.EditText.$new(activity);
      // EditText narrows setText; use the TextView overload.
      Java.cast(input,classes.TextView).setText(classes.String.$new(Qol.describe().find(item=>item.id===module.id).config[setting.key]));
      // Plain text without suggestions, so the keyboard does not rewrite values.
      input.setInputType(0x80001);input.setSingleLine(true);input.setSelectAllOnFocus(true);input.setFilters(Java.array('android.text.InputFilter',[classes.LengthFilter.$new(setting.maxLength)]));
      const frame=classes.LinearLayout.$new(activity);frame.setPadding(dp(20),dp(4),dp(20),0);
      frame.addView(input,classes.LinearParams.$new(-1,-2));
      const builder=classes.Builder.$new(activity);
      builder.setTitle(classes.String.$new(setting.label));
      if(setting.description)builder.setMessage(classes.String.$new(setting.description));
      builder.setView(frame);
      builder.setPositiveButton(classes.String.$new('Save'),ownedListener('DialogClick',()=>{
        // Editable only exposes toString through CharSequence.
        const value=String(Java.cast(input.getText(),classes.CharSequence).toString()).trim();
        try{Qol.setConfig(module.id,setting.key,value);}
        catch(error){fail(error);notify(setting.label,'Value not saved.\n'+String(error.message || error));}
      }));
      builder.setNegativeButton(classes.String.$new('Cancel'),null);
      const shown=Java.retain(builder.create());actionDialogs.add(shown);
      shown.setOnDismissListener(ownedListener('Dismiss',()=>{
        actionDialogs.delete(shown);
        for(const key of keys){callbacks.delete(key);actionCallbackKeys.delete(key);}
        shown.$dispose();
      }));
      shown.show();
    }
    function invokeAction(module,action,confirmFirst) {
      if(stopped)return;
      const pendingKey=module.id+':'+action.id;
      if(action.id!=='cancel' && pendingActions.has(pendingKey))return;
      pendingActions.add(pendingKey);sync();
      Promise.resolve().then(()=>Qol.invoke(module.id,{action:confirmFirst?'preview':action.id,...(confirmFirst?{mode:action.id}:{})})).then(result=>{
        ctx.log('Module action result',{moduleId:module.id,action:confirmFirst?'preview':action.id,result});
        if(confirmFirst) {
          const label=(action.label+' '+action.id).toLowerCase();
          const effect=label.includes('send')?'This will attempt to send gifts to the friends in this preview. Successful sends consume inventory gifts.'
            :label.includes('open')?'This will attempt to open incoming gifts from the friends in this preview. Successful opens add items to your bag and count toward your daily limit.'
            :'This will run '+action.label+' for '+module.name+'.';
          notify(module.name+' — '+action.label,resultText(result)+'\n\n'+effect,()=>invokeAction(module,action,false));
        }else notify(module.name+' — '+action.label,resultText(result));
      }).catch(error=>{
        fail(error);notify(module.name+' — '+action.label,'Action failed: '+String(error));
      }).finally(()=>{
        pendingActions.delete(pendingKey);main(sync);
      }).catch(fail);
    }
    // Native pages. Game-thread callbacks hop to the agent thread before
    // touching module state.
    function later(fn){setTimeout(()=>{if(!stopped)try{fn();}catch(error){fail(error);}},0);}
    function layout(){return PgqlSettingsLayout(Qol.describe().filter(module=>module.id!=='pgql-menu'));}
    function notify(title,message,continueAction) {
      const android=()=>main(()=>actionDialog(title,message,continueAction));
      if(!native || !screen){android();return;}
      screen.prompt(title,message,!!continueAction).then(accepted=>{
        if(accepted && continueAction && !stopped)continueAction();
      }).catch(error=>{fail(error);android();});
    }
    function refresh(){if(native && screen)screen.update(PgqlSettingsLayout.values(Qol.describe())).catch(fail);}
    const handlers={
      toggle(row,value){later(()=>{
        try {
          if(row.key)Qol.setConfig(row.moduleId,row.key,value);
          else {keepSaved.delete(row.moduleId);if(value)Qol.enable(row.moduleId);else Qol.disable(row.moduleId);}
        }catch(error){fail(error);refresh();notify(row.label,'Could not change this setting.\n'+String(error));}
      });},
      action(row){later(()=>{
        const module=Qol.describe().find(item=>item.id===row.moduleId),action=module && module.actions.find(item=>item.id===row.actionId);
        if(!action)return;
        if(!module.enabled){notify(module.name,'Turn on '+module.name+' first.');return;}
        invokeAction(module,action,action.confirm);
      });},
      edit(row){later(()=>{
        const module=Qol.describe().find(item=>item.id===row.moduleId),setting=module && module.settings.find(item=>item.key===row.key);
        if(setting)main(()=>editDialog(module,setting));
      });},
      link(row){later(()=>showPage(row.page));},
      back(){later(()=>{if(page!=='main')showPage('main');else screen.hide().catch(fail);});}
    };
    function showPage(id) {
      page=id;
      screen.show(layout()[id],handlers).catch(error=>{
        if(stopped)return;
        // Keep settings reachable: use the Android panel for this session.
        fail(error);native=false;screen.hide().catch(fail);main(()=>open());
      });
    }
    function openMenu(){if(native && screen)showPage('main');else main(()=>open());}
    function open() {
      if(stopped || opening || (dialog && dialog.isShowing()))return;
      opening=true;
      try {
        widgets=new Map();
        for(const key of callbacks.keys())if(key!==badgeKey && !actionCallbackKeys.has(key))callbacks.delete(key);
        if(dialog){dialog.$dispose();dialog=null;}
        const content=classes.LinearLayout.$new(activity);content.setOrientation(1);
        content.setPadding(dp(20),dp(4),dp(20),dp(12));
        content.addView(text(Qol.project.fullName,16,true));
        content.addView(text('Version '+Qol.project.version,14));
        const divider=classes.View.$new(activity);divider.setBackgroundColor(classes.Color.parseColor('#d0e1df'));
        content.addView(divider,classes.LinearParams.$new(-1,dp(1)));
        for(const module of Qol.describe()) {
          if(module.id==='pgql-menu')continue;
          content.addView(text(module.name,18,true));
          if(module.availability==='planned') {
            content.addView(text(module.unavailableReason,14));
            continue;
          }
          if(module.availability==='experimental')content.addView(text(module.unavailableReason || 'Experimental',14));
          const enabled=row('Enabled',module.enabled,value=>{keepSaved.delete(module.id);if(value)Qol.enable(module.id);else Qol.disable(module.id);});
          widgets.set(module.id+':enabled',enabled);content.addView(enabled);
          for(const setting of module.settings) {
            let control;
            if(setting.type==='text') {
              control=classes.Button.$new(activity);control.setText(classes.String.$new(setting.label+': '+module.config[setting.key]));control.setAllCaps(false);
              control.setOnClickListener(listener('Click',()=>editDialog(module,setting)));
            }else control=row(setting.label,module.config[setting.key],value=>Qol.setConfig(module.id,setting.key,value));
            widgets.set(module.id+':'+setting.key,control);content.addView(control);
          }
          for(const action of module.actions) {
            const control=classes.Button.$new(activity);control.setText(classes.String.$new(action.label));control.setAllCaps(false);
            control.setEnabled(module.enabled && (action.id==='cancel' || !pendingActions.has(module.id+':'+action.id)));
            control.setOnClickListener(listener('Click',()=>invokeAction(module,action,action.confirm)));
            widgets.set(module.id+':action:'+action.id,control);content.addView(control);
          }
        }
        const scroll=classes.ScrollView.$new(activity);scroll.addView(content);
        const builder=classes.Builder.$new(activity);
        builder.setTitle(classes.String.$new(Qol.project.name+' '+Qol.project.version));builder.setView(scroll);
        builder.setPositiveButton(classes.String.$new('Close'),null);
        dialog=Java.retain(builder.create());dialog.show();
        dialog.getWindow().setLayout(Math.min(dp(380),activity.getResources().getDisplayMetrics().widthPixels.value-dp(32)),-2);
        ctx.log('Settings menu opened',{project:Qol.project.name,version:Qol.project.version});
      }finally{opening=false;}
    }
    function loadPreferences() {
      prefs=activity.getSharedPreferences('pgql_settings',0);
      let saved={};
      try{saved=JSON.parse(prefs.getString('modules','{}').toString());}catch(error){fail(error);}
      for(const module of Qol.describe()) {
        if(module.id==='pgql-menu')continue;
        const stored=saved[module.id];if(!stored)continue;
        for(const setting of module.settings)if(typeof stored.config?.[setting.key]===(setting.type==='text'?'string':'boolean')) {
          try{Qol.setConfig(module.id,setting.key,stored.config[setting.key]);}catch(error){fail(error);}
        }
        if(stored.enabled===true)pendingRestore.add(module.id);
        else if(stored.enabled===false)try{Qol.disable(module.id);}catch(error){fail(error);}
      }
      // The session may attach during the loading screen. Enable saved modules
      // once the map exists, one at a time, so their startup work does not land
      // in the same frames.
      const restore=()=>{
        if(stopped)return;
        const [id]=pendingRestore;
        if(id===undefined){ctx.log('Saved modules restored');return;}
        pendingRestore.delete(id);
        try{Qol.enable(id);}catch(error){fail(error);}
        setTimeout(restore,300);
      };
      restoring=false;
      if(!pendingRestore.size)return;
      const gate=new PgqlGameGifts(ctx);
      ctx.log('Waiting for the map before restoring saved modules',{modules:pendingRestore.size});
      gate.mapReady().then(()=>{ctx.log('Map ready',{sinceLoadMs:Date.now()-PgqlGameGifts.loadedAt});restore();},error=>{
        if(stopped)return;
        fail(error);restore();
      });
    }
    function install(candidate) {
      if(stopped)return;
      const content=candidate.findViewById(16908290);if(!content)return;
      activity=Java.retain(candidate);root=Java.retain(Java.cast(content,classes.ViewGroup));
      loadPreferences();
      if(fallback)showBadge();else addEntry();
    }
    function addEntry() {
      if(entry)return;
      try {
        // The click arrives on the Unity thread; hop off it before acting.
        entry=new PgqlGameMainMenu(ctx,Qol.project.name,()=>later(openMenu));
        screen=new PgqlGameSettingsScreen(ctx,entry.game);
        entry.start().catch(error=>{
          if(stopped)return;
          fail(error);fallback=true;main(showBadge);
        });
      }catch(error){fail(error);fallback=true;showBadge();}
    }
    function showBadge() {
      if(stopped || !root)return;
      if(badgeKey)callbacks.delete(badgeKey);
      badge=Java.retain(classes.Button.$new(activity));badge.setText(classes.String.$new('PGQL '+Qol.project.version));
      badge.setAllCaps(false);badge.setTextSize(13);badge.setTextColor(classes.Color.parseColor('#ffffff'));
      badge.setBackgroundTintList(classes.ColorStateList.valueOf(classes.Color.parseColor('#176d70')));
      badge.setElevation(dp(5));badge.setPadding(dp(12),0,dp(12),0);
      badge.setOnClickListener(listener('Click',()=>{try{open();}catch(error){fail(error);}}));
      badgeKey=String(serial);
      const params=classes.FrameParams.$new(-2,dp(44),53);params.topMargin.value=dp(56);params.rightMargin.value=dp(12);
      root.addView(badge,params);
      ctx.log('Fallback settings button injected',{activity:activity.getClass().getName().toString(),version:Qol.project.version});
    }
    function initialize() {
      if(classes)return;
      ctx.log('Initializing settings Java classes');
      const Checked=Java.registerClass({name:unique+'Checked',implements:[Java.use('android.widget.CompoundButton$OnCheckedChangeListener')],fields:{key:'java.lang.String'},methods:{onCheckedChanged(button,value){const fn=callbacks.get(this.key.value.toString());if(fn)fn(value);}}});
      const Click=Java.registerClass({name:unique+'Click',implements:[Java.use('android.view.View$OnClickListener')],fields:{key:'java.lang.String'},methods:{onClick(view){const fn=callbacks.get(this.key.value.toString());if(fn)try{fn();}catch(error){fail(error);}}}});
      const DialogClick=Java.registerClass({name:unique+'DialogClick',implements:[Java.use('android.content.DialogInterface$OnClickListener')],fields:{key:'java.lang.String'},methods:{onClick(dialog,which){const fn=callbacks.get(this.key.value.toString());if(fn)try{fn();}catch(error){fail(error);}}}});
      const Dismiss=Java.registerClass({name:unique+'Dismiss',implements:[Java.use('android.content.DialogInterface$OnDismissListener')],fields:{key:'java.lang.String'},methods:{onDismiss(dialog){const fn=callbacks.get(this.key.value.toString());if(fn)try{fn();}catch(error){fail(error);}}}});
      classes={Checked,Click,DialogClick,Dismiss};
      for(const [key,name] of Object.entries({String:'java.lang.String',TextView:'android.widget.TextView',View:'android.view.View',ViewGroup:'android.view.ViewGroup',Button:'android.widget.Button',Switch:'android.widget.Switch',LinearLayout:'android.widget.LinearLayout',LinearParams:'android.widget.LinearLayout$LayoutParams',FrameParams:'android.widget.FrameLayout$LayoutParams',ScrollView:'android.widget.ScrollView',Builder:'android.app.AlertDialog$Builder',EditText:'android.widget.EditText',CharSequence:'java.lang.CharSequence',LengthFilter:'android.text.InputFilter$LengthFilter',Color:'android.graphics.Color',ColorStateList:'android.content.res.ColorStateList'}))classes[key]=Java.use(name);
    }
    function findActivity() {
      if(stopped || attempted)return;
      try {
        if(!checked)ctx.log('Checking Java runtime');
        if(!Java.available)return;
        if(!checked){checked=true;ctx.log('Java runtime available');}
        Java.perform(()=>{
          try {
            initialize();
            if(activity && !activity.isDestroyed())return;
            const thread=Java.use('android.app.ActivityThread').currentActivityThread();if(!thread)return;
            const records=thread.mActivities.value.values().iterator();
            while(records.hasNext()) {
              const record=Java.cast(records.next(),Java.use('android.app.ActivityThread$ActivityClientRecord'));
              const candidate=record.activity.value;
              if(candidate && !candidate.isFinishing() && !record.paused.value) {
                const retained=Java.retain(candidate);main(()=>install(retained));break;
              }
            }
          }catch(error){if(!attempted){attempted=true;fail(error);}}
        });
      }catch(error){if(!attempted){attempted=true;fail(error);}}
    }
    const unsubscribe=Qol.subscribe(change=>{
      if(stopped)return;
      if(change.moduleId==='pgql-menu')return;
      if(change.type==='disabled' && change.failed)keepSaved.add(change.moduleId);
      else if(change.type==='enabled' || change.type==='disabled')keepSaved.delete(change.moduleId);
      if(!classes)return;
      if(['enabled','disabled','config'].includes(change.type)){main(()=>{if(!change.failed)persist();sync();});refresh();}
    });
    ctx.cleanup(()=>{
      unsubscribe();stopped=true;
      if(Java.available)Java.perform(()=>Java.scheduleOnMainThread(()=>{
        try{if(dialog)dialog.dismiss();for(const shown of [...actionDialogs])shown.dismiss();if(root&&badge)root.removeView(badge);callbacks.clear();actionCallbackKeys.clear();}catch(error){fail(error);}
      }));
    });
    ctx.interval(findActivity,1000);
  }
});
