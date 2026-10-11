#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DocsGateError,
  assertCoverage,
  buildCodeFacts,
  extractGeneratedRegions,
  loadDocsModel,
  parseFrontmatter,
  verifyLinksAndReachability,
} from './lib.mjs';

function mustThrow(name, fn, pattern) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof Error, name);
    assert.match(error.message, pattern, name);
    return;
  }
  assert.fail(`${name} did not throw`);
}

const codeFacts = buildCodeFacts();
const docsModel = loadDocsModel();
const surfaceIds = new Set(codeFacts.public_surface_ids);
const envNames = new Set(codeFacts.environment_variables.map((entry) => entry.name));

assert.ok(docsModel.docs.length > 0, 'documentation inventory must not be empty');
assert.ok(surfaceIds.has('tool:bg_run'));
assert.ok(surfaceIds.has('tool:bg_status'));
assert.ok(surfaceIds.has('tool:bg_logs'));
assert.ok(surfaceIds.has('tool:bg_kill'));
assert.ok(surfaceIds.has('command:bg'));
assert.ok(![...surfaceIds].some((id) => /delegate|fusion|attest|attribution|workflow/iu.test(id)));
assert.equal(envNames.has('PI_BG_FEATURES'), false);
assert.ok(envNames.has('PI_BG_DOCK_SHORTCUT'));
assert.ok(envNames.has('PI_BG_POSIX_SHELL'));
assert.ok(envNames.has('PI_BG_MAX_OUTPUT_BYTES'));
assertCoverage(codeFacts, docsModel);

const index = docsModel.docs.find((doc) => doc.doc_id === 'INDEX');
const readBeforeEdit = docsModel.docs.find((doc) => doc.doc_id === 'read-before-edit');
assert.equal(index?.frontmatter.covers_surfaces.length, 0);
assert.equal(readBeforeEdit?.frontmatter.covers_sources.length, 0);

mustThrow('malformed frontmatter', () => parseFrontmatter('doc_id INDEX.md', 'fixture.md'), /malformed frontmatter/);
mustThrow('unknown public surface', () => assertCoverage(codeFacts, {
  docs: [{ rel: 'docs/x.md', doc_id: 'x', frontmatter: { covers_surfaces: ['tool:not_real'], covers_sources: [] } }],
}), /unknown public surface/);
mustThrow('new uncovered source', () => assertCoverage({
  ...codeFacts,
  governed_sources: [...codeFacts.governed_sources, 'src/new-source.ts'],
}, docsModel), /src\/new-source\.ts has no primary doc/);
mustThrow('broken generated markers', () => extractGeneratedRegions({
  docs: [{ rel: 'docs/x.md', doc_id: 'x', text: '<!-- pi-docs:begin name="a" generator="scripts/docs/generate.mjs" -->\n<!-- pi-docs:begin name="b" generator="scripts/docs/generate.mjs" -->\n<!-- pi-docs:end name="b" -->\n<!-- pi-docs:end name="a" -->' }],
}), /nested/);
mustThrow('broken link', () => verifyLinksAndReachability(process.cwd(), {
  docs: [{
    rel: 'docs/INDEX.md',
    doc_id: 'INDEX',
    body: '# Hi\n[bad](./missing.md)',
    text: '---\n---\n# Hi\n[bad](./missing.md)',
    frontmatter: { covers_surfaces: [], covers_sources: [] },
  }],
}), /broken link/);

const root = fileURLToPath(new URL('../..', import.meta.url));
const verify = spawnSync(process.execPath, ['scripts/docs/verify.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1', PI_TELEMETRY: '0' },
});
assert.equal(verify.status, 0, `${verify.stdout}${verify.stderr}`);
console.log('docs-selftest: process-only mutation fixtures passed');
