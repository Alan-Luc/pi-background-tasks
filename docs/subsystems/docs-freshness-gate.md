---
doc_id: subsystems/docs-freshness-gate
audience: maintainer
mode: mixed
review_policy: contract
stability: stable
covers_surfaces: []
covers_sources: []
---
# Docs freshness gate

Documentation facts are extracted from package metadata and the retained process TypeScript registrations. Unsupported syntax fails the gate rather than falling back to stale hand-maintained inventories. Public registrations, dock variants, links, ownership, and package payloads are checked deterministically.

Generated navigation, README facts, runtime contracts, and manifest bytes are owned by `scripts/docs/generate.mjs`. Run `npm run docs:generate` after the runtime source slice is stable, then run `npm run docs:verify` to confirm that committed bytes match two in-memory renders.

There is no feature-selection parser or advanced workflow inventory in this fork.

<!-- pi-docs:begin name="docs-freshness-gate" generator="scripts/docs/generate.mjs" -->
- Canonical package version: `2.6.9`
- Governed markdown docs: 26
- Public surfaces extracted: 16
- Public surfaces available by default: 15
- Finite dock shortcut values: `shift+down`, `ctrl+alt+b`, `off`
- Governed production sources: 15
- Tool contracts extracted: 4
- Schema IDs extracted: 5
- Environment variable references extracted: 14
- Behavioral attestation receipts not passing: 4
- Receipt store: `docs/attestations.json`

`npm run docs:verify` is read-only: it renders generated files twice in memory and compares them with committed bytes. `npm run docs:generate` is the only docs writer.
<!-- pi-docs:end name="docs-freshness-gate" -->
