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

The native above-editor widget owns Jobs presentation and optionally hosts a compatible pi-tasks presentation factory, never its TaskStore or metrics. The versioned `pi-background-tasks:tasks-widget-host:v1` EventBus capability is offered from the mounted row; its callbacks capture that exact activation and reject updates after disposal. Pi-tasks registers its listener during extension setup, honors the supplied render width, and remains standalone without a compatible host.

Tasks and Jobs are top-aligned with a two-cell gap. Jobs uses its natural visible width capped at 40 cells, its heading reaches the right edge, and item rows end two cells inward to mirror Tasks indentation. With fewer than 64 cells left for Tasks, the blocks stack. Empty columns reserve no space. Other native widgets remain independent.

Jobs are stably sorted by recorded startTime before the five-row limit. Each frame reads the clock once, clamps negative elapsed times, and preserves the dim duration suffix when names truncate. A compact accent heading, animated icons and muted overflow follow pi-tasks' style. Idle or manager-open hides only Jobs, regardless of finished notices. No logs, progress feed, overlay, background fills or footer badge are emitted.

Registry changes synchronize native rendering and one widget-owned 150ms animation interval using pi-tasks' activity glyph sequence. The interval runs only while running jobs are visible, stops/reset when the manager opens or no jobs remain, and clears on disposal. No idle timer or process telemetry is introduced; disposal prevents late renders or refreshes. Non-TUI modes do not install the widget. The task manager retains completed history and running/finished counts.

The task manager opens from `/tasks`, `/bg-tasks`, or the selected dock key. `Ctrl+Alt+C` remains the optional `/bg-clear` fallback. UI reads are bounded and task actions operate on registry-owned task ids.

Telemetry is task-owned and best effort: absent usage is reported as unavailable, never invented as zero. Explicit agent classification controls optional Pi-agent telemetry wrapping; ordinary scripts remain ordinary scripts.
