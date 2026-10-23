import type { McpServer } from '@modelcontextprotocol/server';
import type { ServerDeps } from '../deps.js';
import { ListaDeSalas } from '../schemas.js';
import { resultadoEstruturado } from '../results.js';

export function registerListarSalas(server: McpServer, { salas }: ServerDeps): void {
  server.registerTool(
    'listar_salas',
    {
      description: 'Lista todas as salas com capacidade e recursos.',
      outputSchema: ListaDeSalas,
    },
    () => resultadoEstruturado({ salas: salas.map((s) => ({ ...s, recursos: [...s.recursos] })) }),
  );
}
