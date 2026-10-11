---
doc_id: api/eventbus-v1
audience: maintainer
mode: mixed
review_policy: behavioral
stability: evolving
covers_surfaces: [eventbus:background-task-v1]
covers_sources: [src/core/extension-api.ts]
---
# EventBus v1

<!-- pi-docs:begin name="eventbus-contract" generator="scripts/docs/generate.mjs" -->
Availability: `always`; available by default: **yes**.

| Channel purpose | Channel | Schema |
| --- | --- | --- |
| Request | `pi-background-tasks:request:v1` | `pi-background-tasks.extension-request.v1` |
| Response | `pi-background-tasks:response:v1` | `pi-background-tasks.extension-response.v1` |
| Terminal | `pi-background-tasks:terminal:v1` | `pi-background-tasks.extension-terminal.v1` |

Operations: `capabilities`, `kill`, `logs`, `run`, `status`.


```json
{
  "api_version": 1,
  "kill": true,
  "logs": true,
  "logs_bounded": true,
  "run": true,
  "run_completion_trigger": true,
  "run_is_agent": true,
  "status": true
}
```
<!-- pi-docs:end name="eventbus-contract" -->

The process extension exposes a versioned EventBus request/response/terminal service for host integrations. Frames are closed schemas with explicit operation, request id, task id, and terminal-state validation.

Requests received before the service is open, after shutdown, with duplicate ids, unknown operations, or malformed fields fail loudly. A request accepted before shutdown may receive one error response, but no post-close success is emitted. Requests first emitted after close are not handled and receive no service response.

Terminal publication follows durable metadata publication. A listener failure is surfaced and may cause a retry; consumers deduplicate by task id. The service never reports success before the owned process and metadata have reached a terminal state.
