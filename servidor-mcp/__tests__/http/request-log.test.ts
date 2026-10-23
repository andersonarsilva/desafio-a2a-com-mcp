import { describe, expect, it } from '@jest/globals';
import type { LogFields } from '../../src/http/log.js';
import { logRequest, logResponse } from '../../src/http/request-log.js';

function coletor() {
  const eventos: Array<[string, LogFields]> = [];
  return { eventos, log: (e: string, f: LogFields) => eventos.push([e, f]) };
}

describe('logRequest', () => {
  it('registra metodo, id, nome e traceparent', () => {
    const { eventos, log } = coletor();
    logRequest(log, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'reservar_sala', requestState: 'v1.x', _meta: { traceparent: '00-abc-def-01' } },
    });
    expect(eventos).toEqual([
      ['mcp.request', { method: 'tools/call', id: 7, name: 'reservar_sala', traceparent: '00-abc-def-01', traceId: 'abc', retry: true }],
    ]);
  });

  it('usa a uri como nome em resources/read e tolera corpo sem params', () => {
    const { eventos, log } = coletor();
    logRequest(log, [{ id: 1, method: 'resources/read', params: { uri: 'politica://uso' } }, { id: 2, method: 'ping' }, 'lixo']);
    expect(eventos.map(([, f]) => f['name'])).toEqual(['politica://uso', undefined]);
    expect(eventos[1]![1]['traceId']).toBeUndefined();
  });

  it('ignora corpo que nao e JSON-RPC', () => {
    const { eventos, log } = coletor();
    logRequest(log, undefined);
    expect(eventos).toEqual([]);
  });
});

describe('logResponse', () => {
  it('registra resultType ou codigo de erro', () => {
    const { eventos, log } = coletor();
    logResponse(log, 200, { id: 1, result: { resultType: 'input_required' } });
    logResponse(log, 400, { id: 2, error: { code: -32021 } });
    expect(eventos).toEqual([
      ['mcp.response', { id: 1, status: 200, resultType: 'input_required', isError: undefined, errorCode: undefined }],
      ['mcp.response', { id: 2, status: 400, resultType: undefined, isError: undefined, errorCode: -32021 }],
    ]);
  });
});
