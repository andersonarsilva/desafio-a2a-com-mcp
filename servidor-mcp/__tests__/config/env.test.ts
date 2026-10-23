import { describe, expect, it } from '@jest/globals';
import { loadEnv } from '../../src/config/env.js';

const SECRET_HEX = 'ab'.repeat(32);

describe('loadEnv', () => {
  it('aplica os padroes do desafio', () => {
    const env = loadEnv({ REQUEST_STATE_SECRET: SECRET_HEX });
    expect(env.MCP_PORT).toBe(7301);
    expect(env.MCP_PATH).toBe('/mcp');
    expect(env.MCP_HOST).toBeUndefined();
    expect(env.REQUEST_STATE_SECRET).toHaveLength(32);
  });

  it('aceita porta e caminho por variavel de ambiente', () => {
    const env = loadEnv({ REQUEST_STATE_SECRET: SECRET_HEX, MCP_PORT: '8000', MCP_PATH: '/x', DADOS_DIR: '/d' });
    expect(env).toMatchObject({ MCP_PORT: 8000, MCP_PATH: '/x', DADOS_DIR: '/d' });
  });

  it('exige o segredo', () => {
    expect(() => loadEnv({})).toThrow('REQUEST_STATE_SECRET e obrigatoria');
  });

  it('rejeita segredo curto ou fora de hexadecimal', () => {
    expect(() => loadEnv({ REQUEST_STATE_SECRET: 'ab'.repeat(31) })).toThrow('ao menos 32 bytes');
    expect(() => loadEnv({ REQUEST_STATE_SECRET: 'z'.repeat(64) })).toThrow('hexadecimal');
  });
});
