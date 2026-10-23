import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { Logger } from '../log.js';
import { parseTraceparent } from '../mcp-host/trace-context.js';
import { A2A_PATH, AGENT_CARD_PATH } from './agent-card.js';
import { CODIGOS, falha, JsonRpcError, JsonRpcRequest, sucesso } from './json-rpc.js';
import type { A2AMethods } from './methods.js';

export const MAX_BODY_BYTES = 1024 * 1024;

class BodyTooLargeError extends Error {}

async function lerCorpo(req: IncomingMessage): Promise<string> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte as string);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new BodyTooLargeError();
    partes.push(buffer);
  }
  return Buffer.concat(partes).toString('utf8');
}

function json(res: ServerResponse, status: number, corpo: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

function primeiroHeader(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export function createA2AListener(card: unknown, methods: A2AMethods, log: Logger): RequestListener {
  const atenderRpc = async (req: IncomingMessage, res: ServerResponse) => {
    let bruto: unknown;
    try {
      bruto = JSON.parse(await lerCorpo(req));
    } catch (error) {
      if (error instanceof BodyTooLargeError) return json(res, 413, falha(null, new JsonRpcError(CODIGOS.invalidRequest, 'Corpo acima do limite')));
      return json(res, 200, falha(null, new JsonRpcError(CODIGOS.parseError, 'JSON invalido')));
    }

    const request = JsonRpcRequest.safeParse(bruto);
    if (!request.success) {
      return json(res, 200, falha(null, new JsonRpcError(CODIGOS.invalidRequest, 'Request JSON-RPC 2.0 invalido')));
    }

    const { id, method, params } = request.data;
    const trace = parseTraceparent(primeiroHeader(req.headers['traceparent']));
    log('a2a.request', { method, id, traceId: trace?.traceId });
    try {
      const result = await methods.dispatch(method, params, trace ? { trace } : {});
      log('a2a.response', { method, id, taskId: result.task.id, state: result.task.status.state });
      json(res, 200, sucesso(id, result));
    } catch (error) {
      const rpcError =
        error instanceof JsonRpcError ? error : new JsonRpcError(CODIGOS.internalError, 'Erro interno do agente');
      log('a2a.error', { method, id, code: rpcError.code, message: error instanceof Error ? error.message : String(error) });
      json(res, 200, falha(id, rpcError));
    }
  };

  return (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && pathname === AGENT_CARD_PATH) return json(res, 200, card);
    if (req.method === 'POST' && pathname === A2A_PATH) {
      atenderRpc(req, res).catch((error: unknown) => {
        log('a2a.adapter_error', { message: error instanceof Error ? error.message : String(error) });
        if (!res.headersSent) json(res, 500, falha(null, new JsonRpcError(CODIGOS.internalError, 'Erro interno do agente')));
      });
      return;
    }
    json(res, 404, { error: 'Not Found' });
  };
}
