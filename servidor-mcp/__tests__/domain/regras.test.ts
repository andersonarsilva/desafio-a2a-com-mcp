import { describe, expect, it } from '@jest/globals';
import {
  alternativas,
  conflitos,
  intervaloDe,
  MENSAGENS,
  parseInstante,
  sobrepoe,
  validarPedido,
  versaoDaPolitica,
} from '../../src/domain/regras.js';
import { h, RESERVAS, SALAS } from '../helpers/fixtures.js';

const garagem = SALAS[2]!;

describe('parseInstante', () => {
  it('aceita ISO 8601 com offset ou Z', () => {
    expect(parseInstante('2026-11-03T14:00:00-03:00')).toBe(Date.UTC(2026, 10, 3, 17));
    expect(parseInstante('2026-11-03T17:00Z')).toBe(Date.UTC(2026, 10, 3, 17));
  });

  it.each(['2026-11-03T14:00:00', 'amanha', '2026-13-45T99:00:00-03:00'])('rejeita %s', (valor) => {
    expect(parseInstante(valor)).toBeUndefined();
  });
});

describe('sobrepoe', () => {
  it('considera intervalos adjacentes como livres', () => {
    expect(sobrepoe({ inicio: 0, fim: 10 }, { inicio: 10, fim: 20 })).toBe(false);
    expect(sobrepoe({ inicio: 0, fim: 11 }, { inicio: 10, fim: 20 })).toBe(true);
  });
});

describe('validarPedido', () => {
  const pedido = (sala: string, inicio: string, fim: string) => validarPedido(SALAS, { sala, inicio, fim });

  it('devolve a sala e o intervalo quando tudo esta dentro da politica', () => {
    const v = pedido('sala-aquario', h('08:00'), h('10:00'));
    expect(v).toEqual({ ok: true, sala: SALAS[0], intervalo: { inicio: Date.UTC(2026, 10, 3, 11), fim: Date.UTC(2026, 10, 3, 13) } });
  });

  it.each([
    ['sala-delorean', h('09:00'), h('10:00'), MENSAGENS.salaInexistente('sala-delorean')],
    ['sala-aquario', 'x', h('10:00'), MENSAGENS.dataInvalida('inicio')],
    ['sala-aquario', h('09:00'), 'x', MENSAGENS.dataInvalida('fim')],
    ['sala-aquario', h('10:00'), h('09:00'), MENSAGENS.intervaloInvalido],
    ['sala-aquario', h('10:00'), h('10:00'), MENSAGENS.intervaloInvalido],
    ['sala-aquario', h('07:00'), h('08:00'), MENSAGENS.foraDaJanela],
    ['sala-aquario', h('19:30'), h('20:30'), MENSAGENS.foraDaJanela],
    ['sala-aquario', '2026-11-03T21:00:00-03:00', '2026-11-04T09:00:00-03:00', MENSAGENS.foraDaJanela],
    ['sala-aquario', h('09:00'), h('12:00'), MENSAGENS.duracaoAcimaDoLimite],
  ])('%s %s→%s falha com a mensagem exata', (sala, inicio, fim, mensagem) => {
    expect(pedido(sala, inicio, fim)).toEqual({ ok: false, mensagem });
  });

  it('converte outro fuso para o horario de Sao Paulo', () => {
    expect(pedido('sala-aquario', '2026-11-03T11:00:00Z', '2026-11-03T12:00:00Z').ok).toBe(true);
    expect(pedido('sala-aquario', '2026-11-03T10:00:00Z', '2026-11-03T11:00:00Z').ok).toBe(false);
  });

  it('mantem as mensagens exatas do enunciado', () => {
    expect(MENSAGENS.foraDaJanela).toBe('Fora da janela de uso: a politica permite reservas entre 08:00 e 20:00');
    expect(MENSAGENS.duracaoAcimaDoLimite).toBe('Duracao acima do limite: a politica permite no maximo 2 horas');
    expect(MENSAGENS.intervaloInvalido).toBe('Intervalo invalido: fim deve ser posterior a inicio');
    expect(MENSAGENS.semAlternativas).toBe('Sem alternativas disponiveis no intervalo');
  });
});

describe('conflitos e alternativas', () => {
  const intervalo = { inicio: Date.parse(h('14:00')), fim: Date.parse(h('15:00')) };

  it('encontra a reserva em conflito na sala', () => {
    expect(conflitos(RESERVAS, 'sala-garagem', intervalo)).toEqual([RESERVAS[0]]);
    expect(conflitos(RESERVAS, 'sala-fusca', intervalo)).toEqual([]);
  });

  it('ordena por capacidade e depois por id, sem a sala pedida', () => {
    expect(alternativas(SALAS, RESERVAS, garagem, intervalo)).toEqual(['sala-fusca', 'sala-mirante']);
  });

  it('exclui salas ocupadas e limita a tres', () => {
    const aquario = SALAS[0]!;
    expect(alternativas(SALAS, RESERVAS, aquario, intervalo)).toEqual(['sala-porao', 'sala-fusca', 'sala-mirante']);
    const fusca = SALAS[3]!;
    const tarde = { inicio: Date.parse(h('16:00')), fim: Date.parse(h('17:00')) };
    expect(alternativas(SALAS, RESERVAS, fusca, tarde)).toEqual(['sala-garagem', 'sala-mirante']);
  });

  it('falha alto em reserva com data corrompida', () => {
    expect(() => intervaloDe({ ...RESERVAS[0]!, inicio: 'x' })).toThrow('Reserva res-0001 com data invalida');
  });
});

describe('versaoDaPolitica', () => {
  it('le a versao da primeira linha', () => {
    expect(versaoDaPolitica('versao: 2026-11-01\n\n- regra')).toBe('2026-11-01');
  });

  it('exige a linha de versao', () => {
    expect(() => versaoDaPolitica('- regra')).toThrow('versao:');
  });
});
