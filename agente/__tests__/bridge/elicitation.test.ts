import { describe, expect, it } from '@jest/globals';
import { lerEscolhas } from '../../src/bridge/elicitation.js';
import { elicitacao } from '../helpers/fakes.js';

const pedidos = (outcome: ReturnType<typeof elicitacao>) => (outcome.kind === 'input_required' ? outcome.inputRequests : {});

describe('lerEscolhas', () => {
  it('le a chave, o campo e o enum na ordem do servidor', () => {
    expect(lerEscolhas(pedidos(elicitacao(['sala-fusca', 'sala-mirante'], 'srv:chave')))).toEqual({
      inputKey: 'srv:chave', field: 'sala', opcoes: ['sala-fusca', 'sala-mirante'],
    });
  });

  it('aceita const quando ha uma unica alternativa', () => {
    const inputRequests = {
      k: { method: 'elicitation/create', params: { mode: 'form', requestedSchema: { type: 'object', properties: { sala: { type: 'string', const: 'sala-mirante' } } } } },
    };
    expect(lerEscolhas(inputRequests)?.opcoes).toEqual(['sala-mirante']);
  });

  it.each([
    ['nenhum pedido', {}],
    ['dois pedidos', { a: {}, b: {} }],
    ['metodo diferente', { k: { method: 'sampling/createMessage', params: {} } }],
    ['url mode', { k: { method: 'elicitation/create', params: { mode: 'url', requestedSchema: { properties: {} } } } }],
    ['dois campos', { k: { method: 'elicitation/create', params: { requestedSchema: { properties: { a: { enum: ['x'] }, b: { enum: ['y'] } } } } } }],
    ['campo livre', { k: { method: 'elicitation/create', params: { requestedSchema: { properties: { a: { type: 'string' } } } } } }],
  ])('recusa %s', (_caso, inputRequests) => {
    expect(lerEscolhas(inputRequests)).toBeUndefined();
  });
});
