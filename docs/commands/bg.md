---
doc_id: commands/bg
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [command:bg]
covers_sources: []
---
# `/bg`

<!-- pi-docs:begin name="command-contract-bg" generator="scripts/docs/generate.mjs" -->
| Command | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `/bg` | `always` | yes | Start a tracked shell command: /bg [--survive-reload] [--agent] [--name "Task name"] <command> | `src/extension.ts:603` |
<!-- pi-docs:end name="command-contract-bg" -->

Start a tracked local shell command:

```text
/bg [--survive-reload] [--agent] [--name <name>] <command>
```

`/bg` returns after spawn with a task id and output path. It is display-only by default: terminal completion is visible in the UI but does not trigger a model follow-up turn. Use `bg_run` for agent-launched work.

Commands are ordinary local shell commands, not sandboxes. The runtime applies the activation-selected shell, cwd, timeout, output cap, process-tree termination, and durable metadata policy. Empty commands and invalid options fail before spawn.

`--survive-reload` is supported only for ordinary non-agent shell tasks across a real same-process reload. It preserves the live process and task identity; it never adopts arbitrary PIDs or metadata.

Related: [`bg_run`](../tools/bg_run.md), [`/jobs`](jobs.md), [`/logs`](logs.md), [`/kill`](kill.md), and [background runtime](../subsystems/background-task-runtime.md).
