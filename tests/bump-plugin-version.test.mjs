import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  MARKETPLACE_JSON,
  PLUGIN_JSON,
  bump,
  currentVersion,
  nextPatch,
} from "../scripts/bump-plugin-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Hand-formatted the way the real files are: an inline array in plugin.json and a
// nested entry in marketplace.json, so a reserialize would visibly reflow both.
function fixture({ pluginVersion = "0.1.1", entryVersion = pluginVersion, name = "mobile-canvas" } = {}) {
  const at = mkdtempSync(join(tmpdir(), "mc-bump-"));
  mkdirSync(join(at, ".claude-plugin"));
  writeFileSync(
    join(at, PLUGIN_JSON),
    `{\n  "name": "${name}",\n  "version": "${pluginVersion}",\n  "keywords": ["ios", "android"]\n}\n`,
  );
  writeFileSync(
    join(at, MARKETPLACE_JSON),
    `{\n  "name": "mobile-canvas-claude",\n  "plugins": [\n    {\n      "name": "mobile-canvas",\n      "source": "./",\n      "version": "${entryVersion}"\n    }\n  ]\n}\n`,
  );
  return at;
}

test("increments the patch component", () => {
  assert.equal(nextPatch("0.1.1"), "0.1.2");
  assert.equal(nextPatch("1.0.9"), "1.0.10");
});

test("refuses a version it cannot unambiguously increment", () => {
  for (const bad of ["0.1", "0.1.1-beta", "v0.1.1", "0.1.1+build", ""]) {
    assert.throws(() => nextPatch(bad), /major\.minor\.patch/);
  }
});

test("this repo's two declarations agree", () => {
  // The guard that matters in practice: a split here is what `claude plugin tag`
  // rejects at release time, long after the commit that caused it.
  assert.doesNotThrow(() => currentVersion(root));
});

test("rejects a split between the two files", () => {
  const at = fixture({ pluginVersion: "0.1.1", entryVersion: "0.1.0" });
  try {
    assert.throws(() => currentVersion(at), /version split/);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("rejects a marketplace with no entry for the plugin", () => {
  const at = fixture({ name: "renamed-plugin" });
  try {
    assert.throws(() => currentVersion(at), /no entry named/);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("bumps both files and touches nothing else", () => {
  const at = fixture();
  try {
    const before = [PLUGIN_JSON, MARKETPLACE_JSON].map((f) => readFileSync(join(at, f), "utf8"));
    assert.deepEqual(bump(at), { from: "0.1.1", to: "0.1.2" });

    const after = [PLUGIN_JSON, MARKETPLACE_JSON].map((f) => readFileSync(join(at, f), "utf8"));
    for (const [index, text] of after.entries()) {
      // Byte-for-byte except the one field, which is what keeps a bump reviewable.
      assert.equal(text, before[index].replace('"version": "0.1.1"', '"version": "0.1.2"'));
    }
    assert.equal(currentVersion(at), "0.1.2");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("refuses to guess when the version string appears more than once", () => {
  const at = fixture();
  try {
    // A nested object carrying its own "version" at the same value: replacing both
    // would rewrite a field nobody asked to bump, and the extra edit would be easy
    // to miss in review.
    writeFileSync(
      join(at, PLUGIN_JSON),
      `{\n  "name": "mobile-canvas",\n  "version": "0.1.1",\n  "engine": { "version": "0.1.1" }\n}\n`,
    );
    assert.throws(() => bump(at), /expected exactly one/);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
