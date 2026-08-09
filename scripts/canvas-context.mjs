#!/usr/bin/env node
// The canvas context pair identifies one canvas, and the selected device is stored
// per canvas. Upstream takes the pair from the Copilot session; Claude Code has no
// equivalent, so it is derived from the project directory instead.
//
// A mismatched pair is NOT rejected: it silently creates a second, empty canvas, so
// the symptom is get_selected returning hasSelection:false for a device the user can
// plainly see selected. This module is therefore the only place the pair is computed.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const INSTANCE_ID = "claude";

// Running from a subdirectory of the same project must yield the same pair as
// running from the root, otherwise it is exactly the silent second-empty-canvas
// failure this module exists to prevent. Resolve to the git top-level when there is
// one; a directory that is not a repo (or has no git installed) falls back to the
// realpath of the given directory instead.
function resolveProjectRoot(dir) {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    })
      .toString()
      .trim();
    if (top) return realpathSync(top);
  } catch {
    // git absent, not a repo, or timed out: fall through to the plain directory.
  }

  // realpath so a symlinked checkout and its target share one canvas. A path that
  // does not exist yet still has to produce a stable id, so fall back to resolve().
  try {
    return realpathSync(dir);
  } catch {
    return resolve(dir);
  }
}

export function canvasContext(dir = process.cwd()) {
  const projectDir = resolveProjectRoot(dir);
  const sessionId = createHash("sha256").update(projectDir).digest("hex").slice(0, 16);
  return { sessionId, instanceId: INSTANCE_ID, projectDir };
}

// Node 18 has no import.meta.filename, so compare resolved paths. Use
// fileURLToPath rather than new URL(...).pathname, which does not percent-decode
// and so breaks on any path containing a space.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  process.stdout.write(JSON.stringify(canvasContext()) + "\n");
}
