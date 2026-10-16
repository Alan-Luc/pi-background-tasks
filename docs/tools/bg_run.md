---
doc_id: tools/bg_run
audience: agent
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: [tool:bg_run]
covers_sources: []
---
# `bg_run`

<!-- pi-docs:begin name="tool-contract-bg_run" generator="scripts/docs/generate.mjs" -->
- Label: **Background Run**
- Source: `src/extension.ts:762`
- Availability: `always`
- Available by default: **yes**
- Description: Start a named long-running shell command in the background and return immediately with a task ID and output path. By default, completed, failed, or killed terminal state is delivered automatically as <background-task-notification> and starts a follow-up agent turn; do not sleep or poll merely to wait. Output is stored outside the project tree in a private temporary directory; model-visible logs are bounded to 50.0KB.
- Root schema: `object`

| Field | Required | Type | Description | Constraints |
| --- | --- | --- | --- | --- |
| `command` | yes | `string` | Shell command to start in the background |  |
| `description` | no | `string` | Optional longer human-readable context for the task |  |
| `isAgent` | yes | `boolean` | Required. Set true only when this background task launches an LLM/agent process, such as a child `pi -p ...` or `pi --mode json ...`, so Pi-agent telemetry can be collected. Set false for scripts, tests, servers, sleeps, and ordinary shell commands. |  |
| `name` | yes | `string` | Short human-readable task name shown in the bg footer dock. Required; use 2-6 words, not the raw command. |  |
| `notifyOnCompletion` | no | `boolean` | Whether to deliver the durable terminal notification. Default: true; disable only when deliberately taking over completion monitoring. |  |
| `surviveReload` | no | `boolean` | Opt in to retaining this exact ordinary isAgent:false shell execution across a real same-process Pi reload. Default: false. Supported only for ordinary shell tasks. |  |
| `timeoutSeconds` | no | `number` | Optional timeout; task is failed and killed when exceeded |  |
| `triggerOnCompletion` | no | `boolean` | Whether that notification should automatically trigger a follow-up agent turn. Default: true for bg_run; requires notifyOnCompletion. |  |

<details>
<summary>Normalized TypeBox contract</summary>


```json
{
  "properties": {
    "command": {
      "description": "Shell command to start in the background",
      "type": "string"
    },
    "description": {
      "description": "Optional longer human-readable context for the task",
      "type": "string"
    },
    "isAgent": {
      "description": "Required. Set true only when this background task launches an LLM/agent process, such as a child `pi -p ...` or `pi --mode json ...`, so Pi-agent telemetry can be collected. Set false for scripts, tests, servers, sleeps, and ordinary shell commands.",
      "type": "boolean"
    },
    "name": {
      "description": "Short human-readable task name shown in the bg footer dock. Required; use 2-6 words, not the raw command.",
      "type": "string"
    },
    "notifyOnCompletion": {
      "description": "Whether to deliver the durable terminal notification. Default: true; disable only when deliberately taking over completion monitoring.",
      "type": "boolean"
    },
    "surviveReload": {
      "description": "Opt in to retaining this exact ordinary isAgent:false shell execution across a real same-process Pi reload. Default: false. Supported only for ordinary shell tasks.",
      "type": "boolean"
    },
    "timeoutSeconds": {
      "description": "Optional timeout; task is failed and killed when exceeded",
      "type": "number"
    },
    "triggerOnCompletion": {
      "description": "Whether that notification should automatically trigger a follow-up agent turn. Default: true for bg_run; requires notifyOnCompletion.",
      "type": "boolean"
    }
  },
  "required": [
    "command",
    "isAgent",
    "name"
  ],
  "type": "object"
}
```

</details>
<!-- pi-docs:end name="tool-contract-bg_run" -->

Start an ordinary background shell task and return its durable task id immediately.

```json
{"name":"Typecheck","command":"npm run typecheck","isAgent":false}
```

The command runs with local shell permissions and is not sandboxed. `isAgent` distinguishes a plain script from an explicitly launched Pi/LLM child for telemetry; it does not add a model workflow. Completion notification and follow-up delivery are enabled by default. Do not poll `bg_status` or `bg_logs` merely to wait.

Use `surviveReload:true` only with `isAgent:false` for a supported same-process reload. Invalid input fails before task files or spawn.
