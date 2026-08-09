import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canvasContext, INSTANCE_ID } from "../scripts/canvas-context.mjs";

function initGitRepo(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("instanceId is the constant 'claude'", () => {
  assert.equal(INSTANCE_ID, "claude");
  assert.equal(canvasContext(tmpdir()).instanceId, "claude");
});

test("sessionId is 16 lowercase hex characters", () => {
  const { sessionId } = canvasContext(tmpdir());
  assert.match(sessionId, /^[0-9a-f]{16}$/);
});

test("same directory always yields the same sessionId", () => {
  const dir = mkdtempSync(join(tmpdir(), "mc-ctx-"));
  assert.equal(canvasContext(dir).sessionId, canvasContext(dir).sessionId);
});

test("different directories yield different sessionIds", () => {
  const a = mkdtempSync(join(tmpdir(), "mc-ctx-a-"));
  const b = mkdtempSync(join(tmpdir(), "mc-ctx-b-"));
  assert.notEqual(canvasContext(a).sessionId, canvasContext(b).sessionId);
});

test("a symlink and its target yield the same sessionId", () => {
  const base = mkdtempSync(join(tmpdir(), "mc-ctx-link-"));
  const target = join(base, "real");
  const link = join(base, "alias");
  mkdirSync(target);
  symlinkSync(target, link);
  assert.equal(canvasContext(link).sessionId, canvasContext(target).sessionId);
});

test("projectDir is fully resolved", () => {
  const dir = mkdtempSync(join(tmpdir(), "mc-ctx-real-"));
  assert.equal(canvasContext(dir).projectDir, realpathSync(dir));
});

test("a directory that does not exist still yields a stable id", () => {
  const missing = join(tmpdir(), "mc-ctx-does-not-exist-12345");
  assert.equal(canvasContext(missing).sessionId, canvasContext(missing).sessionId);
});

test("a subdirectory of a git repo yields the same sessionId as its root", () => {
  const root = initGitRepo("mc-ctx-git-");
  const sub = join(root, "nested", "deeper");
  mkdirSync(sub, { recursive: true });
  assert.equal(canvasContext(sub).sessionId, canvasContext(root).sessionId);
});

test("two different git repos still yield different sessionIds", () => {
  const repoA = initGitRepo("mc-ctx-git-a-");
  const repoB = initGitRepo("mc-ctx-git-b-");
  assert.notEqual(canvasContext(repoA).sessionId, canvasContext(repoB).sessionId);
});
