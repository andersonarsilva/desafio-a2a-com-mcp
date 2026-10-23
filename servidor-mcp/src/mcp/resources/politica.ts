import type { McpServer } from '@modelcontextprotocol/server';
import type { ServerDeps } from '../deps.js';

export const URI_POLITICA = 'politica://uso';
const MIME_TYPE = 'text/markdown';

export function registerPolitica(server: McpServer, { politica }: ServerDeps): void {
  server.registerResource(
    'politica-de-uso',
    URI_POLITICA,
    { title: 'Politica de uso das salas', description: 'Regras de reserva vigentes.', mimeType: MIME_TYPE },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: MIME_TYPE, text: politica.texto }] }),
  );
}
