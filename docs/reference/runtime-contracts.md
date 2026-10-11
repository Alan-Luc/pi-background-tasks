---
doc_id: reference/runtime-contracts
audience: maintainer
mode: authored
review_policy: contract
stability: evolving
covers_surfaces: []
covers_sources: []
---
# Runtime contracts

<!-- pi-docs:begin name="runtime-contracts" generator="scripts/docs/generate.mjs" -->
### Configuration variants


```json
{
  "default_dock_shortcut": "shift+down",
  "dock_shortcut_values": [
    "shift+down",
    "ctrl+alt+b",
    "off"
  ],
  "source": "src/core/config.ts"
}
```

### Environment variable references

| Name | Access | Provenance |
| --- | --- | --- |
| `ComSpec` | read | `src/core/common.ts:926`<br>`src/core/common.ts:944` |
| `path` | read | `src/core/common.ts:842` |
| `Path` | read | `src/core/common.ts:842` |
| `PATH` | read | `src/core/common.ts:842`<br>`src/core/common.ts:896`<br>`src/core/pi-launch.ts:425` |
| `PI_BG_DISABLE_PI_TELEMETRY` | read | `src/core/registry.ts:233` |
| `PI_BG_DOCK_SHORTCUT` | read | `src/core/config.ts:42` |
| `PI_BG_MAX_OUTPUT_BYTES` | read | `src/core/registry.ts:59` |
| `PI_BG_POSIX_SHELL` | read | `src/core/common.ts:964` |
| `PI_BG_POSIX_SHELL_PATH` | read | `src/core/common.ts:974` |
| `PI_BG_SHELL` | read | `src/core/common.ts:921` |
| `PI_BG_SHELL_PATH` | read | `src/core/common.ts:922` |
| `SHELL` | read | `src/core/common.ts:981` |
| `SystemRoot` | read | `src/core/windows-taskkill.ts:96` |
| `WINDIR` | read | `src/core/windows-taskkill.ts:101` |

### Runtime paths and artifacts

| Kind | Path/artifact | Provenance |
| --- | --- | --- |
| directory | `.pi/tasks/<session-id>-<pid>/` | `src/core/registry.ts:1179` |
| task-file | `.pi/tasks/<session-id>-<pid>/<task-id>.json` | `src/core/registry.ts:1355` |
| task-file | `.pi/tasks/<session-id>-<pid>/<task-id>.output` | `src/core/registry.ts:1354` |

### Schema identifiers

| Schema | Provenance |
| --- | --- |
| `pi-background-tasks.extension-request.v1` | `src/core/extension-api.ts:15` |
| `pi-background-tasks.extension-response.v1` | `src/core/extension-api.ts:16` |
| `pi-background-tasks.extension-terminal.v1` | `src/core/extension-api.ts:17` |
| `pi-background-tasks.reload-shell-owner.v1` | `src/core/reload-shell-owner.ts:36` |
| `pi-background-tasks.reload-shell.v1` | `src/core/reload-shell-owner.ts:996` |

### Status vocabularies


```json
{
  "TASK_STATUS_VALUES": [
    "running",
    "completed",
    "failed",
    "killed"
  ],
  "TERMINAL_TASK_STATUS_VALUES": [
    "completed",
    "failed",
    "killed"
  ]
}
```
<!-- pi-docs:end name="runtime-contracts" -->

## Task state

Tasks use the states `running`, `completed`, `failed`, and `killed`. Exact ids and unambiguous prefixes resolve task rows; unknown and ambiguous values fail loudly.

Task files live under `.pi/tasks/<session-id>-<pid>/`:

- `<task-id>.output` contains the full local output stream;
- `<task-id>.json` contains durable metadata and terminal state.

Model-visible log reads are bounded. Full output paths are retained in diagnostics rather than silently truncating data.

## Process safety

Ordinary shell commands use structured spawn arguments, the activation-selected shell, the project cwd, and detached process groups where supported. They are not sandboxed. Timeouts, output caps, spawn failures, process-tree termination, and cleanup failures are explicit failure paths.

## Package boundaries

The published entrypoint is `dist/extensions/background-tasks.js`; `dist/src/**` contains private compiled implementation chunks. Pi SDK and TypeBox remain host-provided peers. The package is a private personal fork and does not perform automatic npm version checks.
