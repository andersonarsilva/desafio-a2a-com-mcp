import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { createReservasStore } from '../../src/domain/reservas.js';
import { createReservaCodec } from '../../src/mcp/request-state.js';
import { createServerFactory } from '../../src/mcp/server-factory.js';
import { POLITICA_TEXTO, RESERVAS, SALAS, SECRET } from './fixtures.js';

export const PROTOCOLO = '2026-07-28';
export const CAPS_FORM = { elicitation: { form: {} } };

export function criarHandler(secret: Uint8Array = SECRET): McpHttpHandler {
  return createMcpHandler(
    createServerFactory({
      salas: SALAS,
      reservas: createReservasStore(RESERVAS),
      politica: { texto: POLITICA_TEXTO, versao: '2026-11-01' },
      codec: createReservaCodec(secret),
    }),
    { legacy: 'reject', responseMode: 'json', onerror: () => undefined },
  );
}

interface Opcoes {
  meta?: Record<string, unknown>;
  name?: string;
}

let proximoId = 1;

export async function rpc(
  handler: McpHttpHandler,
  method: string,
  params: Record<string, unknown> = {},
  { meta, name }: Opcoes = {},
): Promise<{ status: number; body: Record<string, any> }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': PROTOCOLO,
    'mcp-method': method,
  };
  const nome = name ?? (params['name'] as string | undefined) ?? (params['uri'] as string | undefined);
  if (nome) headers['mcp-name'] = nome;
  const _meta = meta ?? {
    'io.modelcontextprotocol/protocolVersion': PROTOCOLO,
    'io.modelcontextprotocol/clientCapabilities': CAPS_FORM,
  };
  const response = await handler.fetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: proximoId++, method, params: { ...params, _meta } }),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

export function reservar(handler: McpHttpHandler, args: Record<string, string>, extra: Record<string, unknown> = {}, opcoes?: Opcoes) {
  return rpc(handler, 'tools/call', { name: 'reservar_sala', arguments: args, ...extra }, opcoes);
}
