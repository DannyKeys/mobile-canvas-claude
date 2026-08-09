#!/usr/bin/env node
// Opens the browser canvas. `canvas open` is a real engine verb that returns a
// scoped, short-lived URL, but it is absent from `--help` and therefore carries no
// compatibility promise: re-verify it on every upstream bump.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveCommand } from "../lib/runtime.mjs";
import { canvasContext } from "./canvas-context.mjs";

const run = promisify(execFile);

function parseArgs(argv) {
  const args = { device: null, open: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--device") args.device = argv[++i];
    else if (argv[i] === "--no-open") args.open = false;
  }
  return args;
}

function browserOpener() {
  if (process.platform === "darwin") return { cmd: "open", args: [] };
  if (process.platform === "win32") return { cmd: "cmd", args: ["/c", "start", ""] };
  return { cmd: "xdg-open", args: [] };
}

const args = parseArgs(process.argv.slice(2));
const { sessionId, instanceId } = canvasContext();

let command;
try {
  ({ command } = await resolveCommand());
} catch (error) {
  process.stderr.write(`mobile-canvas: ${error.message}\n`);
  process.exit(1);
}

const verb = ["canvas", "open", "--session", sessionId, "--instance", instanceId, "--json"];
if (args.device) verb.push("--device", args.device);

let payload;
try {
  const { stdout } = await run(command, verb, { timeout: 120_000 });
  payload = JSON.parse(stdout);
} catch (error) {
  process.stderr.write(`mobile-canvas: canvas open failed: ${error.message}\n`);
  process.exit(1);
}

let opened = false;
if (args.open) {
  const { cmd, args: openArgs } = browserOpener();
  try {
    await run(cmd, [...openArgs, payload.url], { timeout: 15_000 });
    opened = true;
  } catch {
    // The URL is still valid and is printed below, so a missing opener is not fatal.
    opened = false;
  }
}

process.stdout.write(
  JSON.stringify({ url: payload.url, title: payload.title, sessionId, instanceId, opened }) + "\n",
);
