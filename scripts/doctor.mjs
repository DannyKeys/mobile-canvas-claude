#!/usr/bin/env node
// Prerequisite checks. Every failure carries a remedy, because the failure modes
// here are mostly silent: the tool keeps half-working and the symptom shows up as
// the app apparently ignoring input.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { accessSync, constants, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { resolveCommand } from "../lib/runtime.mjs";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function which(bin) {
  try {
    const { stdout } = await run("which", [bin], { timeout: 10_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function androidTool(bin, subdir) {
  const onPath = await which(bin);
  if (onPath) return onPath;
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    join(process.env.HOME || "", "Library", "Android", "sdk");
  const candidate = join(home, subdir, bin);
  try {
    await run(candidate, ["--version"], { timeout: 10_000 });
    return candidate;
  } catch {
    // Not every SDK tool accepts --version cleanly, so failing that is not proof of
    // absence. Fall back to an EXECUTABLE check, never a readable one: a file that
    // can be read but not run would otherwise be reported PASS, which is precisely
    // the silent failure this whole command exists to catch.
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      return null;
    }
  }
}

// Pure, so the drift comparison is testable without a network call. `latest` is null
// when upstream could not be reached or answered with a non-OK status.
export function driftDetail(pinned, latest) {
  if (!latest) return `pinned ${pinned} (upstream unreachable)`;
  // The person seeing this is running /mobile-canvas:doctor inside their own
  // project, where scripts/sync-upstream.mjs does not exist and, even resolved,
  // would hand-patch an installed plugin directory. The user-facing remedy is to
  // update the plugin from the marketplace; sync-upstream is the maintainer path.
  return latest === pinned
    ? `pinned ${pinned}, up to date`
    : `pinned ${pinned}, latest is ${latest}. Update the mobile-canvas plugin from the marketplace (maintainers: node scripts/sync-upstream.mjs ${latest}).`;
}

export async function runChecks({ offline = false } = {}) {
  const checks = [];

  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "node",
    ok: major >= 18,
    detail: `v${process.versions.node}`,
    remedy: major >= 18 ? undefined : "Install Node 18 or newer.",
  });

  let command = null;
  try {
    const resolved = await resolveCommand();
    command = resolved.command;
    const { stdout } = await run(command, ["--version"], { timeout: 120_000 });
    checks.push({ name: "engine", ok: true, detail: `${stdout.trim()} (${resolved.source})` });
  } catch (error) {
    checks.push({
      name: "engine",
      ok: false,
      detail: error.message,
      remedy: "Check network access to github.com, or set MOBILE_CANVAS_COMMAND to a local build.",
    });
  }

  const isMac = process.platform === "darwin";
  checks.push({
    name: "macos",
    ok: true,
    advisory: true,
    detail: isMac ? "yes, iOS Simulator control available" : "no, Android only",
  });

  if (isMac) {
    const simctl = await which("xcrun");
    checks.push({
      name: "xcrun",
      ok: Boolean(simctl),
      detail: simctl || "not found",
      remedy: simctl ? undefined : "Install Xcode and run: xcode-select --install",
    });

    const idb = await which("idb_companion");
    checks.push({
      name: "idb_companion",
      ok: Boolean(idb),
      detail: idb || "not found",
      remedy: idb
        ? undefined
        : "brew install facebook/fb/idb-companion. Without it iOS screenshots and video keep working while taps, swipes and typing silently do nothing.",
    });
  }

  for (const [bin, subdir] of [["adb", "platform-tools"], ["emulator", "emulator"]]) {
    const found = await androidTool(bin, subdir);
    checks.push({
      name: bin,
      ok: Boolean(found),
      detail: found || "not found",
      remedy: found
        ? undefined
        : `Install the Android SDK and put ${bin} on PATH, or set ANDROID_HOME. Every Android operation fails without it, usually with a spawn error that says nothing about PATH.`,
    });
  }

  if (command) {
    try {
      const { stdout } = await run(command, ["host", "status"], { timeout: 30_000 });
      checks.push({ name: "host", ok: true, advisory: true, detail: stdout.trim() });
    } catch {
      checks.push({ name: "host", ok: true, advisory: true, detail: "not running (started on demand)" });
    }
  }

  // Advisory: never fails the command, and stays quiet offline, because a missing
  // network must not look like a broken toolchain.
  const manifest = JSON.parse(readFileSync(join(root, "runtimes", "manifest.json"), "utf8"));
  const pinned = manifest.distribution.tag;
  const repo = manifest.distribution.repository;
  let detail = `pinned ${pinned} (drift check skipped)`;
  if (!offline) {
    let latest = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(10_000),
      });
      // A rate-limited 403 is "unreachable" too, so leaving latest null covers both
      // and avoids reporting "skipped" for a check that was attempted and rejected.
      if (res.ok) latest = (await res.json()).tag_name;
    } catch {
      latest = null;
    }
    detail = driftDetail(pinned, latest);
  }
  checks.push({ name: "upstream", ok: true, advisory: true, detail });

  return checks;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const checks = await runChecks({ offline: process.argv.includes("--offline") });
  let failed = 0;
  for (const c of checks) {
    const mark = c.advisory ? "-" : c.ok ? "PASS" : "FAIL";
    process.stdout.write(`${mark.padEnd(4)} ${c.name.padEnd(14)} ${c.detail}\n`);
    if (!c.ok && !c.advisory) {
      failed++;
      process.stdout.write(`     ${" ".repeat(14)} remedy: ${c.remedy}\n`);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}
