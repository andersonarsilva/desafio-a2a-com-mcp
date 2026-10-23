import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { REQUEST_STATE_TTL_SECONDS } from '../../src/mcp/request-state.js';
import { CHAVE_ESCOLHA } from '../../src/mcp/tools/reservar-sala.js';
import { h } from '../helpers/fixtures.js';
import { CAPS_FORM, criarHandler, PROTOCOLO, reservar, rpc } from '../helpers/mcp.js';

const texto = (body: Record<string, any>) => (body.result.content as Array<{ text: string }>).map((c) => c.text).join(' ');
const garagem14 = { sala: 'sala-garagem', inicio: h('14:00'), fim: h('15:00'), responsavel: 'Marty' };

async function conflito(handler = criarHandler(), args = garagem14) {
  const { body } = await reservar(handler, args);
  return { handler, chave: Object.keys(body.result.inputRequests)[0]!, estado: body.result.requestState as string, body };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('descoberta e envelope', () => {
  it('lista as tres tools com inputSchema de objeto e outputSchema', async () => {
    const { body } = await rpc(criarHandler(), 'tools/list');
    const tools = body.result.tools as Array<Record<string, any>>;
    expect(tools.map((t) => t.name)).toEqual(['listar_salas', 'consultar_disponibilidade', 'reservar_sala']);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema.type).toBe('object');
    }
  });

  it.each([
    ['protocolVersion', { 'io.modelcontextprotocol/clientCapabilities': CAPS_FORM }],
    ['clientCapabilities', { 'io.modelcontextprotocol/protocolVersion': PROTOCOLO }],
  ])('rejeita _meta sem %s com -32602 e HTTP 400', async (_campo, meta) => {
    const { status, body } = await rpc(criarHandler(), 'tools/list', {}, { meta });
    expect(status).toBe(400);
    expect(body.error.code).toBe(-32602);
  });

  it('recusa tool inexistente', async () => {
    const { body } = await rpc(criarHandler(), 'tools/call', { name: 'voar_delorean', arguments: {} });
    expect(body.error.code).toBe(-32602);
  });
});

describe('listar_salas e consultar_disponibilidade', () => {
  it('devolve structuredContent igual ao JSON do bloco de texto', async () => {
    const { body } = await rpc(criarHandler(), 'tools/call', { name: 'listar_salas', arguments: {} });
    expect(JSON.parse(texto(body))).toEqual(body.result.structuredContent);
    expect(body.result.structuredContent.salas).toHaveLength(5);
  });

  it('informa conflitos do intervalo', async () => {
    const { body } = await rpc(criarHandler(), 'tools/call', {
      name: 'consultar_disponibilidade',
      arguments: { sala: 'sala-garagem', inicio: h('14:30'), fim: h('15:30') },
    });
    expect(body.result.structuredContent).toEqual({
      sala: 'sala-garagem',
      livre: false,
      conflitos: [{ id: 'res-0001', inicio: h('14:00'), fim: h('15:00'), responsavel: 'Marty' }],
    });
  });

  it('aplica as mesmas validacoes da reserva', async () => {
    const { body } = await rpc(criarHandler(), 'tools/call', {
      name: 'consultar_disponibilidade',
      arguments: { sala: 'sala-aquario', inicio: h('07:00'), fim: h('08:00') },
    });
    expect(body.result.isError).toBe(true);
    expect(texto(body)).toContain('Fora da janela de uso');
  });
});

describe('resource politica://uso', () => {
  it('devolve o texto em text/markdown', async () => {
    const { body } = await rpc(criarHandler(), 'resources/read', { uri: 'politica://uso' });
    expect(body.result.contents).toEqual([{ uri: 'politica://uso', mimeType: 'text/markdown', text: expect.stringContaining('versao: 2026-11-01') }]);
  });

  it('devolve -32602 para URI inexistente', async () => {
    const { body } = await rpc(criarHandler(), 'resources/read', { uri: 'politica://inexistente' });
    expect(body.error.code).toBe(-32602);
  });
});

describe('reservar_sala', () => {
  it('reserva intervalo livre com a versao da politica', async () => {
    const { body } = await reservar(criarHandler(), { sala: 'sala-aquario', inicio: h('09:00'), fim: h('10:00'), responsavel: 'Doc' });
    expect(body.result.resultType).toBe('complete');
    expect(body.result.structuredContent).toEqual({
      reserva: 'res-0003', reservado: true, sala: 'sala-aquario', inicio: h('09:00'), fim: h('10:00'),
      responsavel: 'Doc', politica: '2026-11-01', motivo: null,
    });
  });

  it('devolve erro de execucao para sala inexistente', async () => {
    const { body } = await reservar(criarHandler(), { ...garagem14, sala: 'sala-delorean' });
    expect(body.result.isError).toBe(true);
    expect(texto(body)).toContain('Sala inexistente: sala-delorean');
  });

  it('pede escolha em form mode com alternativas ordenadas', async () => {
    const { body, chave } = await conflito();
    expect(body.result.resultType).toBe('input_required');
    expect(chave).toBe(CHAVE_ESCOLHA);
    const pedido = body.result.inputRequests[chave];
    expect(pedido.method).toBe('elicitation/create');
    expect(pedido.params.mode).toBe('form');
    expect(pedido.params.requestedSchema).toMatchObject({
      type: 'object',
      properties: { sala: { type: 'string', enum: ['sala-fusca', 'sala-mirante'] } },
      required: ['sala'],
    });
  });

  it('responde -32021 com HTTP 400 quando o cliente nao declara elicitation form', async () => {
    const { status, body } = await reservar(criarHandler(), garagem14, {}, {
      meta: { 'io.modelcontextprotocol/protocolVersion': PROTOCOLO, 'io.modelcontextprotocol/clientCapabilities': {} },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe(-32021);
    expect(body.error.data.requiredCapabilities).toEqual({ elicitation: { form: {} } });
  });

  it('devolve "Sem alternativas" quando nenhuma sala atende', async () => {
    const handler = criarHandler();
    const mirante = { sala: 'sala-mirante', inicio: h('11:00'), fim: h('12:00'), responsavel: 'A' };
    await reservar(handler, mirante);
    const { body } = await reservar(handler, mirante);
    expect(body.result.isError).toBe(true);
    expect(texto(body)).toContain('Sem alternativas disponiveis no intervalo');
  });
});

describe('retry do MRTR', () => {
  it('conclui na sala escolhida', async () => {
    const { handler, chave, estado } = await conflito();
    const { body } = await reservar(handler, garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-mirante' } } },
      requestState: estado,
    });
    expect(body.result.resultType).toBe('complete');
    expect(body.result.structuredContent).toMatchObject({ reservado: true, sala: 'sala-mirante', inicio: h('14:00'), responsavel: 'Marty' });
  });

  it('usa os valores selados quando os argumentos sao adulterados', async () => {
    const { handler, chave, estado } = await conflito();
    const { body } = await reservar(handler, { sala: 'sala-mirante', inicio: h('13:00'), fim: h('14:00'), responsavel: 'Biff' }, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-fusca' } } },
      requestState: estado,
    });
    expect(body.result.structuredContent).toMatchObject({ sala: 'sala-fusca', inicio: h('14:00'), responsavel: 'Marty' });
  });

  it('rejeita requestState adulterado com -32602', async () => {
    const { handler, chave, estado } = await conflito();
    const { body } = await reservar(handler, garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-fusca' } } },
      requestState: `${estado.slice(0, -6)}AAAAAA`,
    });
    expect(body.error.code).toBe(-32602);
  });

  it('rejeita requestState assinado com outra chave', async () => {
    const { chave, estado } = await conflito(criarHandler(new Uint8Array(32).fill(9)));
    const { body } = await reservar(criarHandler(), garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-fusca' } } },
      requestState: estado,
    });
    expect(body.error.code).toBe(-32602);
  });

  it('rejeita requestState expirado com -32602', async () => {
    const { handler, chave, estado } = await conflito();
    const agora = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(agora + (REQUEST_STATE_TTL_SECONDS + 1) * 1000);
    const { body } = await reservar(handler, garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-fusca' } } },
      requestState: estado,
    });
    expect(body.error.code).toBe(-32602);
  });

  it('conclui depois de um restart do servidor (nada guardado em memoria)', async () => {
    const { chave, estado } = await conflito();
    const reiniciado = criarHandler();
    const { body } = await reservar(reiniciado, garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-fusca' } } },
      requestState: estado,
    });
    expect(body.result.structuredContent).toMatchObject({ reservado: true, sala: 'sala-fusca' });
  });

  it.each([
    ['decline', 'recusado'],
    ['cancel', 'cancelado'],
  ])('%s conclui sem reservar e sem isError', async (action, motivo) => {
    const { handler, chave, estado } = await conflito();
    const { body } = await reservar(handler, garagem14, { inputResponses: { [chave]: { action } }, requestState: estado });
    expect(body.result.resultType).toBe('complete');
    expect(body.result.isError).toBeFalsy();
    expect(body.result.structuredContent).toMatchObject({ reservado: false, reserva: null, motivo });
  });

  it('recusa escolha fora das alternativas seladas', async () => {
    const { handler, chave, estado } = await conflito();
    const { body } = await reservar(handler, garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-aquario' } } },
      requestState: estado,
    });
    expect(body.result.isError).toBe(true);
    expect(texto(body)).toContain('Escolha invalida: sala-aquario');
  });

  it('pergunta de novo quando a resposta nao veio', async () => {
    const { handler, estado } = await conflito();
    const { body } = await reservar(handler, garagem14, { inputResponses: {}, requestState: estado });
    expect(body.result.resultType).toBe('input_required');
  });

  it('recalcula as alternativas quando a escolhida foi ocupada entre a pausa e o retry', async () => {
    const { handler, chave, estado } = await conflito();
    await reservar(handler, { ...garagem14, sala: 'sala-fusca', responsavel: 'Outro' });
    const { body } = await reservar(handler, garagem14, {
      inputResponses: { [chave]: { action: 'accept', content: { sala: 'sala-fusca' } } },
      requestState: estado,
    });
    expect(body.result.resultType).toBe('input_required');
    expect(body.result.inputRequests[chave].params.requestedSchema.properties.sala.enum).toEqual(['sala-mirante']);
  });
});
