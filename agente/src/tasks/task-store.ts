import type { ToolCall } from '../mcp-host/mcp-host.js';
import type { TraceContext } from '../mcp-host/trace-context.js';
import type { IdGenerator } from './ids.js';
import { podeTransitar } from './task-state.js';
import type { Artifact, Message, Task, TaskState } from './types.js';

export interface PendingInput {
  call: ToolCall;
  inputKey: string;
  field: string;
  opcoes: string[];
  requestState?: string;
}

export interface TaskRecord {
  task: Task;
  trace: TraceContext;
  pending?: PendingInput;
  politica?: string;
}

export class TransicaoInvalidaError extends Error {
  constructor(de: TaskState, para: TaskState) {
    super(`Transicao invalida de ${de} para ${para}`);
  }
}

export interface TaskStore {
  create(trace: TraceContext, contextId?: string): TaskRecord;
  get(id: string): TaskRecord | undefined;
}

export function createTaskStore(ids: IdGenerator, agora: () => Date = () => new Date()): TaskStore {
  const tasks = new Map<string, TaskRecord>();
  return {
    create(trace, contextId) {
      const task: Task = {
        id: ids.task(),
        contextId: contextId ?? ids.context(),
        status: { state: 'TASK_STATE_SUBMITTED', timestamp: agora().toISOString() },
        history: [],
        artifacts: [],
      };
      const record = { task, trace };
      tasks.set(task.id, record);
      return record;
    },
    get: (id) => tasks.get(id),
  };
}

export function transitar(record: TaskRecord, para: TaskState, message?: Message, agora: Date = new Date()): void {
  const de = record.task.status.state;
  if (!podeTransitar(de, para)) throw new TransicaoInvalidaError(de, para);
  record.task.status = message ? { state: para, message, timestamp: agora.toISOString() } : { state: para, timestamp: agora.toISOString() };
  if (message) record.task.history.push(message);
}

export function registrarMensagem(record: TaskRecord, message: Message): void {
  record.task.history.push(message);
}

export function anexarArtifact(record: TaskRecord, artifact: Artifact): void {
  record.task.artifacts.push(artifact);
}
