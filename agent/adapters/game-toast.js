'use strict';
// Original helper shared by the adapters that show game toasts. It moves a toast
// from the middle of the screen to the top, below the Android status bar, through
// the game's own ToastParams.PivotY (a screen fraction from the bottom, 0.5 by
// default). TwoLine toasts ignore VerticalScreenPosition but follow PivotY.
// Names are verified from live managed metadata; there are no offsets.
// Placement is optional: without it a toast still shows, centred as before.
globalThis.PgqlGameToast = class PgqlGameToast {
  // On 0.433.0 the game draws under the status bar and Screen.safeArea reports
  // the whole screen, so the ceiling is what keeps the toast clear of the status
  // bar. A device whose safe area does leave out a taller inset moves it lower.
  static get ceiling(){return 0.9;}
  static get margin(){return 0.1;}
  static get floor(){return 0.5;}
  // safeTop is the safe area's top edge in pixels from the bottom (Unity screen space).
  static position(safeTop,height) {
    if(!(height>0)||!(safeTop>0))return PgqlGameToast.ceiling;
    return Math.max(PgqlGameToast.floor,Math.min(PgqlGameToast.ceiling,safeTop/height-PgqlGameToast.margin));
  }
  // Metadata time. params is the ToastParams class. Returns null (and logs) when
  // the game cannot place toasts, so the caller keeps its centred toasts.
  static bind(type,params,log) {
    try {
      const fields=params.fields.filter(f=>!f.isStatic&&f.name==='PivotY');
      if(fields.length!==1||fields[0].type.name!=='System.Single')throw Error('Unsupported toast field: PivotY');
      const screen=type('UnityEngine.Screen');
      const getter=(name,returns)=>{
        const matches=screen.methods.filter(m=>m.name===name&&m.isStatic&&m.parameterCount===0&&m.returnType.name===returns);
        if(matches.length!==1)throw Error('Unsupported screen method: '+name);
        return matches[0];
      };
      const area=getter('get_safeArea','UnityEngine.Rect'),height=getter('get_height','System.Int32');
      const rect=type('UnityEngine.Rect');
      for(const name of ['m_YMin','m_Height'])if(rect.field(name).type.name!=='System.Single')throw Error('Unsupported rect field: '+name);
      return {area,height,log,failed:false};
    }catch(error){
      if(log)log('Toasts stay centred: top placement unavailable',{error:String(error)});
      return null;
    }
  }
  // Game thread, right after ToastParams..ctor. A placement problem is logged
  // once and never stops the toast.
  static place(bound,params) {
    if(!bound||bound.failed)return null;
    try {
      const rect=bound.area.invoke(),top=rect.field('m_YMin').value+rect.field('m_Height').value;
      const value=PgqlGameToast.position(top,bound.height.invoke());
      params.field('PivotY').value=value;
      return value;
    }catch(error){
      bound.failed=true;
      if(bound.log)bound.log('Toasts stay centred: top placement failed',{error:String(error)});
      return null;
    }
  }
};
