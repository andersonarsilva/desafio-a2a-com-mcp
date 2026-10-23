export type LogFields = Record<string, unknown>;
export type Logger = (event: string, fields: LogFields) => void;

export function createStderrLogger(write: (line: string) => void = (l) => process.stderr.write(l)): Logger {
  return (event, fields) => {
    write(`${JSON.stringify({ ts: new Date().toISOString(), event, ...fields })}\n`);
  };
}
