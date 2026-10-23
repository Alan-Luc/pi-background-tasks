---
doc_id: commands/kill
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [command:kill]
covers_sources: []
---
# `/kill`

<!-- pi-docs:begin name="command-contract-kill" generator="scripts/docs/generate.mjs" -->
| Command | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `/kill` | `always` | yes | Stop a running background task: /kill <id> | `src/extension.ts:724` |
<!-- pi-docs:end name="command-contract-kill" -->

Stop a running background task by exact id or unambiguous prefix:

```text
/kill <task-id>
```

Stopping a finished or unknown task fails loudly. The runtime terminates the owned process tree and records the terminal state.
