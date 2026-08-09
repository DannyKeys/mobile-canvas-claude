import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Tool names the skills instruct Claude to call. A rename upstream must fail here
// rather than surface as Claude calling a tool that no longer exists.
const REQUIRED_TOOLS = [
  "mobile_device_list",
  "mobile_device_catalog",
  "mobile_device_boot",
  "mobile_device_select",
  "mobile_device_get_selected",
  "mobile_device_app_install",
  "mobile_device_app_launch",
  "mobile_device_ui_dump",
  "mobile_device_ui_find",
  "mobile_device_ui_tap",
  "mobile_device_screenshot",
  "mobile_device_log",
  "mobile_device_crashes",
];

// A chunk boundary can fall mid-line: the tools/list response is ~64 KB and arrives
// in about nine chunks. Counting lines that merely START with "{" would treat the
// first fragment as a finished message, kill the child, and parse truncated JSON.
// Only lines known to be terminated count.
function completeJsonLines(buffer) {
  const lines = buffer.split("\n");
  if (!buffer.endsWith("\n")) lines.pop();
  return lines.filter((l) => l.trim().startsWith("{"));
}

function rpc(requests, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [join(root, "scripts", "mcp.mjs")], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`timed out after ${timeoutMs}ms. stderr: ${err}`));
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      out += d.toString();
      // Resolve once every request has produced a complete response line.
      if (completeJsonLines(out).length >= requests.length) {
        clearTimeout(timer);
        child.kill("SIGTERM");
        resolve({ out, err });
      }
    });
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });

    for (const r of requests) child.stdin.write(JSON.stringify(r) + "\n");
  });
}

test("server initializes and advertises the tools the skills use", async () => {
  const { out, err } = await rpc([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke", version: "1" },
      },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ]);

  const messages = completeJsonLines(out).map((l) => JSON.parse(l));

  const init = messages.find((m) => m.id === 1);
  assert.ok(init?.result, `initialize failed. stderr: ${err}`);
  assert.equal(init.result.serverInfo.name, "mobile-canvas");

  const list = messages.find((m) => m.id === 2);
  assert.ok(list?.result?.tools, `tools/list failed. stderr: ${err}`);

  const names = new Set(list.result.tools.map((t) => t.name));
  for (const required of REQUIRED_TOOLS) {
    assert.ok(names.has(required), `missing tool: ${required}`);
  }
  assert.ok(names.size >= 50, `expected 50+ tools, got ${names.size}`);
});
