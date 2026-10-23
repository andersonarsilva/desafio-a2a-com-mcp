import * as z from 'zod';
import { createRequestStateCodec, type RequestStateCodec } from '@modelcontextprotocol/server';
import { ReservaIn } from './schemas.js';

export const REQUEST_STATE_TTL_SECONDS = 600;

export const ReservaSelada = z.object({
  tool: z.literal('reservar_sala'),
  pedido: ReservaIn,
  alternativas: z.array(z.string()).min(1),
});

export type ReservaSelada = z.infer<typeof ReservaSelada>;

export function createReservaCodec(key: Uint8Array): RequestStateCodec<ReservaSelada> {
  return createRequestStateCodec<ReservaSelada>({
    key,
    ttlSeconds: REQUEST_STATE_TTL_SECONDS,
    bind: (ctx) => ctx.mcpReq.method,
  });
}
