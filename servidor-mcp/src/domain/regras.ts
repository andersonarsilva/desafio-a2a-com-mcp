export interface Sala {
  id: string;
  nome: string;
  capacidade: number;
  recursos: string[];
}

export interface Reserva {
  id: string;
  sala: string;
  inicio: string;
  fim: string;
  responsavel: string;
}

export interface Intervalo {
  inicio: number;
  fim: number;
}

export const MENSAGENS = {
  salaInexistente: (id: string) => `Sala inexistente: ${id}`,
  foraDaJanela: 'Fora da janela de uso: a politica permite reservas entre 08:00 e 20:00',
  duracaoAcimaDoLimite: 'Duracao acima do limite: a politica permite no maximo 2 horas',
  intervaloInvalido: 'Intervalo invalido: fim deve ser posterior a inicio',
  semAlternativas: 'Sem alternativas disponiveis no intervalo',
  dataInvalida: (campo: string) =>
    `Data invalida em ${campo}: use ISO 8601 com fuso, por exemplo 2026-11-03T14:00:00-03:00`,
} as const;

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;
const OFFSET_SAO_PAULO_MS = -3 * HORA_MS;
const ABERTURA_MS = 8 * HORA_MS;
const FECHAMENTO_MS = 20 * HORA_MS;
const DURACAO_MAXIMA_MS = 2 * HORA_MS;
export const MAXIMO_DE_ALTERNATIVAS = 3;

const ISO_8601_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function parseInstante(valor: string): number | undefined {
  if (!ISO_8601_COM_FUSO.test(valor)) return undefined;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? undefined : ms;
}

export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim;
}

function dentroDaJanela({ inicio, fim }: Intervalo): boolean {
  const inicioLocal = inicio + OFFSET_SAO_PAULO_MS;
  const fimLocal = fim + OFFSET_SAO_PAULO_MS;
  const meiaNoite = Math.floor(inicioLocal / DIA_MS) * DIA_MS;
  return inicioLocal >= meiaNoite + ABERTURA_MS && fimLocal <= meiaNoite + FECHAMENTO_MS;
}

export interface PedidoDeHorario {
  sala: string;
  inicio: string;
  fim: string;
}

export type Validacao =
  | { ok: true; sala: Sala; intervalo: Intervalo }
  | { ok: false; mensagem: string };

export function validarPedido(salas: readonly Sala[], pedido: PedidoDeHorario): Validacao {
  const sala = salas.find((s) => s.id === pedido.sala);
  if (!sala) return { ok: false, mensagem: MENSAGENS.salaInexistente(pedido.sala) };

  const inicio = parseInstante(pedido.inicio);
  if (inicio === undefined) return { ok: false, mensagem: MENSAGENS.dataInvalida('inicio') };
  const fim = parseInstante(pedido.fim);
  if (fim === undefined) return { ok: false, mensagem: MENSAGENS.dataInvalida('fim') };

  const intervalo = { inicio, fim };
  if (fim <= inicio) return { ok: false, mensagem: MENSAGENS.intervaloInvalido };
  if (!dentroDaJanela(intervalo)) return { ok: false, mensagem: MENSAGENS.foraDaJanela };
  if (fim - inicio > DURACAO_MAXIMA_MS) return { ok: false, mensagem: MENSAGENS.duracaoAcimaDoLimite };

  return { ok: true, sala, intervalo };
}

export function intervaloDe(reserva: Reserva): Intervalo {
  const inicio = parseInstante(reserva.inicio);
  const fim = parseInstante(reserva.fim);
  if (inicio === undefined || fim === undefined) {
    throw new Error(`Reserva ${reserva.id} com data invalida`);
  }
  return { inicio, fim };
}

export function conflitos(reservas: readonly Reserva[], salaId: string, intervalo: Intervalo): Reserva[] {
  return reservas.filter((r) => r.sala === salaId && sobrepoe(intervaloDe(r), intervalo));
}

export function alternativas(
  salas: readonly Sala[],
  reservas: readonly Reserva[],
  pedida: Sala,
  intervalo: Intervalo,
): string[] {
  return salas
    .filter((s) => s.id !== pedida.id && s.capacidade >= pedida.capacidade)
    .filter((s) => conflitos(reservas, s.id, intervalo).length === 0)
    .sort((a, b) => a.capacidade - b.capacidade || a.id.localeCompare(b.id))
    .slice(0, MAXIMO_DE_ALTERNATIVAS)
    .map((s) => s.id);
}

export function versaoDaPolitica(texto: string): string {
  const primeiraLinha = texto.split('\n', 1)[0] ?? '';
  const match = /^versao:\s*(\S+)/.exec(primeiraLinha.trim());
  if (!match?.[1]) throw new Error('Politica de uso sem a linha "versao:" no topo');
  return match[1];
}
