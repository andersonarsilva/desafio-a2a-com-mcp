import * as z from 'zod';

const MIN_SECRET_BYTES = 32;

const EnvSchema = z.object({
  MCP_PORT: z.coerce.number().int().min(1).max(65535).default(7301),
  MCP_HOST: z.string().min(1).optional(),
  MCP_PATH: z.string().startsWith('/').default('/mcp'),
  DADOS_DIR: z.string().min(1).optional(),
  REQUEST_STATE_SECRET: z
    .string({ error: 'REQUEST_STATE_SECRET e obrigatoria (gere com: python3 -c "import secrets; print(secrets.token_hex(32))")' })
    .regex(/^(?:[0-9a-fA-F]{2})+$/, 'REQUEST_STATE_SECRET deve ser hexadecimal')
    .transform((hex) => new Uint8Array(Buffer.from(hex, 'hex')))
    .refine((bytes) => bytes.length >= MIN_SECRET_BYTES, `REQUEST_STATE_SECRET precisa de ao menos ${MIN_SECRET_BYTES} bytes`),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Configuracao invalida: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
