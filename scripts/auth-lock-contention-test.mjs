import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createSingleFlight,
  createTrailingSingleFlight,
  isLockAcquireTimeout,
  retryLockAcquireOnce,
} from "../lib/auth/singleFlight.ts";

const deferred = () => {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const pending = deferred();
let calls = 0;
const singleFlight = createSingleFlight(async () => {
  calls += 1;
  return pending.promise;
});
const first = singleFlight();
const second = singleFlight();
assert.equal(first, second);
assert.equal(calls, 1);
pending.resolve("session");
assert.equal(await first, "session");
assert.equal(await singleFlight(), "session");
assert.equal(calls, 2, "a completed result must not remain cached");

const firstLoad = deferred();
const trailingLoad = deferred();
let loadCalls = 0;
let mounted = true;
const coalescedLoad = createTrailingSingleFlight(
  async () => {
    loadCalls += 1;
    return loadCalls === 1 ? firstLoad.promise : trailingLoad.promise;
  },
  () => mounted,
);
const ordinaryLoad = coalescedLoad();
assert.equal(coalescedLoad(), ordinaryLoad);
assert.equal(loadCalls, 1, "simultaneous ordinary loads must share one execution");
assert.equal(coalescedLoad(true), ordinaryLoad);
assert.equal(coalescedLoad(true), ordinaryLoad);
assert.equal(coalescedLoad(true), ordinaryLoad);
firstLoad.resolve("initial");
assert.equal(await ordinaryLoad, "initial");
assert.equal(loadCalls, 2, "refreshes must collapse into one trailing execution");
trailingLoad.resolve("refreshed");

const unmountLoad = deferred();
let unmountCalls = 0;
mounted = true;
const loadAcrossUnmount = createTrailingSingleFlight(
  async () => {
    unmountCalls += 1;
    return unmountLoad.promise;
  },
  () => mounted,
);
const activeAtUnmount = loadAcrossUnmount();
loadAcrossUnmount(true);
mounted = false;
unmountLoad.resolve("complete");
await activeAtUnmount;
assert.equal(unmountCalls, 1, "unmount must suppress the trailing execution");

const lockError = Object.assign(new Error("transient lock"), {
  isAcquireTimeout: true,
});
assert.equal(isLockAcquireTimeout(lockError), true);
assert.equal(isLockAcquireTimeout(new Error("transient lock")), false);

let retryCalls = 0;
let delays = 0;
const recovered = await retryLockAcquireOnce(
  async () => {
    retryCalls += 1;
    if (retryCalls === 1) throw lockError;
    return "recovered";
  },
  25,
  async (milliseconds) => {
    assert.equal(milliseconds, 25);
    delays += 1;
  },
);
assert.equal(recovered, "recovered");
assert.equal(retryCalls, 2);
assert.equal(delays, 1);

retryCalls = 0;
await assert.rejects(
  retryLockAcquireOnce(
    async () => {
      retryCalls += 1;
      throw lockError;
    },
    25,
    async () => {},
  ),
  (error) => error === lockError,
);
assert.equal(retryCalls, 2, "persistent lock failure must retry only once");

const adapter = readFileSync(
  new URL("../lib/auth/supabaseAuthAdapter.ts", import.meta.url),
  "utf8",
);
const menu = readFileSync(
  new URL("../components/auth/UserAccountMenu.tsx", import.meta.url),
  "utf8",
);
assert.match(adapter, /if \(isInvalidRefreshTokenError\(error\)\) \{\s*await clearInvalidLocalSession\(\);\s*return null;/);
assert.match(adapter, /const getSessionSingleFlight = createSingleFlight\(loadSession\)/);
assert.match(menu, /createTrailingSingleFlight/);
assert.match(menu, /void loadAccount\(true\)/);
assert.match(menu, /if \(!mountedRef\.current\) return/);

console.log("Supabase auth lock-contention regression checks passed.");
