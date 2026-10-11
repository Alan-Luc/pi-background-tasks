---
doc_id: subsystems/child-launch-durability-and-safety
audience: maintainer
mode: authored
review_policy: behavioral
stability: evolving
covers_surfaces: []
covers_sources: [src/core/durable-fs.ts, src/core/pi-launch.ts, src/core/task-durable.ts]
---
# Durability and safety

Durable task metadata uses exclusive temporary files, fsync/close ordering, atomic rename, and loud primary-error precedence. Cleanup never hides the original failure.

Terminal state is published only after the metadata needed by the process runtime is durable. Ordinary streaming output is ended and drained before terminal metadata; bounded model-visible reads do not replace or truncate the full local output.

The process runtime validates paths, shell policy, task identity, timeout, output caps, and ownership before spawn. Process-tree termination and cleanup are explicit failure paths, including platform-specific Windows handling.
