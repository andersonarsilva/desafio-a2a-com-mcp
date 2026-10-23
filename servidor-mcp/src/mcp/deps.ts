import type { RequestStateCodec } from '@modelcontextprotocol/server';
import type { Sala } from '../domain/regras.js';
import type { ReservasStore } from '../domain/reservas.js';
import type { ReservaSelada } from './request-state.js';

export interface Politica {
  texto: string;
  versao: string;
}

export interface ServerDeps {
  salas: readonly Sala[];
  reservas: ReservasStore;
  politica: Politica;
  codec: RequestStateCodec<ReservaSelada>;
}
