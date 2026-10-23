import { describe, expect, it } from '@jest/globals';
import { isTerminal, podeTransitar } from '../../src/tasks/task-state.js';

describe('maquina de estados da Task', () => {
  it('passa por SUBMITTED e WORKING antes de terminar', () => {
    expect(podeTransitar('TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING')).toBe(true);
    expect(podeTransitar('TASK_STATE_SUBMITTED', 'TASK_STATE_COMPLETED')).toBe(false);
    expect(podeTransitar('TASK_STATE_WORKING', 'TASK_STATE_INPUT_REQUIRED')).toBe(true);
    expect(podeTransitar('TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_WORKING')).toBe(true);
    expect(podeTransitar('TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_INPUT_REQUIRED')).toBe(true);
  });

  it.each(['TASK_STATE_COMPLETED', 'TASK_STATE_FAILED', 'TASK_STATE_CANCELED'] as const)('%s e terminal e definitivo', (estado) => {
    expect(isTerminal(estado)).toBe(true);
    expect(podeTransitar(estado, 'TASK_STATE_WORKING')).toBe(false);
  });

  it('estados ativos nao sao terminais', () => {
    expect(isTerminal('TASK_STATE_INPUT_REQUIRED')).toBe(false);
  });
});
