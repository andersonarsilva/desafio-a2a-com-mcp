import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { Logger } from './log.js';
import { logRequest, logResponse } from './request-log.js';

export interface FetchHandler {
  fetch: (request: Request) => Promise<Response>;
}

export const MAX_BODY_BYTES = 4 * 1024 * 1024;

class BodyTooLargeError extends Error {}

async function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte as string);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new BodyTooLargeError();
    partes.push(buffer);
  }
  return Buffer.concat(partes);
}

function toHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue;
    headers.set(nome, Array.isArray(valor) ? valor.join(', ') : valor);
  }
  return headers;
}

function parseJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

function responder(res: ServerResponse, status: number, corpo: string, contentType = 'text/plain'): void {
  res.writeHead(status, { 'content-type': contentType });
  res.end(corpo);
}

export function createMcpListener(handler: FetchHandler, path: string, log: Logger): RequestListener {
  return (req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname !== path) return responder(res, 404, 'Not Found');

      const corpo = await lerCorpo(req);
      if (corpo.length > 0) logRequest(log, parseJson(corpo.toString('utf8')));

      const response = await handler.fetch(
        new Request(url, {
          method: req.method ?? 'GET',
          headers: toHeaders(req),
          body: corpo.length > 0 ? new Uint8Array(corpo) : undefined,
        }),
      );
      const texto = await response.text();
      if (response.headers.get('content-type')?.includes('application/json')) {
        logResponse(log, response.status, parseJson(texto));
      }
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(texto);
    })().catch((error: unknown) => {
      if (error instanceof BodyTooLargeError) return responder(res, 413, 'Payload Too Large');
      log('mcp.adapter_error', { message: error instanceof Error ? error.message : String(error) });
      if (!res.headersSent) responder(res, 500, 'Internal Server Error');
      else res.end();
    });
  };
}
