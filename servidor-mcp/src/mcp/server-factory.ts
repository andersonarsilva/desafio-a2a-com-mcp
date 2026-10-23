import { McpServer } from '@modelcontextprotocol/server';
import type { ServerDeps } from './deps.js';
import { registerPolitica } from './resources/politica.js';
import { registerConsultarDisponibilidade } from './tools/consultar-disponibilidade.js';
import { registerListarSalas } from './tools/listar-salas.js';
import { registerReservarSala } from './tools/reservar-sala.js';

export const SERVER_INFO = { name: 'central-de-salas', version: '1.0.0' } as const;

export function createServerFactory(deps: ServerDeps): () => McpServer {
  return () => {
    const server = new McpServer(SERVER_INFO, {
      capabilities: { tools: {}, resources: {} },
      requestState: { verify: deps.codec.verify },
    });
    registerListarSalas(server, deps);
    registerConsultarDisponibilidade(server, deps);
    registerReservarSala(server, deps);
    registerPolitica(server, deps);
    return server;
  };
}
