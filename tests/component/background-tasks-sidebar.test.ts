import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';
import type { BgTaskSnapshot } from '../../src/core/common.js';
import { BackgroundTasksSidebar } from '../../src/ui/background-tasks-sidebar.js';

const theme: Pick<Theme, 'fg'> = { fg: (_color, text) => text };

function task(id: string, status: BgTaskSnapshot['status'], name = id): BgTaskSnapshot {
  return {
    id, status, name, command: 'SECRET_COMMAND', outputPath: '/secret/output',
    cwd: '/secret/cwd', startTime: 0, bytesWritten: 42, isAgent: false,
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
  void it('renders pi-tasks icon rows with a compact count and no redundant status or hint', () => {
    const view = setup([task('run', 'running', 'Native job')]);
    const lines = view.sidebar.render(120);
    assert.deepEqual(lines.map((line) => line.slice(84)), [
      '● Background jobs (1)',
      '  ✳ Native job',
    ]);
    assert.ok(lines.every((line) => line.startsWith(' '.repeat(84))));
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
      assert.ok(lines.every((line) => line.startsWith(' '.repeat(Math.max(0, width - 36)))));
    }
    assert.match(view.sidebar.render(36)[1] ?? '', /^  ✳ 界/);
  });

  void it('sanitizes malicious names and excludes output and telemetry', () => {
    const view = setup([task('malicious', 'running', 'safe\u001b[31mRED\u0007\u009b2J')]);
    const text = view.sidebar.render(36).join('\n');
    assert.match(text, /safe.*RED/);
    assert.doesNotMatch(text, /[\u001b\u0007\u009b]/);
    assert.doesNotMatch(text, /SECRET_COMMAND|SECRET_MODEL|\/secret\/|42/);
  });

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
