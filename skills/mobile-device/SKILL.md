---
name: mobile-device
description: >
  Drive a local iOS Simulator or Android emulator — list, create, boot, install
  and launch apps, tap by accessibility element, type, screenshot, record, read
  device logs and crashes, and set permissions, location, or network conditions.
  Use whenever the user asks to open a simulator or emulator, run their app on
  one, reproduce a bug on a device, check what a screen looks like, automate a
  user flow, or when a task needs a real device UDID or AVD serial to deploy to.
when_to_use: |
  Triggers include: "open the simulator", "boot an emulator", "run this on my
  iPhone simulator", "tap the login button", "what does the app look like",
  "screenshot the simulator", "record a video of this flow", "which simulators do
  I have", "deploy to the emulator", "reproduce this on iOS", "why did the app
  crash on device", "grant the app camera permission", "fake a GPS location",
  "test this on a slow network", "walk through onboarding on device".
allowed-tools: Bash, Read
---

# Driving a local mobile device

The `mobile_device_*` MCP tools control iOS Simulators and Android emulators on
this machine — 61 of them, covering far more than input and screenshots. A live
browser view of the same device is available through `/mobile-canvas:canvas`.

## Canvas context

Two tools — `mobile_device_select` and `mobile_device_get_selected` — take a
`sessionId` and `instanceId`. These identify one canvas, and the *selected device*
is stored per canvas. Never invent the pair. Always read it with:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/canvas-context.mjs"
```

It is derived from the project directory, so it is the same on every run and the
same pair `/mobile-canvas:canvas` uses. Using that shared pair is what lets the
user pick a device in the browser and have you read that choice back.

Inventing a different pair is not an error the host rejects — it silently creates a
second, empty canvas, so the symptom is `hasSelection: false` for a device the user
can plainly see selected. Every other tool takes an explicit `deviceId` and needs no
context.

## The standard flow

1. `mobile_device_list` — devices, running ones first. Note the two IDs per
   device: the provider-qualified `id` that these tools take, and the **native**
   ID (iOS `udid`, Android AVD name / `emulator-5554` serial) that `dotnet build`,
   `xcrun simctl`, and `adb` take. They are not interchangeable.
2. `mobile_device_boot` if shut down. It waits for boot to finish, so a tap
   issued straight after will land.
3. `mobile_device_app_install` with a host path (`.app` on iOS, `.apk` on
   Android), then `mobile_device_app_launch` with the bundle ID or package name.
   Prefer launching by ID over tapping a home-screen icon — that depends on which
   page the icon happens to be on. `mobile_device_app_list` hides the platform's
   own built-in apps by default, since they'd otherwise outnumber a developer's
   own many times over — ask for system apps explicitly if you need one.
4. Drive it (below).
5. `mobile_device_screenshot` returns the PNG as image content directly, so you
   see it without a separate Read.

## Tapping: use the accessibility tree, not coordinates

On iOS this requires `idb_companion`. Without it, screenshots and video keep working
while every tap, swipe and keystroke is silently dropped, so the app looks like it is
ignoring you. If input appears to do nothing on iOS, run `/mobile-canvas:doctor`
before investigating the app.

`mobile_device_ui_tap` taps the first element matching visible text, accessibility
identifier, or role. Prefer it over `mobile_device_tap` for anything with a label.
It reads the live hierarchy, so it stays correct across layout changes, scroll
position, and device size — a coordinate that worked on an iPhone 15 is wrong on
an SE, and a coordinate read off a screenshot is in image pixels rather than the
logical points `mobile_device_tap` expects.

Use `mobile_device_ui_find` when you need to check something exists, count
matches, or get a centre point before deciding. `mobile_device_ui_dump` gives the
whole tree, which is the fastest way to understand an unfamiliar screen — often
better than a screenshot, since labels and identifiers are text you can reason
about. Ask it for the raw dump when the normalized tree is missing something you
need — it returns the untouched platform payload instead.

Fall back to `mobile_device_tap` only for canvas-drawn UI, map surfaces, and
gestures at a specific point.

After any tap that navigates or triggers a network call, verify before continuing.
Do not chain three taps assuming the first two landed.

## When something looks wrong

- `mobile_device_log` — bounded by default to the last five minutes and the
  newest 200 entries, so an unfiltered call still returns. Still filter with
  `bundleId` and `level` rather than relying on the bound alone; an idle
  simulator writes tens of thousands of lines a minute. Note Apple's log has no
  warning rung, so `level: warning` on iOS yields errors and faults.
- `mobile_device_crashes` — crashes and ANRs survive the process that produced
  them, so this finds failures that happened while nothing was watching. Pass an
  ID to `mobile_device_crash_report` for the stack.

Reach for these before speculating about a blank screen. A MAUI or native startup
exception is usually legible in the first lines after launch.

## Setting up state instead of clicking through it

- `mobile_device_permission_set` — grant/revoke/reset a permission so a
  permission-gated screen can be reached without hand-answering a system prompt.
  Cross-platform names: camera, microphone, location, contacts, photos,
  notifications, and others.
- `mobile_device_location_set` / `_clear`, `mobile_device_network_set`,
  `mobile_device_battery_set`, `mobile_device_biometric` — simulate GPS, network
  conditions, battery state, and Face/Touch ID results.
- `mobile_device_notification_push`, `mobile_device_sms_send`,
  `mobile_device_call` — deliver a push, SMS, or incoming call.
- `mobile_device_clipboard_get` / `_set`, `mobile_device_media_add`,
  `mobile_device_file_push` / `_pull` — seed the pasteboard, photo library, or
  app container.

Prefer these over driving the Settings app by hand; they are faster and do not
break when the OS reorganises Settings.

## Creating a device

`mobile_device_catalog` lists installed runtimes/system images and device types
with the exact IDs `mobile_device_create` needs. Read it first — a runtime ID that
looks plausible but is not installed fails at create time.

## Destructive operations

`mobile_device_erase` and `mobile_device_delete` require explicit
`confirm: true`. Do not pass it unless the user asked for that specific device to
be erased or deleted in this conversation. Erase is unrecoverable — installed
apps, data, and keychain are gone. Prefer `mobile_device_shutdown` when the user
wants a device "closed" or "stopped"; it is reversible.

## Android specifics

Emulators must be launched with `-gpu host`. A software-rendered AVD still
accepts input and screenshots but drops video from ~50 FPS to ~3 FPS, and the
usual report of that is "the canvas is frozen". Check this before investigating
anything else.

## Recording

`mobile_device_recording_start` / `_stop` write a bounded video to disk;
`_stop` returns the path. Always stop a recording you started, including on the
path where the flow failed — the host does not stop it for you.

## When nothing works

Run `/mobile-canvas:doctor`. Common causes: iOS input silently doing nothing
means `idb_companion` is missing; every Android tool failing means the Android
SDK is not on `PATH` or `ANDROID_HOME` is unset.
