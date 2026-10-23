import { describe, expect, it } from '@jest/globals';
import { CODIGOS, JsonRpcError } from '../../src/a2a/json-rpc.js';
import { createA2AMethods } from '../../src/a2a/methods.js';
import { createReservationBridge } from '../../src/bridge/reservation-bridge.js';
import type { ToolOutcome } from '../../src/mcp-host/mcp-host.js';
import { createTaskStore } from '../../src/tasks/task-store.js';
import { elicitacao, fakeHost, reservaFeita, sequentialIds, TRACE } from '../helpers/fakes.js';

const PEDIDO = 'reservar sala=sala-garagem inicio=2026-11-03T14:00:00-03:00 fim=2026-11-03T15:00:00-03:00 responsavel=Marty';

function setup(respostas: ToolOutcome[]) {
  const ids = sequentialIds();
  const host = fakeHost(respostas);
  return { host, methods: createA2AMethods(createTaskStore(ids), createReservationBridge({ host, ids })) };
}

const mensagem = (text: string, extra: Record<string, unknown> = {}) => ({
  message: { messageId: `m-${text}`, role: 'ROLE_USER', parts: [{ text }], ...extra },
});

async function codigoDoErro(promessa: Promise<unknown>): Promise<number> {
  const erro = await promessa.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(erro instanceof JsonRpcError)) throw new Error('esperava JsonRpcError');
  return erro.code;
}

describe('SendMessage', () => {
  it('abre Task nova e devolve { task } no formato v1.0', async () => {
    const { methods } = setup([reservaFeita('sala-garagem')]);
    const { task } = await methods.dispatch('SendMessage', mensagem(PEDIDO), { trace: TRACE });
    expect(task).toMatchObject({ id: 'task-1', contextId: 'ctx-1', status: { state: 'TASK_STATE_COMPLETED' } });
    expect(task.history[0]).toEqual({ messageId: `m-${PEDIDO}`, role: 'ROLE_USER', parts: [{ text: PEDIDO }] });
    expect(task.history[1]).toMatchObject({ role: 'ROLE_AGENT', taskId: 'task-1', contextId: 'ctx-1' });
  });

  it('usa o traceparent do request A2A e gera um quando ausente', async () => {
    const { methods, host } = setup([reservaFeita('a'), reservaFeita('b')]);
    await methods.dispatch('SendMessage', mensagem(PEDIDO), { trace: TRACE });
    await methods.dispatch('SendMessage', mensagem(PEDIDO), {});
    const traceIds = host.traceparents.map((tp) => tp.split('-')[1]);
    expect(traceIds.slice(0, 3)).toEqual([TRACE.traceId, TRACE.traceId, TRACE.traceId]);
    expect(traceIds[3]).not.toBe(TRACE.traceId);
  });

  it('continua a Task pausada e preserva o contextId', async () => {
    const { methods } = setup([elicitacao(['sala-fusca']), reservaFeita('sala-fusca')]);
    const pausada = await methods.dispatch('SendMessage', mensagem(PEDIDO, { contextId: 'ctx-cli' }), {});
    expect(pausada.task.status.state).toBe('TASK_STATE_INPUT_REQUIRED');
    expect(pausada.task.contextId).toBe('ctx-cli');

    const { task } = await methods.dispatch('SendMessage', mensagem('escolha=sala-fusca', { taskId: pausada.task.id }), {});
    expect(task.status.state).toBe('TASK_STATE_COMPLETED');
    expect(task.history.map((m) => m.parts[0]!.text)).toEqual([PEDIDO, 'alternativas: sala-fusca', 'escolha=sala-fusca', 'Reserva res-0003 confirmada na sala-fusca.']);
  });

  it('recusa SendMessage em Task terminal', async () => {
    const { methods } = setup([reservaFeita('a')]);
    const { task } = await methods.dispatch('SendMessage', mensagem(PEDIDO), {});
    expect(await codigoDoErro(methods.dispatch('SendMessage', mensagem('escolha=a', { taskId: task.id }), {}))).toBe(CODIGOS.unsupportedOperation);
  });

  it('recusa SendMessage em Task que nao aguarda input', async () => {
    const ids = sequentialIds();
    const store = createTaskStore(ids);
    const methods = createA2AMethods(store, createReservationBridge({ host: fakeHost([]), ids }));
    const record = store.create(TRACE);
    expect(await codigoDoErro(methods.dispatch('SendMessage', mensagem('escolha=a', { taskId: record.task.id }), {}))).toBe(CODIGOS.unsupportedOperation);
  });

  it('devolve TaskNotFound para taskId desconhecido', async () => {
    const { methods } = setup([]);
    expect(await codigoDoErro(methods.dispatch('SendMessage', mensagem('escolha=a', { taskId: 'task-x' }), {}))).toBe(CODIGOS.taskNotFound);
  });

  it.each([
    ['sem message', {}],
    ['role errado', { message: { messageId: 'm', role: 'ROLE_AGENT', parts: [{ text: 'x' }] } }],
    ['sem partes de texto', { message: { messageId: 'm', role: 'ROLE_USER', parts: [{ data: {} }] } }],
  ])('valida params: %s', async (_caso, params) => {
    const { methods } = setup([]);
    expect(await codigoDoErro(methods.dispatch('SendMessage', params, {}))).toBe(CODIGOS.invalidParams);
  });
});

describe('GetTask e metodos desconhecidos', () => {
  it('reflete o estado corrente da Task', async () => {
    const { methods } = setup([elicitacao(['sala-fusca'])]);
    const { task } = await methods.dispatch('SendMessage', mensagem(PEDIDO), {});
    const lida = await methods.dispatch('GetTask', { id: task.id }, {});
    expect(lida.task).toEqual(task);
  });

  it('erros de GetTask e metodo inexistente', async () => {
    const { methods } = setup([]);
    expect(await codigoDoErro(methods.dispatch('GetTask', { id: 'nada' }, {}))).toBe(CODIGOS.taskNotFound);
    expect(await codigoDoErro(methods.dispatch('GetTask', {}, {}))).toBe(CODIGOS.invalidParams);
    expect(await codigoDoErro(methods.dispatch('SendStreamingMessage', {}, {}))).toBe(CODIGOS.methodNotFound);
  });
});
