import { describe, expect, it } from '@jest/globals';
import { falha, JsonRpcError, sucesso } from '../../src/a2a/json-rpc.js';

describe('envelopes JSON-RPC', () => {
  it('monta sucesso e falha', () => {
    expect(sucesso(1, { ok: true })).toEqual({ jsonrpc: '2.0', id: 1, result: { ok: true } });
    expect(falha('a', new JsonRpcError(-32001, 'nao achei'))).toEqual({ jsonrpc: '2.0', id: 'a', error: { code: -32001, message: 'nao achei' } });
    expect(falha(null, new JsonRpcError(-32602, 'x', { campo: 'y' }))).toEqual({ jsonrpc: '2.0', id: null, error: { code: -32602, message: 'x', data: { campo: 'y' } } });
  });
});
