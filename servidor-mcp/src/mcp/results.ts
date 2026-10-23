import type { CallToolResult } from '@modelcontextprotocol/server';

export function resultadoEstruturado<T extends Record<string, unknown>>(dados: T): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(dados, null, 2) }],
    structuredContent: dados,
  };
}

export function erroDeExecucao(mensagem: string): CallToolResult {
  return { content: [{ type: 'text', text: mensagem }], isError: true };
}
