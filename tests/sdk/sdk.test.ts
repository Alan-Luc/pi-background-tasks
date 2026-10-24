import { describe, it, afterEach, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ModelRuntime,
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type EventBus,
  type ExtensionAPI,
  type ExtensionUIContext,
} from '@earendil-works/pi-coding-agent';
import { parseJsonText, type BgTaskSnapshot, type TaskStatus } from '../../src/core/common.js';
import { BackgroundTaskRegistry } from '../../src/core/registry.js';
import {
  BG_EXTENSION_CAPABILITIES,
  BG_REQUEST_CHANNEL,
  BG_REQUEST_SCHEMA,
  BG_RESPONSE_CHANNEL,
  BG_RESPONSE_SCHEMA,
  BG_TERMINAL_CHANNEL,
  BG_TERMINAL_SCHEMA,
  type BackgroundTaskExtensionResponse,
  type BackgroundTaskExtensionTerminal,
} from '../../src/core/extension-api.js';
import backgroundTasksExtension from '../../src/extension.js';

const extensionPath = resolve('extensions/background-tasks.ts');
const scriptedProviderPath = resolve('tests/scripted-provider/scripted-provider-extension.ts');
const roots: string[] = [];

function skipWin32PosixPiTelemetry(t: TestContext): boolean {
  if (process.platform !== 'win32') return false;
  t.skip('POSIX-shell Pi telemetry wrapping is not applicable on win32 cmd tasks by design');
  return true;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function resolvePiCli(): string | undefined {
  const which = spawnSync('bash', ['-lc', 'command -v pi'], { encoding: 'utf8' });
  return which.status === 0 ? which.stdout.trim() || undefined : undefined;
}

interface SdkHarnessOptions {
  eventBus?: EventBus | undefined;
}

async function harness(options: SdkHarnessOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pi-bg-sdk-'));
  roots.push(root);
  const cwd = join(root, 'project');
  const agentDir = join(root, 'agent');
  await mkdir(cwd, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    additionalExtensionPaths: [extensionPath],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noContextFiles: true,
    noThemes: true,
    ...(options.eventBus === undefined ? {} : { eventBus: options.eventBus }),
  });
  await loader.reload();
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, 'auth.json'),
    modelsPath: null,
  });
  const { session } = await createAgentSession({
    cwd,
    agentDir,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd),
    settingsManager,
    modelRuntime,
    noTools: 'builtin',
  });
  return { session, cwd };
}

type JsonObject = Record<PropertyKey, unknown>;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface TestToolContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface TestToolDetails extends JsonObject {
  task?: unknown;
  tasks?: unknown;
}

interface TestToolResult {
  content: TestToolContent[];
  details: TestToolDetails;
}

interface CustomNotificationEntry {
  type: 'custom_message';
  customType: string;
  content: string;
  details: JsonObject;
}

interface PreparedBgRunArgs extends JsonObject {
  name?: string;
  command?: string;
  isAgent: boolean;
}

interface UiNotification {
  message: string;
  type?: 'info' | 'warning' | 'error';
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'running' || value === 'completed' || value === 'failed' || value === 'killed';
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject(text: string, message: string): JsonObject {
  const parsed = parseJsonText(text);
  assert.ok(isJsonObject(parsed), message);
  return parsed;
}

function requiredJsonObject(value: unknown, message: string): JsonObject {
  assert.ok(isJsonObject(value), message);
  return value;
}

function isBgTaskSnapshot(value: unknown): value is BgTaskSnapshot {
  return (
    isJsonObject(value) &&
    typeof value['id'] === 'string' &&
    typeof value['command'] === 'string' &&
    isTaskStatus(value['status']) &&
    typeof value['outputPath'] === 'string' &&
    typeof value['cwd'] === 'string' &&
    typeof value['startTime'] === 'number' &&
    typeof value['bytesWritten'] === 'number' &&
    typeof value['isAgent'] === 'boolean' &&
    typeof value['notified'] === 'boolean' &&
    typeof value['notifyOnCompletion'] === 'boolean' &&
    typeof value['triggerOnCompletion'] === 'boolean'
  );
}

function isTestToolContent(value: unknown): value is TestToolContent {
  return isJsonObject(value) && typeof value['type'] === 'string';
}

function isTestToolResult(value: unknown): value is TestToolResult {
  return (
    isJsonObject(value) &&
    Array.isArray(value['content']) &&
    value['content'].every(isTestToolContent) &&
    isJsonObject(value['details'])
  );
}

function isCustomNotificationEntry(value: unknown): value is CustomNotificationEntry {
  return (
    isJsonObject(value) &&
    value['type'] === 'custom_message' &&
    value['customType'] === 'background-task-notification' &&
    typeof value['content'] === 'string' &&
    isJsonObject(value['details'])
  );
}

function isPreparedBgRunArgs(value: unknown): value is PreparedBgRunArgs {
  return (
    isJsonObject(value) &&
    typeof value['isAgent'] === 'boolean' &&
    (value['name'] === undefined || typeof value['name'] === 'string') &&
    (value['command'] === undefined || typeof value['command'] === 'string')
  );
}

function requiredTask(value: unknown, message: string): BgTaskSnapshot {
  assert.ok(isBgTaskSnapshot(value), message);
  return value;
}

function taskFromResult(result: TestToolResult): BgTaskSnapshot {
  return requiredTask(result.details.task, 'tool result should include a background task snapshot');
}

function tasksFromResult(result: TestToolResult): BgTaskSnapshot[] {
  const tasks = result.details.tasks;
  assert.ok(Array.isArray(tasks), 'tool result should include a task list');
  return tasks.map((task) =>
    requiredTask(task, 'task list entry should be a background task snapshot'),
  );
}

function firstTask(result: TestToolResult): BgTaskSnapshot {
  const task = tasksFromResult(result)[0];
  assert.ok(task, 'tool result should include at least one background task snapshot');
  return task;
}

function resultText(result: TestToolResult): string {
  const content = result.content[0];
  assert.ok(content, 'tool result should include a content item');
  if (typeof content.text !== 'string') {
    throw new Error('tool result first content item should include text');
  }
  return content.text;
}

function requiredPrepared(value: unknown): PreparedBgRunArgs {
  assert.ok(
    isPreparedBgRunArgs(value),
    'prepared bg_run arguments should satisfy the bg_run schema',
  );
  return value;
}

async function exec(session: AgentSession, name: string, params: unknown): Promise<TestToolResult> {
  const tool = session.getToolDefinition(name);
  assert.ok(tool, `missing tool ${name}`);
  const result: unknown = await tool.execute(
    `call-${name}`,
    params,
    undefined,
    undefined,
    session.extensionRunner.createContext(),
  );
  assert.ok(isTestToolResult(result), `${name} should return a tool result object`);
  return result;
}

async function wait(session: AgentSession, id: string, iterations = 100): Promise<BgTaskSnapshot> {
  for (let i = 0; i < iterations; i++) {
    const s = await exec(session, 'bg_status', { taskId: id });
    const t = firstTask(s);
    if (t.status !== 'running') return t;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('timeout');
}

function customNotifications(session: AgentSession): CustomNotificationEntry[] {
  const entries: readonly unknown[] = session.sessionManager.getEntries();
  return entries.filter(isCustomNotificationEntry);
}

async function readJsonEventually(path: string): Promise<JsonObject> {
  let last = '';
  for (let i = 0; i < 20; i++) {
    last = await readFile(path, 'utf8').catch(() => '');
    if (last.trim()) return parseJsonObject(last, 'metadata JSON should be an object');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return parseJsonObject(last, 'metadata JSON should be an object');
}

async function readJsonWithStatus(path: string, status: string): Promise<JsonObject> {
  let metadata = await readJsonEventually(path);
  for (let attempt = 0; attempt < 40; attempt++) {
    metadata = await readJsonEventually(path);
    if (metadata['status'] === status) return metadata;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return metadata;
}

function requireEventResponse(value: unknown): BackgroundTaskExtensionResponse {
  assert.ok(isJsonObject(value), 'EventBus response must be an object');
  assert.equal(value['schema_version'], BG_RESPONSE_SCHEMA);
  assert.equal(typeof value['request_id'], 'string');
  assert.equal(typeof value['operation'], 'string');
  assert.equal(typeof value['ok'], 'boolean');
  const hasResult = Object.prototype.hasOwnProperty.call(value, 'result');
  const hasError = Object.prototype.hasOwnProperty.call(value, 'error');
  assert.notEqual(
    hasResult,
    hasError,
    'EventBus response must contain exactly one of result/error',
  );
  return value as BackgroundTaskExtensionResponse;
}

function requireOkResult(response: BackgroundTaskExtensionResponse): unknown {
  assert.equal(response.ok, true, response.ok ? 'ok' : response.error);
  return response.ok ? response.result : undefined;
}

function requireTerminal(value: unknown): BackgroundTaskExtensionTerminal {
  assert.ok(isJsonObject(value), 'EventBus terminal must be an object');
  assert.deepEqual(Object.keys(value).sort(), ['schema_version', 'task']);
  assert.equal(value['schema_version'], BG_TERMINAL_SCHEMA);
  return { schema_version: BG_TERMINAL_SCHEMA, task: requiredTask(value['task'], 'terminal task') };
}

// The EventBus kill response is only emitted after stopTask resolves. On Windows
// the two-stage taskkill flow issues a logical terminate request first and waits
// the full KILL_GRACE_MS window (3000 ms) before forcing, so a kill response
// cannot arrive inside the POSIX budget. POSIX keeps the tight budget so a
// genuine hang still fails fast there.
const EVENT_RESPONSE_TIMEOUT_MS = process.platform === 'win32' ? 10_000 : 1500;

function waitForEventResponse(
  eventBus: EventBus,
  requestId: string,
): Promise<BackgroundTaskExtensionResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timed out waiting for EventBus response ${requestId}`));
    }, EVENT_RESPONSE_TIMEOUT_MS);
    const unsubscribe = eventBus.on(BG_RESPONSE_CHANNEL, (data) => {
      const response = requireEventResponse(data);
      if (response.request_id !== requestId) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(response);
    });
  });
}

async function emitEventRequest(
  eventBus: EventBus,
  requestId: string,
  operation: string,
  payload: Record<string, unknown>,
): Promise<BackgroundTaskExtensionResponse> {
  const pending = waitForEventResponse(eventBus, requestId);
  eventBus.emit(BG_REQUEST_CHANNEL, {
    schema_version: BG_REQUEST_SCHEMA,
    request_id: requestId,
    operation,
    payload,
  });
  return pending;
}

// Matches EVENT_RESPONSE_TIMEOUT_MS: a killed task only reaches a terminal state
// after the Windows grace window elapses, so the same platform budget applies.
const TERMINAL_SNAPSHOT_POLL_MS = 25;
const TERMINAL_SNAPSHOT_ATTEMPTS = EVENT_RESPONSE_TIMEOUT_MS / TERMINAL_SNAPSHOT_POLL_MS;

async function waitForTerminalSnapshot(
  terminals: readonly BgTaskSnapshot[],
  taskId: string,
): Promise<BgTaskSnapshot> {
  for (let attempt = 0; attempt < TERMINAL_SNAPSHOT_ATTEMPTS; attempt++) {
    const terminal = terminals.find((task) => task.id === taskId);
    if (terminal) return terminal;
    await new Promise((resolve) => setTimeout(resolve, TERMINAL_SNAPSHOT_POLL_MS));
  }
  throw new Error(`timed out waiting for terminal ${taskId}`);
}

async function cleanupRoot(root: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!(error instanceof Error) || !/ENOTEMPTY/.test(error.message) || attempt === 4)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

afterEach(async () => {
  for (const r of roots.splice(0)) await cleanupRoot(r);
});

function makeStatusUi(
  baseUi: ExtensionUIContext,
  statuses: Array<string | undefined>,
  notifications: UiNotification[],
): ExtensionUIContext {
  return {
    ...baseUi,
    notify: (message, type) => {
      const notification: UiNotification = { message };
      if (type !== undefined) notification.type = type;
      notifications.push(notification);
    },
    setStatus: (_key, text) => {
      statuses.push(text);
    },
  };
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
    return;
  }
  process.env[key] = value;
}

void describe('sdk', () => {
  void it('registers only process commands, tools, shortcuts, and renderer and persists task output', async () => {
    const { session } = await harness();
    try {
      assert.deepEqual(session.getActiveToolNames().sort(), [
        'bg_kill', 'bg_logs', 'bg_run', 'bg_status',
      ]);
      const bgRunTool = session.getToolDefinition('bg_run');
      assert.ok(bgRunTool, 'bg_run tool should be registered');
      const bgRunParams: unknown = bgRunTool.parameters;
      assert.ok(isJsonObject(bgRunParams), 'bg_run schema should be an object');
      const required = bgRunParams['required'];
      assert.ok(
        Array.isArray(required) && required.includes('isAgent'),
        'bg_run schema must require isAgent',
      );
      const properties = bgRunParams['properties'];
      const isAgentSchema = isJsonObject(properties) ? properties['isAgent'] : bgRunParams;
      assert.match(JSON.stringify(isAgentSchema), /LLM\/agent/);
      const cmds = session.extensionRunner.getRegisteredCommands().map((c) => c.invocationName);
      assert.deepEqual(cmds.sort(), [
        'bg', 'bg-clear', 'bg-tasks', 'jobs', 'kill', 'logs', 'tasks',
      ]);
      assert.ok(session.extensionRunner.getMessageRenderer('background-task-notification'));
      const shortcuts = session.extensionRunner.getShortcuts({});
      assert.deepEqual([...shortcuts.keys()].sort(), ['ctrl+alt+c', 'shift+down']);

      const r = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'SDK Echo',
        command: 'echo sdk-ok',
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const task = await wait(session, taskFromResult(r).id);
      assert.equal(task.status, 'completed');
      assert.equal(task.name, 'SDK Echo');
      assert.equal(task.isAgent, false);
      assert.ok(existsSync(task.outputPath));
      const metadataPath = task.outputPath.replace(/\.output$/, '.json');
      assert.ok(existsSync(metadataPath));
      const metadata = await readJsonWithStatus(metadataPath, 'completed');
      assert.equal(metadata['status'], 'completed');
      assert.equal(metadata['name'], 'SDK Echo');
      assert.equal(metadata['isAgent'], false);
      const logs = await exec(session, 'bg_logs', { taskId: task.id, maxBytes: 100 });
      assert.match(resultText(logs), /sdk-ok/);
      await assert.rejects(() => exec(session, 'bg_kill', { taskId: task.id }), /not running/);
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('BUG-181 exposes an event-driven prompt contract and truthful launch receipts', async () => {
    const { session } = await harness();
    try {
      const ctx = session.extensionRunner.createContext();
      const systemPrompt = ctx.getSystemPrompt();
      assert.match(systemPrompt, /Do not call sleep, bg_status, or bg_logs merely to wait/);
      assert.match(systemPrompt, /automatically starts a follow-up agent turn/);
      assert.match(systemPrompt, /A running result is not an instruction to poll again/);
      assert.match(systemPrompt, /Do not repeatedly call bg_logs to wait for completion/);
      assert.match(systemPrompt, /Treat <background-task-notification> as durable terminal truth/);
      assert.doesNotMatch(
        systemPrompt,
        /After bg_run, use bg_status and bg_logs to inspect progress/,
      );

      const bgRun = session.getToolDefinition('bg_run');
      const bgStatus = session.getToolDefinition('bg_status');
      const bgLogs = session.getToolDefinition('bg_logs');
      assert.ok(bgRun && bgStatus && bgLogs, 'background tools should be registered');
      assert.match(bgRun.description, /do not sleep or poll merely to wait/);
      assert.match(bgStatus.description, /not a waiting primitive/);
      assert.match(bgLogs.description, /not a waiting primitive/);

      // shellQuote emits POSIX single quotes, which cmd.exe does not understand.
      const longCommand = `node -e ${JSON.stringify('setTimeout(() => {}, 10000)')}`;
      const cases = [
        {
          name: 'Default Delivery',
          notifyOnCompletion: undefined,
          triggerOnCompletion: undefined,
          expectedNotify: true,
          expectedTrigger: true,
          expected: [
            'Terminal notification: enabled.',
            'Automatic follow-up turn: enabled.',
            'Next action: do not poll or sleep',
          ],
        },
        {
          name: 'Notification Only',
          notifyOnCompletion: true,
          triggerOnCompletion: false,
          expectedNotify: true,
          expectedTrigger: false,
          expected: [
            'Terminal notification: enabled.',
            'Automatic follow-up turn: disabled.',
            'will not start an agent turn',
          ],
        },
        {
          name: 'Disabled Requested Wake',
          notifyOnCompletion: false,
          triggerOnCompletion: true,
          expectedNotify: false,
          expectedTrigger: true,
          expected: [
            'Terminal notification: disabled.',
            'Automatic follow-up turn: disabled because terminal notifications are disabled.',
            'triggerOnCompletion has no effect',
          ],
        },
        {
          name: 'Manual Delivery',
          notifyOnCompletion: false,
          triggerOnCompletion: false,
          expectedNotify: false,
          expectedTrigger: false,
          expected: [
            'Terminal notification: disabled.',
            'Automatic follow-up turn: disabled.',
            'deliberate manual monitoring',
          ],
        },
      ] as const;

      for (const testCase of cases) {
        const params = {
          isAgent: false,
          name: testCase.name,
          command: longCommand,
          ...(testCase.notifyOnCompletion === undefined
            ? {}
            : { notifyOnCompletion: testCase.notifyOnCompletion }),
          ...(testCase.triggerOnCompletion === undefined
            ? {}
            : { triggerOnCompletion: testCase.triggerOnCompletion }),
        };
        const result = await exec(session, 'bg_run', params);
        const task = taskFromResult(result);
        assert.equal(task.notifyOnCompletion, testCase.expectedNotify);
        assert.equal(task.triggerOnCompletion, testCase.expectedTrigger);
        for (const expected of testCase.expected) {
          assert.ok(
            resultText(result).includes(expected),
            `${testCase.name} receipt should include ${JSON.stringify(expected)}`,
          );
        }
        assert.equal(
          Reflect.get(result, 'terminate'),
          undefined,
          'bg_run must remain non-terminating for workflows that continue useful work',
        );
      }
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('serves real extension EventBus requests and terminal events through the shared registry', async () => {
    const eventBus = createEventBus();
    const terminals: BgTaskSnapshot[] = [];
    const eventOrder: string[] = [];
    const unsubscribeResponseOrder = eventBus.on(BG_RESPONSE_CHANNEL, (data) => {
      const response = requireEventResponse(data);
      if (response.request_id === 'sdk-run' || response.request_id === 'sdk-kill') {
        eventOrder.push(`response:${response.request_id}`);
      }
    });
    const unsubscribeTerminal = eventBus.on(BG_TERMINAL_CHANNEL, (data) => {
      const task = requireTerminal(data).task;
      terminals.push(task);
      eventOrder.push(`terminal:${task.id}:${task.status}`);
    });
    const { session } = await harness({ eventBus });
    try {
      await session.extensionRunner.emit({ type: 'session_start', reason: 'startup' });
      const caps = await emitEventRequest(eventBus, 'sdk-cap', 'capabilities', {});
      assert.deepEqual(requireOkResult(caps), BG_EXTENSION_CAPABILITIES);

      const run = await emitEventRequest(eventBus, 'sdk-run', 'run', {
        name: 'EventBus Echo',
        command: 'echo api-ok',
        isAgent: false,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const task = requiredTask(requireOkResult(run), 'run result task');
      assert.equal(task.name, 'EventBus Echo');
      assert.ok(
        task.status === 'running' || task.status === 'completed',
        `immediate run response status should be a valid launch snapshot, got ${task.status}`,
      );
      assert.ok(existsSync(task.outputPath));
      const terminal = await waitForTerminalSnapshot(terminals, task.id);
      assert.equal(terminal.status, 'completed');
      assert.equal(terminals.filter((entry) => entry.id === task.id).length, 1);
      assert.ok(
        eventOrder.findIndex((entry) => entry === `terminal:${task.id}:completed`) >
          eventOrder.indexOf('response:sdk-run'),
        'completed terminal must follow the correlated run response',
      );

      const logs = await emitEventRequest(eventBus, 'sdk-logs', 'logs', {
        taskId: task.id,
        maxBytes: 100,
        tail: true,
      });
      const logsResult = requiredJsonObject(requireOkResult(logs), 'logs result must be an object');
      assert.match(String(logsResult['text']), /api-ok/u);
      assert.equal(requiredTask(logsResult['task'], 'logs task').id, task.id);
      assert.equal(logsResult['tail'], true);

      const status = await emitEventRequest(eventBus, 'sdk-status', 'status', { taskId: task.id });
      const statusResult = requiredJsonObject(
        requireOkResult(status),
        'status result must be an object',
      );
      const statusTasks = statusResult['tasks'];
      assert.ok(Array.isArray(statusTasks), 'status tasks should be an array');
      assert.equal(requiredTask(statusTasks[0], 'status task').status, 'completed');

      const sleep = await emitEventRequest(eventBus, 'sdk-sleep', 'run', {
        name: 'EventBus Sleep',
        // `exec` is a POSIX shell builtin and shellQuote emits POSIX quoting;
        // neither is valid under cmd.exe. Node's own quoting handles both.
        command: `node -e ${JSON.stringify('setTimeout(() => {}, 5000)')}`,
        isAgent: false,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const sleepTask = requiredTask(requireOkResult(sleep), 'sleep run task');
      const kill = await emitEventRequest(eventBus, 'sdk-kill', 'kill', { taskId: sleepTask.id });
      const killResult = requiredJsonObject(requireOkResult(kill), 'kill result must be an object');
      assert.equal(requiredTask(killResult['task'], 'kill task').status, 'killed');
      const sleepTerminal = await waitForTerminalSnapshot(terminals, sleepTask.id);
      assert.equal(sleepTerminal.status, 'killed');
      assert.equal(terminals.filter((entry) => entry.id === sleepTask.id).length, 1);
      assert.ok(
        eventOrder.findIndex((entry) => entry === `terminal:${sleepTask.id}:killed`) >
          eventOrder.indexOf('response:sdk-kill'),
        'killed terminal must follow the kill response',
      );

      const malformed = await emitEventRequest(eventBus, 'sdk-malformed', 'run', {
        name: 'Bad EventBus Run',
        command: 'echo nope',
        isAgent: false,
        timeoutSeconds: null,
        notifyOnCompletion: true,
        triggerOnCompletion: true,
      });
      assert.equal(malformed.ok, false);
      assert.match(malformed.ok ? '' : malformed.error, /positive integer/u);

      const unknown = await emitEventRequest(eventBus, 'sdk-unknown', 'mystery', {});
      assert.equal(unknown.ok, false);
      assert.equal(unknown.operation, 'mystery');

      const firstDuplicate = await emitEventRequest(eventBus, 'sdk-dup', 'capabilities', {});
      assert.equal(firstDuplicate.ok, true);
      const duplicate = await emitEventRequest(eventBus, 'sdk-dup', 'capabilities', {});
      assert.equal(duplicate.ok, false);
      assert.match(duplicate.ok ? '' : duplicate.error, /duplicate request_id/u);
    } finally {
      unsubscribeTerminal();
      unsubscribeResponseOrder();
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('uses AgentSession.reload() to invalidate old runners and bind fresh EventBus activations', async () => {
    const eventBus = createEventBus();
    const responses: BackgroundTaskExtensionResponse[] = [];
    const terminals: BgTaskSnapshot[] = [];
    const unsubscribeResponses = eventBus.on(BG_RESPONSE_CHANNEL, (data) => {
      responses.push(requireEventResponse(data));
    });
    const unsubscribeTerminals = eventBus.on(BG_TERMINAL_CHANNEL, (data) => {
      terminals.push(requireTerminal(data).task);
    });
    const { session } = await harness({ eventBus });
    let bound = false;
    try {
      await session.bindExtensions({ onError: () => undefined });
      bound = true;
      for (let cycle = 1; cycle <= 2; cycle++) {
        const oldRunner = session.extensionRunner;
        const oldContext = oldRunner.createContext();
        const runningRequestId = `real-reload-${String(cycle)}-running`;
        const running = await emitEventRequest(eventBus, runningRequestId, 'run', {
          name: `Real Reload Running ${String(cycle)}`,
          command: `node -e ${JSON.stringify('setTimeout(() => {}, 10000)')}`,
          isAgent: false,
          notifyOnCompletion: false,
          triggerOnCompletion: false,
        });
        const runningTask = requiredTask(requireOkResult(running), 'real reload running task');
        assert.equal(runningTask.status, 'running');

        await session.reload();
        assert.notEqual(session.extensionRunner, oldRunner, 'reload must install a fresh runner');
        assert.throws(() => oldContext.cwd, /stale after session replacement or reload/u);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(
          terminals.filter((task) => task.id === runningTask.id).length,
          0,
          'reload-killed tasks must not publish on the disposed activation',
        );

        const quickRequestId = `real-reload-${String(cycle)}-quick`;
        const quick = await emitEventRequest(eventBus, quickRequestId, 'run', {
          name: `Real Reload Quick ${String(cycle)}`,
          command: 'echo reload-ok',
          isAgent: false,
          notifyOnCompletion: false,
          triggerOnCompletion: false,
        });
        const quickTask = requiredTask(requireOkResult(quick), 'real reload quick task');
        await waitForTerminalSnapshot(terminals, quickTask.id);
        assert.equal(
          responses.filter((response) => response.request_id === quickRequestId).length,
          1,
          'only the freshly bound activation may answer after reload',
        );
        assert.equal(
          terminals.filter((task) => task.id === quickTask.id).length,
          1,
          'the fresh activation must publish exactly one ordinary terminal',
        );
      }
    } finally {
      unsubscribeTerminals();
      unsubscribeResponses();
      if (bound) {
        await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      }
      session.dispose();
    }
  });

  void it('keeps an overlapping late session_start continuation from recreating status resources', async () => {
    type LifecycleHandler = (event: Record<string, unknown>, ctx: JsonObject) => unknown;
    const root = await mkdtemp(join(tmpdir(), 'pi-bg-late-session-start-'));
    roots.push(root);
    const cwd = join(root, 'project');
    await mkdir(cwd, { recursive: true });
    const handlers = new Map<string, LifecycleHandler[]>();
    const pi: ExtensionAPI = Object.assign(Object.create(null), {
      events: createEventBus(),
      on(name: string, handler: LifecycleHandler) {
        const registered = handlers.get(name) ?? [];
        registered.push(handler);
        handlers.set(name, registered);
        return () => undefined;
      },
      registerTool() {},
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getThinkingLevel() {
        return 'off';
      },
      getActiveTools() {
        return [];
      },
      setActiveTools() {},
    });
    const ctx: JsonObject = {
      cwd,
      sessionManager: { getSessionId: () => 'late-session-start' },
      modelRegistry: { getAll: () => [] },
      model: undefined,
      hasUI: false,
      mode: 'print',
      ui: { setStatus() {}, setWidget() {}, notify() {} },
    };
    const dispatch = async (name: string, event: Record<string, unknown>): Promise<void> => {
      for (const handler of [...(handlers.get(name) ?? [])]) await handler(event, ctx);
    };
    await backgroundTasksExtension(pi);

    const originalEnsureRuntimeDir = BackgroundTaskRegistry.prototype.ensureRuntimeDir;
    const enteredEnsure = deferred<void>();
    const releaseEnsure = deferred<void>();
    const activeIntervals = new Set<ReturnType<typeof setInterval>>();
    const realSetInterval = globalThis.setInterval;
    const realClearInterval = globalThis.clearInterval;
    globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
      const handle = realSetInterval(...args);
      activeIntervals.add(handle);
      return handle;
    }) as typeof setInterval;
    globalThis.clearInterval = ((handle?: ReturnType<typeof setInterval>) => {
      if (handle !== undefined) activeIntervals.delete(handle);
      return realClearInterval(handle);
    }) as typeof clearInterval;
    BackgroundTaskRegistry.prototype.ensureRuntimeDir = async function (context) {
      enteredEnsure.resolve(undefined);
      await releaseEnsure.promise;
      return originalEnsureRuntimeDir.call(this, context);
    };

    try {
      const start = dispatch('session_start', { type: 'session_start', reason: 'startup' });
      await enteredEnsure.promise;
      await dispatch('session_shutdown', { type: 'session_shutdown', reason: 'reload' });
      assert.equal(activeIntervals.size, 0, 'shutdown must clear all pre-existing intervals');

      releaseEnsure.resolve(undefined);
      await start;
      assert.equal(
        activeIntervals.size,
        0,
        'the old session_start continuation must not create a post-shutdown interval',
      );
    } finally {
      releaseEnsure.resolve(undefined);
      for (const handle of activeIntervals) realClearInterval(handle);
      activeIntervals.clear();
      BackgroundTaskRegistry.prototype.ensureRuntimeDir = originalEnsureRuntimeDir;
      globalThis.setInterval = realSetInterval;
      globalThis.clearInterval = realClearInterval;
    }
  });

  void it('supports status/log prefix resolution, all-task listing, head/tail truncation, and ambiguous/unknown ID errors', async () => {
    const { session } = await harness();
    try {
      const first = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'SDK First',
        // The head/tail assertions below are byte-exact, so the command must
        // emit exactly six bytes with no trailing newline. `printf` is
        // POSIX-only and `echo` appends a newline, so use node directly.
        command: `node -e ${JSON.stringify('process.stdout.write("abcdef")')}`,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const second = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'SDK Second',
        command: `node -e ${JSON.stringify('process.stdout.write("123456")')}`,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const firstDone = await wait(session, taskFromResult(first).id);
      await wait(session, taskFromResult(second).id);
      const all = await exec(session, 'bg_status', {});
      assert.ok(tasksFromResult(all).length >= 2);
      const byPrefix = await exec(session, 'bg_status', { taskId: firstDone.id.slice(0, 5) });
      assert.equal(firstTask(byPrefix).id, firstDone.id);
      await assert.rejects(
        () => exec(session, 'bg_status', { taskId: 'b' }),
        /Ambiguous task ID prefix/,
      );
      await assert.rejects(
        () => exec(session, 'bg_status', { taskId: 'bdeadbeef' }),
        /Unknown background task ID/,
      );
      const head = await exec(session, 'bg_logs', {
        taskId: firstDone.id,
        maxBytes: 3,
        tail: false,
      });
      assert.match(resultText(head), /^abc/);
      assert.match(resultText(head), /Showing head/);
      const tail = await exec(session, 'bg_logs', {
        taskId: firstDone.id,
        maxBytes: 3,
        tail: true,
      });
      assert.match(resultText(tail), /def/);
      assert.match(resultText(tail), /Showing tail/);
      await assert.rejects(
        () => exec(session, 'bg_logs', { taskId: 'bdeadbeef' }),
        /Unknown background task ID/,
      );
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('kills running tasks and rejects unknown or completed kills loudly', async () => {
    const { session } = await harness();
    try {
      const r = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'SDK Sleep',
        command: `node -e ${JSON.stringify('setTimeout(() => {}, 10000)')}`,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const task = taskFromResult(r);
      const k = await exec(session, 'bg_kill', { taskId: task.id.slice(0, 6) });
      assert.match(resultText(k), /Killed/);
      const t = await wait(session, task.id);
      assert.equal(t.status, 'killed');
      await assert.rejects(() => exec(session, 'bg_kill', { taskId: t.id }), /not running/);
      await assert.rejects(
        () => exec(session, 'bg_kill', { taskId: 'bdeadbeef' }),
        /Unknown background task ID/,
      );
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('fails timed-out tasks loudly', async () => {
    const { session } = await harness();
    try {
      const r = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'SDK Timeout',
        command: `node -e ${JSON.stringify('setTimeout(() => {}, 5000)')}`,
        timeoutSeconds: 1,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const t = await wait(session, taskFromResult(r).id, 80);
      assert.equal(t.status, 'failed');
      assert.match(t.error ?? '', /Timed out after 1s/);
      const logs = await exec(session, 'bg_logs', { taskId: t.id, maxBytes: 1000 });
      assert.match(resultText(logs), /background task timeout/);
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('records completion notifications exactly once when enabled and suppresses them when disabled', async () => {
    const { session } = await harness();
    try {
      const notified = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'Notify SDK',
        // The payload deliberately contains <, > and & to exercise escaping of
        // task output. Those are cmd.exe redirection and separator
        // metacharacters, so the literal must not appear in the command line;
        // it is rebuilt from character codes inside the child instead.
        command: `node -e ${JSON.stringify(
          'process.stdout.write(String.fromCharCode(60)+"ok"+String.fromCharCode(62,38)+"done")',
        )}`,
        notifyOnCompletion: true,
        triggerOnCompletion: false,
      });
      const hidden = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'No Notify SDK',
        command: 'echo quiet',
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      await wait(session, taskFromResult(notified).id);
      const hiddenTask = taskFromResult(hidden);
      await wait(session, hiddenTask.id);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const notes = customNotifications(session);
      assert.equal(notes.length, 1);
      const note = notes[0];
      assert.ok(note, 'completion notification should be recorded');
      assert.match(note.content, /<task-name>Notify SDK<\/task-name>/);
      assert.match(note.content, /<status>completed<\/status>/);
      assert.match(note.content, /&quot;|Notify SDK/);
      assert.equal(note.details['notified'], true);
      const status = await exec(session, 'bg_status', { taskId: hiddenTask.id });
      assert.equal(firstTask(status).notified, false);
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('captures only task-owned explicit telemetry in snapshots and metadata', async () => {
    const { session } = await harness();
    try {
      const tool = session.getToolDefinition('bg_run');
      assert.ok(tool, 'bg_run tool should be registered');
      const ctx = session.extensionRunner.createContext();
      ctx.getContextUsage = () => ({ tokens: 999_000, contextWindow: 1_000_000, percent: 99.9 });
      const script = `console.log(JSON.stringify({ type: "background-task-telemetry", model: "test-provider/test-model", contextUsage: { tokens: 50000, contextWindow: 200000, percent: 25 }, tokenUsage: { input: 1000, output: 200, cacheRead: 30, cacheWrite: 20, totalTokens: 1250 }, toolUsage: { total: 2, failed: 1, byName: { read: 1, bash: 1 } } })); console.log("context");`;
      const command = `node -e ${JSON.stringify(script)}`;
      const rawResult: unknown = await tool.execute(
        'call-context',
        {
          isAgent: false,
          name: 'Context SDK',
          command,
          notifyOnCompletion: false,
          triggerOnCompletion: false,
        },
        undefined,
        undefined,
        ctx,
      );
      assert.ok(isTestToolResult(rawResult), 'bg_run should return a typed tool result');
      const t = await wait(session, taskFromResult(rawResult).id);
      assert.deepEqual(t.contextUsage, { tokens: 50_000, contextWindow: 200_000, percent: 25 });
      assert.deepEqual(t.tokenUsage, {
        input: 1000,
        output: 200,
        cacheRead: 30,
        cacheWrite: 20,
        totalTokens: 1250,
      });
      assert.deepEqual(t.toolUsage, { total: 2, failed: 1, byName: { read: 1, bash: 1 } });
      assert.equal(t.model, 'test-provider/test-model');
      const status = await exec(session, 'bg_status', { taskId: t.id });
      assert.match(resultText(status), /ctx=25\.0%\/200k/);
      assert.match(resultText(status), /model=test-provider\/test-model/);
      assert.match(resultText(status), /tokens=1\.3k/);
      assert.match(resultText(status), /tools=2 failed=1/);
      const metadataPath = t.outputPath.replace(/\.output$/, '.json');
      let metadata = parseJsonObject(
        await readFile(metadataPath, 'utf8'),
        'telemetry metadata should be an object',
      );
      for (let attempt = 0; attempt < 40; attempt++) {
        metadata = parseJsonObject(
          await readFile(metadataPath, 'utf8'),
          'telemetry metadata should be an object',
        );
        if (metadata['contextUsage'] !== undefined) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.deepEqual(metadata['contextUsage'], {
        tokens: 50_000,
        contextWindow: 200_000,
        percent: 25,
      });
      assert.deepEqual(metadata['tokenUsage'], t.tokenUsage);
      assert.deepEqual(metadata['toolUsage'], t.toolUsage);
      assert.equal(metadata['model'], 'test-provider/test-model');

      const legacy = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'Legacy Context SDK',
        command: `node -e ${JSON.stringify('console.log(JSON.stringify({ type: "background-task-context-usage", tokens: 42, contextWindow: 1000, percent: 4.2 }))')}`,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const legacyTask = await wait(session, taskFromResult(legacy).id);
      assert.deepEqual(legacyTask.contextUsage, { tokens: 42, contextWindow: 1000, percent: 4.2 });
      assert.equal(legacyTask.tokenUsage, undefined);

      const noTelemetry = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'No Context SDK',
        command: 'echo no-context',
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const noTelemetryTask = await wait(session, taskFromResult(noTelemetry).id);
      assert.equal(noTelemetryTask.contextUsage, undefined);
      assert.equal(noTelemetryTask.tokenUsage, undefined);
      assert.equal(noTelemetryTask.toolUsage, undefined);
      assert.equal(noTelemetryTask.model, undefined);
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('wraps explicitly marked background Pi agents and captures context telemetry', async (t) => {
    if (skipWin32PosixPiTelemetry(t)) return;
    const { session, cwd } = await harness();
    const oldPath = process.env['PATH'];
    try {
      const bin = join(cwd, 'bin');
      await mkdir(bin, { recursive: true });
      const fakePi = join(bin, 'pi');
      await writeFile(
        fakePi,
        `#!/usr/bin/env node
const args = process.argv.slice(2);
if (!args.includes("--mode") || args[args.indexOf("--mode") + 1] !== "json") {
  console.error("expected --mode json: " + JSON.stringify(args));
  process.exit(3);
}
if (args.includes("-p") || args.includes("--print")) {
  console.error("print flag should be removed: " + JSON.stringify(args));
  process.exit(4);
}
const firstMessage = {
  role: "assistant",
  model: "openai-codex/gpt-5.5",
  usage: { input: 1000, output: 200, cacheRead: 30, cacheWrite: 20, totalTokens: 1250 },
  content: [{ type: "toolCall", id: "call-read", name: "read", arguments: { path: "README.md" } }],
  stopReason: "toolUse",
  timestamp: Date.now()
};
const secondMessage = {
  role: "assistant",
  model: "openai-codex/gpt-5.5",
  usage: { input: 300, output: 50, cacheRead: 0, cacheWrite: 10, totalTokens: 360 },
  content: [{ type: "text", text: "fake child final" }],
  stopReason: "stop",
  timestamp: Date.now()
};
console.log(JSON.stringify({ type: "message_end", message: firstMessage }));
console.log(JSON.stringify({ type: "tool_execution_start", toolCallId: "call-read", toolName: "read", args: { path: "README.md" } }));
console.log(JSON.stringify({ type: "tool_execution_end", toolCallId: "call-read", toolName: "read", result: {}, isError: false }));
console.log(JSON.stringify({ type: "tool_execution_start", toolCallId: "call-bash", toolName: "bash", args: { command: "false" } }));
console.log(JSON.stringify({ type: "tool_execution_end", toolCallId: "call-bash", toolName: "bash", result: {}, isError: true }));
console.log(JSON.stringify({ type: "message_end", message: secondMessage }));
`,
        'utf8',
      );
      await chmod(fakePi, 0o755);
      process.env['PATH'] = `${bin}${delimiter}${oldPath ?? ''}`;

      const r = await exec(session, 'bg_run', {
        isAgent: true,
        name: 'Wrapped Pi Agent',
        command: 'pi --model openai-codex/gpt-5.5 -p hello',
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const t = await wait(session, taskFromResult(r).id);
      assert.equal(t.status, 'completed');
      assert.deepEqual(t.contextUsage, {
        tokens: 360,
        contextWindow: 272000,
        percent: (360 / 272000) * 100,
      });
      assert.deepEqual(t.tokenUsage, {
        input: 1300,
        output: 250,
        cacheRead: 30,
        cacheWrite: 30,
        totalTokens: 1610,
      });
      assert.deepEqual(t.toolUsage, { total: 2, failed: 1, byName: { read: 1, bash: 1 } });
      assert.equal(t.model, 'openai-codex/gpt-5.5');
      const status = await exec(session, 'bg_status', { taskId: t.id });
      assert.match(resultText(status), /model=openai-codex\/gpt-5\.5/);
      assert.match(resultText(status), /tokens=1\.6k/);
      assert.match(resultText(status), /tools=2 failed=1/);
      const logs = await exec(session, 'bg_logs', { taskId: t.id, maxBytes: 4000, tail: false });
      const logText = resultText(logs);
      assert.match(logText, /\u2192 read README\.md/);
      assert.match(logText, /\u2717 bash failed/);
      assert.match(logText, /fake child final/);
      assert.doesNotMatch(logText, /background-task-telemetry/);
      assert.doesNotMatch(logText, /background-task-context-usage/);
      assert.doesNotMatch(logText, /background-task-activity/);
      const metadataPath = t.outputPath.replace(/\.output$/, '.json');
      const metadata = parseJsonObject(
        await readFile(metadataPath, 'utf8'),
        'wrapped Pi metadata should be an object',
      );
      assert.deepEqual(metadata['contextUsage'], t.contextUsage);
      assert.deepEqual(metadata['tokenUsage'], t.tokenUsage);
      assert.deepEqual(metadata['toolUsage'], t.toolUsage);
      assert.equal(metadata['model'], 'openai-codex/gpt-5.5');
    } finally {
      restoreEnvValue('PATH', oldPath);
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it(
    'wraps an explicitly marked real child Pi and counts JSON token/tool telemetry',
    { timeout: 20_000 },
    async (t) => {
      if (process.platform === 'win32') {
        t.skip('POSIX shell env-prefix child-pi telemetry smoke is not portable to Windows');
        return;
      }
      const piCli = resolvePiCli();
      if (!piCli) {
        t.skip('pi CLI is not available on PATH for real child-pi telemetry smoke');
        return;
      }
      const { session, cwd } = await harness();
      try {
        const childAgentDir = join(cwd, 'child-agent');
        const childSessionDir = join(cwd, 'child-sessions');
        await mkdir(childAgentDir, { recursive: true });
        await mkdir(childSessionDir, { recursive: true });
        const envPrefix = Object.entries({
          PI_BG_SCRIPTED_SCENARIO: 'json-tool-telemetry',
          PI_BG_SCRIPTED_API_KEY: 'scripted-api-key',
          PI_CODING_AGENT_DIR: childAgentDir,
          PI_CODING_AGENT_SESSION_DIR: childSessionDir,
          PI_OFFLINE: '1',
          PI_SKIP_VERSION_CHECK: '1',
          PI_TELEMETRY: '0',
          CI: '1',
          PATH: `${dirname(piCli)}${delimiter}${process.env['PATH'] ?? ''}`,
        })
          .map(([key, value]) => `${key}=${shellQuote(value)}`)
          .join(' ');
        const command = `${envPrefix} pi --offline --no-session --no-extensions -e ${shellQuote(scriptedProviderPath)} --no-skills --no-prompt-templates --no-context-files --model pi-bg-scripted/scripted-model -p ${shellQuote('exercise real json tool telemetry')}`;
        const r = await exec(session, 'bg_run', {
          isAgent: true,
          name: 'Real Pi Telemetry',
          command,
          notifyOnCompletion: false,
          triggerOnCompletion: false,
        });
        const t = await wait(session, taskFromResult(r).id, 240);
        assert.equal(t.status, 'completed');
        assert.deepEqual(t.tokenUsage, {
          input: 20,
          output: 10,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 30,
          costTotal: 0,
        });
        assert.deepEqual(t.toolUsage, { total: 2, failed: 1, byName: { scripted_echo: 2 } });
        assert.equal(t.model, 'pi-bg-scripted/scripted-model');
        const status = await exec(session, 'bg_status', { taskId: t.id });
        assert.match(resultText(status), /model=pi-bg-scripted\/scripted-model/);
        assert.match(resultText(status), /tokens=30/);
        assert.match(resultText(status), /tools=2 failed=1/);
        const logs = await exec(session, 'bg_logs', { taskId: t.id, maxBytes: 8000, tail: false });
        const logText = resultText(logs);
        assert.match(logText, /JSON tool telemetry complete/);
        assert.match(logText, /scripted_echo/);
        assert.doesNotMatch(logText, /background-task-telemetry/);
      } finally {
        await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
        session.dispose();
      }
    },
  );

  void it('mounts one passive sidebar only in TUI mode and removes it on shutdown', async () => {
    const { session } = await harness();
    const widgets: boolean[] = [];
    const statuses: Array<string | undefined> = [];
    const ui: ExtensionUIContext = {
      ...makeStatusUi(session.extensionRunner.getUIContext(), statuses, []),
      setWidget: (key, content) => {
        assert.equal(key, 'background-tasks');
        widgets.push(typeof content === 'function');
      },
    };
    try {
      session.extensionRunner.setUIContext(ui, 'rpc');
      await session.extensionRunner.emit({ type: 'session_start', reason: 'startup' });
      assert.deepEqual(widgets, [], 'RPC must not install a terminal sidebar');
      session.extensionRunner.setUIContext(ui, 'tui');
      await session.extensionRunner.emit({ type: 'session_start', reason: 'startup' });
      assert.deepEqual(widgets, [true], 'TUI installs a component factory');
      await session.extensionRunner.emit({ type: 'session_start', reason: 'startup' });
      assert.deepEqual(widgets, [true], 'repeated startup does not duplicate sidebar');
      const started = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'Sidebar Silent',
        command: `node -e ${JSON.stringify('setTimeout(() => {}, 1000)')}`,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      await wait(session, taskFromResult(started).id);
      assert.deepEqual(statuses, [], 'sidebar replaces background-task footer status');
      assert.deepEqual(widgets, [true], 'registry refresh must retain the mounted widget');
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
    assert.deepEqual(widgets, [true, false], 'shutdown removes the owned widget');
  });

  void it('clears finished sidebar notices without stopping running jobs', async () => {
    const { session } = await harness();
    const notifications: UiNotification[] = [];
    session.extensionRunner.setUIContext(
      makeStatusUi(session.extensionRunner.getUIContext(), [], notifications),
    );
    try {
      const running = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'Sidebar Running',
        command: `node -e ${JSON.stringify('setTimeout(() => {}, 10000)')}`,
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const done = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'Sidebar Done',
        command: 'echo done',
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      await wait(session, taskFromResult(done).id);
      const clear = session.extensionRunner.getRegisteredCommands()
        .find((cmd) => cmd.invocationName === 'bg-clear');
      assert.ok(clear);
      await clear.handler('', session.extensionRunner.createCommandContext());
      assert.match(notifications.at(-1)?.message ?? '', /Cleared 1 finished/);
      await clear.handler('', session.extensionRunner.createCommandContext());
      assert.match(notifications.at(-1)?.message ?? '', /No finished background task notices/);
      const status = await exec(session, 'bg_status', { taskId: taskFromResult(running).id });
      assert.match(resultText(status), /running/);
      await exec(session, 'bg_kill', { taskId: taskFromResult(running).id });
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('uses bg_run prepareArguments for legacy calls without names', async () => {
    const { session } = await harness();
    try {
      const tool = session.getToolDefinition('bg_run');
      assert.ok(tool?.prepareArguments);
      const prepared = requiredPrepared(
        tool.prepareArguments({ command: 'npm run qa', description: 'Legacy QA', isAgent: false }),
      );
      assert.equal(prepared.name, 'Legacy QA');
      assert.equal(prepared.isAgent, false);
      const agent = requiredPrepared(
        tool.prepareArguments({ name: 'Legacy Agent', command: 'pi -p hi', isAgent: true }),
      );
      assert.equal(agent.isAgent, true);
      assert.throws(
        () => tool.prepareArguments?.({ command: 'pnpm test' }),
        /requires isAgent boolean/,
      );
      assert.throws(() => tool.prepareArguments?.(null), /arguments must be an object/);
      const invalid = { name: 'Background task', command: '', isAgent: false };
      await assert.rejects(
        () => exec(session, 'bg_run', { name: 'Missing Agent Flag', command: 'echo ok' }),
        /requires isAgent boolean/,
      );
      await assert.rejects(() => exec(session, 'bg_run', invalid), /Background command is empty/);
    } finally {
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('fails spawn errors loudly and writes failure metadata', async () => {
    const previousShell = process.env['SHELL'];
    const previousComSpec = process.env['ComSpec'];
    if (process.platform === 'win32') {
      process.env['ComSpec'] = 'C:\\definitely\\missing\\pi-bg-shell.exe';
    } else {
      process.env['SHELL'] = '/definitely/missing/pi-bg-shell';
    }
    const { session } = await harness();
    try {
      const r = await exec(session, 'bg_run', {
        isAgent: false,
        name: 'Bad Shell',
        command: 'echo nope',
        notifyOnCompletion: false,
        triggerOnCompletion: false,
      });
      const t = await wait(session, taskFromResult(r).id);
      assert.equal(t.status, 'failed');
      assert.match(t.error ?? '', /ENOENT|no such file/i);
      const metadataPath = t.outputPath.replace(/\.output$/, '.json');
      const metadata = await readJsonWithStatus(metadataPath, 'failed');
      assert.equal(metadata['status'], 'failed');
    } finally {
      restoreEnvValue('SHELL', previousShell);
      restoreEnvValue('ComSpec', previousComSpec);
      await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
      session.dispose();
    }
  });

  void it('cleans up multiple running tasks on shutdown', async () => {
    const { session } = await harness();
    const one = await exec(session, 'bg_run', {
      isAgent: false,
      name: 'SDK Shutdown One',
      command: `node -e ${JSON.stringify('setTimeout(() => {}, 10000)')}`,
      notifyOnCompletion: false,
      triggerOnCompletion: false,
    });
    const two = await exec(session, 'bg_run', {
      isAgent: false,
      name: 'SDK Shutdown Two',
      command: `node -e ${JSON.stringify('setTimeout(() => {}, 10000)')}`,
      notifyOnCompletion: false,
      triggerOnCompletion: false,
    });
    await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
    const s1 = await exec(session, 'bg_status', { taskId: taskFromResult(one).id });
    const s2 = await exec(session, 'bg_status', { taskId: taskFromResult(two).id });
    assert.equal(firstTask(s1).status, 'killed');
    assert.equal(firstTask(s2).status, 'killed');
    assert.match(firstTask(s1).error ?? '', /shutdown/);
    session.dispose();
  });
});
