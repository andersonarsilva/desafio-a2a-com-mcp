export type TaskState =
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED';

export interface TextPart {
  text: string;
}

export interface Message {
  messageId: string;
  role: 'ROLE_USER' | 'ROLE_AGENT';
  parts: TextPart[];
  taskId?: string;
  contextId?: string;
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp: string;
}

export interface Artifact {
  artifactId: string;
  name: string;
  parts: TextPart[];
}

export interface Task {
  id: string;
  contextId: string;
  status: TaskStatus;
  history: Message[];
  artifacts: Artifact[];
}
