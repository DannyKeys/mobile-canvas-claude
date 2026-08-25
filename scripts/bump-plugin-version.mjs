#!/usr/bin/env node
// Bumps the plugin's patch version in the two files that declare it.
//
// This exists because the Claude Code client caches an installed plugin under
// cache/<marketplace>/<plugin>/<version>/, keyed by the version string alone. An
// engine sync that leaves the version untouched is therefore invisible to anyone
// who already holds that version: `plugin update` reports success, copies nothing,
// and the stale files stay in place. Worse, a fresh install of the same version
// string gets main's newer content, so one version can mean different bytes on
// different machines. Every content change must move the version.
//
// The two files are rewritten by targeted string replacement rather than
// JSON.stringify, because a reserialize would reflow hand-formatted JSON (the
// inline keywords array, for one) and bury a one-line change in a whole-file diff.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const PLUGIN_JSON = ".claude-plugin/plugin.json";
export const MARKETPLACE_JSON = ".claude-plugin/marketplace.json";

export function nextPatch(version) {
  // Deliberately strict: a prerelease or build suffix would need a policy for what
  // "next" means, and guessing one silently is worse than refusing.
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`version ${JSON.stringify(version)} is not a plain major.minor.patch`);
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

// `claude plugin tag` refuses to cut a release when plugin.json and the enclosing
// marketplace entry disagree, so the same agreement is required here rather than
// letting a bump propagate a split that only surfaces at release time.
export function currentVersion(at = root) {
  const plugin = JSON.parse(readFileSync(join(at, PLUGIN_JSON), "utf8"));
  const marketplace = JSON.parse(readFileSync(join(at, MARKETPLACE_JSON), "utf8"));
  const entry = marketplace.plugins?.find((candidate) => candidate.name === plugin.name);

  if (!entry) {
    throw new Error(`${MARKETPLACE_JSON} has no entry named ${JSON.stringify(plugin.name)}`);
  }
  if (plugin.version !== entry.version) {
    throw new Error(
      `version split: ${PLUGIN_JSON} says ${plugin.version}, ` +
        `${MARKETPLACE_JSON} says ${entry.version}. Reconcile them before bumping.`,
    );
  }
  return plugin.version;
}

function replaceVersion(at, relative, from, to) {
  const path = join(at, relative);
  const before = readFileSync(path, "utf8");
  const pattern = new RegExp(`"version"\\s*:\\s*"${from.replace(/\./g, "\\.")}"`, "g");
  const hits = before.match(pattern) ?? [];

  // More than one match means some other key also carries this version string, and
  // a blind replace would rewrite a field nobody asked to bump.
  if (hits.length !== 1) {
    throw new Error(`expected exactly one "version": "${from}" in ${relative}, found ${hits.length}`);
  }
  writeFileSync(path, before.replace(pattern, `"version": "${to}"`));
}

export function bump(at = root) {
  const from = currentVersion(at);
  const to = nextPatch(from);
  for (const relative of [PLUGIN_JSON, MARKETPLACE_JSON]) replaceVersion(at, relative, from, to);
  return { from, to };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  // stdout is the new version and nothing else, so the workflow can capture it with
  // a plain command substitution. Anything human-readable goes to stderr.
  const { from, to } = bump();
  process.stderr.write(`plugin version ${from} -> ${to}\n`);
  process.stdout.write(`${to}\n`);
}
