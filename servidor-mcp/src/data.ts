import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod';
import { versaoDaPolitica, type Reserva, type Sala } from './domain/regras.js';
import type { Politica } from './mcp/deps.js';

const SalasSchema = z.array(
  z.object({ id: z.string(), nome: z.string(), capacidade: z.number().int(), recursos: z.array(z.string()) }),
);
const ReservasSchema = z.array(
  z.object({ id: z.string(), sala: z.string(), inicio: z.string(), fim: z.string(), responsavel: z.string() }),
);

export interface DadosIniciais {
  salas: Sala[];
  reservas: Reserva[];
  politica: Politica;
}

async function lerJson(caminho: string): Promise<unknown> {
  return JSON.parse(await readFile(caminho, 'utf8'));
}

export async function carregarDados(dir: string): Promise<DadosIniciais> {
  const [salas, reservas, texto] = await Promise.all([
    lerJson(join(dir, 'salas.json')).then((d) => SalasSchema.parse(d)),
    lerJson(join(dir, 'reservas.json')).then((d) => ReservasSchema.parse(d)),
    readFile(join(dir, 'politica-de-uso.md'), 'utf8'),
  ]);
  return { salas, reservas, politica: { texto, versao: versaoDaPolitica(texto) } };
}
