# Mobile Canvas for Claude Code

Drive local iOS Simulators and Android emulators from Claude Code: boot, install,
launch, tap by accessibility element, type, screenshot, record, read logs and crashes.

A Claude Code port of [Redth/mobile-canvas-ghcp](https://github.com/Redth/mobile-canvas-ghcp)
by Jonathan Dick, which targets GitHub Copilot. The engine is that project's, used
unmodified as a released binary; this repo adds the Claude Code plugin surface.

## Install

```
/plugin marketplace add DannyKeys/mobile-canvas-claude
/plugin install mobile-canvas
```

Restart Claude Code, then run `/mobile-canvas:doctor`.

### Prerequisites

- **Node 18+**
- **macOS with Xcode** for iOS Simulator support
- **`idb_companion`** for iOS input: `brew install facebook/fb/idb-companion`.
  Without it, screenshots and video keep working while taps, swipes and typing are
  silently dropped.
- **Android SDK** with `adb` and `emulator` on `PATH` or under `ANDROID_HOME`

The engine binary is not committed. It downloads on first use (about 12.5 MB) into
`~/.mobile-canvas/`, SHA-256 verified against `runtimes/manifest.json`.

## Commands

| Command | Purpose |
|---|---|
| `/mobile-canvas:devices` | List local simulators and emulators |
| `/mobile-canvas:canvas` | Open the live device view in your browser |
| `/mobile-canvas:doctor` | Check prerequisites and upstream drift |

The three commands above are a convenience layer, not the plugin's real surface.
The engine exposes roughly 60 `mobile_device_*` MCP tools, everything from
boot/install/launch to accessibility-tree taps, logs, crash reports, permissions,
location, network conditions, and recording. Two skills teach Claude how to use
that surface directly rather than through a slash command:

| Skill | Purpose |
|---|---|
| `mobile-device` | Drive any local iOS Simulator or Android emulator via the `mobile_device_*` tools |
| `maui-device-loop` | Build, deploy, and verify a .NET MAUI app on device (build → deploy → tap → screenshot) |

## Upstream sync

Five files are upstream-owned and never hand-edited: `.mcp.json`, `lib/runtime.mjs`,
`lib/runtime-assets.mjs`, `scripts/mcp.mjs`, `runtimes/manifest.json`. This repo is
currently pinned to upstream `v0.1.7` (see `runtimes/manifest.json`).

```bash
node scripts/sync-upstream.mjs v0.1.8
```

A scheduled workflow does this weekly and opens a PR. Sync always reads the **thin**
tarball. The standalone `mobile-canvas-runtime-manifest-<tag>.json` release asset is
the fat variant, and because its hashes are identical the mistake would not be caught
by verification, only by failing at first use.

## Tests

```bash
node --test tests/*.test.mjs
```

The shell expands that glob into explicit filenames before Node ever sees it, so it
works on the Node 18 floor this repo targets. Don't run `node --test tests/` (the
bare-directory form) instead: Node's own recursive test-directory discovery isn't
reliable before Node 22, so on an older Node it can silently run fewer tests than
you expect rather than failing loudly.

## Licence

MIT, as upstream. Engine copyright Jonathan Dick. The Claude Code plugin layer
(commands, skills, and scripts in this repo) is copyright Daniel Okebukola.
