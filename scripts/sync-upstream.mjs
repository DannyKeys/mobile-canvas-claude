#!/usr/bin/env node
// Re-copies the five upstream-owned files for a given tag. Nothing else in this
// repo is touched, which is what makes an upgrade a reviewable diff.
//
// The source MUST be the thin tarball. Each release also publishes a standalone
// mobile-canvas-runtime-manifest-<tag>.json, which is the fat variant: it names a
// path inside a bundled payload instead of a release asset to download. Its SHA-256
// values are identical, so hash verification cannot catch the mistake; it would fail
// later, at first use, on a machine with no bundled payload.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const UPSTREAM_OWNED = [
  ".mcp.json",
  "lib/runtime.mjs",
  "lib/runtime-assets.mjs",
  "scripts/mcp.mjs",
  "runtimes/manifest.json",
];

export function assertThinManifest(manifest) {
  for (const [platform, entry] of Object.entries(manifest.runtimes ?? {})) {
    for (const [name, file] of Object.entries(entry.files ?? {})) {
      if (!file.asset) {
        throw new Error(
          `fat manifest detected at ${platform}/${name}: expected an "asset" download name, ` +
            `found ${JSON.stringify(file.archive ?? Object.keys(file))}. Sync from the thin tarball.`,
        );
      }
    }
  }
}

export async function sync(tag) {
  const repo = "Redth/mobile-canvas-ghcp";
  const url = `https://github.com/${repo}/releases/download/${tag}/mobile-canvas-copilot-plugin-thin-${tag}.tar.gz`;
  const work = mkdtempSync(join(tmpdir(), "mc-sync-"));

  try {
    const archive = join(work, "thin.tar.gz");
    await run("curl", ["-fsSL", "-o", archive, url], { timeout: 120_000 });
    await run("tar", ["xzf", archive, "-C", work], { timeout: 120_000 });

    const src = join(work, "mobile-canvas");
    const manifest = JSON.parse(readFileSync(join(src, "runtimes", "manifest.json"), "utf8"));
    assertThinManifest(manifest);

    if (manifest.distribution?.tag !== tag) {
      throw new Error(`tarball reports tag ${manifest.distribution?.tag}, expected ${tag}`);
    }

    for (const relative of UPSTREAM_OWNED) {
      copyFileSync(join(src, relative), join(root, relative));
    }
    return { tag, version: manifest.version, files: UPSTREAM_OWNED };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const tag = process.argv[2];
  if (!tag) {
    process.stderr.write("usage: node scripts/sync-upstream.mjs <tag>   e.g. v0.1.8\n");
    process.exit(2);
  }
  const result = await sync(tag);
  process.stdout.write(`synced ${result.files.length} files to ${result.tag} (version ${result.version})\n`);
}
