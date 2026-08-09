---
description: Check Mobile Canvas prerequisites — binary, host, Xcode, idb, Android SDK
allowed-tools: Bash
---

Run the diagnostics:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

Report the results grouped as **working** and **needs attention**. For anything
failing, give the remedy the check reported, and say what the failure would look
like in practice so the user can tell whether it is actually their problem:

- **idb_companion missing** — iOS video and screenshots still work; taps, swipes
  and typing silently do nothing.
- **adb / emulator not on PATH** — every Android operation fails, usually with a
  spawn error rather than anything about `PATH`.
- **Not macOS** — Android works; iOS Simulator control is unavailable.

Lines marked `-` are advisory and never fail the command. The `upstream` line
reports whether the pinned engine release is behind the latest; if it is, mention
the `sync-upstream` command it prints but do not run it yourself.

The command exits non-zero when any non-advisory check fails, which is expected —
do not treat that as the command itself being broken.
