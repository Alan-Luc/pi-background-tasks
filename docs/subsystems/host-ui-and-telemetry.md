---
doc_id: subsystems/host-ui-and-telemetry
audience: maintainer
mode: authored
review_policy: behavioral
stability: stable
covers_surfaces: []
covers_sources: [extensions/background-tasks.ts, src/core/config.ts, src/core/lazy-module.ts, src/extension.ts, src/ui/background-tasks-manager.ts, src/ui/background-tasks-sidebar.ts]
---
# Host UI and telemetry

This subsystem owns the process entrypoint, retained command/tool registration, passive sidebar, task manager UI, completion renderer, and task telemetry.

The published entrypoint is `dist/extensions/background-tasks.js`, compiled from `extensions/background-tasks.ts`. It registers the process commands/tools, EventBus service, sidebar, notifications, and selected dock shortcut. There is no feature-selection environment variable and no automatic npm update notice.

The interactive sidebar is a passive 36-column top-right overlay on terminals at least 100 columns and 20 rows. It shows the running count (including zero), task names/statuses, and unseen finished notices, with at most five task rows and an overflow count. It never reads logs or displays progress telemetry. Theme foregrounds replace fixed colours and background fills. It hides while the focused manager is open; no background-task footer badge is emitted.

A zero-line widget owns exactly one non-capturing overlay handle. Task changes request renders without a UI refresh timer; widget disposal and synchronous shutdown remove only that handle. Non-TUI modes do not install the widget. The task manager continues to show running and finished counts even when history is hidden.

The task manager opens from `/tasks`, `/bg-tasks`, or the selected dock key. `Ctrl+Alt+C` remains the optional `/bg-clear` fallback. UI reads are bounded and task actions operate on registry-owned task ids.

Telemetry is task-owned and best effort: absent usage is reported as unavailable, never invented as zero. Explicit agent classification controls optional Pi-agent telemetry wrapping; ordinary scripts remain ordinary scripts.
