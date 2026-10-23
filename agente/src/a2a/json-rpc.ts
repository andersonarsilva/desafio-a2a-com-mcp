import * as z from 'zod';

export const CODIGOS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  taskNotFound: -32001,
  unsupportedOperation: -32004,
} as const;

export class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

export type JsonRpcId = string | number | null;

export const JsonRpcRequest = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequest>;

export function sucesso(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result };
}

export function falha(id: JsonRpcId, error: JsonRpcError) {
  const corpo = error.data === undefined ? { code: error.code, message: error.message } : { code: error.code, message: error.message, data: error.data };
  return { jsonrpc: '2.0' as const, id, error: corpo };
}
