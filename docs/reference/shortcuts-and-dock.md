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
| `ctrl+alt+b` | `dock:ctrl+alt+b` | no | Open focused background task manager | `src/extension.ts:642` |
| `ctrl+alt+c` | `always` | yes | Clear finished background task notices (terminal-dependent fallback for /bg-clear) | `src/extension.ts:650` |
| `shift+down` | `dock:shift+down` | yes | Open focused background task manager | `src/extension.ts:633` |
<!-- pi-docs:end name="shortcut-contracts" -->

`PI_BG_DOCK_SHORTCUT` selects `shift+down` (default), `ctrl+alt+b`, or `off`. Only the selected dock key is registered; with `off`, `/tasks` and `/bg-tasks` remain the fallback.

`Ctrl+Alt+C` is separate from dock selection and clears finished notices as a terminal-dependent fallback for `/bg-clear`.

Running jobs appear above the editor, oldest-first, with pi-tasks-style animated icons, dim display numbers (`#1`, `#2`, …), accented names and dim elapsed runtimes. Numbers follow current row order, not registry IDs. Compatible pi-tasks shares a native Tasks-left/Jobs-right row with level headings and job rows indented beneath their left-aligned heading; narrow terminals stack the blocks. Other widgets remain independent. Without a compatible pi-tasks presentation bridge, the Jobs block remains standalone on the right. The Jobs column disappears when idle or while the task manager is open, without hiding Tasks. No transcript is covered or keyboard focus taken; there is no floating overlay, progress feed or background-task footer badge.

Completed history and finished notices remain in `/tasks`. Opening task detail marks that task seen; list navigation alone does not clear notices. `/bg-clear` clears finished notices without stopping running jobs.
