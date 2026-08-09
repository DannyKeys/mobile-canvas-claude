---
name: maui-device-loop
description: >
  Build, deploy, and exercise a .NET MAUI app on a local iOS Simulator or Android
  emulator, then verify the result on screen. Use when the user wants to run their
  MAUI app on a device, reproduce or confirm a fix on device, check a XAML layout
  change visually, or iterate build-deploy-tap-screenshot without leaving Claude.
when_to_use: |
  Triggers include: "run my MAUI app on the simulator", "deploy this to the
  emulator", "does this XAML change look right", "build and run on iOS", "test
  this fix on Android", "why does this page look wrong on device", "iterate on
  this layout", "check the app on both platforms".
---

# The MAUI build → deploy → drive loop

Combines `dotnet build` with the `mobile_device_*` tools so a change can be
verified on screen rather than assumed. Read the `mobile-device` skill for the
device tools themselves; this covers the .NET side and the loop.

## 1. Pick the device first

`mobile_device_list`, then boot the target if needed. Take the **native** ID from
the result — `udid` for iOS, the AVD name or `emulator-5554` serial for Android.
The provider-qualified `id` the device tools use is not accepted by MSBuild.

If the user has the canvas open, read their choice instead of picking for them:
`mobile_device_get_selected` with this project's canvas context.

## 2. Find the target framework

Read the `<TargetFrameworks>` in the `.csproj` rather than assuming `net10.0-ios`.
A `-f` that isn't in the project fails with an error that reads like a missing
workload, which sends people down the wrong path.

```bash
grep -o '<TargetFrameworks>[^<]*' *.csproj
```

## 3. Deploy

iOS Simulator:

```bash
dotnet build -t:Run -f net10.0-ios -p:_DeviceName=:v2:udid=<UDID>
```

Android emulator:

```bash
dotnet build -t:Run -f net10.0-android36.0 -p:Device=emulator-5554
```

The Android TFM often carries an API level (`net10.0-android36.0`, not
`net10.0-android`). Passing the bare form fails with an error that reads like a
missing workload, which sends people down the wrong path. This is exactly why step 2
says to read `<TargetFrameworks>` from the `.csproj` rather than assume.

`-p:Device` initialises `AdbTarget` to `-s "<Device>"`, so it is the one knob to
set. On .NET 11 and later, `dotnet run --device <udid-or-serial>` does the same
thing with device discovery built in, and `dotnet build -t:ComputeAvailableDevices`
lists what it would choose from.

Always pass an explicit device. With no `-p:Device` / `-p:_DeviceName`, the build
picks a default target, and on a machine with several booted devices that is
routinely not the one on screen — the app deploys successfully to a device nobody
is looking at, and the change appears not to have worked.

If you would rather not shell out at all, `dotnet build -f <tfm>` alone produces
the `.app` / `.apk`, and `mobile_device_app_install` + `mobile_device_app_launch`
put it on the device. That path gives a clearer error when installation fails,
because the failure is separated from the build.

## 4. Drive and verify

Wait for launch, then take a `mobile_device_screenshot` before doing anything
else — one taken too early catches the splash screen, and every conclusion drawn
from it is wrong. The screenshot comes back as image content, so you see it
directly.

Then drive the flow with `mobile_device_ui_tap` (by label or `AutomationId`),
`_type_text`, and `_swipe`. In MAUI, `AutomationId` on a control becomes the
accessibility identifier on both platforms, which makes `identifier` the most
stable way to target an element — more so than visible text, which changes with
localisation. Setting `AutomationId` on the controls you drive is worth doing
once and pays for itself immediately.

Screenshot after each step that changes the screen. Do not report a layout as
correct without having looked at one.

## 5. Iterating

On a XAML-only change, redeploy with the same command — it is usually faster than
reasoning about whether hot reload applied. If a change genuinely does not appear
after a successful deploy, the likely causes in order are: deployed to a different
device than the one on screen (check step 3), a stale `bin`/`obj` after a
`TargetFrameworks` edit, or the app not actually relaunching.

## Logs and crashes

When a screenshot shows a crash or a blank page, read the device rather than
guessing:

```
mobile_device_log      deviceId, bundleId: <your app id>, level: "error"
mobile_device_crashes  deviceId
```

Filter by `bundleId` — an idle simulator writes tens of thousands of lines a
minute and an unfiltered dump buries the exception. A MAUI startup exception is
almost always legible in the first lines after launch, and
`mobile_device_crashes` catches the case where the app died before you looked.

## Both platforms

When asked to check something "on both", run the platforms sequentially and keep
each platform's screenshots labelled. Rendering differences between iOS and
Android in MAUI are expected for fonts, shadows, and safe-area insets — flag them
as differences to look at, not automatically as bugs.
