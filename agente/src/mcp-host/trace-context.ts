import { randomBytes } from 'node:crypto';

export interface TraceContext {
  traceId: string;
  flags: string;
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZEROS = /^0+$/;

export function parseTraceparent(header: string | undefined): TraceContext | undefined {
  const match = header ? TRACEPARENT.exec(header.trim().toLowerCase()) : null;
  if (!match) return undefined;
  const [, traceId, spanId, flags] = match as unknown as [string, string, string, string];
  if (ZEROS.test(traceId) || ZEROS.test(spanId)) return undefined;
  return { traceId, flags };
}

export function newTraceContext(): TraceContext {
  return { traceId: randomBytes(16).toString('hex'), flags: '01' };
}

export function childTraceparent({ traceId, flags }: TraceContext): string {
  return `00-${traceId}-${randomBytes(8).toString('hex')}-${flags}`;
}
