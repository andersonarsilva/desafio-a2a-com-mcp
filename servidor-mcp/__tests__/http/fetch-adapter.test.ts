import { afterEach, describe, expect, it } from '@jest/globals';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMcpListener, MAX_BODY_BYTES, type FetchHandler } from '../../src/http/fetch-adapter.js';
import type { LogFields } from '../../src/http/log.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

async function subir(handler: FetchHandler) {
  const eventos: Array<[string, LogFields]> = [];
  server = createServer(createMcpListener(handler, '/mcp', (e, f) => eventos.push([e, f])));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, eventos };
}

describe('createMcpListener', () => {
  it('repassa metodo, headers e corpo ao handler e loga request e response', async () => {
    let recebido: Request | undefined;
    const { url, eventos } = await subir({
      fetch: async (request) => {
        recebido = request;
        return Response.json({ jsonrpc: '2.0', id: 1, result: { resultType: 'complete' } }, { status: 200 });
      },
    });

    const corpo = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    const r = await fetch(`${url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', 'mcp-method': 'tools/list' }, body: corpo });

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ jsonrpc: '2.0', id: 1, result: { resultType: 'complete' } });
    expect(recebido?.method).toBe('POST');
    expect(recebido?.headers.get('mcp-method')).toBe('tools/list');
    expect(await recebido?.text()).toBe(corpo);
    expect(eventos.map(([e]) => e)).toEqual(['mcp.request', 'mcp.response']);
  });

  it('nao loga corpo vazio nem resposta que nao e JSON', async () => {
    const { url, eventos } = await subir({ fetch: async () => new Response('ok', { status: 202 }) });
    const r = await fetch(`${url}/mcp`, { method: 'GET' });
    expect(r.status).toBe(202);
    expect(eventos).toEqual([]);
  });

  it('responde 404 fora do caminho do endpoint', async () => {
    const { url } = await subir({ fetch: async () => new Response('nunca') });
    expect((await fetch(`${url}/outro`)).status).toBe(404);
  });

  it('responde 413 para corpo acima do limite', async () => {
    const { url } = await subir({ fetch: async () => new Response('nunca') });
    const r = await fetch(`${url}/mcp`, { method: 'POST', body: 'x'.repeat(MAX_BODY_BYTES + 1) });
    expect(r.status).toBe(413);
  });

  it('responde 500 e loga quando o handler explode', async () => {
    const { url, eventos } = await subir({
      fetch: async () => {
        throw new Error('boom');
      },
    });
    const r = await fetch(`${url}/mcp`, { method: 'POST', body: 'nao-json' });
    expect(r.status).toBe(500);
    expect(eventos).toContainEqual(['mcp.adapter_error', { message: 'boom' }]);
  });
});
