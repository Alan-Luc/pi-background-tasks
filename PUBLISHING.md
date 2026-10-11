# Package maintenance

This is a private personal fork. Do not publish it to npm, create release tags, or push changes from maintenance runs.

The package version remains in `package.json`; the lockfile root version must match it. Use isolated local checks only:

```bash
npm run build:runtime
npm run typecheck
npm run test:type-safety
npm run test:package
npm run test:docs
npm run docs:verify
npm run payload:check
npm run pack:dry-run
```

`npm pack --dry-run --json --ignore-scripts` is the payload source of truth. It must include the compiled process entrypoint, authoritative `src/` and `extensions/`, retained docs, `LICENSE`, `logo.png`, and no tests, scripts, local artifacts, or private Pi host copies.

The upstream author and ISC license are retained. Upstream integration is manual; there is no automatic npm version check.
