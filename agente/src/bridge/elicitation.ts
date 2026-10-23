import * as z from 'zod';

const Propriedade = z.looseObject({
  enum: z.array(z.string()).min(1).optional(),
  const: z.string().optional(),
});

const FormElicitation = z.looseObject({
  method: z.literal('elicitation/create'),
  params: z.looseObject({
    mode: z.literal('form').optional(),
    requestedSchema: z.looseObject({ properties: z.record(z.string(), Propriedade) }),
  }),
});

export interface Escolhas {
  inputKey: string;
  field: string;
  opcoes: string[];
}

export function lerEscolhas(inputRequests: Record<string, unknown>): Escolhas | undefined {
  const entradas = Object.entries(inputRequests);
  if (entradas.length !== 1) return undefined;
  const [inputKey, pedido] = entradas[0] as [string, unknown];

  const parsed = FormElicitation.safeParse(pedido);
  if (!parsed.success) return undefined;

  const campos = Object.entries(parsed.data.params.requestedSchema.properties);
  if (campos.length !== 1) return undefined;
  const [field, schema] = campos[0] as [string, z.infer<typeof Propriedade>];

  const opcoes = schema.enum ?? (schema.const !== undefined ? [schema.const] : []);
  return opcoes.length > 0 ? { inputKey, field, opcoes } : undefined;
}
