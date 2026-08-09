import { test } from "node:test";
import assert from "node:assert/strict";
import { runChecks } from "../scripts/doctor.mjs";

test("reports the checks that matter, each with a name and a boolean", async () => {
  const checks = await runChecks({ offline: true });
  const names = checks.map((c) => c.name);

  for (const required of ["node", "engine", "idb_companion", "adb", "emulator"]) {
    assert.ok(names.includes(required), `missing check: ${required}`);
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
