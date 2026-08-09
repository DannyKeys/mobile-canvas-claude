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

## Upstream sync

Five files are upstream-owned and never hand-edited: `.mcp.json`, `lib/runtime.mjs`,
`lib/runtime-assets.mjs`, `scripts/mcp.mjs`, `runtimes/manifest.json`.

```bash
node scripts/sync-upstream.mjs v0.1.8
```

A scheduled workflow does this weekly and opens a PR. Sync always reads the **thin**
tarball. The standalone `mobile-canvas-runtime-manifest-<tag>.json` release asset is
the fat variant, and because its hashes are identical the mistake would not be caught
by verification, only by failing at first use.

## Licence

MIT, as upstream. Engine copyright Jonathan Dick.
