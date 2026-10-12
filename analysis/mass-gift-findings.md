# Recovered MassGift behavior

Scope: decoded `analysis/agents-decoded/main_agent.js`, SHA-256 `9a20b21248e731f157a65d31a77ae26227efd88735a2119d625b94f61b7a5552`. All behavior descriptions below are static source observations; no game or agent was executed. Positions are zero-based byte offsets in that decoded file. The exact class excerpt is `analysis/agents-decoded/mass-gift.raw.js`.

## Main finding

The agent already implements multi-selection batch gift opening/sending as `MassGift` (minified class `GC`). It uses the game's own gifting RPC services from an injected JavaScript/IL2CPP bridge. It does not automatically select every eligible friend in this class. A tap selects a friend; a long press opens the ordinary friend interaction. This is materially different from the requested one-button daily resolution flow.

## UI and selection

`GC` begins at byte 2093328 (`0x1ff110`); `init` starts at 2100920 (`0x200eb8`).

- `FriendsListPage.Reinitialize` provides `giftingService` and `friendsRpcService`, resets selections, attaches a count delegate, and clones the SortButton into three buttons: open gifts, send gifts, remove friends.
- `FriendsListPage.SetFriendActionButton` hooks the cells, extracts `FriendDetails.player_.playerId_`, and tracks reused cell instances. It destroys/replaces the standard friend-cell button. A tap toggles `selectedFriends[playerId]`, changes selection background and count, and shows action buttons while selection is nonempty.
- Long-press gesture uses `timeToPress=.5`, `distanceLimit=.2`, and `distanceLimitInPixelsSquared=10`; it invokes the saved original click handler.
- The friend rows show last-sent/received timestamps parsed from one-way friendship data; those dates are cached per player and friend codename. That display logic does not filter the send queue.
- `runActionOnSelectedFriends` at byte 2107957 (`0x202a35`) shows confirmation dialogs. Send can optionally include stickers if `AnyStickers()` is true. Each dialog includes cancel before starting. The in-progress loop has no explicit cancel token/check.
- Initialization disables the separate SwiftGift instance. SwiftGift also skips itself when MassGift is enabled.

## Send queue

`async sendGifts(t=!1)` starts at byte 2114163 (`0x204273`).

1. Snapshot `Object.keys(selectedFriends)`.
2. Read `this.giftingService.get_GiftsInInventory().array`, keeping gifts whose `ReceiverId.length==0`.
3. If none remain, show the no-gifts toast and return.
4. Temporarily clear friend-change delegates and show a wait modal.
5. Set attempt count to `Math.min(unassignedGiftCount,selectedFriendCount)`.
6. For each index, pair inventory gift `o[d]` with selected friend `r[d]`. Optionally choose sticker inventory `_items[d]` while available.
7. Await `se.getGiftingRpcService().SendGift(gift.GiftboxId,friendId,friendId,stickerOrNull,!1)` through `_0(...,"System.Action<SendGiftOutProto>",10,500)`.
8. Log returned `Result`, then continue. An exception exits the whole loop. `finally` restores delegates, resets selection/refreshes the list on the next frame, and dismisses the modal.

Observed weaknesses relevant to a new implementation: no preflight eligibility filtering; no branch on send Result; no success/failure totals; no retry based on a returned send Result; no reuse of a gift after failed send; no stop on server send limit; no explicit in-flight cancellation. The shared `_0` wrapper does retry rejected promise calls up to ten attempts, with increasing delays; see the helper trace below. Because gift/friend pairing advances after every returned result, a failed attempt still consumes a queue position. This does not establish that the game consumed the gift.

Declared send results in the constructor: 1 success; 2 unknown; 3 player absent; 4 gift absent; 5 already sent today; 6 player has unopened gift; 7 friend update error; 8 player has no stickers. They are not interpreted by this send method.

## Open queue

`async openGifts()` starts at byte 2110516 (`0x203434`).

- Loops selected friends sequentially, updates progress, and stops after a prior daily-limit response.
- Gets `GetGiftboxDetails(friendId)` from friends service. If count is zero, logs and skips; otherwise takes the first gift.
- Attempts `CreatePostcard(giftbox,null,null)`, then deletes that newly created postcard when Result is success (1) or daily butterfly limit (9). Already-created (4), inventory-full (5), rate-limited (7) or unknown results are logged; the method still proceeds to open. It does not delete an already-existing postcard in the Result=4 branch.
- Calls `OpenGift(gift.GiftboxId,friendId,friendId)` through `_0(...,"System.Action<OpenGiftOutProto>",10,500)`.
- Open success (1) displays item/stardust/egg rewards. Daily limit (4) sets a stop flag and displays a toast. Bag full (3) or missing/already-collected gift (5) display toasts and continue. Unknown response is logged.
- Exceptions exit the whole loop. `finally` restores delegates and dismisses the modal.

Creating then deleting postcards appears intended to trigger postcard-related progression while avoiding retained postcard inventory, but that purpose is an inference from call order, not runtime evidence. A reconstruction of the user's gift workflow need not copy this ancillary behavior.

## Shared completion and data

`disableChangedActions` at byte 2109363 (`0x202fb3`) saves then sets these to null: `FriendsListChanged`, `FriendRequestsChanged`, `FriendDetailsChanged`. `enableChangedActions` at 2109822 (`0x20317e`) restores them and schedules `resetSelectedFriends()` plus `friendsRpcService.OnFriendsListUpdated()` on the next frame. An error still restores them because the loops use finally.

`resetSelectedFriends` at 2116546 (`0x204bc2`) clears selections and hides buttons. `getGiftDates` at 2116878 (`0x204d0e`) calls `CreateCodedInput()` on `dataFromMe_` and `dataToMe_`, merges into `OneWaySharedFriendshipDataProto`, and reads the first gift's `SentTimestamp`. It gives current outgoing/incoming gift details, not a complete daily send eligibility predicate.

## Interfaces useful for independent reconstruction

| Interface / method | Role observed here |
|---|---|
| `Niantic.Holoholo.Social.UI.FriendsListPage.Reinitialize` | Captures gifting/friends service and count |
| `FriendsListPage.SetFriendActionButton` | Friend cell binding and selection |
| `FriendDetails.player_.playerId_` | Stable queue identity used for RPC |
| `giftingService.get_GiftsInInventory()` | Available local gifts; unassigned filter `ReceiverId.length==0` |
| `GetGiftboxDetails(friendId)` | Incoming gift candidates |
| `GiftingRpcService.SendGift(...)` | Asynchronous send request |
| `GiftingRpcService.OpenGift(...)` | Asynchronous open request |
| `PostcardCollectionRpcService.CreatePostcard/DeletePostcards` | Ancillary postcard operations |
| `_0(callback,"System.Action<...>",10,500)` | Retries promise rejection up to 10 calls with 500, 1000, ... 4500 ms delays; successful promise resolution returns immediately regardless of game Result |
| `OnFriendsListUpdated()` | Refresh after completing/erroring |

A one-button independent design should obtain the full friend list, compute eligible actions from current state, preserve one pending operation at a time, advance inventory only after a confirmed send, handle every server result, stop at daily caps, and expose progress/cancellation. The current class provides service call examples, but full friend enumeration and eligibility fields require the dependency/service-layer trace. Runtime compatibility with the installed Pokemon GO version remains unverified.

## Completed helper and service-layer trace

Readable source anchors: `agents-readable/main_agent.js:82605` (`g0e`), `:82616` (`_0`), `:67928` (`Holo2`/`ve`), `:64047` (map-context resolution).

`g0e` parses the output type from `System.Action<...>`, casts the returned managed promise to `Niantic.Promises.Promise<OutputType>`, attaches an Error delegate that rejects a JavaScript Promise, and a Then delegate that resolves it. `_0` executes the request callback anew on each attempt. Rejections trigger delays `r*(attemptIndex+1)`; the tenth rejection is thrown. A resolved proto with a non-success Result is not retried. No explicit deadline exists in these helpers, so an unresolved managed promise can keep the queue waiting indefinitely. Retrying a send after a lost response could submit it more than once; a new implementation should recheck game state rather than assume failure means nothing happened.

`se` aliases `ve` (named `Holo2`). It maps the Friends/Gifting/Sticker/Postcard services to game interfaces, resolves them through the map's dependency-injection container, caches live instances, and resolves again when a cached Unity object is dead. `ue.resolveFromMapContext` ultimately calls `MapContainer.Resolve(interface.$typeof)`. This is a live game-object interface, not a standalone network client. Calling these functions requires the bridge, a running compatible game, a valid map context and appropriately scheduled callbacks. They have not been exercised here.

Scoped REA analysis of recovered excerpts is retained separately; its coverage concerns only inert syntax and conservative relationships. The source/manual trace above establishes the specific code observations; it does not claim runtime reachability or server effects.
