---
doc_id: getting-started
audience: user
mode: authored
review_policy: contract
stability: stable
covers_surfaces: []
covers_sources: []
---
# Getting started

Install the private checkout locally:

```bash
pi install .
```

Start a tracked shell command:

```text
/bg --name "Docs build" npm run docs:verify
```

Use `/jobs` to list tasks, `/logs <task-id> 20000` for bounded output, and `/kill <task-id>` to stop a running task. `/tasks` and `/bg-tasks` open the task manager. `/bg-clear` clears finished-task notices.

The default dock shortcut is **Shift↓**. Set `PI_BG_DOCK_SHORTCUT=ctrl+alt+b` to select the alternate shortcut or `PI_BG_DOCK_SHORTCUT=off` to use commands only. Shell policy and output limits are documented in [Configuration](operations/configuration.md).

## SDK hosts

Normal Pi modes initialize the extension lifecycle. SDK hosts must bind the extension with a counted binding and repeat that binding after reload so `session_start` and shutdown ownership are delivered. This is a host lifecycle requirement; the package does not add a fallback.

## Next links

- [Choose a workflow](choose-a-workflow.md)
- [Configuration](operations/configuration.md)
- [README](../README.md)
