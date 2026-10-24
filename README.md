<div align="center">
  <img src="logo.png" alt="pi-background-tasks logo" width="144" height="144">

# pi-background-tasks

**Run durable background shell tasks without blocking Pi.**

[![Pi extension](https://img.shields.io/badge/Pi-extension-19c7d4)](https://github.com/earendil-works/pi-coding-agent)
[![Node](https://img.shields.io/badge/node-%3E%3D22.19-1f8f4d)](package.json)
[![License](https://img.shields.io/badge/license-ISC-f5a623)](LICENSE)

</div>

This personal fork keeps the process runtime only:

- run named shell commands in the background;
- inspect bounded status and logs;
- stop tasks and clean up process trees safely;
- receive durable completion notifications through Pi's EventBus;
- see a compact native running-job widget, with task manager commands and shortcuts.

This is a personal fork of [Ismail's pi-background-tasks](https://github.com/ismailsaleekh/pi-background-tasks). The upstream author and ISC license are preserved. The package is private and is not published to npm; incorporate upstream fixes manually through the `upstream` Git remote.

## Install locally

```bash
pi install .
pi install . -l
```

## Commands

- `/bg` starts a tracked shell command.
- `/jobs` lists tasks.
- `/logs <task-id> [max-bytes]` reads bounded output.
- `/kill <task-id>` stops a task.
- `/tasks` and `/bg-tasks` open the task manager.
- `/bg-clear` clears finished-task notices.

Running jobs appear in a compact, right-aligned widget above the editor, using the same native layout as other Pi widgets. It disappears when no jobs are running; completed history remains in `/tasks`. There is no progress feed, floating overlay, or background-task footer badge.

The default dock shortcut is **Shift↓**. `PI_BG_DOCK_SHORTCUT=ctrl+alt+b` selects the alternate shortcut, and `PI_BG_DOCK_SHORTCUT=off` disables the shortcut while retaining the commands. Shell selection and output limits are documented in [Configuration](docs/operations/configuration.md).

## Agent tool

`bg_run` starts an ordinary shell task and returns its task id immediately. Completion notification is the normal wake-up path; `bg_status` and `bg_logs` are point-in-time inspection tools, not polling primitives. Use `bg_kill` to stop a running task.

## Development checks

```bash
npm ci
npm run build:runtime
npm run typecheck
npm run test:package
npm run docs:verify
npm run payload:check
```

See [Testing](docs/operations/testing.md), [Releasing](docs/operations/releasing.md), and the [maintainer gateway](BACKGROUND-TASKS-INSTRUCTIONS.md).
