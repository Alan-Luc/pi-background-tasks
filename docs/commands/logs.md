---
doc_id: commands/logs
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [command:logs]
covers_sources: []
---
# `/logs`

<!-- pi-docs:begin name="command-contract-logs" generator="scripts/docs/generate.mjs" -->
| Command | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `/logs` | `always` | yes | Show bounded output from a background task: /logs <id> [maxBytes] | `src/extension.ts:693` |
<!-- pi-docs:end name="command-contract-logs" -->

Read bounded output for a task:

```text
/logs <task-id> [max-bytes]
```

The model-visible response is capped. The task notice and metadata retain the full local output path for direct inspection.
