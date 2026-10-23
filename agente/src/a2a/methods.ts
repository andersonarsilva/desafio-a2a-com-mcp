import * as z from 'zod';
import type { ReservationBridge } from '../bridge/reservation-bridge.js';
import { newTraceContext, type TraceContext } from '../mcp-host/trace-context.js';
import { isTerminal } from '../tasks/task-state.js';
import { registrarMensagem, type TaskRecord, type TaskStore } from '../tasks/task-store.js';
import { toWireTask } from '../tasks/task-view.js';
import type { Message, Task } from '../tasks/types.js';
import { CODIGOS, JsonRpcError } from './json-rpc.js';

const MessageIn = z.object({
  messageId: z.string().min(1),
  role: z.literal('ROLE_USER'),
  parts: z.array(z.looseObject({ text: z.string().optional() })).min(1),
  taskId: z.string().min(1).optional(),
  contextId: z.string().min(1).optional(),
});

const SendMessageParams = z.looseObject({ message: MessageIn });
const GetTaskParams = z.looseObject({ id: z.string().min(1) });

export interface RequestContext {
  trace?: TraceContext;
}

export interface A2AMethods {
  dispatch(method: string, params: unknown, ctx: RequestContext): Promise<{ task: Task }>;
}

function parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new JsonRpcError(CODIGOS.invalidParams, z.prettifyError(parsed.error));
  return parsed.data;
}

function mensagemDoUsuario(entrada: z.infer<typeof MessageIn>): { message: Message; texto: string } {
  const textos = entrada.parts.flatMap((p) => (p.text === undefined ? [] : [p.text]));
  if (textos.length === 0) throw new JsonRpcError(CODIGOS.invalidParams, 'A mensagem precisa de ao menos uma parte de texto');
  const message: Message = {
    messageId: entrada.messageId,
    role: 'ROLE_USER',
    parts: textos.map((text) => ({ text })),
    ...(entrada.taskId ? { taskId: entrada.taskId } : {}),
    ...(entrada.contextId ? { contextId: entrada.contextId } : {}),
  };
  return { message, texto: textos.join(' ') };
}

function taskExistente(store: TaskStore, id: string): TaskRecord {
  const record = store.get(id);
  if (!record) throw new JsonRpcError(CODIGOS.taskNotFound, `Task nao encontrada: ${id}`);
  return record;
}

export function createA2AMethods(store: TaskStore, bridge: ReservationBridge): A2AMethods {
  const sendMessage = async (params: unknown, ctx: RequestContext) => {
    const { message: entrada } = parseParams(SendMessageParams, params);
    const { message, texto } = mensagemDoUsuario(entrada);

    if (!entrada.taskId) {
      const record = store.create(ctx.trace ?? newTraceContext(), entrada.contextId);
      registrarMensagem(record, message);
      await bridge.start(record, texto);
      return { task: toWireTask(record) };
    }

    const record = taskExistente(store, entrada.taskId);
    const estado = record.task.status.state;
    if (isTerminal(estado)) {
      throw new JsonRpcError(CODIGOS.unsupportedOperation, `Task ${record.task.id} ja terminou em ${estado}`);
    }
    if (estado !== 'TASK_STATE_INPUT_REQUIRED') {
      throw new JsonRpcError(CODIGOS.unsupportedOperation, `Task ${record.task.id} nao aguarda input (${estado})`);
    }
    registrarMensagem(record, message);
    await bridge.resume(record, texto);
    return { task: toWireTask(record) };
  };

  const getTask = async (params: unknown) => {
    const { id } = parseParams(GetTaskParams, params);
    return { task: toWireTask(taskExistente(store, id)) };
  };

  return {
    async dispatch(method, params, ctx) {
      if (method === 'SendMessage') return sendMessage(params, ctx);
      if (method === 'GetTask') return getTask(params);
      throw new JsonRpcError(CODIGOS.methodNotFound, `Metodo nao suportado: ${method}`);
    },
  };
}
