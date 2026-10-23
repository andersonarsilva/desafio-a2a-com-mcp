import { afterEach, describe, expect, it } from '@jest/globals';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MAX_BODY_BYTES, createA2AListener } from '../../src/a2a/http-server.js';
import { JsonRpcError } from '../../src/a2a/json-rpc.js';
import type { A2AMethods, RequestContext } from '../../src/a2a/methods.js';
import type { LogFields } from '../../src/log.js';
import { TRACEPARENT } from '../helpers/fakes.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

const TASK = { id: 't', contextId: 'c', status: { state: 'TASK_STATE_COMPLETED' as const, timestamp: '' }, history: [], artifacts: [] };

async function subir(dispatch: A2AMethods['dispatch']) {
  const eventos: Array<[string, LogFields]> = [];
  server = createServer(createA2AListener({ name: 'card' }, { dispatch }, (e, f) => eventos.push([e, f])));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, eventos };
}

const post = (url: string, body: string, headers: Record<string, string> = {}) =>
  fetch(`${url}/a2a`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

describe('createA2AListener', () => {
  it('serve o Agent Card no well-known', async () => {
    const { url } = await subir(async () => ({ task: TASK }));
    const r = await fetch(`${url}/.well-known/agent-card.json`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ name: 'card' });
  });

  it('despacha JSON-RPC repassando o trace do header', async () => {
    let ctx: RequestContext | undefined;
    const { url, eventos } = await subir(async (_m, _p, c) => {
      ctx = c;
      return { task: TASK };
    });
    const r = await post(url, JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'GetTask', params: { id: 't' } }), { traceparent: TRACEPARENT });
    expect(await r.json()).toEqual({ jsonrpc: '2.0', id: 9, result: { task: TASK } });
    expect(ctx?.trace?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(eventos.map(([e]) => e)).toEqual(['a2a.request', 'a2a.response']);
  });

  it('nao cria trace com header ausente', async () => {
    let ctx: RequestContext | undefined;
    const { url } = await subir(async (_m, _p, c) => {
      ctx = c;
      return { task: TASK };
    });
    await post(url, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'GetTask' }));
    expect(ctx).toEqual({});
  });

  it('traduz JsonRpcError e erro inesperado', async () => {
    const { url } = await subir(async (method) => {
      if (method === 'A') throw new JsonRpcError(-32001, 'nao achei');
      throw new Error('boom');
    });
    expect(await (await post(url, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'A' }))).json()).toEqual({ jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'nao achei' } });
    expect(await (await post(url, JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'B' }))).json()).toEqual({ jsonrpc: '2.0', id: 2, error: { code: -32603, message: 'Erro interno do agente' } });
  });

  it('responde parse error, invalid request e corpo grande', async () => {
    const { url } = await subir(async () => ({ task: TASK }));
    expect((await (await post(url, '{')).json()).error.code).toBe(-32700);
    expect((await (await post(url, JSON.stringify({ id: 1, method: 'x' }))).json()).error.code).toBe(-32600);
    expect((await post(url, 'x'.repeat(MAX_BODY_BYTES + 1))).status).toBe(413);
  });

  it('responde 404 para outras rotas', async () => {
    const { url } = await subir(async () => ({ task: TASK }));
    expect((await fetch(`${url}/a2a`)).status).toBe(404);
    expect((await fetch(`${url}/nada`, { method: 'POST' })).status).toBe(404);
  });
});
