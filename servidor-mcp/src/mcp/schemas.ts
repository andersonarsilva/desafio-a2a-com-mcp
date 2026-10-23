import * as z from 'zod';

export const SalaOut = z.object({
  id: z.string(),
  nome: z.string(),
  capacidade: z.number().int(),
  recursos: z.array(z.string()),
});

export const ListaDeSalas = z.object({ salas: z.array(SalaOut) });

export const ConsultaIn = z.object({
  sala: z.string(),
  inicio: z.string(),
  fim: z.string(),
});

export const Disponibilidade = z.object({
  sala: z.string(),
  livre: z.boolean(),
  conflitos: z.array(
    z.object({
      id: z.string(),
      inicio: z.string(),
      fim: z.string(),
      responsavel: z.string(),
    }),
  ),
});

export const ReservaIn = ConsultaIn.extend({ responsavel: z.string().min(1) });

export const ReservaOut = z.object({
  reserva: z.string().nullable(),
  reservado: z.boolean(),
  sala: z.string().nullable(),
  inicio: z.string().nullable(),
  fim: z.string().nullable(),
  responsavel: z.string().nullable(),
  politica: z.string().nullable(),
  motivo: z.string().nullable(),
});

export type PedidoDeReserva = z.infer<typeof ReservaIn>;
export type ReservaOut = z.infer<typeof ReservaOut>;
