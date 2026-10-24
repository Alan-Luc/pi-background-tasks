import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { isolatedTestEnv, stripAnsi } from '../helpers/normalize.js';
import { seedPeerTasks } from '../helpers/peer-tasks-fixture.js';
const extensionPath = resolve('extensions/background-tasks.ts');
const expectBin = '/usr/bin/expect';

const PTY_SKIP_REASON =
  'interactive stdin is not deliverable to a raw-mode Node TUI via /usr/bin/expect on this host ' +
  '(verified: a plain `cat` receives input but a Node process.stdin reader does not). ' +
  'Run `npm run test:pty` on a host/CI where Node TTY stdin works under the PTY driver.';

function tclQuote(value: string): string {
  return `{${value.replace(/}/g, '\\}')}}`;
}

/**
 * Probe whether this host can deliver interactive stdin to a raw-mode Node TUI
 * through /usr/bin/expect. pi is a Node program that puts stdin in raw mode, so
 * if a minimal Node raw-stdin reader cannot receive an expect-sent byte, none of
 * the interactive pi PTY scenarios below can run here. The probe spawns the exact
 * failing shape (Node + expect) rather than guessing from platform/version, and
 * the result is cached so it runs once per suite.
 */
let ptyInputProbe: Promise<boolean> | undefined;
function ptyInputSupported(): Promise<boolean> {
  ptyInputProbe ??= probePtyInput();
  return ptyInputProbe;
}

async function probePtyInput(): Promise<boolean> {
  if (process.platform === 'win32') return false;
  if (!existsSync(expectBin)) return false;
  const root = await mkdtemp(join(tmpdir(), 'pi-bg-pty-probe-'));
  try {
    const reader = join(root, 'reader.cjs');
    await writeFile(
      reader,
      [
        'process.stdin.setEncoding("utf8");',
        'if (process.stdin.setRawMode) process.stdin.setRawMode(true);',
        'process.stdin.resume();',
        'process.stdin.on("data", (d) => { if (d.includes("Z")) { process.stdout.write("PTYPROBE_OK\\n"); process.exit(0); } });',
        'process.stdout.write("PTYPROBE_READY\\n");',
      ].join('\n'),
      'utf8',
    );
    const script = join(root, 'probe.expect');
    await writeFile(
      script,
      [
        'set timeout 6',
        `spawn -noecho ${tclQuote(process.execPath)} ${tclQuote(reader)}`,
        'expect { -re "PTYPROBE_READY" {} timeout { exit 2 } }',
        'after 300',
        'send "Z"',
        'expect { -re "PTYPROBE_OK" { exit 0 } timeout { exit 3 } }',
      ].join('\n'),
      'utf8',
    );
    const result = spawnSync(expectBin, [script], { encoding: 'utf8', timeout: 12_000 });
    return result.status === 0 && result.stdout.includes('PTYPROBE_OK');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

interface RunExpectOptions {
  size?: { rows: number; cols: number } | undefined;
  env?: Readonly<Record<string, string>> | undefined;
  rawOutput?: boolean | undefined;
}

async function runExpect(
  body: string,
  timeoutSeconds = 35,
  size?: { rows: number; cols: number },
  options: RunExpectOptions = {},
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pi-bg-pty-'));
  const cwd = join(root, 'project');
  await mkdir(cwd, { recursive: true });
  const script = join(root, 'scenario.expect');
  // Some scenarios (e.g. scrolling the tall detail view) need a taller pty so the
  // bottom-anchored dock is not clipped; stty_init must be set before spawn.
  const requestedSize = options.size ?? size;
  const sttyInit = requestedSize
    ? `set stty_init {rows ${String(requestedSize.rows)} columns ${String(requestedSize.cols)}}\n`
    : '';
  const extensionArgs = `-e ${tclQuote(extensionPath)}`;
  const optionEnv = Object.entries(options.env ?? {})
    .map(([key, value]) => `set env(${key}) ${tclQuote(value)}`)
    .join('\n');
  const content = `
set timeout ${String(timeoutSeconds)}
${sttyInit}`;
  const tail = `
set env(PI_OFFLINE) "${isolatedTestEnv.PI_OFFLINE}"
set env(PI_SKIP_VERSION_CHECK) "${isolatedTestEnv.PI_SKIP_VERSION_CHECK}"
set env(PI_TELEMETRY) "${isolatedTestEnv.PI_TELEMETRY}"
set env(CI) "${isolatedTestEnv.CI}"
set env(PI_CODING_AGENT_DIR) ${tclQuote(join(root, 'agent'))}
set env(PI_CODING_AGENT_SESSION_DIR) ${tclQuote(join(root, 'sessions'))}
set env(NPM_CONFIG_CACHE) "/tmp/pi-npm-cache"
set env(TERM) "xterm-256color"
${optionEnv}
spawn -noecho pi --offline --no-session --no-extensions ${extensionArgs} --no-skills --no-prompt-templates --no-context-files --no-tools
expect {
  -re {\\[\\?u} { send "\\033\\[?0u"; exp_continue }
  -re {\\[c} { send "\\033\\[?1;2c"; exp_continue }
  -re {\\(auto\\)} {}
  timeout { puts "INITIAL_PROMPT_TIMEOUT"; exit 2 }
}
after 600
${body}
send "\\003"
after 500
exit 0
`;
  await writeFile(script, content + tail, 'utf8');
  try {
    const result = spawnSync(expectBin, [script], {
      cwd,
      encoding: 'utf8',
      timeout: (timeoutSeconds + 5) * 1000,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 0, stripAnsi(output));
    return options.rawOutput ? output : stripAnsi(output).replace(/\r/g, '');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function findCommand(command: string): string | undefined {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() || undefined : undefined;
}

function tmuxRun(tmux: string, socket: string, args: string[]) {
  return spawnSync(tmux, ['-S', socket, ...args], { encoding: 'utf8', timeout: 10_000 });
}

async function waitForPane(
  tmux: string,
  socket: string,
  predicate: (screen: string) => boolean,
  message: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let screen = '';
  while (Date.now() < deadline) {
    const capture = tmuxRun(tmux, socket, ['capture-pane', '-p', '-t', 'combined']);
    assert.equal(capture.status, 0, capture.stderr);
    screen = stripAnsi(capture.stdout).replace(/\r/g, '');
    if (predicate(screen)) return screen;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert.fail(`${message}\nCurrent screen:\n${screen}`);
}

async function sendPaneKeys(tmux: string, socket: string, keys: string): Promise<void> {
  const sent = tmuxRun(tmux, socket, ['send-keys', '-t', 'combined', '-l', '--', keys]);
  assert.equal(sent.status, 0, sent.stderr);
  const entered = tmuxRun(tmux, socket, ['send-keys', '-t', 'combined', 'Enter']);
  assert.equal(entered.status, 0, entered.stderr);
}

async function sendPaneKey(tmux: string, socket: string, key: string): Promise<void> {
  const sent = tmuxRun(tmux, socket, ['send-keys', '-t', 'combined', '-l', '--', key]);
  assert.equal(sent.status, 0, sent.stderr);
}

function nativeLongJobDuration(screen: string): string | undefined {
  const lines = screen.split('\n');
  const heading = lines.findIndex((line) => line.includes('Background jobs (4)'));
  if (heading < 0) return undefined;
  const row = lines.slice(heading + 1, heading + 5).find((line) => line.includes('This is a deliberately'));
  return row?.trimEnd().match(/\((\d+(?:ms|s))\)$/u)?.[1];
}

void describe('interactive PTY', () => {
  void it('extracts elapsed time from native rows rather than transcript echoes', () => {
    const screen = [
      'Started: This is a deliberately long silent job name for truncation',
      '● Background jobs (4)',
      '✳ Job One (1s)', '✳ Job Two (1s)', '✳ Job Three (1s)',
      '✳ This is a deliberately lo... (241ms)  ',
    ].join('\n');
    assert.equal(nativeLongJobDuration(screen), '241ms');
    assert.equal(nativeLongJobDuration('Old transcript: This is a deliberately long job (23s)'), undefined);
  });
  void it('renders real peer Tasks beside oldest-first Jobs and preserves their runtimes', { timeout: 100_000 }, async (t) => {
    const peerRoot = process.env['PI_TASKS_SOURCE_ROOT'];
    const tmux = findCommand('tmux');
    const pi = findCommand('pi');
    if (!peerRoot) {
      t.skip('set PI_TASKS_SOURCE_ROOT to the writable pi-tasks source checkout');
      return;
    }
    if (!tmux || !pi) {
      t.skip('combined native-row proof requires tmux and the pi CLI on PATH');
      return;
    }
    const absolutePeerRoot = resolve(peerRoot);
    assert.ok(existsSync(join(absolutePeerRoot, 'src', 'index.ts')));
    const root = await mkdtemp(join('/tmp', `pbg-row-${String(process.pid)}-`));
    const cwd = join(root, 'project');
    const socket = join(root, 'tmux.sock');
    const taskStorePath = join(root, 'tasks.json');
    const siblingExtension = join(root, 'native-sibling.ts');
    await mkdir(cwd, { recursive: true });
    await writeFile(siblingExtension, `export default function (pi) {
  pi.on('session_start', (_event, ctx) => {
    if (ctx.mode === 'tui' && ctx.hasUI) {
      ctx.ui.setWidget('test-native-sibling', () => ({
        render: () => ['SIBLING-NATIVE-MARKER'],
        invalidate() {},
      }), { placement: 'aboveEditor' });
    }
  });
}\n`, 'utf8');
    await seedPeerTasks(absolutePeerRoot, taskStorePath);
    const env = {
      ...process.env,
      ...isolatedTestEnv,
      PI_TASKS: taskStorePath,
      PI_CODING_AGENT_DIR: join(root, 'agent'),
      PI_CODING_AGENT_SESSION_DIR: join(root, 'sessions'),
      NPM_CONFIG_CACHE: '/tmp/pi-npm-cache',
      TERM: 'xterm-256color',
    };
    let serverStarted = false;
    try {
      const started = spawnSync(tmux, [
        '-S', socket, 'new-session', '-d', '-s', 'combined', '-x', '120', '-y', '40', '-c', cwd,
        pi, '--offline', '--no-session', '--no-extensions',
        '-e', join(absolutePeerRoot, 'src', 'index.ts'), '-e', extensionPath, '-e', siblingExtension,
        '--no-skills', '--no-prompt-templates', '--no-context-files', '--no-tools',
      ], { encoding: 'utf8', timeout: 20_000, env });
      assert.equal(started.status, 0, started.stderr);
      serverStarted = true;
      await waitForPane(tmux, socket, (screen) => screen.includes('(auto)'), 'Pi did not reach its ready prompt');

      const jobNames = [
        'Job One', 'Job Two', 'Job Three',
        'This is a deliberately long silent job name for truncation',
      ];
      for (let index = 0; index < jobNames.length; index++) {
        const name = jobNames[index];
        assert.ok(name);
        await sendPaneKeys(tmux, socket, `/bg --name "${name}" node -e "setTimeout(()=>{},30000)"`);
        const count = index + 1;
        await waitForPane(
          tmux, socket,
          (screen) => screen.includes(`Background jobs (${String(count)})`),
          `the live Jobs row did not show ${String(count)} running jobs`,
        );
        await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      }

      const wideScreen = await waitForPane(
        tmux, socket,
        (screen) => screen.includes('Background jobs (4)') && screen.includes('Native Task One'),
        'the current screen did not show both real extensions',
      );
      assert.ok(wideScreen.includes('SIBLING-NATIVE-MARKER'), 'the independent native sibling must remain visible');
      const wideLines = wideScreen.split('\n');
      const taskHeading = wideLines.findIndex((line) => line.includes('4 tasks'));
      const jobsHeading = wideLines.findIndex((line) => line.includes('Background jobs (4)'));
      const firstTask = wideLines.findIndex((line) => line.includes('Native Task One'));
      const firstJob = wideLines.findIndex((line) => line.includes('Job One'));
      assert.ok(taskHeading >= 0 && jobsHeading >= 0, 'both native headings must be visible');
      assert.equal(taskHeading, jobsHeading, 'Tasks and Jobs headings must share a row');
      assert.ok(firstTask >= 0 && firstJob >= 0);
      assert.equal(firstTask, firstJob, 'first task and job rows must share a row');
      t.diagnostic(`Current wide native rows:\n${wideLines.slice(taskHeading, taskHeading + 6).join('\n')}`);
      const taskHeadingLine = wideLines[taskHeading];
      const jobsHeadingLine = wideLines[jobsHeading];
      const taskItemLine = wideLines[firstTask];
      const jobItemLine = wideLines[firstJob];
      assert.ok(taskHeadingLine && jobsHeadingLine && taskItemLine && jobItemLine);
      assert.equal(taskHeadingLine.indexOf('●'), 0, 'Tasks heading must begin at the left edge');
      assert.equal(jobsHeadingLine.indexOf('Background jobs') + 'Background jobs (4)'.length, 120,
        'Jobs heading must reach the terminal right edge');
      assert.equal(taskItemLine.search(/\S/u), 2, 'Tasks items keep their two-column left inset');
      assert.equal(jobItemLine.trimEnd().length, 118, 'Jobs items mirror the two-column outer inset');
      const jobPositions = ['Job One', 'Job Two', 'Job Three'].map((name) => wideLines.findIndex((line) => line.includes(name)));
      assert.ok(jobPositions.every((position) => position >= 0));
      assert.deepEqual([...jobPositions].sort((a, b) => a - b), jobPositions, 'Jobs remain oldest-first');

      const firstDuration = nativeLongJobDuration(wideScreen);
      assert.ok(firstDuration, 'truncated long-name rows must retain a visible elapsed suffix');
      await new Promise((resolveWait) => setTimeout(resolveWait, 1300));
      const laterScreen = await waitForPane(tmux, socket, (screen) => nativeLongJobDuration(screen) !== undefined,
        'the long-name Jobs row disappeared');
      assert.notEqual(nativeLongJobDuration(laterScreen), firstDuration, 'the displayed per-job runtime must advance');
      t.diagnostic(`Observed job runtime: ${firstDuration} → ${nativeLongJobDuration(laterScreen)}`);

      const resized = tmuxRun(tmux, socket, ['resize-window', '-t', 'combined', '-x', '100', '-y', '40']);
      assert.equal(resized.status, 0, resized.stderr);
      const narrowScreen = await waitForPane(tmux, socket,
        (screen) => screen.includes('Background jobs (4)') && screen.includes('Native Task One'),
        'the resized screen did not retain both widgets');
      const narrowLines = narrowScreen.split('\n');
      assert.notEqual(
        narrowLines.findIndex((line) => line.includes('4 tasks')),
        narrowLines.findIndex((line) => line.includes('Background jobs (4)')),
        'fewer than 64 remaining Tasks columns must stack the native blocks',
      );

      await sendPaneKeys(tmux, socket, '/bg-tasks');
      await waitForPane(tmux, socket, (screen) => screen.includes('bg tasks focused'), 'the background manager did not open');
      await sendPaneKey(tmux, socket, 'x');
      const restored = await waitForPane(tmux, socket,
        (screen) => screen.includes('Background jobs (4)') && screen.includes('Native Task One'),
        'closing the manager did not restore the combined row');
      assert.ok(restored.includes('SIBLING-NATIVE-MARKER'), 'manager close must not swallow the sibling widget');
      assert.equal(restored.split('\n').filter((line) => line.includes('4 tasks')).length, 1,
        'the real peer Tasks block must not be duplicated');

      await sendPaneKeys(tmux, socket, '/bg-tasks');
      await waitForPane(tmux, socket, (screen) => screen.includes('bg tasks focused'), 'the manager did not reopen for cleanup');
      await sendPaneKey(tmux, socket, 'a');
      await waitForPane(tmux, socket, screen => screen.includes('Press a/K again to stop all'), 'stop-all confirmation did not arm');
      await sendPaneKey(tmux, socket, 'K');
      await waitForPane(tmux, socket, screen => screen.includes('Stopped 4 running task'), 'the real background jobs did not stop');
      await sendPaneKey(tmux, socket, 'x');
      const idle = await waitForPane(tmux, socket,
        (screen) => !screen.includes('Background jobs (4)') && screen.includes('Native Task One'),
        'Jobs did not disappear after completion while Tasks remained');
      assert.doesNotMatch(idle, /Background jobs \(4\)/u);
      assert.ok(idle.includes('SIBLING-NATIVE-MARKER'), 'an unrelated native sibling must survive Jobs becoming idle');
    } finally {
      if (serverStarted) tmuxRun(tmux, socket, ['kill-server']);
      await rm(root, { recursive: true, force: true });
    }
  });

  void it('hides the native job widget when no jobs are running', { timeout: 45_000 }, async (t) => {
    if (!(await ptyInputSupported())) {
      t.skip(PTY_SKIP_REASON);
      return;
    }
    const output = await runExpect(`
send "/bg-clear"
send "\\r"
expect {
  -re "No finished background task notices" {}
  timeout { puts "IDLE_WIDGET_COMMAND_TIMEOUT"; exit 40 }
}
`, 30, { rows: 40, cols: 120 }, { rawOutput: true });
    assert.doesNotMatch(stripAnsi(output), /Background jobs|No jobs running|0 running/);
  });

  void it('shows native running jobs while commands remain usable, then completes', { timeout: 45_000 }, async (t) => {
    if (!(await ptyInputSupported())) {
      t.skip(PTY_SKIP_REASON);
      return;
    }
    const output = await runExpect(`
send {/bg --name "PTY Native" sleep 3}
send "\\r"
expect {
  -re {Background jobs [(]1[)](.|\\n)*[✳✴✵✶✷✸✹✺✻✼✽] PTY Native} {}
  timeout { puts "RUNNING_WIDGET_TIMEOUT"; exit 41 }
}
send "/bg-clear"
send "\\r"
expect {
  -re "No finished background task notices" {}
  timeout { puts "INPUT_WITH_WIDGET_TIMEOUT"; exit 42 }
}
expect {
  -re "bg completed" {}
  timeout { puts "NATIVE_COMPLETION_TIMEOUT"; exit 43 }
}
send "/bg-clear"
send "\\r"
expect {
  -re "Cleared 1 finished" {}
  timeout { puts "CLEAR_NOTICE_TIMEOUT"; exit 44 }
}
`, 35, { rows: 40, cols: 120 }, { rawOutput: true });
    assert.match(stripAnsi(output), /Background jobs/);
    assert.match(stripAnsi(output), /Cleared 1 finished/);
    assert.doesNotMatch(stripAnsi(output), /No jobs running|0 running|bg [0-9]+ running/);
    assert.doesNotMatch(output, /48;2;183;223;255/);
  });

  void it('shows native jobs on an 80-column terminal and keeps /tasks available', { timeout: 45_000 }, async (t) => {
    if (!(await ptyInputSupported())) {
      t.skip(PTY_SKIP_REASON);
      return;
    }
    const output = await runExpect(`
send {/bg --name "Native Narrow" sleep 2}
send "\\r"
expect {
  -re "Background jobs(.|\\n)*Native Narrow" {}
  timeout { puts "NARROW_WIDGET_TIMEOUT"; exit 45 }
}
send "/tasks"
send "\\r"
expect {
  -re "bg tasks focused" {}
  timeout { puts "NARROW_MANAGER_TIMEOUT"; exit 46 }
}
send "x"
`, 30, { rows: 40, cols: 80 }, { rawOutput: true });
    assert.match(stripAnsi(output), /Background jobs/);
    assert.match(stripAnsi(output), /bg tasks focused/);
  });

  void it(
    'opens the focused dock from /tasks and closes with x',
    { timeout: 45_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
send "/tasks"
send "\\r"
expect {
  -re "bg tasks focused|No background tasks" {}
  timeout { puts "TASKS_DOCK_TIMEOUT"; exit 3 }
}
send "x"
`,
        30,
      );
      assert.match(output, /bg tasks focused|No background tasks/);
    },
  );

  void it(
    'opens the task manager via Shift+Down after starting a named task',
    { timeout: 55_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
send {/bg --name "PTY Sleep" node -e "setTimeout(()=>{},4000)"}
send "\\r"
expect {
  -re "Started PTY Sleep" {}
  timeout { puts "BG_START_TIMEOUT"; exit 4 }
}
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused(.|\n)*PTY Sleep" {}
  timeout { puts "SHIFT_DOWN_DOCK_TIMEOUT"; exit 5 }
}
send "x"
`,
        40,
      );
      assert.match(output, /PTY Sleep/);
      assert.match(output, /bg tasks focused/);
    },
  );

  void it(
    'drives real dock detail, history, stop, and close keys',
    { timeout: 70_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
send {/bg --name "PTY Action" node -e "let i=0; const t=setInterval(()=>{console.log('pty-action-'+(++i)); if(i===20) clearInterval(t)},100)"}
send "\\r"
expect {
  -re "Started PTY Action" {}
  timeout { puts "ACTION_START_TIMEOUT"; exit 6 }
}
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused(.|\n)*PTY Action" {}
  timeout { puts "ACTION_DOCK_TIMEOUT"; exit 7 }
}
send "\\r"
expect {
  -re "bg: PTY Action|Output tail" {}
  timeout { puts "ACTION_DETAIL_TIMEOUT"; exit 8 }
}
send "r"
after 300
send "\\033\\[D"
expect {
  -re "bg tasks focused" {}
  timeout { puts "ACTION_BACK_TIMEOUT"; exit 9 }
}
send "h"
expect {
  -re "history|active" {}
  timeout { puts "ACTION_HISTORY_TIMEOUT"; exit 10 }
}
send "k"
expect {
  -re "Stopping|Stopped|stopped" {}
  timeout { puts "ACTION_STOP_TIMEOUT"; exit 11 }
}
send "x"
`,
        55,
      );
      assert.match(output, /PTY Action/);
      assert.match(output, /bg tasks focused/);
      assert.match(output, /bg: PTY Action|Output tail/);
    },
  );

  void it(
    'scrolls the detail output tail with real arrow/page keys',
    { timeout: 60_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
send {/bg --name "PTY Scroll" node -e "for(let i=1;i<=60;i++)console.log('PTYSCROLL-'+i)"}
send "\\r"
expect {
  -re "Started PTY Scroll" {}
  timeout { puts "SCROLL_START_TIMEOUT"; exit 33 }
}
after 600
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused" {}
  timeout { puts "SCROLL_DOCK_TIMEOUT"; exit 34 }
}
send "\\r"
expect {
  -re "bg: PTY Scroll" {}
  timeout { puts "SCROLL_DETAIL_TIMEOUT"; exit 35 }
}
expect {
  -re "PTYSCROLL-60" {}
  timeout { puts "SCROLL_OUTPUT_TIMEOUT"; exit 37 }
}
send "\\033\\[A"
send "\\033\\[A"
send "\\033\\[A"
expect {
  -re {of 60} {}
  timeout { puts "SCROLL_INDICATOR_TIMEOUT"; exit 36 }
}
send "x"
`,
        45,
        { rows: 80, cols: 120 },
      );
      assert.match(output, /PTY Scroll/);
      assert.match(output, /lines [0-9]+.*of 60/);
    },
  );

  void it(
    'covers secondary dock keys for selection, output path, rerun, and stop-all',
    { timeout: 80_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
send {/bg --name "PTY Alpha" node -e "setInterval(()=>console.log('alpha'),200)"}
send "\\r"
expect {
  -re "Started PTY Alpha" {}
  timeout { puts "SECONDARY_ALPHA_TIMEOUT"; exit 12 }
}
send {/bg --name "PTY Beta" node -e "setInterval(()=>console.log('beta'),200)"}
send "\\r"
expect {
  -re "Started PTY Beta" {}
  timeout { puts "SECONDARY_BETA_TIMEOUT"; exit 13 }
}
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused(.|\n)*PTY Beta(.|\n)*PTY Alpha|bg tasks focused(.|\n)*PTY Alpha(.|\n)*PTY Beta" {}
  timeout { puts "SECONDARY_DOCK_TIMEOUT"; exit 14 }
}
send "c"
expect {
  -re "Output path shown for PTY Beta|Output path for PTY Beta" {}
  timeout { puts "SECONDARY_PATH_BETA_TIMEOUT"; exit 15 }
}
send "\\033\\[B"
expect {
  -re "PTY Alpha" {}
  timeout { puts "SECONDARY_DOWN_TIMEOUT"; exit 16 }
}
send "c"
expect {
  -re "Output path shown for PTY Alpha|Output path for PTY Alpha" {}
  timeout { puts "SECONDARY_PATH_ALPHA_TIMEOUT"; exit 17 }
}
send "\\033\\[A"
expect {
  -re "PTY Beta" {}
  timeout { puts "SECONDARY_UP_TIMEOUT"; exit 18 }
}
send "R"
expect {
  -re "Reran as PTY Beta|Rerunning PTY Beta" {}
  timeout { puts "SECONDARY_RERUN_TIMEOUT"; exit 19 }
}
send "a"
expect {
  -re "Press a/K again to stop all" {}
  timeout { puts "SECONDARY_STOP_ALL_ARM_TIMEOUT"; exit 20 }
}
send "K"
expect {
  -re {Stopped [0-9]+ running task} {}
  timeout { puts "SECONDARY_STOP_ALL_TIMEOUT"; exit 21 }
}
send "x"
`,
        65,
      );
      assert.match(output, /PTY Alpha/);
      assert.match(output, /PTY Beta/);
      assert.match(output, /Output path shown for PTY/);
      assert.match(output, /Reran as PTY Beta|Rerunning PTY Beta/);
      assert.match(output, /Stopped [0-9]+ running task/);
    },
  );

  void it(
    'reruns completed, failed, and killed history tasks in a real dock',
    { timeout: 70_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
send {/bg --name "PTY Done Rerun" printf done-rerun}
send "\\r"
expect {
  -re "Started PTY Done Rerun" {}
  timeout { puts "RERUN_COMPLETE_START_TIMEOUT"; exit 22 }
}
expect {
  -re "bg completed.*PTY Done Rerun" {}
  timeout { puts "RERUN_COMPLETE_TERMINAL_TIMEOUT"; exit 33 }
}
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused" {}
  timeout { puts "RERUN_COMPLETE_DOCK_TIMEOUT"; exit 23 }
}
send "R"
expect {
  -re "Reran as PTY Done Rerun|Rerunning PTY Done Rerun" {}
  timeout { puts "RERUN_COMPLETE_ACTION_TIMEOUT"; exit 24 }
}
send "x"
after 200
send {/bg --name "PTY Stop Rerun" sleep 20}
send "\\r"
expect {
  -re "Started PTY Stop Rerun" {}
  timeout { puts "RERUN_KILLED_START_TIMEOUT"; exit 25 }
}
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused" {}
  timeout { puts "RERUN_KILLED_DOCK_TIMEOUT"; exit 26 }
}
send "k"
expect {
  -re "Stopped PTY Stop Rerun" {}
  timeout { puts "RERUN_KILLED_STOP_TIMEOUT"; exit 27 }
}
send "R"
expect {
  -re "Reran as PTY Stop Rerun" {}
  timeout { puts "RERUN_KILLED_ACTION_TIMEOUT"; exit 28 }
}
send "a"
expect {
  -re "Press a/K again to stop all" {}
  timeout { puts "RERUN_KILLED_STOP_ALL_ARM_TIMEOUT"; exit 29 }
}
send "K"
expect {
  -re {Stopped [1-9][0-9]* running task} {}
  timeout { puts "RERUN_KILLED_RERUN_STOP_TIMEOUT"; exit 34 }
}
send "x"
after 200
send {/bg --name "PTY Bad Rerun" node -e "process.exit(5)"}
send "\\r"
expect {
  -re "Started PTY Bad Rerun" {}
  timeout { puts "RERUN_FAILED_START_TIMEOUT"; exit 30 }
}
expect {
  -re "bg failed.*PTY Bad Rerun" {}
  timeout { puts "RERUN_FAILED_TERMINAL_TIMEOUT"; exit 35 }
}
send "\\033\\[1;2B"
expect {
  -re "bg tasks focused" {}
  timeout { puts "RERUN_FAILED_DOCK_TIMEOUT"; exit 31 }
}
send "R"
expect {
  -re "Reran as PTY Bad Rerun|Rerunning PTY Bad Rerun" {}
  timeout { puts "RERUN_FAILED_ACTION_TIMEOUT"; exit 32 }
}
send "x"
`,
        55,
      );
      assert.match(output, /Reran as PTY Done Rerun|Rerunning PTY Done Rerun/);
      assert.match(output, /Reran as PTY Bad Rerun|Rerunning PTY Bad Rerun/);
      assert.match(output, /Reran as PTY Stop Rerun|Rerunning PTY Stop Rerun/);
    },
  );

  void it(
    'covers /bg-tasks history, failed unread badges, and page keys',
    { timeout: 200_000 },
    async (t) => {
      if (!(await ptyInputSupported())) {
        t.skip(PTY_SKIP_REASON);
        return;
      }
      const output = await runExpect(
        `
set send_slow {1 .004}
for {set i 1} {$i <= 16} {incr i} {
  send -s "/bg --name \\"PTY Page $i\\" printf page-$i"
  send "\\r"
  expect {
    -re "Started PTY Page $i" {}
    timeout { puts "PAGE_START_TIMEOUT_$i"; exit 22 }
  }
  after 80
}
send {/bg --name "PTY Fails" node -e "process.exit(4)"}
send "\\r"
expect {
  -re "Started PTY Fails" {}
  timeout { puts "PAGE_FAIL_START_TIMEOUT"; exit 23 }
}
after 700
send "/bg-tasks"
send "\\r"
expect {
  -re "bg tasks focused(.|\n)*(failed|unread)(.|\n)*PTY Fails" {}
  timeout { puts "PAGE_DOCK_TIMEOUT"; exit 24 }
}
send "\\033\\[6~"
after 300
send "\\033\\[5~"
after 300
send "x"
`,
        170,
      );
      assert.match(output, /PTY Fails/);
      assert.match(output, /failed|unread/);
      assert.match(output, /PTY Page/);
    },
  );
});
