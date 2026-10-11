---
doc_id: operations/releasing
audience: maintainer
mode: authored
review_policy: contract
stability: evolving
covers_surfaces: []
covers_sources: []
---
# Releasing operations

This personal fork is private. Do not publish, tag, push, or install it into user Pi state from a maintenance run.

For a local candidate, run:

```bash
npm run build:runtime
npm run typecheck
npm run test:package
npm run test:docs
npm run docs:verify
npm run payload:check
npm run pack:dry-run
```

`package.json` is the version source and `package-lock.json` must match it. The payload must contain the compiled process entrypoint, authoritative `src/` and `extensions/`, retained docs, `LICENSE`, and `logo.png`; it must not contain tests, scripts, local artifacts, or private Pi host copies.

The upstream author and ISC license remain unchanged. Upstream updates are manual integration; no automatic npm version check exists.
