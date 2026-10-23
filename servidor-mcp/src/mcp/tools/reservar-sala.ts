import {
  inputRequired,
  inputResponse,
  ProtocolError,
  ProtocolErrorCode,
  type CallToolResult,
  type InputRequiredResult,
  type InputResponseView,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { alternativas, MENSAGENS, validarPedido } from '../../domain/regras.js';
import type { ServerDeps } from '../deps.js';
import { ReservaSelada } from '../request-state.js';
import { ReservaIn, ReservaOut, type PedidoDeReserva } from '../schemas.js';
import { erroDeExecucao, resultadoEstruturado } from '../results.js';

export const CHAVE_ESCOLHA = 'escolha_de_sala';
export const MENSAGEM_ELICITATION = 'A sala pedida esta ocupada nesse intervalo. Escolha uma alternativa.';

type Resultado = CallToolResult | InputRequiredResult;

function reservaCriada(deps: ServerDeps, pedido: PedidoDeReserva): CallToolResult {
  const reserva = deps.reservas.criar(pedido);
  const saida: ReservaOut = {
    reserva: reserva.id,
    reservado: true,
    sala: reserva.sala,
    inicio: reserva.inicio,
    fim: reserva.fim,
    responsavel: reserva.responsavel,
    politica: deps.politica.versao,
    motivo: null,
  };
  return resultadoEstruturado(saida);
}

function reservaRecusada(motivo: string): CallToolResult {
  const saida: ReservaOut = {
    reserva: null,
    reservado: false,
    sala: null,
    inicio: null,
    fim: null,
    responsavel: null,
    politica: null,
    motivo,
  };
  return resultadoEstruturado(saida);
}

async function pedirEscolha(
  deps: ServerDeps,
  pedido: PedidoDeReserva,
  opcoes: string[],
  ctx: ServerContext,
): Promise<InputRequiredResult> {
  const requestState = await deps.codec.mint({ tool: 'reservar_sala', pedido, alternativas: opcoes }, ctx);
  return inputRequired({
    inputRequests: {
      [CHAVE_ESCOLHA]: inputRequired.elicit({
        mode: 'form',
        message: MENSAGEM_ELICITATION,
        requestedSchema: {
          type: 'object',
          properties: {
            sala: { type: 'string', title: 'Sala', description: 'Sala alternativa escolhida', enum: opcoes },
          },
          required: ['sala'],
        },
      }),
    },
    requestState,
  });
}

async function iniciar(deps: ServerDeps, pedido: PedidoDeReserva, ctx: ServerContext): Promise<Resultado> {
  const validacao = validarPedido(deps.salas, pedido);
  if (!validacao.ok) return erroDeExecucao(validacao.mensagem);

  if (deps.reservas.conflitos(validacao.sala.id, validacao.intervalo).length === 0) {
    return reservaCriada(deps, pedido);
  }

  const opcoes = alternativas(deps.salas, deps.reservas.listar(), validacao.sala, validacao.intervalo);
  if (opcoes.length === 0) return erroDeExecucao(MENSAGENS.semAlternativas);
  return pedirEscolha(deps, pedido, opcoes, ctx);
}

async function reservarAlternativa(
  deps: ServerDeps,
  selado: ReservaSelada,
  sala: string,
  ctx: ServerContext,
): Promise<Resultado> {
  const pedido = { ...selado.pedido, sala };
  const validacao = validarPedido(deps.salas, pedido);
  if (!validacao.ok) return erroDeExecucao(validacao.mensagem);

  if (deps.reservas.conflitos(sala, validacao.intervalo).length > 0) {
    return iniciar(deps, selado.pedido, ctx);
  }
  return reservaCriada(deps, pedido);
}

function lerSelado(estado: unknown): ReservaSelada {
  const parsed = ReservaSelada.safeParse(estado);
  if (!parsed.success) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'requestState nao pertence a reservar_sala');
  }
  return parsed.data;
}

async function retomar(
  deps: ServerDeps,
  selado: ReservaSelada,
  resposta: InputResponseView,
  ctx: ServerContext,
): Promise<Resultado> {
  if (resposta.kind !== 'elicit') return iniciar(deps, selado.pedido, ctx);
  if (resposta.action === 'decline') return reservaRecusada('recusado');
  if (resposta.action === 'cancel') return reservaRecusada('cancelado');

  const escolhida = resposta.content?.['sala'];
  if (typeof escolhida !== 'string' || !selado.alternativas.includes(escolhida)) {
    return erroDeExecucao(`Escolha invalida: ${String(escolhida)} nao esta entre as alternativas oferecidas`);
  }
  return reservarAlternativa(deps, selado, escolhida, ctx);
}

export function registerReservarSala(server: McpServer, deps: ServerDeps): void {
  server.registerTool(
    'reservar_sala',
    {
      description: 'Reserva uma sala. Se o intervalo estiver ocupado, pergunta qual alternativa usar.',
      inputSchema: ReservaIn,
      outputSchema: ReservaOut,
    },
    async (argumentos, ctx) => {
      const estado = ctx.mcpReq.requestState();
      if (estado === undefined) return iniciar(deps, argumentos, ctx);
      const resposta = inputResponse(ctx.mcpReq.inputResponses, CHAVE_ESCOLHA);
      return retomar(deps, lerSelado(estado), resposta, ctx);
    },
  );
}
