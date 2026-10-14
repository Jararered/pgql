'use strict';
// Original GO Plus status bridge: reports device XP/timestamps/encounter IDs
// back to the game's native PgpManagerAndroid so the virtual session behaves
// like a connected accessory. Exports are resolved from libholoholo.so and
// gated to the supported GO build by the adapter.
globalThis.PgqlPgpManager = class PgqlPgpManager {
  constructor(libholoholo) {
    const xp=libholoholo.findExportByName('_ZN3pgp7android17PgpManagerAndroid19SendXpGainedMessageEi');
    const time=libholoholo.findExportByName('_ZN3pgp7android17PgpManagerAndroid26SendUpdateTimestampMessageEl');
    const id=libholoholo.findExportByName('_ZN3pgp7android17PgpManagerAndroid22SendEncounterIdMessageEl');
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