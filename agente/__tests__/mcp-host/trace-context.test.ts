import { describe, expect, it } from '@jest/globals';
import { childTraceparent, newTraceContext, parseTraceparent } from '../../src/mcp-host/trace-context.js';
import { TRACEPARENT } from '../helpers/fakes.js';

describe('trace context', () => {
  it('le um traceparent W3C valido', () => {
    expect(parseTraceparent(TRACEPARENT)).toEqual({ traceId: '4bf92f3577b34da6a3ce929d0e0e4736', flags: '01' });
    expect(parseTraceparent(TRACEPARENT.toUpperCase())?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it.each([undefined, '', 'lixo', `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`, '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01'])(
    'rejeita %p',
    (valor) => {
      expect(parseTraceparent(valor)).toBeUndefined();
    },
  );

  it('mantem o trace-id e gera span-id novo a cada filho', () => {
    const ctx = parseTraceparent(TRACEPARENT)!;
    const a = childTraceparent(ctx);
    const b = childTraceparent(ctx);
    expect(a).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
    expect(a).not.toBe(b);
    expect(parseTraceparent(a)).toEqual(ctx);
  });

  it('gera um trace novo quando o cliente nao enviou', () => {
    const ctx = newTraceContext();
    expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(parseTraceparent(childTraceparent(ctx))).toEqual(ctx);
  });
});
