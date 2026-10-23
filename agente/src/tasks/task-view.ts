import type { TaskRecord } from './task-store.js';
import type { Task } from './types.js';

export function toWireTask({ task }: TaskRecord): Task {
  return structuredClone({
    id: task.id,
    contextId: task.contextId,
    status: task.status,
    history: task.history,
    artifacts: task.artifacts,
  });
}
