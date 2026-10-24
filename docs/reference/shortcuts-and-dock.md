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
| `ctrl+alt+b` | `dock:ctrl+alt+b` | no | Open focused background task manager | `src/extension.ts:636` |
| `ctrl+alt+c` | `always` | yes | Clear finished background task notices (terminal-dependent fallback for /bg-clear) | `src/extension.ts:644` |
| `shift+down` | `dock:shift+down` | yes | Open focused background task manager | `src/extension.ts:627` |
<!-- pi-docs:end name="shortcut-contracts" -->

`PI_BG_DOCK_SHORTCUT` selects `shift+down` (default), `ctrl+alt+b`, or `off`. Only the selected dock key is registered; with `off`, `/tasks` and `/bg-tasks` remain the fallback.

`Ctrl+Alt+C` is separate from dock selection and clears finished notices as a terminal-dependent fallback for `/bg-clear`.

Running jobs appear in a compact right-aligned native widget above the editor, with pi-tasks-style animated icons, accented job names, and no progress output. It participates in Pi's layout without covering the transcript or taking keyboard focus. It disappears when no jobs are running or while the task manager is open. There is no terminal-size cutoff, floating overlay, or background-task footer badge.

Completed history and finished notices remain in `/tasks`. Opening task detail marks that task seen; list navigation alone does not clear notices. `/bg-clear` clears finished notices without stopping running jobs.
