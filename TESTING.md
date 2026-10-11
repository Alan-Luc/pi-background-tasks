# pi-background-tasks testing

This private fork tests the durable process runtime only. Use task-owned temporary project, agent, session, HOME, npm cache, and config roots; never use the user's Pi state.

## Default checks

```bash
npm run typecheck
npm run test:type-safety
npm run test:unit
npm run test:sdk
npm run test:rpc
npm run test:component
npm run test:package
npm run test:agent-loop
```

Focused package/docs checks:

```bash
npm run build:runtime
npm run test:docs
npm run docs:verify
npm run payload:check
npm run pack:dry-run
```

The process checks cover shell execution, completion notification, EventBus publication, bounded status/log reads, kill, timeout, output limits, cleanup, reload ownership, dock/commands, telemetry, and invalid shell/configuration input. Package checks retain TypeScript safety, file-URL path safety, host-peer posture, payload closure, and deterministic docs verification.

Do not run live inference, use paid model routes, or point tests at `~/.pi/agent`. Windows-native checks are reported honestly when the host is not Windows.
