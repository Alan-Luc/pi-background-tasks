import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth, type Component, type OverlayOptions } from '@earendil-works/pi-tui';
import type { BgTaskSnapshot } from '../../src/core/common.js';
import { BackgroundTasksSidebar } from '../../src/ui/background-tasks-sidebar.js';

const theme: Pick<Theme, 'fg'> = { fg: (_color, text) => text };
function task(id: string, status: BgTaskSnapshot['status'], name = id): BgTaskSnapshot {
  return { id, status, name, command: 'SECRET_COMMAND', outputPath: '/secret/output', cwd: '/secret/cwd', startTime: 0, bytesWritten: 42, isAgent: true, surviveReload: false, notified: false, notifyOnCompletion: true, triggerOnCompletion: true, contextUsage: { tokens: 123, contextWindow: 1000, percent: 12 }, tokenUsage: { input: 456, output: 789, cacheRead: 0, cacheWrite: 0, totalTokens: 1245 }, toolUsage: { total: 3, failed: 0, byName: {} }, model: 'SECRET_MODEL' };
}
function setup(tasks: BgTaskSnapshot[], seen: ReadonlySet<string> = new Set(), isManagerOpen = false) {
  let panel: Component | undefined;
  let overlayOptions: OverlayOptions | undefined;
  let hidden = 0;
  let renders = 0;
  const sidebar = new BackgroundTasksSidebar({
    showOverlay: (component, options) => { panel = component; overlayOptions = options; return { hide: () => { hidden++; }, setHidden() {}, isHidden: () => false, focus() {}, unfocus() {}, isFocused: () => false }; },
    requestRender: () => { renders++; },
  }, theme, { getTasks: () => tasks, isSeen: (id) => seen.has(id), isManagerOpen: () => isManagerOpen });
  return { sidebar, panel: () => panel, options: () => overlayOptions, hidden: () => hidden, renders: () => renders };
}

describe('BackgroundTasksSidebar', () => {
  it('renders explicit idle state and running rows before unseen finished rows', () => {
    const idle = setup([]);
    assert.deepEqual(idle.panel()?.render(36), ['Background jobs', '0 running', 'No jobs running', '/tasks']);

    const view = setup([
      task('finished-first', 'completed', 'Finished row'),
      task('run', 'running', 'Running row'),
      task('failed', 'failed', 'Failed row'),
      task('stopped', 'killed', 'Stopped row'),
    ]);
    const lines = view.panel()?.render(36) ?? [];
    const runningIndex = lines.findIndex((line) => line.includes('Running row'));
    const doneIndex = lines.findIndex((line) => line.includes('Finished row'));
    const failedIndex = lines.findIndex((line) => line.includes('Failed row'));
    const stoppedIndex = lines.findIndex((line) => line.includes('Stopped row'));
    assert.match(lines[1] ?? '', /^1 running$/);
    assert.ok(runningIndex >= 0 && runningIndex < doneIndex && doneIndex < failedIndex && failedIndex < stoppedIndex);
    assert.match(lines[runningIndex] ?? '', /running$/);
    assert.match(lines[doneIndex] ?? '', /done$/);
    assert.match(lines[failedIndex] ?? '', /failed$/);
    assert.match(lines[stoppedIndex] ?? '', /stopped$/);
  });

  it('omits seen finished tasks but never omits running tasks marked seen', () => {
    const view = setup([task('active', 'running', 'Active seen'), task('complete', 'completed', 'Finished seen')], new Set(['active', 'complete']));
    const lines = view.panel()?.render(36) ?? [];
    assert.ok(lines.some((line) => line.includes('Active seen')));
    assert.ok(!lines.some((line) => line.includes('Finished seen')));
  });

  it('limits rows to five and reports truthful overflow and running count', () => {
    const view = setup([
      task('r1', 'running', 'Run one'), task('r2', 'running', 'Run two'),
      task('f1', 'completed', 'Done one'), task('f2', 'failed', 'Fail two'),
      task('f3', 'killed', 'Stop three'), task('f4', 'completed', 'Done four'),
    ]);
    const lines = view.panel()?.render(36) ?? [];
    assert.equal(['Run one', 'Run two', 'Done one', 'Fail two', 'Stop three'].filter((name) => lines.some((line) => line.includes(name))).length, 5);
    assert.match(lines[1] ?? '', /^2 running$/);
    assert.match(lines.at(-1) ?? '', /^\+1 more · \/tasks$/);
    assert.ok(!lines.some((line) => line.includes('Done four')));
  });

  it('bounds long and wide names, preserves status, and excludes task details and telemetry', () => {
    const view = setup([
      task('long', 'running', 'A'.repeat(100)),
      task('wide', 'failed', '界'.repeat(100)),
    ]);
    const lines = view.panel()?.render(36) ?? [];
    const longRow = lines.find((line) => line.startsWith('AAA')) ?? '';
    const wideRow = lines.find((line) => line.endsWith('failed')) ?? '';
    assert.ok(lines.every((line) => visibleWidth(line) <= 36));
    assert.ok([...wideRow].filter((character) => character === '界').length * 2 + 7 <= 36);
    assert.match(longRow, /running$/);
    assert.match(wideRow, /failed$/);
    const output = lines.join('\n');
    for (const privateValue of ['SECRET_COMMAND', 'SECRET_MODEL', '/secret/output', '/secret/cwd', '123', '456', '789', '42']) {
      assert.ok(!output.includes(privateValue));
    }
  });

  it('sanitizes malicious control and ANSI names before rendering', () => {
    const view = setup([task('hostile', 'running', 'safe\u001b[31mRED\u0007\u009b2J')]);
    const lines = view.panel()?.render(36) ?? [];
    assert.ok(lines.some((line) => line.includes('safe') && line.includes('RED')));
    assert.ok(!lines.join('').includes('\u001b'));
    assert.ok(!lines.join('').includes('\u0007'));
    assert.ok(!lines.join('').includes('\u009b'));
  });

  it('mounts as a passive top-right overlay with responsive visibility thresholds', () => {
    const view = setup([]);
    const options = view.options();
    assert.equal(options?.width, 36);
    assert.equal(options?.anchor, 'top-right');
    assert.equal(options?.nonCapturing, true);
    assert.deepEqual(options?.margin, { top: 1, right: 1 });
    assert.deepEqual(view.sidebar.render(36), []);
    assert.equal(options?.visible?.(100, 20), true);
    assert.equal(options?.visible?.(99, 20), false);
    assert.equal(options?.visible?.(100, 19), false);
    // Manager state is supplied by the owner and controls overlay visibility.
    const managerView = setup([], new Set(), true);
    assert.equal(managerView.options()?.visible?.(120, 40), false);
  });

  it('refreshes until disposal, then hides its owned overlay exactly once', () => {
    const view = setup([]);
    view.sidebar.refresh();
    assert.equal(view.renders(), 1);
    view.sidebar.dispose();
    view.sidebar.dispose();
    view.sidebar.refresh();
    assert.equal(view.hidden(), 1);
    assert.equal(view.renders(), 1);
  });
});
