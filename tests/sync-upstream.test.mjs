import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { UPSTREAM_OWNED, assertThinManifest } from "../scripts/sync-upstream.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("owns exactly the five upstream files", () => {
  assert.deepEqual([...UPSTREAM_OWNED].sort(), [
    ".mcp.json",
    "lib/runtime-assets.mjs",
    "lib/runtime.mjs",
    "runtimes/manifest.json",
    "scripts/mcp.mjs",
  ]);
});

test("accepts a thin manifest", () => {
  const thin = { runtimes: { "darwin-arm64": { files: { "mobile-canvas": { asset: "x.gz", sha256: "a" } } } } };
  assert.doesNotThrow(() => assertThinManifest(thin));
});

test("rejects a fat manifest even though its hashes are identical", () => {
  // The fat variant describes a path inside a bundled payload rather than a release
  // asset to download. Hashes match, so only the shape distinguishes them.
  const fat = { runtimes: { "darwin-arm64": { files: { "mobile-canvas": { archive: "osx-arm64/mobile-canvas.gz", sha256: "a" } } } } };
  assert.throws(() => assertThinManifest(fat), /fat manifest/i);
});

test("the vendored manifest in this repo is thin", () => {
  const manifest = JSON.parse(readFileSync(join(root, "runtimes", "manifest.json"), "utf8"));
  assert.doesNotThrow(() => assertThinManifest(manifest));
});
