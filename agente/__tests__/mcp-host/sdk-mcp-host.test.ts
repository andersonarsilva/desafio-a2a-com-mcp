import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const connect = jest.fn<(...args: unknown[]) => Promise<void>>();
const listTools = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const readResource = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const callTool = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const clientArgs: unknown[][] = [];

jest.unstable_mockModule('@modelcontextprotocol/client', () => ({
  Client: class {
    constructor(...args: unknown[]) {
      clientArgs.push(args);
    }
    connect = connect;
    listTools = listTools;
    readResource = readResource;
    callTool = callTool;
  },
  StreamableHTTPClientTransport: class {
    constructor(readonly url: URL) {}
  },
}));

const { createSdkMcpHost, CLIENT_INFO } = await import('../../src/mcp-host/sdk-mcp-host.js');

const TP = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
const host = () => createSdkMcpHost({ url: new URL('http://localhost:7301/mcp'), timeoutMs: 1000 });

beforeEach(() => {
  jest.clearAllMocks();
  clientArgs.length = 0;
  connect.mockResolvedValue(undefined);
});

describe('createSdkMcpHost', () => {
  it('declara elicitation form, pina a revisao e desliga o auto-fulfill', async () => {
    listTools.mockResolvedValue({ tools: [] });
    await host().listToolNames(TP);
    expect(clientArgs[0]).toEqual([
      CLIENT_INFO,
      { capabilities: { elicitation: { form: {} } }, versionNegotiation: { mode: { pin: '2026-07-28' } }, inputRequired: { autoFulfill: false } },
    ]);
  });

  it('conecta uma vez e reaproveita o cliente', async () => {
    listTools.mockResolvedValue({ tools: [] });
    const h = host();
    await h.listToolNames(TP);
    await h.listToolNames(TP);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('reconecta depois de uma falha de conexao', async () => {
    connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    listTools.mockResolvedValue({ tools: [] });
    const h = host();
    await expect(h.listToolNames(TP)).rejects.toThrow('ECONNREFUSED');
    await expect(h.listToolNames(TP)).resolves.toEqual([]);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('pagina o tools/list e propaga o traceparent no _meta', async () => {
    listTools.mockResolvedValueOnce({ tools: [{ name: 'a' }], nextCursor: 'c1' }).mockResolvedValueOnce({ tools: [{ name: 'b' }] });
    await expect(host().listToolNames(TP)).resolves.toEqual(['a', 'b']);
    expect(listTools).toHaveBeenNthCalledWith(1, { _meta: { traceparent: TP } }, { timeout: 1000 });
    expect(listTools).toHaveBeenNthCalledWith(2, { cursor: 'c1', _meta: { traceparent: TP } }, { timeout: 1000 });
  });

  it('le o texto do resource', async () => {
    readResource.mockResolvedValue({ contents: [{ uri: 'u', text: 'versao: 1' }, { uri: 'u', blob: 'x' }] });
    await expect(host().readResourceText('politica://uso', TP)).resolves.toBe('versao: 1');
    expect(readResource).toHaveBeenCalledWith({ uri: 'politica://uso', _meta: { traceparent: TP } }, { timeout: 1000 });
  });

  it('chama a tool aceitando input_required e sem validacao de outputSchema no SDK', async () => {
    const definicao = { name: 'reservar_sala', inputSchema: { type: 'object' }, outputSchema: { type: 'object' } };
    listTools.mockResolvedValue({ tools: [definicao] });
    callTool.mockResolvedValue({ resultType: 'input_required', inputRequests: {}, requestState: 'v1.x' });
    const h = host();
    await h.listToolNames(TP);
    const call = { name: 'reservar_sala', arguments: { sala: 'a' }, requestState: 'v1.x' };

    await expect(h.callTool(call, TP)).resolves.toEqual({ kind: 'input_required', inputRequests: {}, requestState: 'v1.x' });
    expect(callTool).toHaveBeenCalledWith(
      { ...call, _meta: { traceparent: TP } },
      { allowInputRequired: true, timeout: 1000, toolDefinition: { ...definicao, outputSchema: undefined } },
    );
  });

  it('usa definicao minima para tool nao descoberta', async () => {
    callTool.mockResolvedValue({ content: [] });
    await host().callTool({ name: 'x', arguments: {} }, TP);
    expect(callTool).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toolDefinition: { name: 'x', inputSchema: { type: 'object' }, outputSchema: undefined } }));
  });
});
