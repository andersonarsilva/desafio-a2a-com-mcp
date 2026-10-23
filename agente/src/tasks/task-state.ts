import type { TaskState } from './types.js';

const TERMINAIS: ReadonlySet<TaskState> = new Set(['TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED']);

const TRANSICOES: Readonly<Record<TaskState, readonly TaskState[]>> = {
  TASK_STATE_SUBMITTED: ['TASK_STATE_WORKING', 'TASK_STATE_FAILED'],
  TASK_STATE_WORKING: ['TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED'],
  TASK_STATE_INPUT_REQUIRED: ['TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_WORKING', 'TASK_STATE_CANCELED', 'TASK_STATE_FAILED'],
  TASK_STATE_COMPLETED: [],
  TASK_STATE_FAILED: [],
  TASK_STATE_CANCELED: [],
};

export function isTerminal(state: TaskState): boolean {
  return TERMINAIS.has(state);
}

export function podeTransitar(de: TaskState, para: TaskState): boolean {
  return TRANSICOES[de].includes(para);
}
