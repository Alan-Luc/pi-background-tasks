# pi-background-tasks test plan

The acceptance surface is the process runtime and its package gates.

## Public contract

| Surface | Contract |
|---|---|
| `bg_run` | Starts a validated shell task and returns immediately with durable task coordinates. |
| `bg_status` | Returns point-in-time status for exact or unambiguous task ids. |
| `bg_logs` | Reads bounded task output and preserves the full local output path. |
| `bg_kill` | Stops a running task or fails loudly for an unknown/finished task. |
| `/bg`, `/jobs`, `/logs`, `/kill` | User-facing shell-task controls. |
| `/tasks`, `/bg-tasks`, `/bg-clear` | Task manager and finished-notice controls. |
| Dock and notifications | Retain the selected dock shortcut, footer state, completion renderer, EventBus terminal delivery, and clear fallback. |

## Required gates

| Gate | Command |
|---|---|
| Runtime build | `npm run build:runtime` |
| Typecheck | `npm run typecheck` |
| Type safety | `npm run test:type-safety` |
| Unit, SDK, RPC, component | `npm run test:unit`, `npm run test:sdk`, `npm run test:rpc`, `npm run test:component` |
| Package | `npm run test:package` |
| Scripted process loop | `npm run test:agent-loop` |
| PTY and Windows qualification | `npm run test:pty`, `npm run test:windows` |
| Docs | `npm run test:docs`, `npm run docs:verify` |
| Payload/package | `npm run payload:check`, `npm run pack:dry-run`, `npm run test:pnpm-pack` |

## Safety acceptance

Shell commands are not sandboxed, so tests verify cwd, shell policy, process-group/tree termination, timeouts, output caps, and loud spawn failures. Durable metadata and completion publication happen in order. Completion notification is event-driven; tests must not require a status/log polling loop. Invalid dock or shell settings fail without fallback. No feature-selection variable or automatic npm check is part of the contract.
