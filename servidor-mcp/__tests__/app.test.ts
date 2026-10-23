import { afterEach, describe, expect, it } from '@jest/globals';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import type { LogFields } from '../src/http/log.js';
import { POLITICA_TEXTO, RESERVAS, SALAS, SECRET } from './helpers/fixtures.js';

let app: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (app ? app.close(() => resolve()) : resolve()));
});

describe('createApp', () => {
  it('serve o endpoint MCP via HTTP e loga o traceparent', async () => {
    const eventos: Array<[string, LogFields]> = [];
    app = createApp(
      { REQUEST_STATE_SECRET: SECRET, MCP_PATH: '/mcp' },
      { salas: SALAS, reservas: RESERVAS, politica: { texto: POLITICA_TEXTO, versao: '2026-11-01' } },
      (e, f) => eventos.push([e, f]),
    );
    await new Promise<void>((resolve) => app!.listen(0, '127.0.0.1', resolve));
    const { port } = app.address() as AddressInfo;
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

    const r = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/list',
        params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {}, traceparent } },
      }),
    });

    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(eventos).toContainEqual(['mcp.request', expect.objectContaining({ method: 'tools/list', id: 1, traceparent, traceId: '4bf92f3577b34da6a3ce929d0e0e4736' })]);
  });

  it('loga requests rejeitados pelo SDK', async () => {
    const eventos: Array<[string, LogFields]> = [];
    app = createApp(
      { REQUEST_STATE_SECRET: SECRET, MCP_PATH: '/mcp' },
      { salas: SALAS, reservas: RESERVAS, politica: { texto: POLITICA_TEXTO, versao: '2026-11-01' } },
      (e, f) => eventos.push([e, f]),
    );
    await new Promise<void>((resolve) => app!.listen(0, '127.0.0.1', resolve));
    const { port } = app.address() as AddressInfo;
    const r = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/list' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    expect(r.status).toBe(400);
    expect(eventos.map(([e]) => e)).toContain('mcp.rejected');
  });
});
