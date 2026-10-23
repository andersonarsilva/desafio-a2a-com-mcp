import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { carregarDados } from './data.js';
import { createStderrLogger } from './http/log.js';

const log = createStderrLogger();

try {
  const env = loadEnv(process.env);
  const dadosDir = env.DADOS_DIR ?? fileURLToPath(new URL('../../dados/', import.meta.url));
  const app = createApp(env, await carregarDados(dadosDir), log);
  const onListening = () => log('mcp.listening', { port: env.MCP_PORT, path: env.MCP_PATH, dadosDir });
  if (env.MCP_HOST) app.listen(env.MCP_PORT, env.MCP_HOST, onListening);
  else app.listen(env.MCP_PORT, onListening);
} catch (error) {
  log('mcp.boot_failed', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
