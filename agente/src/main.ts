import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createStderrLogger } from './log.js';
import { createSdkMcpHost } from './mcp-host/sdk-mcp-host.js';
import { randomIds } from './tasks/ids.js';

const log = createStderrLogger();

try {
  const env = loadEnv(process.env);
  const host = createSdkMcpHost({ url: new URL(env.MCP_URL), timeoutMs: env.MCP_TIMEOUT_MS });
  const app = createApp({ publicUrl: env.PUBLIC_URL, host, ids: randomIds, log });
  const onListening = () => log('agente.listening', { port: env.AGENT_PORT, publicUrl: env.PUBLIC_URL, mcpUrl: env.MCP_URL });
  if (env.AGENT_HOST) app.listen(env.AGENT_PORT, env.AGENT_HOST, onListening);
  else app.listen(env.AGENT_PORT, onListening);
} catch (error) {
  log('agente.boot_failed', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
