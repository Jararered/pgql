const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const events = [],
  instances = [];
let nextAdapter;
class FakeGameGifts {
  constructor() {
    this.impl = nextAdapter;
    instances.push(this);
  }
  preview() {
    return this.impl.preview();
  }
  open(friendId) {
    return this.impl.open(friendId);
  }
  send(friendId) {
    return this.impl.send(friendId);
  }
}
const context = vm.createContext({
  send: (event) => events.push(event),
  recv: () => {},
  Process: { id: 123, arch: "arm64" },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  PgqlGameGifts: FakeGameGifts,
});
for (const file of ["runtime.js", "core/gift-queue.js", "modules/mass-gift.js"])
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../agent", file), "utf8"),
    context,
  );
const Qol = context.Qol;
function makeAdapter() {
  const calls = [];
  return {
    calls,
    async preview() {
      calls.push({ action: "preview" });
      return {
        friendIds: ["friend-private-a", "friend-private-b"],
        giftCount: 4,
      };
    },
    async open(friendId) {
      calls.push({ action: "open", friendId });
      return 1;
    },
    async send(friendId) {
      calls.push({ action: "send", friendId });
      return 1;
    },
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
(async () => {
  nextAdapter = makeAdapter();
  await assert.rejects(
    Qol.invoke("mass-gift", { action: "preview" }),
    /disabled/,
  );
  Qol.enable("mass-gift");
  const metadata = Qol.describe().find((module) => module.id === "mass-gift");
  assert.equal(
    metadata.actions.find((action) => action.id === "open").confirm,
    true,
  );
  assert.equal(
    metadata.actions.find((action) => action.id === "send").confirm,
    true,
  );
  const preview = await Qol.invoke("mass-gift", { action: "preview" });
  assert.equal(preview.friendCount, 2);
  assert.equal(preview.giftCount, 4);
  assert.equal("friendIds" in preview, false);
  assert.equal(JSON.stringify(preview).includes("friend-private"), false);
  assert.equal(
    (await Qol.invoke("mass-gift", { action: "status" })).phase,
    "idle",
  );
  await assert.rejects(
    Qol.invoke("mass-gift", { action: "unknown" }),
    /Unknown Mass Gift action/,
  );
  const sent = await Qol.invoke("mass-gift", { action: "send" });
  assert.equal(sent.phase, "completed");
  assert.equal(sent.succeeded, 2);
  assert.deepEqual(
    nextAdapter.calls
      .filter((call) => call.action === "send")
      .map((call) => call.friendId),
    ["friend-private-a", "friend-private-b"],
  );
  assert.equal(
    nextAdapter.calls.filter((call) => call.action === "open").length,
    0,
  );
  assert.equal(
    (await Qol.invoke("mass-gift", { action: "status" })).mode,
    "send",
  );

  // Cancellation through the module keeps the current request in flight,
  // records its settled outcome, and prevents the second friend's action.
  const began = deferred(),
    settle = deferred();
  nextAdapter.open = (friendId) => {
    nextAdapter.calls.push({ action: "open", friendId });
    began.resolve();
    return settle.promise;
  };
  const running = Qol.invoke("mass-gift", { action: "open" });
  await began.promise;
  const cancelledWhileRunning = await Qol.invoke("mass-gift", {
    action: "cancel",
  });
  assert.equal(cancelledWhileRunning.phase, "running");
  assert.equal(cancelledWhileRunning.completed, 0);
  settle.resolve(1);
  const cancelled = await running;
  assert.equal(cancelled.phase, "cancelled");
  assert.equal(cancelled.succeeded, 1);
  assert.equal(
    nextAdapter.calls.filter((call) => call.action === "open").length,
    1,
  );

  // Disabling retires the actual queue. A failed re-enable must not create a
  // new adapter or allow an overlapping batch while its old request settles.
  const retiringBegan = deferred(),
    retiringSettle = deferred();
  nextAdapter.open = (friendId) => {
    nextAdapter.calls.push({ action: "open", friendId });
    retiringBegan.resolve();
    return retiringSettle.promise;
  };
  const retiringRun = Qol.invoke("mass-gift", { action: "open" });
  await retiringBegan.promise;
  const retiredAdapter = nextAdapter;
  Qol.disable("mass-gift");
  const beforeReenable = instances.length;
  assert.throws(() => Qol.enable("mass-gift"), /still settling/);
  assert.equal(instances.length, beforeReenable);
  assert.equal(
    Qol.describe().find((module) => module.id === "mass-gift").enabled,
    false,
  );
  await assert.rejects(
    Qol.invoke("mass-gift", { action: "status" }),
    /disabled/,
  );
  retiringSettle.resolve(1);
  const retired = await retiringRun;
  assert.equal(retired.phase, "cancelled");
  assert.equal(retired.completed, 1);
  assert.equal(
    retiredAdapter.calls.filter((call) => call.action === "open").length,
    2,
  );
  nextAdapter = makeAdapter();
  Qol.enable("mass-gift");
  assert.equal(instances.length, beforeReenable + 1);
  assert.equal(
    (await Qol.invoke("mass-gift", { action: "status" })).phase,
    "idle",
  );
  const reopened = await Qol.invoke("mass-gift", { action: "open" });
  assert.equal(reopened.phase, "completed");
  assert.equal(reopened.succeeded, 2);
  Qol.disable("mass-gift");
  assert(
    events.some(
      (event) =>
        event.type === "log" &&
        event.message === "Gift batch progress" &&
        event.details.phase === "cancelled",
    ),
  );
  console.log(
    "Mass Gift preview privacy, action dispatch, cancellation and retired queue lifecycle tests passed.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
