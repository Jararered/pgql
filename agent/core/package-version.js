'use strict';
// Installed game versionName through the Java bridge. Unlike
// Il2Cpp.application.version this also works in processes that never load
// Unity, such as the game's :pgp accessory service process.
globalThis.PgqlPackageVersion = () => new Promise((resolve,reject)=>{
  try {
    Java.perform(()=>{
      try {
        const app=Java.use('android.app.ActivityThread').currentApplication();
        if(!app)throw Error('Application is not available');
        const info=app.getPackageManager().getPackageInfo(app.getPackageName(),0);
        resolve(String(info.versionName.value));
      }catch(error){reject(error);}
    });
  }catch(error){reject(error);}
});
