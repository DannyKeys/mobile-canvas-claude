import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveCommand } from "../lib/runtime.mjs";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("opens a canvas and reports the derived context", async () => {
  const { stdout } = await run("node", [join(root, "scripts", "canvas.mjs"), "--no-open"], {
    timeout: 180_000,
  });
  const result = JSON.parse(stdout);

  assert.match(result.url, /^http:\/\/127\.0\.0\.1:\d+\/#bootstrap=/);
  assert.match(result.sessionId, /^[0-9a-f]{16}$/);
  assert.equal(result.instanceId, "claude");
  assert.equal(result.opened, false);

  // The URL must carry the same pair, or the browser canvas and the agent would
  // be looking at two different canvases.
  assert.ok(result.url.includes(`sessionId=${result.sessionId}`));
  assert.ok(result.url.includes(`instanceId=${result.instanceId}`));
});

// Resolve the engine in-process rather than through `node -e`. This file is already
// ESM, whereas `node -e` defaults to CommonJS when no package.json declares
// "type": "module" — and this repo deliberately has no package.json — so top-level
// await inside -e is a SyntaxError.
//
// `host stop` reports {"success": true} unconditionally, including when no host is
// running at all. Asserting on it alone would pass in a world where the test above
// never started a daemon, so the daemon's existence is pinned first and its absence
// afterwards. A running host reports status "ok" with a non-zero pid; a stopped one
// reports "stopped" with pid 0.
test("shuts the host down cleanly afterwards", async () => {
  const { command } = await resolveCommand();

  const before = JSON.parse((await run(command, ["host", "status", "--json"])).stdout);
  assert.equal(before.status, "ok", "the previous test should have left a host running");
  assert.ok(before.processId > 0, "a running host should report a pid");

  const { stdout } = await run(command, ["host", "stop"], { timeout: 60_000 });
  assert.match(stdout, /"success":\s*true/);

  const after = JSON.parse((await run(command, ["host", "status", "--json"])).stdout);
  assert.equal(after.status, "stopped");
  assert.equal(after.processId, 0);
});
