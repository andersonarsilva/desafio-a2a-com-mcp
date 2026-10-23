import { describe, expect, it } from '@jest/globals';
import { loadEnv } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('aplica os padroes do desafio', () => {
    expect(loadEnv({})).toEqual({
      AGENT_PORT: 7300, PUBLIC_URL: 'http://localhost:7300', MCP_URL: 'http://localhost:7301/mcp', MCP_TIMEOUT_MS: 15000,
    });
  });

  it('aceita overrides por variavel de ambiente', () => {
    expect(loadEnv({ AGENT_PORT: '9000', AGENT_HOST: '127.0.0.1', MCP_URL: 'http://mcp:1/x' })).toMatchObject({ AGENT_PORT: 9000, AGENT_HOST: '127.0.0.1', MCP_URL: 'http://mcp:1/x' });
  });

  it('rejeita valores invalidos', () => {
    expect(() => loadEnv({ MCP_URL: 'nao-e-url' })).toThrow('Configuracao invalida');
  });
});
