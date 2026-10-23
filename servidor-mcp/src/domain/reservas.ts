import { conflitos, type Intervalo, type Reserva } from './regras.js';

export interface ReservasStore {
  listar(): readonly Reserva[];
  conflitos(salaId: string, intervalo: Intervalo): Reserva[];
  criar(dados: Omit<Reserva, 'id'>): Reserva;
}

const PREFIXO = 'res-';

function sequencial(id: string): number {
  const n = Number.parseInt(id.slice(PREFIXO.length), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function createReservasStore(iniciais: readonly Reserva[]): ReservasStore {
  const reservas: Reserva[] = [...iniciais];
  let ultimo = reservas.reduce((max, r) => Math.max(max, sequencial(r.id)), 0);

  return {
    listar: () => reservas,
    conflitos: (salaId, intervalo) => conflitos(reservas, salaId, intervalo),
    criar(dados) {
      ultimo += 1;
      const reserva = { id: `${PREFIXO}${String(ultimo).padStart(4, '0')}`, ...dados };
      reservas.push(reserva);
      return reserva;
    },
  };
}
