#!/usr/bin/env node
// The canvas context pair identifies one canvas, and the selected device is stored
// per canvas. Upstream takes the pair from the Copilot session; Claude Code has no
// equivalent, so it is derived from the project directory instead.
//
// A mismatched pair is NOT rejected: it silently creates a second, empty canvas, so
// the symptom is get_selected returning hasSelection:false for a device the user can
// plainly see selected. This module is therefore the only place the pair is computed.

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const INSTANCE_ID = "claude";

export function canvasContext(dir = process.cwd()) {
  // realpath so a symlinked checkout and its target share one canvas. A path that
  // does not exist yet still has to produce a stable id, so fall back to resolve().
  let projectDir;
  try {
    projectDir = realpathSync(dir);
  } catch {
    projectDir = resolve(dir);
  }

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
