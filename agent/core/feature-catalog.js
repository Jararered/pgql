'use strict';
// Product roadmap and adapter boundaries, independent of version-specific hooks.
globalThis.PgqlFeatures = (() => {
  const rows = [
    ['shiny-scanner','Shiny Scanner','Map',['map','encounters','notifications','location']],
    ['virtual-go-plus','Virtual GO Plus','Automation',['accessory']],
    ['quest-tweaks','Quest Tweaks','Inventory',['research','encounters']],
    ['magic-bag','Magic Bag','Inventory',['items']],
    ['tamagotchi','Tamagotchi','Buddy',['buddy','items','battle']],
    ['cooldown-tracker','Cooldown Tracker','Map',['location','action-history','encounters']],
    ['raid-pack','Raid Pack','Battle',['battle','animation']],
    ['tap-to-teleport','Tap to Teleport','Map',['map','location']],
    ['instant-loading','Instant Loading','Map',['map']],
    ['transfer-on-catch','Transfer on Catch','Inventory',['pokemon','encounters','accessory']],
    ['mass-gift','Mass Gift','Social',['friends','gifts','postcards']],
    ['eggspresso','Eggspresso','Inventory',['eggs','items']],
    ['pinap-master','Pinap Master','Encounters',['encounters','items']],
    ['gym-feeder','Gym Feeder','Battle',['gyms','items']],
    ['performance-mode','Performance Mode','System',['rendering']],
    ['headshot','Headshot','Encounters',['encounters']],
    ['pvp-metrics','PVP Metrics','Pokemon',['pokemon','encounters','pvp-data']],
    ['incognito-mode','Incognito Mode','System',['presentation']],
    ['account-manager','Account Manager','System',['account-session','secure-storage']],
    ['perfect-throw','Perfect Throw','Encounters',['encounters']],
    ['instant-catch','Instant Catch','Encounters',['encounters']],
    ['inventory-tweaks','Inventory Tweaks','Inventory',['pokemon','items','buddy']],
    ['swift-gift','Swift Gift','Social',['friends','gifts','animation']],
    ['speed-mode','Speed Mode','System',['animation','map','items']],
    ['block-non-shiny-encounters','Block Non-Shiny Encounters','Encounters',['encounters']],
    ['instant-spin','Instant Spin','Map',['pokestops']],
    ['boss-movesets','Boss Movesets','Battle',['raids','notifications']],
    ['encounter-iv-names','Replace Names with IVs in Encounters','Encounters',['encounters','presentation']],
    ['show-encounter-iv','Show Encounter IV','Encounters',['encounters','notifications']],
    ['inventory-ivs','Shows IVs in Inventory','Pokemon',['pokemon','presentation']],
    ['skip-encounter-intro','Skip Encounter Intro','Encounters',['encounters','animation']],
    ['mock-locations-patch','Integrated Mock Locations Patch','System',['location']],
    ['spawn-booster','Spawn Booster','Map',['map']]
  ];
  const catalog=new Map(rows.map(([id,name,category,requires])=>[id,Object.freeze({id,name,category,requires:Object.freeze(requires)})]));
  return Object.freeze({get:id=>catalog.get(id),list:()=>[...catalog.values()]});
})();
