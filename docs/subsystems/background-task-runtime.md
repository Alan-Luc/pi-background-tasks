---
doc_id: subsystems/background-task-runtime
audience: maintainer
mode: authored
review_policy: behavioral
stability: stable
covers_surfaces: []
covers_sources: [src/core/common.ts, src/core/registry.ts, src/core/reload-shell-owner.ts, src/core/shell-policy.ts, src/core/windows-taskkill.ts]
---
# Background task runtime

The runtime owns task identity, shell invocation, process lifecycle, bounded logs, metadata, telemetry, completion publication, and platform termination.

Task states are `running`, `completed`, `failed`, and `killed`. Task files live under `.pi/tasks/<session-id>-<pid>/` as `<task-id>.output` and `<task-id>.json`. Exact ids and unambiguous prefixes resolve rows; unknown and ambiguous ids fail loudly.

Shell commands use structured spawn arguments, the activation-selected shell, the project cwd, and detached process groups where supported. They are not sandboxed. Timeouts, output caps, spawn failures, tree termination failures, metadata failures, and publication failures remain explicit.

Reload survival is opt-in for ordinary non-agent shell tasks only. A supported same-process reload preserves the owned child, task identity, output stream, timeout, and cap; it never adopts arbitrary PIDs or metadata. Shutdown closes admission and cleans up every owned process.
