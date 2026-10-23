import { describe, expect, it } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import { carregarDados } from '../src/data.js';

const DADOS = fileURLToPath(new URL('../../dados/', import.meta.url));

describe('carregarDados', () => {
  it('carrega salas, reservas e a versao da politica do starter', async () => {
    const dados = await carregarDados(DADOS);
    expect(dados.salas.map((s) => s.id)).toContain('sala-mirante');
    expect(dados.reservas.map((r) => r.id)).toEqual(['res-0001', 'res-0002']);
    expect(dados.politica.versao).toBe('2026-11-01');
  });

  it('falha com diretorio inexistente', async () => {
    await expect(carregarDados('/nao/existe')).rejects.toThrow();
  });
});
