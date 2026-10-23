import { describe, expect, it } from '@jest/globals';
import { toToolOutcome } from '../../src/mcp-host/mcp-host.js';

describe('toToolOutcome', () => {
  it('preserva input_required cru, com requestState opaco', () => {
    const inputRequests = { k: { method: 'elicitation/create' } };
    expect(toToolOutcome({ resultType: 'input_required', inputRequests, requestState: 'v1.x' })).toEqual({
      kind: 'input_required', inputRequests, requestState: 'v1.x',
    });
    expect(toToolOutcome({ resultType: 'input_required', inputRequests })).toEqual({ kind: 'input_required', inputRequests });
  });

  it('junta os blocos de texto e mantem o structuredContent', () => {
    expect(
      toToolOutcome({ content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }], structuredContent: { x: 1 } }),
    ).toEqual({ kind: 'complete', isError: false, text: 'a\nb', structured: { x: 1 } });
  });

  it('marca erro de execucao', () => {
    expect(toToolOutcome({ content: [{ type: 'text', text: 'Sala inexistente: x' }], isError: true })).toEqual({
      kind: 'complete', isError: true, text: 'Sala inexistente: x',
    });
  });

  it('falha com resultado malformado', () => {
    expect(() => toToolOutcome({ content: 'x' })).toThrow();
  });
});
