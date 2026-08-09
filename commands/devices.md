---
description: List local iOS Simulators and Android emulators
argument-hint: "[ios|android]"
---

List the local virtual devices using the `mobile_device_list` tool.

If the argument above (`$ARGUMENTS`) names a platform — `ios` or `android` —
show only that platform's devices. If it is empty, show all of them.

Present a compact table: name, platform, OS version, state, and the **native**
identifier used for deployment (iOS `udid`, Android AVD name or serial). Put
running devices first. Include the provider-qualified `id` only if the user is
going to need it for another tool call in this turn — it is noise otherwise.

If no devices exist at all, say so and mention `mobile_device_catalog` lists the
installed runtimes and device types one could be created from. Do not create a
device unless asked.
