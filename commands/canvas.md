---
description: Open the live Mobile Canvas for this project in your browser
argument-hint: "[device-id]"
allowed-tools: Bash
---

Open the Mobile Canvas live view.

If the user supplied a device ID (`$ARGUMENTS` above is non-empty), run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/canvas.mjs" --device "<the device ID>"
```

Otherwise run it without the `--device` flag:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/canvas.mjs"
```

Then tell the user, in one or two lines:

- that the canvas is open in their browser, or, if `opened` came back false, give
  them the URL and mention it is short-lived
- the `sessionId`, so they know which canvas you share with them

Do not re-list their devices unless asked. If the command fails, run
`node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"` and report what it found rather
than guessing at a cause.

The canvas shows live video and accepts real tap, drag, scroll and keyboard input.
A device selected there is visible to `mobile_device_get_selected` using the same
context pair, and a device you select with `mobile_device_select` appears there.
Never invent a `sessionId` or `instanceId`: always take them from
`scripts/canvas-context.mjs`, because a mismatched pair silently opens a second,
empty canvas rather than failing.
