---
doc_id: reference/shortcuts-and-dock
audience: user
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: ['shortcut:ctrl+alt+b', 'shortcut:ctrl+alt+c', 'shortcut:shift+down']
covers_sources: []
---
# Shortcuts and dock

<!-- pi-docs:begin name="shortcut-contracts" generator="scripts/docs/generate.mjs" -->
| Shortcut | Availability | Default | Description | Provenance |
| --- | --- | --- | --- | --- |
| `ctrl+alt+b` | `dock:ctrl+alt+b` | no | Open focused background task footer dock | `src/extension.ts:664` |
| `ctrl+alt+c` | `always` | yes | Clear finished background task footer notices (terminal-dependent fallback for /bg-clear) | `src/extension.ts:672` |
| `shift+down` | `dock:shift+down` | yes | Open focused background task footer dock | `src/extension.ts:655` |
<!-- pi-docs:end name="shortcut-contracts" -->

`PI_BG_DOCK_SHORTCUT` selects `shift+down` (default), `ctrl+alt+b`, or `off`. Only the selected dock key is registered; with `off`, `/tasks` and `/bg-tasks` remain the fallback.

`Ctrl+Alt+C` is separate from dock selection and clears finished notices as a terminal-dependent fallback for `/bg-clear`.

The footer always shows how many background jobs are running, including `bg 0 running` when none are active. Finished unread notices (failed, stopped, and done) appear after a separator; they are not running jobs. Opening a task detail marks that task seen; list navigation alone does not clear badges. Clearing notices leaves the running count visible.
