import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { BgTaskSnapshot } from '../../src/core/common.js';
import { BackgroundTasksSidebar } from '../../src/ui/background-tasks-sidebar.js';

const theme: Pick<Theme, 'fg'> = { fg: (_color, text) => text };

function task(id: string, status: BgTaskSnapshot['status'], name = id): BgTaskSnapshot {
  return {
    id, status, name, command: 'SECRET_COMMAND', outputPath: '/secret/output',
    cwd: '/secret/cwd', startTime: Date.now(), bytesWritten: 42, isAgent: false,
    surviveReload: false, notified: false, notifyOnCompletion: true,
    triggerOnCompletion: false, model: 'SECRET_MODEL',
  };
}

function setup(tasks: BgTaskSnapshot[]) {
  let renders = 0;
  let overlays = 0;
  let managerOpen = false;
  const tui = {
    showOverlay: () => { overlays++; throw new Error('Native widget must not create an overlay'); },
    requestRender: () => { renders++; },
  };
  const sidebar = new BackgroundTasksSidebar(tui, theme, {
    getTasks: () => tasks,
    isManagerOpen: () => managerOpen,
  });
  return {
    sidebar, renders: () => renders, overlays: () => overlays,
    setManagerOpen: (open: boolean) => { managerOpen = open; },
  };
}

void describe('BackgroundTasksSidebar', () => {
  void it('orders running jobs by start time and preserves elapsed suffixes at the mirrored right edge', (t) => {
    const newer = task('newer', 'running', 'Newer');
    const oldest = task('oldest', 'running', 'Oldest');
    const tied = task('tied', 'running', 'Tied');
    newer.startTime = 59_000;
    oldest.startTime = 1000;
    tied.startTime = 59_000;
    const tasks = [newer, oldest, tied];
    const clock = t.mock.method(Date, 'now', () => 60_000);
    const lines = setup(tasks).sidebar.render(120);
    assert.match(lines[1] ?? '', /Oldest.*\(59s\)  $/);
    assert.match(lines[2] ?? '', /Newer.*\(1s\)  $/);
    assert.match(lines[3] ?? '', /Tied.*\(1s\)  $/);
    assert.equal(visibleWidth(lines[0] ?? ''), 120, 'heading reaches the outer right edge');
    assert.equal(visibleWidth((lines[1] ?? '').trimEnd()), 118, 'item inset mirrors Tasks indentation');
    assert.deepEqual(tasks.map((item) => item.id), ['newer', 'oldest', 'tied']);
    assert.equal(clock.mock.callCount(), 1, 'one consistent clock reading per frame');
  });

  void it('numbers chronological running rows in dim without changing job IDs', (t) => {
    t.mock.method(Date, 'now', () => 60_000);
    const newer = task('real-new-id', 'running', 'Newer');
    const oldest = task('real-old-id', 'running', 'Oldest');
    newer.startTime = 59_000;
    oldest.startTime = 1000;
    const calls: Array<{ color: string; text: string }> = [];
    t.mock.method(theme, 'fg', (color: Parameters<Theme['fg']>[0], text: string) => { calls.push({ color, text }); return text; });
    const tasks = [newer, task('finished', 'completed'), oldest];
    const view = setup(tasks);
    const lines = view.sidebar.render(120);
    assert.match(lines[1] ?? '', /✳ #1 Oldest \(59s\)  $/);
    assert.match(lines[2] ?? '', /✳ #2 Newer \(1s\)  $/);
    assert.ok(calls.some((call) => call.color === 'dim' && call.text === '#1 '));
    assert.deepEqual(tasks.map((job) => job.id), ['real-new-id', 'finished', 'real-old-id']);
    oldest.status = 'completed';
    assert.match(view.sidebar.render(120)[1] ?? '', /✳ #1 Newer \(1s\)  $/);
    view.sidebar.dispose();
  });

  void it('composes Tasks and Jobs with level headings and width-aware narrow fallback', (t) => {
    t.mock.method(Date, 'now', () => 60_000);
    const running = task('run', 'running', 'Job one');
    running.startTime = 48_000;
    const view = setup([running]);
    const widths: number[] = [];
    const taskLines = ['● Tasks', '  Task one', '  Task two', '  Task three'];
    assert.equal(view.sidebar.setTasksWidget(() => ({
      render: (width) => {
        widths.push(width);
        return taskLines.map((line) => truncateToWidth(line, width));
      },
      invalidate() {},
    })), true);
    const wide = view.sidebar.render(120);
    assert.ok(wide[0]?.startsWith('● Tasks'));
    assert.match(wide[0] ?? '', /Background jobs \(1\)$/);
    assert.ok(wide[1]?.startsWith('  Task one'));
    assert.match(wide[1] ?? '', /Job one.*\(12s\)  $/);
    assert.equal(wide.length, 4, 'unequal heights share one native row');
    assert.ok(wide.every((line) => visibleWidth(line) <= 120));
    assert.ok((widths.at(-1) ?? 0) >= 64 && (widths.at(-1) ?? 120) < 120);
    const narrow = view.sidebar.render(80);
    assert.equal(narrow[0], '● Tasks');
    assert.match(narrow[4] ?? '', /Background jobs \(1\)$/);
    assert.ok(narrow.every((line) => visibleWidth(line) <= 80));
    assert.equal(widths.at(-1), 80);
    assert.equal(view.overlays(), 0);
    view.sidebar.dispose();
  });

  void it('keeps Tasks without Jobs and disposes exact hosted components on replacement and shutdown', () => {
    const running = task('run', 'running');
    const view = setup([running]);
    let firstDisposed = 0;
    let secondDisposed = 0;
    assert.equal(view.sidebar.setTasksWidget(() => ({
      render: () => ['● Tasks'], invalidate() {}, dispose: () => { firstDisposed++; },
    })), true);
    running.status = 'completed';
    assert.deepEqual(view.sidebar.render(120), ['● Tasks']);
    running.status = 'running';
    view.setManagerOpen(true);
    assert.deepEqual(view.sidebar.render(120), ['● Tasks'], 'manager hides only Jobs');
    assert.equal(view.sidebar.setTasksWidget(() => ({
      render: () => ['● More tasks'], invalidate() {}, dispose: () => { secondDisposed++; },
    })), true);
    assert.equal(firstDisposed, 1);
    view.sidebar.dispose();
    view.sidebar.dispose();
    assert.equal(secondDisposed, 1);
    let staleFactoryCalled = false;
    assert.equal(view.sidebar.setTasksWidget(() => {
      staleFactoryCalled = true;
      return { render: () => [], invalidate() {} };
    }), false);
    assert.equal(staleFactoryCalled, false);
  });

  void it('renders pi-tasks icon rows with a compact count and no redundant status or hint', (t) => {
    t.mock.method(Date, 'now', () => 0);
    const view = setup([task('run', 'running', 'Native job')]);
    const lines = view.sidebar.render(120);
    assert.equal(lines[0]?.trimStart(), '● Background jobs (1)');
    assert.match(lines[1] ?? '', /✳ #1 Native job \(0ms\)  $/);
    assert.equal(visibleWidth(lines[0] ?? ''), 120);
    assert.equal(visibleWidth((lines[1] ?? '').trimEnd()), 118);
    assert.ok(lines.every((line) => visibleWidth(line) <= 120));
    assert.equal(view.overlays(), 0);
  });

  void it('shows only running jobs and disappears when the last job finishes', () => {
    const running = task('active', 'running', 'Active job');
    const tasks = [task('done', 'completed', 'Finished job'), running];
    const view = setup(tasks);
    let text = view.sidebar.render(36).join('\n');
    assert.match(text, /Active job/);
    assert.doesNotMatch(text, /Finished job/);
    running.status = 'completed';
    assert.deepEqual(view.sidebar.render(120), []);
    tasks.push(task('failed', 'failed'), task('stopped', 'killed'));
    assert.deepEqual(view.sidebar.render(120), [], 'unseen finished notices never keep widget visible');
    assert.deepEqual(setup([]).sidebar.render(120), []);
  });

  void it('limits active rows to five and reports the total and overflow', () => {
    const view = setup(Array.from({ length: 7 }, (_, i) => task(`Run ${i + 1}`, 'running')));
    const lines = view.sidebar.render(36);
    assert.match(lines[0] ?? '', /Background jobs \(7\)/);
    assert.equal(lines.filter((line) => /Run [1-5]/.test(line)).length, 5);
    assert.doesNotMatch(lines.join('\n'), /Run [67]/);
    assert.match(lines.at(-1) ?? '', /… and 2 more/);
  });

  void it('uses available native width, including terminals narrower than 100 columns', () => {
    const view = setup([task('wide', 'running', '界'.repeat(100))]);
    for (const width of [1, 20, 36, 80, 120]) {
      const lines = view.sidebar.render(width);
      assert.ok(lines.length > 0);
      assert.ok(lines.every((line) => visibleWidth(line) <= width));
    }
    assert.match(view.sidebar.render(36)[1] ?? '', /✳ #1 界/);
    assert.match(view.sidebar.render(36)[1] ?? '', /\)  $/);
  });

  void it('sanitizes malicious names and excludes output and telemetry', (t) => {
    t.mock.method(Date, 'now', () => 0);
    const view = setup([task('malicious', 'running', 'safe\u001b[31mRED\u0007\u009b2J')]);
    const text = view.sidebar.render(36).join('\n');
    assert.match(text, /safe.*RED/);
    assert.doesNotMatch(text, /[\u001b\u0007\u009b]/);
    assert.doesNotMatch(text, /SECRET_COMMAND|SECRET_MODEL|\/secret\/|42/);
  });

  for (const scenario of [
    { elapsed: -500, expected: '(0ms)' },
    { elapsed: 999, expected: '(999ms)' },
    { elapsed: 60_000, expected: '(1m)' },
    { elapsed: 3_600_000, expected: '(1h)' },
  ]) {
    void it(`preserves ${scenario.expected} while truncating long job names`, (t) => {
      t.mock.method(Date, 'now', () => 4_000_000);
      const job = task('long', 'running', 'Long name '.repeat(20));
      job.startTime = 4_000_000 - scenario.elapsed;
      const line = setup([job]).sidebar.render(120)[1] ?? '';
      assert.ok(line.trimEnd().endsWith(scenario.expected));
      assert.equal(visibleWidth(line.trimEnd()), 118);
      assert.ok(visibleWidth(line) <= 120);
    });
  }

  void it('animates visible running jobs and stops ticking when idle, hidden, or disposed', async () => {
    const running = task('active', 'running', 'Animated job');
    const view = setup([running]);
    const waitForFrame = () => new Promise((resolve) => setTimeout(resolve, 180));
    try {
      view.sidebar.refresh();
      const first = view.sidebar.render(120);
      await waitForFrame();
      assert.notDeepEqual(view.sidebar.render(120), first, 'running icon advances without task output');
      assert.ok(view.renders() > 1, 'animation requests a native render');

      running.status = 'completed';
      view.sidebar.refresh();
      const idleRenders = view.renders();
      await waitForFrame();
      assert.equal(view.renders(), idleRenders, 'no animation timer remains when idle');
      assert.deepEqual(view.sidebar.render(120), []);

      running.status = 'running';
      view.sidebar.refresh();
      view.setManagerOpen(true);
      view.sidebar.refresh();
      const hiddenRenders = view.renders();
      await waitForFrame();
      assert.equal(view.renders(), hiddenRenders, 'manager hides and stops the animation');

      view.setManagerOpen(false);
      view.sidebar.refresh();
      const restarted = view.sidebar.render(120);
      await waitForFrame();
      assert.notDeepEqual(view.sidebar.render(120), restarted, 'visible activity restarts animation');
      view.sidebar.dispose();
      const disposedRenders = view.renders();
      await waitForFrame();
      assert.equal(view.renders(), disposedRenders, 'disposal clears the animation timer');
    } finally {
      view.sidebar.dispose();
    }
  });

  void it('hides while the manager is open and stops rendering or refreshing after disposal', () => {
    const view = setup([task('run', 'running')]);
    view.setManagerOpen(true);
    assert.deepEqual(view.sidebar.render(120), []);
    view.setManagerOpen(false);
    assert.ok(view.sidebar.render(120).length > 0);
    view.sidebar.refresh();
    assert.equal(view.renders(), 1);
    view.sidebar.dispose();
    view.sidebar.dispose();
    view.sidebar.refresh();
    assert.equal(view.renders(), 1);
    assert.deepEqual(view.sidebar.render(120), []);
  });
});
