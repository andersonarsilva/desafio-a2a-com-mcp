import { randomUUID } from 'node:crypto';

export interface IdGenerator {
  task(): string;
  context(): string;
  message(): string;
  artifact(): string;
}

const curto = () => randomUUID().replaceAll('-', '').slice(0, 12);

export const randomIds: IdGenerator = {
  task: () => `task-${curto()}`,
  context: () => `ctx-${curto()}`,
  message: () => `msg-${curto()}`,
  artifact: () => `art-${curto()}`,
};
