---
doc_id: operations/configuration
audience: maintainer
mode: authored
review_policy: contract
stability: stable
covers_surfaces: []
covers_sources: []
---
# Configuration

The process runtime has no capability-selection flag. It always registers the retained process tools, commands, UI, notifications, and EventBus service.

## Dock shortcut

`PI_BG_DOCK_SHORTCUT` selects one dock shortcut: `shift+down` (default), `ctrl+alt+b`, or `off`. Invalid, blank, differently cased, or whitespace-bearing values fail extension load with `pi_bg_config_invalid`; they do not restore a default. With `off`, `/tasks` and `/bg-tasks` remain available. `Ctrl+Alt+C` remains the terminal-dependent clear fallback for `/bg-clear`.

## Shell selection

On POSIX, `PI_BG_POSIX_SHELL=inherit` preserves the non-empty `SHELL` value or `/bin/sh`. `bash` and `sh` select the corresponding shell and use `-c`; `PI_BG_POSIX_SHELL_PATH` may provide a validated absolute executable path. On Windows, `PI_BG_SHELL` selects `cmd` or `bash`, with an optional absolute `PI_BG_SHELL_PATH`. Invalid explicit settings fail without search fallback.

The selected shell policy is resolved once per activation and is reused by the agent guidance and process spawns. Reload resolves a new policy.

## Limits and telemetry

- `PI_BG_MAX_OUTPUT_BYTES` sets the task output cap; exceeding it fails the task rather than claiming success.
- `bg_logs.maxBytes` and `/logs <id> [maxBytes]` are bounded reads.
- `PI_BG_DISABLE_PI_TELEMETRY=1` disables optional telemetry wrapping for explicitly marked Pi-agent shell tasks.
- `PI_OFFLINE=1`, `PI_SKIP_VERSION_CHECK=1`, and `PI_TELEMETRY=0` are recommended for isolated checks.

There is no automatic npm version lookup and no updater command in this fork.
