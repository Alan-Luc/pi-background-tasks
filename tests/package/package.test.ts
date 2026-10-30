import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { findFileUrlPathnameViolations } from '../helpers/typescript-source-guards.js';

const root = resolve(import.meta.dirname, '../..');

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(?:ts|tsx|mjs|js)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

void describe('package', () => {
  void it('ships the work-status capability in the compiled runtime', () => {
    const result = spawnSync('node', ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const { BG_EXTENSION_CAPABILITIES } = await import('./dist/src/core/extension-api.js');
      assert.equal(BG_EXTENSION_CAPABILITIES.work_status, true);
    `], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  void it('describes the private process-only fork', async () => {
    const manifest = record(
      JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as unknown,
      'package.json',
    );
    assert.equal(manifest['name'], 'pi-background-tasks');
    assert.equal(manifest['private'], true);
    assert.match(String(manifest['description']), /background shell tasks/u);
    assert.equal(manifest['publishConfig'], undefined);

    const pi = record(manifest['pi'], 'package.json.pi');
    assert.deepEqual(pi['extensions'], ['./dist/extensions/background-tasks.js']);
    assert.match(String(pi['image']), /Alan-Luc\/pi-background-tasks\/main\/logo\.png/u);

    const keywords = manifest['keywords'];
    assert.ok(Array.isArray(keywords));
    for (const removed of ['delegate', 'attestation', 'fusion', 'multi-model']) {
      assert.equal(keywords.includes(removed), false, `removed keyword ${removed}`);
    }

    const dependencies = manifest['dependencies'];
    assert.equal(dependencies, undefined);
    const devDependencies = record(manifest['devDependencies'], 'devDependencies');
    assert.equal(devDependencies['@types/turndown'], undefined);
    assert.equal(devDependencies['turndown'], undefined);

    const scripts = record(manifest['scripts'], 'scripts');
    for (const removed of [
      'smoke:large-context',
      'test:hook-contract',
      'docs:attest/record',
    ]) {
      assert.equal(scripts[removed], undefined, `removed script ${removed}`);
    }
    for (const required of [
      'build:runtime',
      'typecheck',
      'test:type-safety',
      'test:package',
      'test:compat',
      'test:agent-loop',
      'smoke',
      'docs:verify',
      'payload:check',
      'pack:dry-run',
      'prepack',
    ]) {
      assert.equal(typeof scripts[required], 'string', `missing script ${required}`);
    }

    const files = manifest['files'];
    assert.ok(Array.isArray(files));
    for (const required of ['dist/', 'extensions/', 'src/', 'docs/', 'LICENSE']) {
      assert.equal(files.includes(required), true, `missing package file ${required}`);
    }
    assert.equal(files.includes('THIRD_PARTY_NOTICES.md'), false);
    assert.equal(existsSync(join(root, 'THIRD_PARTY_NOTICES.md')), false);
  });

  void it('keeps Pi host packages as peers without private runtime copies', async () => {
    const manifest = record(
      JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as unknown,
      'package.json',
    );
    const peers = record(manifest['peerDependencies'], 'peerDependencies');
    assert.equal(peers['@earendil-works/pi-ai'], undefined);
    assert.equal(peers['typebox'], '*');
    assert.equal(typeof peers['@earendil-works/pi-coding-agent'], 'string');
    assert.equal(typeof peers['@earendil-works/pi-tui'], 'string');
    assert.equal(manifest['dependencies'], undefined);
    assert.equal(manifest['bundledDependencies'], undefined);
  });

  void it('rejects file URL pathname misuse in package-owned source', async () => {
    const roots = ['src', 'extensions', 'scripts', 'tests'];
    const violations: string[] = [];
    for (const directory of roots) {
      for (const path of await sourceFiles(join(root, directory))) {
        const source = await readFile(path, 'utf8');
        for (const violation of findFileUrlPathnameViolations(path, source)) {
          violations.push(`${relative(root, path)}:${String(violation.line)} ${violation.text}`);
        }
      }
    }
    assert.deepEqual(violations, []);
  });
});
