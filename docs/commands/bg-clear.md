---
doc_id: commands/bg-clear
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [command:bg-clear]
covers_sources: []
---
# `/bg-clear`

<!-- pi-docs:begin name="command-contract-bg-clear" generator="scripts/docs/generate.mjs" -->
| Command | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `/bg-clear` | `always` | yes | Clear finished background task footer notices | `src/extension.ts:651` |
<!-- pi-docs:end name="command-contract-bg-clear" -->

Mark finished background-task notices as seen.

The command works independently of the dock and is the canonical fallback when a terminal does not deliver `Ctrl+Alt+C`. Opening a task detail also marks that task seen; merely opening or closing the list does not clear other finished badges.
