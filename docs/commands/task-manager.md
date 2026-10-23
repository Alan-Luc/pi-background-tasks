---
doc_id: commands/task-manager
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [command:bg-tasks, command:tasks]
covers_sources: []
---
# `/tasks` and `/bg-tasks`

<!-- pi-docs:begin name="command-contract-tasks-bg-tasks" generator="scripts/docs/generate.mjs" -->
| Command | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `/tasks` | `always` | yes | Open the Claude-like background task manager UI | `src/extension.ts:630` |
| `/bg-tasks` | `always` | yes | Open the background task manager UI | `src/extension.ts:638` |
<!-- pi-docs:end name="command-contract-tasks-bg-tasks" -->

Open the focused background-task dock in an interactive UI. Both commands are equivalent and remain available when the dock shortcut is `off`.

The dock header separates running jobs from finished jobs, including explicit zero counts. The dock lists running, completed, failed, and killed tasks. Open a detail view for bounded output, stop a running task, rerun an ordinary shell task, or return to the list. Finished-task badges remain until detail view or `/bg-clear` marks them seen.
