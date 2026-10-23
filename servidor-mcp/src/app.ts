import { createServer, type Server } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { Env } from './config/env.js';
import type { DadosIniciais } from './data.js';
import { createReservasStore } from './domain/reservas.js';
import { createMcpListener } from './http/fetch-adapter.js';
import type { Logger } from './http/log.js';
import { createReservaCodec } from './mcp/request-state.js';
import { createServerFactory } from './mcp/server-factory.js';

export function createApp(env: Pick<Env, 'REQUEST_STATE_SECRET' | 'MCP_PATH'>, dados: DadosIniciais, log: Logger): Server {
  const factory = createServerFactory({
    salas: dados.salas,
    reservas: createReservasStore(dados.reservas),
    politica: dados.politica,
    codec: createReservaCodec(env.REQUEST_STATE_SECRET),
  });
  const handler = createMcpHandler(factory, {
    legacy: 'reject',
    responseMode: 'json',
    onerror: (error) => log('mcp.rejected', { message: error.message }),
  });
  return createServer(createMcpListener(handler, env.MCP_PATH, log));
}
