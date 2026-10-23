import * as z from 'zod';

export type InputResponse =
  | { action: 'accept'; content: Record<string, string> }
  | { action: 'decline' }
  | { action: 'cancel' };

export interface ToolCall {
  name: string;
  arguments: Record<string, string>;
  inputResponses?: Record<string, InputResponse>;
  requestState?: string;
}

export type ToolOutcome =
  | { kind: 'complete'; isError: boolean; text: string; structured?: Record<string, unknown> }
  | { kind: 'input_required'; inputRequests: Record<string, unknown>; requestState?: string };

export interface McpHost {
  listToolNames(traceparent: string): Promise<string[]>;
  readResourceText(uri: string, traceparent: string): Promise<string>;
  callTool(call: ToolCall, traceparent: string): Promise<ToolOutcome>;
}

const InputRequiredResult = z.object({
  resultType: z.literal('input_required'),
  inputRequests: z.record(z.string(), z.unknown()).default({}),
  requestState: z.string().optional(),
});

const CompleteResult = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
  isError: z.boolean().optional(),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
});

export function toToolOutcome(result: unknown): ToolOutcome {
  const inputRequired = InputRequiredResult.safeParse(result);
  if (inputRequired.success) {
    const { inputRequests, requestState } = inputRequired.data;
    return requestState === undefined ? { kind: 'input_required', inputRequests } : { kind: 'input_required', inputRequests, requestState };
  }
  const complete = CompleteResult.parse(result);
  const text = complete.content.flatMap((c) => (c.type === 'text' && c.text !== undefined ? [c.text] : [])).join('\n');
  const outcome: ToolOutcome = { kind: 'complete', isError: complete.isError === true, text };
  return complete.structuredContent ? { ...outcome, structured: complete.structuredContent } : outcome;
}
