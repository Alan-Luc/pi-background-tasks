---
doc_id: choose-a-workflow
audience: user
mode: authored
review_policy: contract
stability: stable
covers_surfaces: []
covers_sources: []
---
# Choose a workflow

1. Use foreground Pi work when the next response depends on immediate output.
2. Use `/bg` for a long command you start manually.
3. Use `bg_run` when Pi starts a long shell command and should continue after the launch.
4. Use `/jobs`, `bg_status`, or bounded `bg_logs` for deliberate inspection.
5. Use `/kill` or `bg_kill` when the process should stop.

Background tasks are ordinary local shell commands. They use the selected shell, cwd, environment, network, credentials, and filesystem permissions of the Pi process; the extension tracks and terminates them but does not sandbox them.

Completion notifications are the normal waiting path. Do not poll status or logs merely to wait for a task to finish.
