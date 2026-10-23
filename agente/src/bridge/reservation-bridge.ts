import * as z from 'zod';
import { FORMATO_DO_PEDIDO, parseEscolha, parsePedido, versaoDaPolitica } from '../commands/parse.js';
import type { InputResponse, McpHost, ToolCall, ToolOutcome } from '../mcp-host/mcp-host.js';
import { childTraceparent } from '../mcp-host/trace-context.js';
import type { IdGenerator } from '../tasks/ids.js';
import { anexarArtifact, transitar, type TaskRecord } from '../tasks/task-store.js';
import type { Message, TaskState } from '../tasks/types.js';
import { lerEscolhas } from './elicitation.js';

export const TOOL_RESERVA = 'reservar_sala';
export const URI_POLITICA = 'politica://uso';
export const ARTIFACT_RESERVA = 'reserva';

const ReservaConcluida = z.object({
  reserva: z.string(),
  reservado: z.literal(true),
  sala: z.string(),
  inicio: z.string(),
  fim: z.string(),
  responsavel: z.string(),
});

const ReservaNaoRealizada = z.object({
  reservado: z.literal(false),
  motivo: z.string().nullable().optional(),
});

export const linhaDeAlternativas = (opcoes: readonly string[]) => `alternativas: ${opcoes.join(', ')}`;

export interface ReservationBridge {
  start(record: TaskRecord, texto: string): Promise<void>;
  resume(record: TaskRecord, texto: string): Promise<void>;
}

export interface BridgeDeps {
  host: McpHost;
  ids: IdGenerator;
}

function mensagemDeErro(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createReservationBridge({ host, ids }: BridgeDeps): ReservationBridge {
  const mensagemDoAgente = (record: TaskRecord, text: string): Message => ({
    messageId: ids.message(),
    role: 'ROLE_AGENT',
    parts: [{ text }],
    taskId: record.task.id,
    contextId: record.task.contextId,
  });

  const encerrar = (record: TaskRecord, estado: TaskState, texto: string) => {
    transitar(record, estado, mensagemDoAgente(record, texto));
  };

  const pausar = (record: TaskRecord, opcoes: readonly string[]) => {
    transitar(record, 'TASK_STATE_INPUT_REQUIRED', mensagemDoAgente(record, linhaDeAlternativas(opcoes)));
  };

  const concluir = (record: TaskRecord, structured: Record<string, unknown> | undefined) => {
    const recusa = ReservaNaoRealizada.safeParse(structured);
    if (recusa.success) {
      return encerrar(record, 'TASK_STATE_CANCELED', `Reserva nao realizada: ${recusa.data.motivo ?? 'recusada'}`);
    }
    const reserva = ReservaConcluida.safeParse(structured);
    if (!reserva.success) {
      return encerrar(record, 'TASK_STATE_FAILED', 'Resposta inesperada do servidor MCP');
    }
    const { reserva: id, sala, inicio, fim, responsavel } = reserva.data;
    anexarArtifact(record, {
      artifactId: ids.artifact(),
      name: ARTIFACT_RESERVA,
      parts: [{ text: JSON.stringify({ reserva: id, sala, inicio, fim, responsavel, politica: record.politica }) }],
    });
    encerrar(record, 'TASK_STATE_COMPLETED', `Reserva ${id} confirmada na ${sala}.`);
  };

  const aplicar = (record: TaskRecord, call: ToolCall, outcome: ToolOutcome) => {
    if (outcome.kind === 'complete') {
      return outcome.isError ? encerrar(record, 'TASK_STATE_FAILED', outcome.text) : concluir(record, outcome.structured);
    }

    const escolhas = lerEscolhas(outcome.inputRequests);
    if (!escolhas) {
      return encerrar(record, 'TASK_STATE_FAILED', 'Pedido de input do servidor MCP nao suportado');
    }
    record.pending = {
      call: { name: call.name, arguments: call.arguments },
      ...escolhas,
      ...(outcome.requestState === undefined ? {} : { requestState: outcome.requestState }),
    };
    pausar(record, escolhas.opcoes);
  };

  const chamar = async (record: TaskRecord, call: ToolCall) => {
    const outcome = await host.callTool(call, childTraceparent(record.trace));
    aplicar(record, call, outcome);
  };

  const comFalha = async (record: TaskRecord, passo: () => Promise<void>) => {
    try {
      await passo();
    } catch (error) {
      encerrar(record, 'TASK_STATE_FAILED', mensagemDeErro(error));
    }
  };

  return {
    async start(record, texto) {
      transitar(record, 'TASK_STATE_WORKING');
      const pedido = parsePedido(texto);
      if (!pedido) return encerrar(record, 'TASK_STATE_FAILED', FORMATO_DO_PEDIDO);

      await comFalha(record, async () => {
        const tools = await host.listToolNames(childTraceparent(record.trace));
        if (!tools.includes(TOOL_RESERVA)) {
          return encerrar(record, 'TASK_STATE_FAILED', `Tool ${TOOL_RESERVA} nao foi descoberta no servidor MCP`);
        }
        const politica = versaoDaPolitica(await host.readResourceText(URI_POLITICA, childTraceparent(record.trace)));
        if (!politica) return encerrar(record, 'TASK_STATE_FAILED', 'Politica de uso sem versao declarada');
        record.politica = politica;

        await chamar(record, { name: TOOL_RESERVA, arguments: { ...pedido } });
      });
    },

    async resume(record, texto) {
      const pending = record.pending;
      if (!pending) return encerrar(record, 'TASK_STATE_FAILED', 'Task pausada sem pedido de input pendente');

      const escolha = parseEscolha(texto);
      const valida = escolha && (escolha.kind === 'recusar' || pending.opcoes.includes(escolha.valor));
      if (!escolha || !valida) return pausar(record, pending.opcoes);

      const resposta: InputResponse =
        escolha.kind === 'recusar' ? { action: 'decline' } : { action: 'accept', content: { [pending.field]: escolha.valor } };

      transitar(record, 'TASK_STATE_WORKING');
      delete record.pending;
      const retry: ToolCall = {
        ...pending.call,
        inputResponses: { [pending.inputKey]: resposta },
        ...(pending.requestState === undefined ? {} : { requestState: pending.requestState }),
      };
      await comFalha(record, () => chamar(record, retry));
    },
  };
}
