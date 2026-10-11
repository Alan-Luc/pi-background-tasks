---
doc_id: operations/troubleshooting
audience: maintainer
mode: authored
review_policy: contract
stability: stable
covers_surfaces: []
covers_sources: []
---
# Troubleshooting

## The extension does not load

Check the Pi host peer versions and run `npm run build:runtime`. Invalid shell or dock settings fail loudly with `pi_bg_config_invalid`; correct the value rather than relying on a fallback.

## A task is missing

Use the exact task id or an unambiguous prefix. `/jobs` lists retained tasks. The runtime does not adopt arbitrary metadata or process ids.

## A command failed

Read the bounded output with `/logs <task-id>`. Spawn, timeout, output-cap, kill, metadata, and completion-publication failures remain explicit in task status and diagnostics.

## Completion did not wake Pi

`/bg` is display-only by design. `bg_run` uses completion notification and follow-up delivery unless its notification or trigger options were explicitly disabled. Do not add a polling loop as a workaround; inspect the terminal notification and task logs instead.

## Package checks fail

Run `npm ci`, then `npm run build:runtime`, `npm run docs:verify`, and `npm run payload:check` in an isolated environment. The fork is private and has no automatic npm update check.
