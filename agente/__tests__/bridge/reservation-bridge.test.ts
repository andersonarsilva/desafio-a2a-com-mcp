import { describe, expect, it } from '@jest/globals';
import { FORMATO_DO_PEDIDO } from '../../src/commands/parse.js';
import { createReservationBridge, linhaDeAlternativas } from '../../src/bridge/reservation-bridge.js';
import type { ToolOutcome } from '../../src/mcp-host/mcp-host.js';
import { createTaskStore } from '../../src/tasks/task-store.js';
import { elicitacao, fakeHost, reservaFeita, sequentialIds, TRACE } from '../helpers/fakes.js';

const PEDIDO = 'reservar sala=sala-garagem inicio=2026-11-03T14:00:00-03:00 fim=2026-11-03T15:00:00-03:00 responsavel=Marty';

function cenario(respostas: Array<ToolOutcome | Error>, tools?: string[], politica?: string) {
  const ids = sequentialIds();
  const host = fakeHost(respostas, tools, politica);
  const store = createTaskStore(ids);
  return { host, store, bridge: createReservationBridge({ host, ids }), record: store.create(TRACE) };
}

const ultimaMensagem = (record: { task: { status: { message?: { parts: Array<{ text: string }> } } } }) =>
  record.task.status.message?.parts[0]?.text;

describe('start', () => {
  it('conclui com artifact reserva levando a versao da politica lida do resource', async () => {
    const { bridge, record, host } = cenario([reservaFeita('sala-garagem')]);
    await bridge.start(record, PEDIDO);

    expect(record.task.status.state).toBe('TASK_STATE_COMPLETED');
    expect(ultimaMensagem(record)).toBe('Reserva res-0003 confirmada na sala-garagem.');
    expect(record.task.artifacts).toHaveLength(1);
    expect(record.task.artifacts[0]!.name).toBe('reserva');
    expect(JSON.parse(record.task.artifacts[0]!.parts[0]!.text)).toEqual({
      reserva: 'res-0003', sala: 'sala-garagem', inicio: '2026-11-03T14:00:00-03:00', fim: '2026-11-03T15:00:00-03:00', responsavel: 'Marty', politica: '2026-11-01',
    });
    expect(host.calls[0]!.call).toEqual({
      name: 'reservar_sala',
      arguments: { sala: 'sala-garagem', inicio: '2026-11-03T14:00:00-03:00', fim: '2026-11-03T15:00:00-03:00', responsavel: 'Marty' },
    });
  });

  it('propaga o mesmo trace-id em todos os requests MCP da Task', async () => {
    const { bridge, record, host } = cenario([elicitacao(['sala-fusca']), reservaFeita('sala-fusca')]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=sala-fusca');
    expect(host.traceparents).toHaveLength(4);
    for (const tp of host.traceparents) expect(tp.split('-')[1]).toBe(TRACE.traceId);
    expect(new Set(host.traceparents).size).toBe(4);
  });

  it('pausa com a linha exata de alternativas e guarda o requestState so no record', async () => {
    const { bridge, record } = cenario([elicitacao(['sala-fusca', 'sala-mirante'])]);
    await bridge.start(record, PEDIDO);

    expect(record.task.status.state).toBe('TASK_STATE_INPUT_REQUIRED');
    expect(ultimaMensagem(record)).toBe('alternativas: sala-fusca, sala-mirante');
    expect(record.pending).toMatchObject({ inputKey: 'escolha_de_sala', field: 'sala', opcoes: ['sala-fusca', 'sala-mirante'], requestState: 'v1.estado-opaco-sala-fusca-sala-mirante' });
    expect(JSON.stringify(record.task)).not.toContain('estado-opaco');
  });

  it('termina em FAILED com a mensagem exata da tool', async () => {
    const { bridge, record } = cenario([{ kind: 'complete', isError: true, text: 'Sala inexistente: sala-delorean' }]);
    await bridge.start(record, PEDIDO);
    expect(record.task.status.state).toBe('TASK_STATE_FAILED');
    expect(ultimaMensagem(record)).toBe('Sala inexistente: sala-delorean');
  });

  it.each([
    ['pedido fora do formato', 'oi', [], undefined, undefined, FORMATO_DO_PEDIDO],
    ['tool nao descoberta', PEDIDO, [], ['listar_salas'], undefined, 'Tool reservar_sala nao foi descoberta no servidor MCP'],
    ['politica sem versao', PEDIDO, [], undefined, '- sem versao', 'Politica de uso sem versao declarada'],
    ['erro de protocolo', PEDIDO, [new Error('Invalid params')], undefined, undefined, 'Invalid params'],
    ['input nao suportado', PEDIDO, [{ kind: 'input_required', inputRequests: {} } as ToolOutcome], undefined, undefined, 'Pedido de input do servidor MCP nao suportado'],
    ['structuredContent inesperado', PEDIDO, [{ kind: 'complete', isError: false, text: '' } as ToolOutcome], undefined, undefined, 'Resposta inesperada do servidor MCP'],
  ])('falha quando %s', async (_caso, texto, respostas, tools, politica, mensagem) => {
    const { bridge, record } = cenario(respostas as ToolOutcome[], tools, politica);
    await bridge.start(record, texto);
    expect(record.task.status.state).toBe('TASK_STATE_FAILED');
    expect(ultimaMensagem(record)).toBe(mensagem);
  });

  it('converte falha que nao e Error em mensagem', async () => {
    const { bridge, record, host } = cenario([]);
    host.callTool = async () => {
      throw 'texto';
    };
    await bridge.start(record, PEDIDO);
    expect(ultimaMensagem(record)).toBe('texto');
  });
});

describe('resume', () => {
  it('repete o tools/call original com a mesma chave e o requestState ecoado', async () => {
    const { bridge, record, host } = cenario([elicitacao(['sala-fusca', 'sala-mirante'], 'srv:k'), reservaFeita('sala-mirante')]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=sala-mirante');

    const [inicial, retry] = host.calls;
    expect(retry!.call).toEqual({
      ...inicial!.call,
      inputResponses: { 'srv:k': { action: 'accept', content: { sala: 'sala-mirante' } } },
      requestState: 'v1.estado-opaco-sala-fusca-sala-mirante',
    });
    expect(record.task.status.state).toBe('TASK_STATE_COMPLETED');
    expect(record.pending).toBeUndefined();
  });

  it('escolha fora do enum mantem a pausa e repete a lista sem chamar o MCP', async () => {
    const { bridge, record, host } = cenario([elicitacao(['sala-fusca', 'sala-mirante'])]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=sala-aquario');
    await bridge.resume(record, 'qualquer coisa');

    expect(record.task.status.state).toBe('TASK_STATE_INPUT_REQUIRED');
    expect(ultimaMensagem(record)).toBe(linhaDeAlternativas(['sala-fusca', 'sala-mirante']));
    expect(host.calls).toHaveLength(1);
  });

  it('escolha=recusar vira decline e termina em CANCELED', async () => {
    const recusa: ToolOutcome = { kind: 'complete', isError: false, text: '', structured: { reservado: false, motivo: 'recusado' } };
    const { bridge, record, host } = cenario([elicitacao(['sala-mirante']), recusa]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=recusar');

    expect(host.calls[1]!.call.inputResponses).toEqual({ escolha_de_sala: { action: 'decline' } });
    expect(record.task.status.state).toBe('TASK_STATE_CANCELED');
    expect(ultimaMensagem(record)).toBe('Reserva nao realizada: recusado');
  });

  it('pausa de novo quando o servidor pede outra escolha no retry', async () => {
    const { bridge, record, host } = cenario([elicitacao(['sala-fusca', 'sala-mirante']), elicitacao(['sala-mirante']), reservaFeita('sala-mirante')]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=sala-fusca');
    expect(record.task.status.state).toBe('TASK_STATE_INPUT_REQUIRED');
    expect(ultimaMensagem(record)).toBe('alternativas: sala-mirante');

    await bridge.resume(record, 'escolha=sala-mirante');
    expect(host.calls[2]!.call.requestState).toBe('v1.estado-opaco-sala-mirante');
    expect(record.task.status.state).toBe('TASK_STATE_COMPLETED');
  });

  it('falha se a Task pausada perdeu o pedido pendente', async () => {
    const { bridge, record } = cenario([elicitacao(['sala-fusca'])]);
    await bridge.start(record, PEDIDO);
    delete record.pending;
    await bridge.resume(record, 'escolha=sala-fusca');
    expect(record.task.status.state).toBe('TASK_STATE_FAILED');
  });

  it('erro de protocolo no retry termina em FAILED', async () => {
    const { bridge, record } = cenario([elicitacao(['sala-fusca']), new Error('Invalid or expired requestState')]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=sala-fusca');
    expect(record.task.status.state).toBe('TASK_STATE_FAILED');
    expect(ultimaMensagem(record)).toBe('Invalid or expired requestState');
  });

  it('mantem o requestState de cada Task isolado', async () => {
    const ids = sequentialIds();
    const host = fakeHost([elicitacao(['a']), elicitacao(['b']), reservaFeita('b', 'res-b'), reservaFeita('a', 'res-a')]);
    const store = createTaskStore(ids);
    const bridge = createReservationBridge({ host, ids });
    const t1 = store.create(TRACE);
    const t2 = store.create(TRACE);

    await bridge.start(t1, PEDIDO);
    await bridge.start(t2, PEDIDO);
    await bridge.resume(t2, 'escolha=b');
    await bridge.resume(t1, 'escolha=a');

    expect(host.calls[2]!.call.requestState).toBe('v1.estado-opaco-b');
    expect(host.calls[3]!.call.requestState).toBe('v1.estado-opaco-a');
    expect(t1.task.status.state).toBe('TASK_STATE_COMPLETED');
    expect(t2.task.status.state).toBe('TASK_STATE_COMPLETED');
  });

  it('retry sem requestState nao inventa um', async () => {
    const semEstado = { ...elicitacao(['sala-fusca']) } as Extract<ToolOutcome, { kind: 'input_required' }>;
    delete semEstado.requestState;
    const { bridge, record, host } = cenario([semEstado, reservaFeita('sala-fusca')]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=sala-fusca');
    expect(host.calls[1]!.call).not.toHaveProperty('requestState');
  });

  it('recusa sem motivo usa texto padrao', async () => {
    const { bridge, record } = cenario([elicitacao(['x']), { kind: 'complete', isError: false, text: '', structured: { reservado: false } }]);
    await bridge.start(record, PEDIDO);
    await bridge.resume(record, 'escolha=recusar');
    expect(ultimaMensagem(record)).toBe('Reserva nao realizada: recusada');
  });
});
