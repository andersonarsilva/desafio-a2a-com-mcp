import type { Logger } from './log.js';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mensagens(corpo: unknown): JsonObject[] {
  if (Array.isArray(corpo)) return corpo.filter(isObject);
  return isObject(corpo) ? [corpo] : [];
}

function traceIdDe(traceparent: unknown): string | undefined {
  if (typeof traceparent !== 'string') return undefined;
  return traceparent.split('-')[1];
}

export function logRequest(log: Logger, corpo: unknown): void {
  for (const msg of mensagens(corpo)) {
    const params = isObject(msg['params']) ? msg['params'] : {};
    const meta = isObject(params['_meta']) ? params['_meta'] : {};
    log('mcp.request', {
      method: msg['method'],
      id: msg['id'],
      name: params['name'] ?? params['uri'],
      traceparent: meta['traceparent'],
      traceId: traceIdDe(meta['traceparent']),
      retry: typeof params['requestState'] === 'string',
    });
  }
}

export function logResponse(log: Logger, status: number, corpo: unknown): void {
  for (const msg of mensagens(corpo)) {
    const result = isObject(msg['result']) ? msg['result'] : undefined;
    const error = isObject(msg['error']) ? msg['error'] : undefined;
    log('mcp.response', {
      id: msg['id'],
      status,
      resultType: result?.['resultType'],
      isError: result?.['isError'],
      errorCode: error?.['code'],
    });
  }
}
