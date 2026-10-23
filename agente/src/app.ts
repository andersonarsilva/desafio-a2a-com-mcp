import { createServer, type Server } from 'node:http';
import { buildAgentCard } from './a2a/agent-card.js';
import { createA2AListener } from './a2a/http-server.js';
import { createA2AMethods } from './a2a/methods.js';
import { createReservationBridge } from './bridge/reservation-bridge.js';
import type { Logger } from './log.js';
import type { McpHost } from './mcp-host/mcp-host.js';
import type { IdGenerator } from './tasks/ids.js';
import { createTaskStore } from './tasks/task-store.js';

export interface AppDeps {
  publicUrl: string;
  host: McpHost;
  ids: IdGenerator;
  log: Logger;
}

export function createApp({ publicUrl, host, ids, log }: AppDeps): Server {
  const methods = createA2AMethods(createTaskStore(ids), createReservationBridge({ host, ids }));
  return createServer(createA2AListener(buildAgentCard(publicUrl), methods, log));
}
