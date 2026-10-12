// Inert recovered excerpt; dependencies unresolved. Source: agents-readable/main_agent.js:67928
var ve = class ve {
    static tryResolve(e, t, r = !1) {
      let n = r ? ue.resolveFromProjectContext(t) : ue.resolveFromMapContext(t);
      return n
        ? ((ve.instances[e] = new g4(n)), n)
        : (ve.logger.error(`Error while resolving "${e}"`), null);
    }
    static getInstance(e, t = !1) {
      let r = ve.wrappers[e];
      if (!r) return (ve.logger.error(`Unknown instance: ${e}`), null);
      let n = ve.instances[e];
      return n
        ? n.isAlive()
          ? n.instance
          : (ve.logger.warn(`Instance for ${e} is dead -> ${n.deathReason}`),
            ve.tryResolve(e, r, t))
        : ve.tryResolve(e, r, t);
    }
    static getPlayerService() {
      return ve.getInstance("PlayerService", !0);
    }
    static getUserPromptsService() {
      return ve.getInstance("UserPromptsService", !0);
    }
    static getRpcManager() {
      return ve.getInstance("RpcManager", !0);
    }
    static getItemBag() {
      return ve.getInstance("ItemBag");
    }
    static getPokemonBag() {
      return ve.getInstance("PokemonBag");
    }
    static getMapEntityService() {
      return ve.getInstance("MapEntityService");
    }
    static getMapPlaceDirectoryService() {
      return ve.getInstance("MapPlaceDirectoryService");
    }
    static getPokemonInventoryGuiService() {
      return ve.getInstance("PokemonInventoryGuiService");
    }
    static getIncubatorService() {
      return ve.getInstance("IncubatorService");
    }
    static getCatchCardGenerationService() {
      return ve.getInstance("CatchCardGenerationService");
    }
    static getBuddyPokemonService() {
      return ve.getInstance("BuddyPokemonService");
    }
    static getBuddyRpcService() {
      return ve.getInstance("BuddyRpcService");
    }
    static getLocationProvider() {
      return ve.getInstance("LocationProvider");
    }
    static getWorldMapRenderer() {
      return ve.getInstance("WorldMapRenderer");
    }
    static getQuestRpcService() {
      return ve.getInstance("QuestRpcService");
    }
    static getQuestService() {
      return ve.getInstance("QuestService");
    }
    static getReferralRpcService() {
      return ve.getInstance("ReferralRpcService");
    }
    static getEventPassService() {
      return ve.getInstance("EventPassService");
    }
    static getMapRootState() {
      return ve.getInstance("MapRootState");
    }
    static getItemSpriteLookup() {
      return ve.getInstance("ItemSpriteLookup");
    }
    static getPokemonAssetManager() {
      return ve.getInstance("PokemonAssetManager");
    }
    static getAwardItemBubbleService() {
      return ve.getInstance("AwardItemBubbleService");
    }
    static getFriendsRpcService() {
      return ve.getInstance("FriendsRpcService");
    }
    static getGiftingRpcService() {
      return ve.getInstance("GiftingRpcService");
    }
    static getStickerService() {
      return ve.getInstance("StickerService");
    }
    static getPostcardCollectionRpcService() {
      return ve.getInstance("PostcardCollectionRpcService");
    }
    static getClipboardService() {
      return ve.getInstance("ClipboardService");
    }
    static getIncidentService() {
      return ve.getInstance("IncidentService");
    }
    static getGameMasterData() {
      return ve.getInstance("GameMasterData", !0);
    }
    static init() {
      (ve.logger.debug("Initializing Holoholo..."),
        (ve.wrappers.PlayerService = T.use("Niantic.Holoholo.IPlayerService")),
        (ve.wrappers.UserPromptsService = T.use(
          "Niantic.Holoholo.UI.IUserPromptsService",
        )),
        (ve.wrappers.RpcManager = T.use(
          "Niantic.Platform.Ditto.Rpc.IRpcManager",
        )),
        (ve.wrappers.ItemBag = T.use("Niantic.Holoholo.IItemBag")),
        (ve.wrappers.PokemonBag = T.use("Niantic.Holoholo.IPokemonBag")),
        (ve.wrappers.MapEntityService = T.use(
          "Niantic.Holoholo.Map.IMapEntityService",
        )),
        (ve.wrappers.MapPlaceDirectoryService = T.use(
          "Niantic.Holoholo.Map.IMapPlaceDirectoryService",
        )),
        (ve.wrappers.PokemonInventoryGuiService = T.use(
          "Niantic.Holoholo.UI.Pokemon.IPokemonInventoryGuiService",
        )),
        (ve.wrappers.IncubatorService = T.use(
          "Niantic.Holoholo.Items.IIncubatorService",
        )),
        (ve.wrappers.CatchCardGenerationService = T.use(
          "Niantic.Holoholo.CatchCard.ICatchCardGenerationService",
        )),
        (ve.wrappers.BuddyPokemonService = T.use(
          "Niantic.Holoholo.Buddy.IBuddyPokemonService",
        )),
        (ve.wrappers.BuddyRpcService = T.use(
          "Niantic.Holoholo.Buddy.IBuddyRpcService",
        )),
        (ve.wrappers.LocationProvider = T.use(
          "Niantic.Holoholo.ILocationProvider",
        )),
        (ve.wrappers.WorldMapRenderer = T.use(
          "Niantic.Holoholo.Map.IWorldMapRenderer",
        )),
        (ve.wrappers.QuestRpcService = T.use(
          "Niantic.Holoholo.Quests.IQuestRpcService",
        )),
        (ve.wrappers.QuestService = T.use(
          "Niantic.Holoholo.Quests.IQuestService",
        )),
        (ve.wrappers.ReferralRpcService = T.use(
          "Niantic.Holoholo.Referral.IReferralRpcService",
        )),
        (ve.wrappers.EventPassService = T.use(
          "Niantic.Holoholo.UI.TodayView.EventPass.IEventPassService",
        )),
        (ve.wrappers.MapRootState = T.use("Niantic.Holoholo.MapRootState")),
        (ve.wrappers.ItemSpriteLookup = T.use(
          "Niantic.Holoholo.Items.IItemSpriteLookup",
        )),
        (ve.wrappers.PokemonAssetManager = T.use(
          "Niantic.Holoholo.AssetBundles.IPokemonAssetManager",
        )),
        (ve.wrappers.AwardItemBubbleService = T.use(
          "Niantic.Holoholo.UI.IAwardItemBubbleService",
        )),
        (ve.wrappers.FriendsRpcService = T.use(
          "Niantic.Holoholo.Social.IFriendsRpcService",
        )),
        (ve.wrappers.GiftingRpcService = T.use(
          "Niantic.Holoholo.Social.Gifting.IGiftingRpcService",
        )),
        (ve.wrappers.StickerService = T.use(
          "Niantic.Holoholo.Social.Gifting.IStickerService",
        )),
        (ve.wrappers.PostcardCollectionRpcService = T.use(
          "Niantic.Holoholo.Collections.IPostcardCollectionRpcService",
        )),
        (ve.wrappers.ClipboardService = T.use(
          "Niantic.Holoholo.Services.IClipboardService",
        )),
        (ve.wrappers.IncidentService = T.use(
          "Niantic.Holoholo.Incident.IIncidentService",
        )),
        (ve.wrappers.GameMasterData = T.use("IGameMasterData")),
        ve.logger.info("Initialized Holoholo."));
    }
    static reset() {
      ve.instances = {};
    }
  };
