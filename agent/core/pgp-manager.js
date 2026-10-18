'use strict';
// Original GO Plus status bridge: reports device XP/timestamps/encounter IDs
// back to the game's native PgpManagerAndroid so the virtual session behaves
// like a connected accessory. Exports are resolved from libholoholo.so and
// gated to the supported GO build by the adapter.
globalThis.PgqlPgpManager = class PgqlPgpManager {
  static get exports() {
    return ['_ZN3pgp7android17PgpManagerAndroid19SendXpGainedMessageEi',
      '_ZN3pgp7android17PgpManagerAndroid26SendUpdateTimestampMessageEl',
      '_ZN3pgp7android17PgpManagerAndroid22SendEncounterIdMessageEl'];
  }
  constructor(libholoholo) {
    const [xp,time,id]=PgqlPgpManager.exports.map(name=>libholoholo.findExportByName(name));
    if(!xp || !time || !id)throw Error('Unsupported PgpManagerAndroid exports');
    this.sendXpGained=new NativeFunction(xp,'void',['pointer','int']);
    this.sendTimestamp=new NativeFunction(time,'void',['pointer','int64']);
    this.sendEncounterId=new NativeFunction(id,'void',['pointer','uint64']);
  }
  reportXpGained(manager,xp) {
    this.sendXpGained(manager,xp);
    this.sendTimestamp(manager,Date.now());
  }
  reportEncounterId(manager,id) { this.sendEncounterId(manager,id); }
  reportNoXp(manager) {
    this.sendXpGained(manager,0);
    this.sendTimestamp(manager,Date.now());
  }
};