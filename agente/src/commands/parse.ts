export interface PedidoDeReserva {
  sala: string;
  inicio: string;
  fim: string;
  responsavel: string;
}

export type Escolha = { kind: 'recusar' } | { kind: 'opcao'; valor: string };

const RESERVAR = /^reservar\s+sala=(\S+)\s+inicio=(\S+)\s+fim=(\S+)\s+responsavel=(.+)$/;
const ESCOLHA = /^escolha=(\S+)$/;
export const RECUSAR = 'recusar';

export const FORMATO_DO_PEDIDO =
  'Pedido fora do formato: reservar sala=<id> inicio=<iso8601> fim=<iso8601> responsavel=<nome>';

export function parsePedido(texto: string): PedidoDeReserva | undefined {
  const match = RESERVAR.exec(texto.trim());
  if (!match) return undefined;
  const [, sala, inicio, fim, responsavel] = match as unknown as [string, string, string, string, string];
  return { sala, inicio, fim, responsavel: responsavel.trim() };
}

export function parseEscolha(texto: string): Escolha | undefined {
  const match = ESCOLHA.exec(texto.trim());
  if (!match?.[1]) return undefined;
  return match[1] === RECUSAR ? { kind: 'recusar' } : { kind: 'opcao', valor: match[1] };
}

export function versaoDaPolitica(texto: string): string | undefined {
  const primeiraLinha = texto.split('\n', 1)[0] ?? '';
  return /^versao:\s*(\S+)/.exec(primeiraLinha.trim())?.[1];
}
