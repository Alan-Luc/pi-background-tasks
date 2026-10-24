---
doc_id: commands/jobs
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [command:jobs]
covers_sources: []
---
# `/jobs`

<!-- pi-docs:begin name="command-contract-jobs" generator="scripts/docs/generate.mjs" -->
| Command | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `/jobs` | `always` | yes | List running and recent background tasks | `src/extension.ts:653` |
<!-- pi-docs:end name="command-contract-jobs" -->

List retained background tasks and their current states. Use an exact id or unambiguous prefix with `/logs` and `/kill`.
