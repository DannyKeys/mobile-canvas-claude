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
  // An empty map iterates zero times, so a shape-only loop would accept a manifest
  // with nothing in it at all. A guard that passes "there is nothing to check" is
  // not a guard, so absence is rejected explicitly before the shape is examined.
  const runtimes = Object.entries(manifest.runtimes ?? {});
  if (runtimes.length === 0) {
    throw new Error("manifest declares no runtimes; refusing to install one with nothing to verify");
  }

  for (const [platform, entry] of runtimes) {
    const files = Object.entries(entry.files ?? {});
    if (files.length === 0) {
      throw new Error(`manifest runtime ${platform} declares no files`);
    }
    for (const [name, file] of files) {
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
  // Read from the local manifest rather than hardcoding, so this is not a third
  // copy of upstream identity that can silently drift from doctor.mjs and the
  // check-upstream workflow, which both already read distribution.repository.
  // Identity is stable across tags, so bootstrapping from the manifest already on
  // disk is safe even for the very tag being synced.
  const localManifest = JSON.parse(readFileSync(join(root, "runtimes", "manifest.json"), "utf8"));
  const repo = localManifest.distribution.repository;
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
