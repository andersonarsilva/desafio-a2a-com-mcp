import * as z from 'zod';

const EnvSchema = z.object({
  AGENT_PORT: z.coerce.number().int().min(1).max(65535).default(7300),
  AGENT_HOST: z.string().min(1).optional(),
  PUBLIC_URL: z.url().default('http://localhost:7300'),
  MCP_URL: z.url().default('http://localhost:7301/mcp'),
  MCP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuracao invalida: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
