import { describe, expect, it } from '@jest/globals';
import { parseEscolha, parsePedido, versaoDaPolitica } from '../../src/commands/parse.js';

describe('parsePedido', () => {
  it('le o formato fixo do enunciado', () => {
    expect(parsePedido('reservar sala=sala-garagem inicio=2026-11-03T14:00:00-03:00 fim=2026-11-03T15:00:00-03:00 responsavel=Marty')).toEqual({
      sala: 'sala-garagem', inicio: '2026-11-03T14:00:00-03:00', fim: '2026-11-03T15:00:00-03:00', responsavel: 'Marty',
    });
  });

  it('aceita responsavel com espacos e espacos nas pontas', () => {
    expect(parsePedido('  reservar sala=a inicio=b fim=c responsavel=Emmett Brown  ')?.responsavel).toBe('Emmett Brown');
  });

  it.each(['reserve sala=a inicio=b fim=c responsavel=d', 'reservar sala=a fim=c inicio=b responsavel=d', 'reservar', ''])('rejeita %p', (texto) => {
    expect(parsePedido(texto)).toBeUndefined();
  });
});

describe('parseEscolha', () => {
  it('distingue recusa de opcao', () => {
    expect(parseEscolha('escolha=recusar')).toEqual({ kind: 'recusar' });
    expect(parseEscolha(' escolha=sala-fusca ')).toEqual({ kind: 'opcao', valor: 'sala-fusca' });
  });

  it.each(['escolha=', 'sala-fusca', 'escolha=a b'])('rejeita %p', (texto) => {
    expect(parseEscolha(texto)).toBeUndefined();
  });
});

describe('versaoDaPolitica', () => {
  it('extrai a versao da primeira linha', () => {
    expect(versaoDaPolitica('versao: 2026-11-01\n\n- x')).toBe('2026-11-01');
    expect(versaoDaPolitica('- x\nversao: 1')).toBeUndefined();
  });
});
