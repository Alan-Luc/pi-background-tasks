---
doc_id: INDEX
audience: user
mode: generated
review_policy: contract
stability: stable
covers_surfaces: []
covers_sources: []
---
# Documentation index

Generated navigation for every package-local documentation page. This index intentionally owns no public surface and no production source; ownership is explicit in each primary doc's frontmatter.

## Start here

- [Getting started](./getting-started.md)
- [Choose a workflow](./choose-a-workflow.md)
- [Read before editing production sources](./read-before-edit.md)
- [Runtime contracts](./reference/runtime-contracts.md)

## Docs by audience

### agent

| Doc | Mode | Review | Stability |
| --- | --- | --- | --- |
| [concepts/completion-delivery](./concepts/completion-delivery.md) | authored | behavioral | stable |
| [read-before-edit](./read-before-edit.md) | generated | contract | stable |
| [tools/bg_kill](./tools/bg_kill.md) | mixed | contract | stable |
| [tools/bg_logs](./tools/bg_logs.md) | mixed | contract | stable |
| [tools/bg_run](./tools/bg_run.md) | mixed | contract | stable |
| [tools/bg_status](./tools/bg_status.md) | mixed | contract | stable |

### maintainer

| Doc | Mode | Review | Stability |
| --- | --- | --- | --- |
| [api/eventbus-v1](./api/eventbus-v1.md) | mixed | behavioral | evolving |
| [operations/configuration](./operations/configuration.md) | authored | contract | stable |
| [operations/releasing](./operations/releasing.md) | authored | contract | evolving |
| [operations/testing](./operations/testing.md) | authored | behavioral | evolving |
| [operations/troubleshooting](./operations/troubleshooting.md) | authored | contract | stable |
| [reference/runtime-contracts](./reference/runtime-contracts.md) | authored | contract | evolving |
| [subsystems/background-task-runtime](./subsystems/background-task-runtime.md) | authored | behavioral | stable |
| [subsystems/child-launch-durability-and-safety](./subsystems/child-launch-durability-and-safety.md) | authored | behavioral | evolving |
| [subsystems/docs-freshness-gate](./subsystems/docs-freshness-gate.md) | mixed | contract | stable |
| [subsystems/host-ui-and-telemetry](./subsystems/host-ui-and-telemetry.md) | authored | behavioral | stable |

### user

| Doc | Mode | Review | Stability |
| --- | --- | --- | --- |
| [choose-a-workflow](./choose-a-workflow.md) | authored | contract | stable |
| [commands/bg](./commands/bg.md) | mixed | contract | stable |
| [commands/bg-clear](./commands/bg-clear.md) | mixed | contract | stable |
| [commands/jobs](./commands/jobs.md) | mixed | contract | stable |
| [commands/kill](./commands/kill.md) | mixed | contract | stable |
| [commands/logs](./commands/logs.md) | mixed | contract | stable |
| [commands/task-manager](./commands/task-manager.md) | mixed | contract | stable |
| [getting-started](./getting-started.md) | authored | contract | stable |
| [INDEX](./INDEX.md) | generated | contract | stable |
| [reference/shortcuts-and-dock](./reference/shortcuts-and-dock.md) | mixed | contract | stable |

## Docs by category

- **api**: [api/eventbus-v1](./api/eventbus-v1.md)
- **commands**: [commands/bg](./commands/bg.md), [commands/bg-clear](./commands/bg-clear.md), [commands/jobs](./commands/jobs.md), [commands/kill](./commands/kill.md), [commands/logs](./commands/logs.md), [commands/task-manager](./commands/task-manager.md)
- **concepts**: [concepts/completion-delivery](./concepts/completion-delivery.md)
- **operations**: [operations/configuration](./operations/configuration.md), [operations/releasing](./operations/releasing.md), [operations/testing](./operations/testing.md), [operations/troubleshooting](./operations/troubleshooting.md)
- **reference**: [reference/runtime-contracts](./reference/runtime-contracts.md), [reference/shortcuts-and-dock](./reference/shortcuts-and-dock.md)
- **root**: [choose-a-workflow](./choose-a-workflow.md), [getting-started](./getting-started.md), [INDEX](./INDEX.md), [read-before-edit](./read-before-edit.md)
- **subsystems**: [subsystems/background-task-runtime](./subsystems/background-task-runtime.md), [subsystems/child-launch-durability-and-safety](./subsystems/child-launch-durability-and-safety.md), [subsystems/docs-freshness-gate](./subsystems/docs-freshness-gate.md), [subsystems/host-ui-and-telemetry](./subsystems/host-ui-and-telemetry.md)
- **tools**: [tools/bg_kill](./tools/bg_kill.md), [tools/bg_logs](./tools/bg_logs.md), [tools/bg_run](./tools/bg_run.md), [tools/bg_status](./tools/bg_status.md)

## Public surface owners

| Surface | Primary doc |
| --- | --- |
| `command:bg` | [commands/bg](./commands/bg.md) |
| `command:bg-clear` | [commands/bg-clear](./commands/bg-clear.md) |
| `command:bg-tasks` | [commands/task-manager](./commands/task-manager.md) |
| `command:jobs` | [commands/jobs](./commands/jobs.md) |
| `command:kill` | [commands/kill](./commands/kill.md) |
| `command:logs` | [commands/logs](./commands/logs.md) |
| `command:tasks` | [commands/task-manager](./commands/task-manager.md) |
| `eventbus:background-task-v1` | [api/eventbus-v1](./api/eventbus-v1.md) |
| `renderer:background-task-notification` | [concepts/completion-delivery](./concepts/completion-delivery.md) |
| `shortcut:ctrl+alt+b` | [reference/shortcuts-and-dock](./reference/shortcuts-and-dock.md) |
| `shortcut:ctrl+alt+c` | [reference/shortcuts-and-dock](./reference/shortcuts-and-dock.md) |
| `shortcut:shift+down` | [reference/shortcuts-and-dock](./reference/shortcuts-and-dock.md) |
| `tool:bg_kill` | [tools/bg_kill](./tools/bg_kill.md) |
| `tool:bg_logs` | [tools/bg_logs](./tools/bg_logs.md) |
| `tool:bg_run` | [tools/bg_run](./tools/bg_run.md) |
| `tool:bg_status` | [tools/bg_status](./tools/bg_status.md) |

## Public surface inventory

| Kind | Name | ID | Availability | Default | Provenance |
| --- | --- | --- | --- | --- | --- |
| command | `bg` | `command:bg` | `always` | yes | `src/extension.ts:576` |
| command | `bg-clear` | `command:bg-clear` | `always` | yes | `src/extension.ts:619` |
| command | `bg-tasks` | `command:bg-tasks` | `always` | yes | `src/extension.ts:611` |
| command | `jobs` | `command:jobs` | `always` | yes | `src/extension.ts:653` |
| command | `kill` | `command:kill` | `always` | yes | `src/extension.ts:697` |
| command | `logs` | `command:logs` | `always` | yes | `src/extension.ts:666` |
| command | `tasks` | `command:tasks` | `always` | yes | `src/extension.ts:603` |
| tool | `bg_kill` | `tool:bg_kill` | `always` | yes | `src/extension.ts:914` |
| tool | `bg_logs` | `tool:bg_logs` | `always` | yes | `src/extension.ts:869` |
| tool | `bg_run` | `tool:bg_run` | `always` | yes | `src/extension.ts:730` |
| tool | `bg_status` | `tool:bg_status` | `always` | yes | `src/extension.ts:838` |
| shortcut | `ctrl+alt+b` | `shortcut:ctrl+alt+b` | `dock:ctrl+alt+b` | no | `src/extension.ts:637` |
| shortcut | `ctrl+alt+c` | `shortcut:ctrl+alt+c` | `always` | yes | `src/extension.ts:645` |
| shortcut | `shift+down` | `shortcut:shift+down` | `dock:shift+down` | yes | `src/extension.ts:628` |
| renderer | `background-task-notification` | `renderer:background-task-notification` | `always` | yes | `src/extension.ts:477` |
| eventbus | `background-task-v1` | `eventbus:background-task-v1` | `always` | yes | `src/core/extension-api.ts` |
