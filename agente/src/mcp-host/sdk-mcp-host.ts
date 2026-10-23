import { Client, StreamableHTTPClientTransport, type Tool } from '@modelcontextprotocol/client';
import { toToolOutcome, type McpHost } from './mcp-host.js';

export const CLIENT_INFO = { name: 'agente-central-de-salas', version: '1.0.0' } as const;
export const PROTOCOL_VERSION = '2026-07-28';

export interface SdkMcpHostOptions {
  url: URL;
  timeoutMs: number;
}

/**
 * SDK 2.3.1 validates `outputSchema` on every `callTool` result, including
 * `input_required` ones, which by spec carry no `structuredContent`
 * (client/dist/index.mjs, `callTool`: "has an output schema but did not return
 * structured content"). Passing the discovered definition without
 * `outputSchema` as `toolDefinition` keeps the raw `input_required` visible;
 * the bridge validates the structured content itself.
 */
function semValidacaoDeSaida(definicao: Tool): Tool {
  return { ...definicao, outputSchema: undefined };
}

export function createSdkMcpHost({ url, timeoutMs }: SdkMcpHostOptions): McpHost {
  let conexao: Promise<Client> | undefined;
  const descobertas = new Map<string, Tool>();

  const conectar = async (): Promise<Client> => {
    const client = new Client(CLIENT_INFO, {
      capabilities: { elicitation: { form: {} } },
      versionNegotiation: { mode: { pin: PROTOCOL_VERSION } },
      inputRequired: { autoFulfill: false },
    });
    await client.connect(new StreamableHTTPClientTransport(url), { timeout: timeoutMs });
    return client;
  };

  const client = (): Promise<Client> => {
    conexao ??= conectar().catch((error: unknown) => {
      conexao = undefined;
      throw error;
    });
    return conexao;
  };

  return {
    async listToolNames(traceparent) {
      const c = await client();
      const nomes: string[] = [];
      let cursor: string | undefined;
      do {
        const pagina = await c.listTools({ ...(cursor ? { cursor } : {}), _meta: { traceparent } }, { timeout: timeoutMs });
        for (const tool of pagina.tools) descobertas.set(tool.name, tool);
        nomes.push(...pagina.tools.map((t) => t.name));
        cursor = pagina.nextCursor;
      } while (cursor);
      return nomes;
    },

    async readResourceText(uri, traceparent) {
      const c = await client();
      const { contents } = await c.readResource({ uri, _meta: { traceparent } }, { timeout: timeoutMs });
      return contents.map((item) => ('text' in item ? item.text : '')).join('');
    },

    async callTool(call, traceparent) {
      const c = await client();
      const definicao = descobertas.get(call.name) ?? { name: call.name, inputSchema: { type: 'object' } };
      const result: unknown = await c.callTool(
        { ...call, _meta: { traceparent } },
        { allowInputRequired: true, timeout: timeoutMs, toolDefinition: semValidacaoDeSaida(definicao) },
      );
      return toToolOutcome(result);
    },
  };
}
