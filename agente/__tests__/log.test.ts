import { describe, expect, it } from '@jest/globals';
import { createStderrLogger } from '../src/log.js';

describe('createStderrLogger', () => {
  it('escreve uma linha JSON por evento', () => {
    const linhas: string[] = [];
    createStderrLogger((l) => linhas.push(l))('a2a.request', { method: 'GetTask' });
    expect(JSON.parse(linhas[0]!)).toMatchObject({ event: 'a2a.request', method: 'GetTask' });
  });
});
