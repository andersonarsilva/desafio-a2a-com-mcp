import { describe, expect, it } from '@jest/globals';
import { createReservasStore } from '../../src/domain/reservas.js';
import { h, RESERVAS } from '../helpers/fixtures.js';

describe('createReservasStore', () => {
  it('continua a sequencia a partir do maior id existente', () => {
    const store = createReservasStore(RESERVAS);
    const criada = store.criar({ sala: 'sala-aquario', inicio: h('09:00'), fim: h('10:00'), responsavel: 'Doc' });
    expect(criada.id).toBe('res-0003');
    expect(store.listar()).toHaveLength(3);
  });

  it('torna a reserva criada visivel para as consultas seguintes', () => {
    const store = createReservasStore([]);
    const intervalo = { inicio: Date.parse(h('09:00')), fim: Date.parse(h('10:00')) };
    expect(store.conflitos('sala-aquario', intervalo)).toEqual([]);
    const criada = store.criar({ sala: 'sala-aquario', inicio: h('09:00'), fim: h('10:00'), responsavel: 'Doc' });
    expect(criada.id).toBe('res-0001');
    expect(store.conflitos('sala-aquario', intervalo)).toEqual([criada]);
  });

  it('ignora ids fora do padrao ao calcular a sequencia', () => {
    const store = createReservasStore([{ ...RESERVAS[0]!, id: 'legado' }]);
    expect(store.criar({ sala: 'sala-porao', inicio: h('09:00'), fim: h('10:00'), responsavel: 'Doc' }).id).toBe('res-0001');
  });

  it('nao altera o array de seed', () => {
    const seed = [...RESERVAS];
    createReservasStore(seed).criar({ sala: 'sala-porao', inicio: h('09:00'), fim: h('10:00'), responsavel: 'Doc' });
    expect(seed).toHaveLength(2);
  });
});
