import { test } from "node:test";
import assert from "node:assert/strict";
import { runChecks, driftDetail } from "../scripts/doctor.mjs";

test("reports the checks that matter, each with a name and a boolean", async () => {
  const checks = await runChecks({ offline: true });
  const names = checks.map((c) => c.name);

  // xcrun and idb_companion are only emitted on macOS, so requiring them everywhere
  // would fail on a Linux runner for a tool that deliberately supports Android-only.
  const required = ["node", "engine", "adb", "emulator"];
  if (process.platform === "darwin") required.push("xcrun", "idb_companion");

  for (const name of required) {
    assert.ok(names.includes(name), `missing check: ${name}`);
  }
  for (const c of checks) {
    assert.equal(typeof c.ok, "boolean", `${c.name} has no boolean ok`);
    assert.equal(typeof c.detail, "string");
    if (!c.ok) assert.ok(c.remedy, `${c.name} failed without a remedy`);
  }
});

test("the upstream drift check is advisory and is skipped offline", async () => {
  const checks = await runChecks({ offline: true });
  const drift = checks.find((c) => c.name === "upstream");
  assert.ok(drift, "missing upstream check");
  assert.equal(drift.advisory, true);
  // Advisory checks must never be able to fail the command.
  assert.equal(drift.ok, true);
});

test("node and engine checks pass on this machine", async () => {
  const checks = await runChecks({ offline: true });
  assert.equal(checks.find((c) => c.name === "node").ok, true);
  assert.equal(checks.find((c) => c.name === "engine").ok, true);
});

// The live fetch cannot be unit-tested without a network, but the comparison it
// feeds is the part that can silently rot — a wrong property name would report
// "up to date" forever and quietly defeat the whole upgrade signal.
test("drift comparison reports up to date, behind, and unreachable", () => {
  assert.equal(driftDetail("v0.1.7", "v0.1.7"), "pinned v0.1.7, up to date");

  const behind = driftDetail("v0.1.7", "v0.1.8");
  assert.match(behind, /latest is v0\.1\.8/);
  // User-facing remedy is "update from the marketplace"; sync-upstream is called
  // out as the maintainer-only path, not handed to the end user as the primary fix.
  assert.match(behind, /marketplace/i);
  assert.match(behind, /sync-upstream\.mjs v0\.1\.8/);

  assert.equal(driftDetail("v0.1.7", null), "pinned v0.1.7 (upstream unreachable)");
});
