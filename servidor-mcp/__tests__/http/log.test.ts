import { describe, expect, it } from '@jest/globals';
import { createStderrLogger } from '../../src/http/log.js';

describe('createStderrLogger', () => {
  it('escreve uma linha JSON por evento', () => {
    const linhas: string[] = [];
    createStderrLogger((l) => linhas.push(l))('mcp.request', { method: 'tools/list', id: 1 });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.endsWith('\n')).toBe(true);
    expect(JSON.parse(linhas[0]!)).toMatchObject({ event: 'mcp.request', method: 'tools/list', id: 1 });
  });
});
