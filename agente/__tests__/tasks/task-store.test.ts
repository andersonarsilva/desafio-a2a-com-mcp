import { describe, expect, it } from '@jest/globals';
import { randomIds } from '../../src/tasks/ids.js';
import { anexarArtifact, createTaskStore, registrarMensagem, transitar, TransicaoInvalidaError } from '../../src/tasks/task-store.js';
import { toWireTask } from '../../src/tasks/task-view.js';
import { sequentialIds, TRACE } from '../helpers/fakes.js';

const agora = () => new Date('2026-11-03T12:00:00Z');

describe('createTaskStore', () => {
  it('abre Task com id e contextId proprios em SUBMITTED', () => {
    const store = createTaskStore(sequentialIds(), agora);
    const record = store.create(TRACE);
    expect(record.task).toEqual({
      id: 'task-1', contextId: 'ctx-1', status: { state: 'TASK_STATE_SUBMITTED', timestamp: '2026-11-03T12:00:00.000Z' }, history: [], artifacts: [],
    });
    expect(store.get('task-1')).toBe(record);
    expect(store.get('task-x')).toBeUndefined();
  });

  it('reaproveita o contextId informado pelo cliente', () => {
    expect(createTaskStore(sequentialIds()).create(TRACE, 'ctx-cliente').task.contextId).toBe('ctx-cliente');
  });

  it('gera ids aleatorios com prefixo', () => {
    expect(randomIds.task()).toMatch(/^task-[0-9a-f]{12}$/);
    expect(randomIds.context()).toMatch(/^ctx-/);
    expect(randomIds.message()).toMatch(/^msg-/);
    expect(randomIds.artifact()).toMatch(/^art-/);
  });
});

describe('transitar', () => {
  it('atualiza status e historico', () => {
    const record = createTaskStore(sequentialIds()).create(TRACE);
    transitar(record, 'TASK_STATE_WORKING');
    expect(record.task.status.message).toBeUndefined();
    const msg = { messageId: 'm', role: 'ROLE_AGENT' as const, parts: [{ text: 'ok' }] };
    transitar(record, 'TASK_STATE_COMPLETED', msg);
    expect(record.task.status).toMatchObject({ state: 'TASK_STATE_COMPLETED', message: msg });
    expect(record.task.history).toEqual([msg]);
  });

  it('recusa sair de estado terminal', () => {
    const record = createTaskStore(sequentialIds()).create(TRACE);
    transitar(record, 'TASK_STATE_WORKING');
    transitar(record, 'TASK_STATE_FAILED');
    expect(() => transitar(record, 'TASK_STATE_WORKING')).toThrow(TransicaoInvalidaError);
  });
});

describe('toWireTask', () => {
  it('nunca expoe o pedido pendente nem o requestState', () => {
    const record = createTaskStore(sequentialIds()).create(TRACE);
    registrarMensagem(record, { messageId: 'u', role: 'ROLE_USER', parts: [{ text: 'oi' }] });
    anexarArtifact(record, { artifactId: 'a', name: 'reserva', parts: [{ text: '{}' }] });
    record.pending = { call: { name: 'reservar_sala', arguments: {} }, inputKey: 'k', field: 'sala', opcoes: ['x'], requestState: 'v1.SEGREDO' };
    record.politica = '2026-11-01';

    const wire = toWireTask(record);
    expect(Object.keys(wire).sort()).toEqual(['artifacts', 'contextId', 'history', 'id', 'status']);
    expect(JSON.stringify(wire)).not.toContain('SEGREDO');
    wire.history.push({ messageId: 'x', role: 'ROLE_USER', parts: [] });
    expect(record.task.history).toHaveLength(1);
  });
});
