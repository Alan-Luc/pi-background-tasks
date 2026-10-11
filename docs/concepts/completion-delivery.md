---
doc_id: concepts/completion-delivery
audience: agent
mode: authored
review_policy: behavioral
stability: stable
covers_surfaces: [renderer:background-task-notification]
covers_sources: []
---
# Completion delivery

A background task publishes terminal state only after its durable metadata is ready. The extension then emits one completion notification through the retained EventBus/UI path.

`/bg` uses notification-only display behavior. `bg_run` enables notification plus a follow-up wake by default. Callers may explicitly disable either behavior, but a caller must not add a status/log polling loop merely to wait.

Publication failures remain visible and retryable; they are not converted into successful task completion. Consumers should deduplicate a terminal task id if the host retries an event after a listener failure.
