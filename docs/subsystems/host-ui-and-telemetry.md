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

This subsystem owns the process entrypoint, retained command/tool registration, native running-job widget, task manager UI, completion renderer, and task telemetry.

The published entrypoint is `dist/extensions/background-tasks.js`, compiled from `extensions/background-tasks.ts`. It registers the process commands/tools, EventBus service, widget, notifications, and selected dock shortcut. There is no feature-selection environment variable and no automatic npm update notice.

The interactive job widget renders directly above the editor as a right-aligned block of up to 36 columns, adapting to smaller terminals. A compact heading and tree rows show only running tasks, with at most five rows and an overflow count. When no jobs are running, it renders no lines, regardless of unseen finished notices. It never reads logs or displays progress telemetry. Theme foregrounds replace fixed colours and background fills. It hides while the focused manager is open; no overlay or background-task footer badge is emitted.

Task changes request native widget renders without a refresh timer or separate layout resources. Disposal prevents late renders or refreshes. Non-TUI modes do not install the widget. The task manager retains completed history and running/finished counts.

The task manager opens from `/tasks`, `/bg-tasks`, or the selected dock key. `Ctrl+Alt+C` remains the optional `/bg-clear` fallback. UI reads are bounded and task actions operate on registry-owned task ids.

Telemetry is task-owned and best effort: absent usage is reported as unavailable, never invented as zero. Explicit agent classification controls optional Pi-agent telemetry wrapping; ordinary scripts remain ordinary scripts.
