import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';
import { Compile } from 'typebox/compile';
import { parseJsonText } from '../../src/core/common.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const REMOVED_TYPEBOX_APIS = [
  'Type.Base',
  'Type.Awaited',
  'Type.Promise',
  'Type.AsyncIterator',
  'Type.Iterator',
  'Type.Options',
  'Value.Mutate',
] as const;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.tsx?$/u.test(entry.name)) files.push(path);
  }
  return files;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

void describe('TypeBox compatibility', () => {
  void it('keeps TypeBox and Pi SDK packages host-provided', async (t: TestContext) => {
    const typeboxPackageJson = join(packageRoot, 'node_modules/typebox/package.json');
    if (!existsSync(typeboxPackageJson)) {
      t.skip('local node_modules/typebox is unavailable in this isolated worktree');
      return;
    }
    const installed = parseJsonText(await readFile(typeboxPackageJson, 'utf8'));
    assert.ok(isRecord(installed));
    assert.match(String(installed['version']), /^1\.3\./u);

    const manifest = parseJsonText(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    assert.ok(isRecord(manifest));
    const peers = manifest['peerDependencies'];
    assert.ok(isRecord(peers));
    assert.equal(peers['typebox'], '*');
    assert.equal(peers['@earendil-works/pi-ai'], undefined);
    assert.equal(manifest['dependencies'], undefined);
    assert.equal(manifest['bundledDependencies'], undefined);
  });

  void it('uses no TypeBox API removed by the Pi 0.83/0.84 bundled version', async () => {
    const violations: string[] = [];
    for (const directory of ['src', 'extensions', 'scripts', 'tests']) {
      for (const file of await sourceFiles(join(packageRoot, directory))) {
        const source = await readFile(file, 'utf8');
        for (const api of REMOVED_TYPEBOX_APIS) {
          if (new RegExp(`\\b${api.replace('.', '\\.')}\\s*\\(`, 'u').test(source)) {
            violations.push(`${file} uses removed TypeBox API ${api}`);
          }
        }
      }
    }
    assert.deepEqual(violations, []);
  });

  void it('compiles a retained process tool shape under TypeBox 1.3', () => {
    const schema = Compile(
      Type.Object(
        { name: Type.String(), command: Type.String(), isAgent: Type.Boolean() },
        { additionalProperties: false },
      ),
    );
    assert.equal(schema.Check({ name: 'build', command: 'npm run build', isAgent: false }), true);
    assert.equal(schema.Check({ name: 'build', command: 'npm run build' }), false);
    assert.equal(
      schema.Check({ name: 'build', command: 'npm run build', isAgent: false, unknown: true }),
      false,
    );
  });

  void it('keeps nullable and optional TypeBox shapes valid', () => {
    const Nullable = Type.Object(
      {
        taskId: Type.Union([Type.String(), Type.Null()]),
        entries: Type.Union([Type.Array(Type.String()), Type.Null()]),
        counts: Type.Array(Type.Object({ name: Type.String(), calls: Type.Number() })),
      },
      { additionalProperties: false },
    );
    const compiled = Compile(Nullable);
    assert.equal(compiled.Check({ taskId: null, entries: null, counts: [] }), true);
    assert.equal(compiled.Check({ taskId: 'a', entries: ['x'], counts: [] }), true);
    assert.equal(compiled.Check({ taskId: null, entries: [1], counts: [] }), false);
    type NullableValue = Static<typeof Nullable>;
    const typed: NullableValue = { taskId: null, entries: ['x'], counts: [] };
    assert.deepEqual(typed.entries, ['x']);

    const Optional = Type.Object({ taskId: Type.Optional(Type.String()) });
    assert.equal(Value.Check(Optional, {}), true);
    assert.equal(Value.Check(Optional, { taskId: 5 }), false);
  });
});
