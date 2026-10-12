# Mass Gift adapter contract

Static observations from the recovered agent, not game execution. Source: `analysis/agents-readable/main_agent.js`, derived from decoded agent SHA-256 `9a20b21248e731f157a65d31a77ae26227efd88735a2119d625b94f61b7a5552`. Existing longer investigation: `analysis/mass-gift-findings.md`. No recovered implementation was copied into PGQL.

## Observed managed interfaces

| Interface | Contract used by MassGift | Source line |
|---|---|---:|
| `Niantic.Holoholo.Social.IFriendsRpcService` | `GetGiftboxDetails(friendId)` returns an immediate managed collection with `count` and `array`. First gift is used. | 83111 |
| `Niantic.Holoholo.Social.Gifting.IGiftingRpcService` | `SendGift(giftboxId, friendId, friendId, stickerOrNull, false)` returns managed `Niantic.Promises.Promise<SendGiftOutProto>`. | 83292 |
| Same | `OpenGift(giftboxId, friendId, friendId)` returns managed `Promise<OpenGiftOutProto>`. | 83169 |
| Friends service | `FriendsListChanged`, `FriendRequestsChanged`, `FriendDetailsChanged` are mutable delegate fields; `OnFriendsListUpdated()` refreshes the list. | 83038–83063 |
| Captured `FriendsListPage.giftingService` | `get_GiftsInInventory()` returns collection with `array`; gifts are filtered by `ReceiverId.length == 0`, identified by `GiftboxId`. | 83258 |
| `Niantic.Holoholo.Social.Gifting.IStickerService` | `AnyStickers()` and `GetStickerInventory(false)._items`; items passed directly into `SendGift`. | 83012, 83283 |

Service interface registration is at 68093–68104. Services resolve from the live map Zenject container using `MapContainer.Resolve(interface.$typeof)` (64025–64048); cached objects are checked for liveness and re-resolved (67928–67949). These are game objects, not a separate HTTP API.

The meanings of the two repeated friend-ID arguments and the final send Boolean are **unknown** from this call site; preserve the observed shape until inspecting live method parameter metadata. No collection-wide friend enumeration or complete send-eligibility predicate is established by this trace.

## Version and bridge requirements

The recovered agent explicitly supports only Pokémon GO `0.431.0` (90457–90462). Its obfuscation map includes `djsl → friendsRpcService`, `djst → giftingService`, `blzi → SetFriendActionButton` (90271–90273), `djye → friendsRpcService` (90367), and `bmiz → get_GiftsInInventory` (90451). Class names and relevant RPC names remain readable in these call sites, but this does not establish that the installed game's IL2CPP exports or metadata are intact.

The original uses its own Ditto IL2CPP object/class/method/delegate wrappers (`T`), initialized with `Zeppelin.dll::Niantic.Zeppelin.Scheduler.Scheduler.LateUpdate`, scene `Boot` (90504–90508). Android Java bridge alone cannot call these managed methods. Original initialization, obfuscation/error handling, and ancillary bypasses should not be imported into PGQL. An original adapter must discover current classes/methods, validate signatures and game version, obtain live services, preserve managed object/delegate lifetime, and schedule game access on the Unity thread. Scheduling wrappers use Zeppelin `SchedulerExt.RunNextFrame` with a managed `System.Action` delegate (67219–67230).

### Smallest capture map

`FriendsListPage` is referenced as full literal `Niantic.Holoholo.Social.UI.FriendsListPage`; no token in that identity is remapped by the recovered version map. `Reinitialize` is also absent from the map and is used literally (82702–82707). The capture hook can therefore resolve this class and method, then examine current field metadata for `djsl` (friends RPC service) and `djst` (gifting inventory service). The exact concrete class behind either field, assembly ownership, overload/parameter signatures, and any inherited field layout remain **unknown** until inspecting live metadata.

`SetFriendActionButton` maps to `blzi`. Its Ditto `onEnter` wrapper's arguments exclude the instance: argument 0 is the cell; argument 1 is inspected for `ParsedFriendDetails` and resolved with `get_FriendDetails()`, otherwise argument 2 is used as direct details (82770–82784). Convert indices for the current bridge only after inspecting its signature. Both `ParsedFriendDetails` and `FriendDetails` are literals with no remapped token in the recovered map. Stable identity is `details.player_.playerId_`. Do not assume this row hook enumerates friends that have never been bound to visible/recycled cells.

A bounded search of the entire recovered readable source for `get_Friends`, `GetFriendList`, `GetFriendsList`, `GetFriends`, `GetAllFriends`, `friendsList`, `friendList`, `friendsDetails`, `GetFriendDetails`, `CanSendGift`, `HasGift`, and `CanOpenGift` returned no occurrence. This is a negative source search, not proof those APIs do not exist in the game. Full-list enumeration should be discovered from the captured friends service's current metadata. Incoming-gift lookup is available at `GetGiftboxDetails`; outgoing inventory uses `bmiz` on the captured gifting service. The SwiftGift trace separately identifies concrete `Niantic.Holoholo.Social.Gifting.GiftingService.TryGetGiftBoxDetails` (77064–77067), with no mapped token in that method name.

## Queue, results, and limits

`MassGift` batches **manually selected friends**. `FriendsListPage.Reinitialize` captures services and sets up the buttons (82702–82766). `SetFriendActionButton` obtains `FriendDetails.player_.playerId_`; it also accepts `ParsedFriendDetails.get_FriendDetails()` (82770–82784). It does not select every eligible friend itself.

Send snapshots selection and inventory, loops `min(unassigned gifts, selected friends)`, pairs by index, and waits for one response before the next call (83252–83318). It logs every returned result and advances even after rejection by the game. Constants (82641–82648): `1 success`, `2 unknown`, `3 player does not exist`, `4 gift does not exist`, `5 already sent today`, `6 player has unopened gift`, `7 friend update error`, `8 player has no stickers`. No send-limit result or numeric daily cap is established here.

Open loops selected friends, skips no-gift friends, and uses the first incoming gift (83078–83127). Results (82632–82635; handling 83173–83241): `1 success`, `3 bag full`, `4 daily player limit`, `5 missing/already collected gift`. Limit `4` stops subsequent calls; bag full and missing gifts continue. Unknown results are logged. Successful opens expose `Items.LootItem` with item, stardust and egg variants (83180–83208). No hard-coded daily numeric cap is used.

Original open also creates and sometimes deletes postcards before opening (83128–83166). That operation is ancillary, potentially destructive to postcard inventory, and not necessary for a gift-only PGQL adapter. Any purpose related to postcard progression remains inferred.

## Completion, progress, cancellation, and failure

Confirm dialogs permit cancellation **before** starting (82984–83036). No in-flight cancel token/check appears in either queue. Progress is a wait modal updated on the next frame: open counts processed selection entries, send reports the zero-based loop index (83088–83110, 83285–83290). There are no accurate success/failure totals. Each queue uses `finally` to restore delegates, reset selections, refresh friends and dismiss the modal (83242–83249, 83313–83320).

Managed promise bridge attaches `Error(System.Action<string>)` and `Then(System.Action<OutputProto>)` (82605–82615). Retry wrapper executes the request anew after promise rejection, up to 10 calls, with delays `500, 1000, …, 4500` ms. Resolved failure result codes are not retried (82616–82627). No timeout is implemented; lost promise completion can wait forever. A lost response followed by retry can repeat a mutation.

## Independent PGQL design implications (inferred, not recovered behavior)

Use a serial queue with preview, explicit start, progress/result totals, cancel between completed requests, and stop on server daily cap or full bag. Preserve a gift until confirmed send success; re-read uncertain state rather than blindly retrying mutations. Friend eligibility and a full list must be obtained from validated current game metadata. Keep postcard operations out of the initial gift feature. Until live contracts are validated, expose unavailable/read-only states rather than treating a mocked queue as a working game feature.
