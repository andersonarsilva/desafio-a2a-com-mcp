import type { McpServer } from '@modelcontextprotocol/server';
import { validarPedido } from '../../domain/regras.js';
import type { ServerDeps } from '../deps.js';
import { ConsultaIn, Disponibilidade } from '../schemas.js';
import { erroDeExecucao, resultadoEstruturado } from '../results.js';

export function registerConsultarDisponibilidade(server: McpServer, { salas, reservas }: ServerDeps): void {
  server.registerTool(
    'consultar_disponibilidade',
    {
      description: 'Diz se uma sala esta livre no intervalo, e quais reservas conflitam.',
      inputSchema: ConsultaIn,
      outputSchema: Disponibilidade,
    },
    (pedido) => {
      const validacao = validarPedido(salas, pedido);
      if (!validacao.ok) return erroDeExecucao(validacao.mensagem);

      const emConflito = reservas.conflitos(validacao.sala.id, validacao.intervalo);
      return resultadoEstruturado({
        sala: validacao.sala.id,
        livre: emConflito.length === 0,
        conflitos: emConflito.map(({ id, inicio, fim, responsavel }) => ({ id, inicio, fim, responsavel })),
      });
    },
  );
}
