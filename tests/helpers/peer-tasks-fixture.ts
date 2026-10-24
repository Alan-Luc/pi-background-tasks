import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface SeededTask {
  id: string;
}

interface PublicTaskStore {
  create(subject: string, description: string): SeededTask;
  update(id: string, fields: { status: 'pending' | 'in_progress' | 'completed' }): unknown;
}

interface TaskStoreModule {
  TaskStore: new (path?: string) => PublicTaskStore;
}

function isTaskStoreModule(value: unknown): value is TaskStoreModule {
  if (typeof value !== 'object' || value === null || !('TaskStore' in value)) return false;
  const TaskStore = value.TaskStore;
  return typeof TaskStore === 'function';
}

export async function seedPeerTasks(peerRoot: string, storePath: string): Promise<string[]> {
  const moduleUrl = pathToFileURL(join(peerRoot, 'src', 'task-store.ts')).href;
  const loaded: unknown = await import(moduleUrl);
  if (!isTaskStoreModule(loaded)) throw new Error('peer TaskStore public API is unavailable');

  const store = new loaded.TaskStore(storePath);
  return ['One', 'Two', 'Three', 'Four'].map((name) => {
    const task = store.create(`Native Task ${name}`, 'Seeded through the peer TaskStore API');
    store.update(task.id, { status: 'in_progress' });
    return task.id;
  });
}
