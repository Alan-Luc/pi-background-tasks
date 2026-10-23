---
doc_id: subsystems/host-ui-and-telemetry
audience: maintainer
mode: authored
review_policy: behavioral
stability: stable
covers_surfaces: []
covers_sources: [extensions/background-tasks.ts, src/core/config.ts, src/core/lazy-module.ts, src/extension.ts, src/ui/background-tasks-manager.ts]
---
# Host UI and telemetry

This subsystem owns the process entrypoint, retained command/tool registration, footer dock, task manager UI, completion renderer, and task telemetry.

The published entrypoint is `dist/extensions/background-tasks.js`, compiled from `extensions/background-tasks.ts`. It registers the process commands/tools, EventBus service, footer, notifications, and selected dock shortcut. There is no feature-selection environment variable and no automatic npm update notice.

The footer always shows the running-job count, including zero, separately from finished unread notices. The task manager repeats running and finished counts even when history is hidden.

The task manager opens from `/tasks`, `/bg-tasks`, or the selected dock key. `Ctrl+Alt+C` remains the optional `/bg-clear` fallback. UI reads are bounded and task actions operate on registry-owned task ids.

Telemetry is task-owned and best effort: absent usage is reported as unavailable, never invented as zero. Explicit agent classification controls optional Pi-agent telemetry wrapping; ordinary scripts remain ordinary scripts.
