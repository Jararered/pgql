'use strict';
// Reserve stable IDs without presenting unimplemented features as working toggles.
for (const feature of PgqlFeatures.list()) {
  if(Qol.describe().some(module=>module.id===feature.id))continue;
  Qol.register({id:feature.id,name:feature.name,availability:'planned',
    unavailableReason:'Planned — game adapter and behavior are not implemented.',
    enable(){throw Error('Feature is not implemented: '+feature.name);}});
}
