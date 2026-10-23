import type { Reserva, Sala } from '../../src/domain/regras.js';

export const SALAS: Sala[] = [
  { id: 'sala-aquario', nome: 'Aquario', capacidade: 4, recursos: ['tv'] },
  { id: 'sala-porao', nome: 'Porao', capacidade: 6, recursos: ['quadro'] },
  { id: 'sala-garagem', nome: 'Garagem', capacidade: 12, recursos: ['tv', 'quadro'] },
  { id: 'sala-fusca', nome: 'Fusca', capacidade: 12, recursos: ['tv'] },
  { id: 'sala-mirante', nome: 'Mirante', capacidade: 20, recursos: ['tv', 'quadro', 'camera'] },
];

export const RESERVAS: Reserva[] = [
  { id: 'res-0001', sala: 'sala-garagem', inicio: '2026-11-03T14:00:00-03:00', fim: '2026-11-03T15:00:00-03:00', responsavel: 'Marty' },
  { id: 'res-0002', sala: 'sala-fusca', inicio: '2026-11-03T16:00:00-03:00', fim: '2026-11-03T17:00:00-03:00', responsavel: 'Jennifer' },
];

export const POLITICA_TEXTO =
  'versao: 2026-11-01\n\n- Reservas somente entre 08:00 e 20:00, horario de Sao Paulo (-03:00).\n';

export const SECRET = new Uint8Array(32).fill(7);

export const h = (hora: string) => `2026-11-03T${hora}:00-03:00`;
