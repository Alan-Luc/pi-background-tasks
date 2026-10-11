import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);

function text(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

void describe('docs package integration contract', () => {
  void it('keeps documentation generation and package gates available', () => {
    const packageJson = JSON.parse(text('package.json')) as {
      files: string[];
      scripts: Record<string, string>;
      pi?: { image?: string; extensions?: string[] };
    };
    assert.equal(packageJson.files.includes('docs/'), true);
    assert.equal(packageJson.files.includes('BACKGROUND-TASKS-INSTRUCTIONS.md'), true);
    assert.equal(packageJson.files.includes('README.md'), true);
    assert.equal(packageJson.files.includes('LICENSE'), true);
    assert.deepEqual(packageJson.pi?.extensions, ['./dist/extensions/background-tasks.js']);
    assert.match(packageJson.pi?.image ?? '', /Alan-Luc\/pi-background-tasks/u);
    assert.equal(packageJson.scripts['docs:generate'], 'node scripts/docs/generate.mjs');
    assert.equal(packageJson.scripts['docs:verify'], 'node scripts/docs/verify.mjs');
    assert.equal(packageJson.scripts['test:docs'], 'tsx --test tests/unit/docs-gate.test.ts tests/package/docs-contract.test.ts');
    assert.equal(packageJson.scripts['payload:check'], 'npm run build:runtime && node scripts/check-package-payload.mjs');
    assert.match(packageJson.scripts['prepack'] ?? '', /build:runtime/);
    assert.match(packageJson.scripts['prepack'] ?? '', /docs:verify/);
    assert.match(packageJson.scripts['prepack'] ?? '', /check-package-payload/);
    for (const path of [
      'docs/INDEX.md',
      'docs/read-before-edit.md',
      'docs/manifest.json',
      'docs/attestations.json',
      'docs/subsystems/docs-freshness-gate.md',
    ]) {
      assert.equal(existsSync(new URL(path, root)), true, `${path} must exist`);
    }
  });

  void it('documents only the retained process surfaces in authored entry docs', () => {
    const inventory = [
      text('README.md'),
      text('BACKGROUND-TASKS-INSTRUCTIONS.md'),
      text('docs/getting-started.md'),
      text('docs/choose-a-workflow.md'),
      text('docs/operations/configuration.md'),
    ].join('\n');
    for (const retained of ['/bg', '/tasks', '/bg-tasks', '/bg-clear', '/jobs', '/logs', '/kill', 'bg_run', 'bg_status', 'bg_logs', 'bg_kill']) {
      assert.match(inventory, new RegExp(retained.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
    }
    for (const removed of ['PI_BG_FEATURES', '/bg-update', 'bg_delegate', 'bg_result', 'fusion_reason', 'bg_run_pi_attested', 'claude-cache']) {
      assert.doesNotMatch(inventory, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
    }
  });
});
