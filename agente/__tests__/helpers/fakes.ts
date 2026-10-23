import type { McpHost, ToolCall, ToolOutcome } from '../../src/mcp-host/mcp-host.js';
import type { IdGenerator } from '../../src/tasks/ids.js';

export const POLITICA = 'versao: 2026-11-01\n\n- regra';
export const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
export const TRACE = { traceId: '4bf92f3577b34da6a3ce929d0e0e4736', flags: '01' };

export function sequentialIds(): IdGenerator {
  const n = { task: 0, ctx: 0, msg: 0, art: 0 };
  return {
    task: () => `task-${++n.task}`,
    context: () => `ctx-${++n.ctx}`,
    message: () => `msg-${++n.msg}`,
    artifact: () => `art-${++n.art}`,
  };
}

export function elicitacao(opcoes: string[], chave = 'escolha_de_sala'): ToolOutcome {
  return {
    kind: 'input_required',
    requestState: `v1.estado-opaco-${opcoes.join('-')}`,
    inputRequests: {
      [chave]: {
        method: 'elicitation/create',
        params: {
          mode: 'form',
          message: 'Escolha',
          requestedSchema: { type: 'object', properties: { sala: { type: 'string', enum: opcoes } }, required: ['sala'] },
        },
      },
    },
  };
}

export function reservaFeita(sala: string, id = 'res-0003'): ToolOutcome {
  return {
    kind: 'complete',
    isError: false,
    text: '{}',
    structured: {
      reserva: id, reservado: true, sala, inicio: '2026-11-03T14:00:00-03:00', fim: '2026-11-03T15:00:00-03:00',
      responsavel: 'Marty', politica: '2026-11-01', motivo: null,
    },
  };
}

export interface FakeHost extends McpHost {
  calls: Array<{ call: ToolCall; traceparent: string }>;
  traceparents: string[];
}

export function fakeHost(respostas: Array<ToolOutcome | Error>, tools = ['listar_salas', 'reservar_sala'], politica = POLITICA): FakeHost {
  const calls: FakeHost['calls'] = [];
  const traceparents: string[] = [];
  return {
    calls,
    traceparents,
    async listToolNames(traceparent) {
      traceparents.push(traceparent);
      return tools;
    },
    async readResourceText(_uri, traceparent) {
      traceparents.push(traceparent);
      return politica;
    },
    async callTool(call, traceparent) {
      traceparents.push(traceparent);
      calls.push({ call: structuredClone(call), traceparent });
      const resposta = respostas.shift();
      if (!resposta) throw new Error('fakeHost sem resposta');
      if (resposta instanceof Error) throw resposta;
      return resposta;
    },
  };
}
