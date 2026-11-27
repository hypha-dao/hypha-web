import type { ToolCallLog } from './deps';

/**
 * Builds the one structured log line per tool call from an ALLOW-LIST of fields (E9, E33).
 * Anything not listed here, however it got into the input, never reaches the log: no tokens,
 * no arguments, no free text, no results. Values are limited to short primitives.
 */
const ALLOWED = [
  'tool',
  'outcome',
  'durationMs',
  'clientId',
  'itemCount',
] as const;

/** Extra fields of the audit line of a write (`mcp.write`): ids and a flag, never content. */
const WRITE_ALLOWED = ['personId', 'spaceId', 'signalId', 'duplicate'] as const;

const MAX_STRING = 200;

export function buildToolLogLine(
  entry: ToolCallLog,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {
    event: entry.write ? 'mcp.write' : 'mcp.tool_call',
  };
  const source = entry as unknown as Record<string, unknown>;
  for (const key of ALLOWED) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_STRING);
    else if (value === null && key === 'clientId') out[key] = null;
  }
  if (entry.write) {
    const write = entry.write as unknown as Record<string, unknown>;
    for (const key of WRITE_ALLOWED) {
      const value = write[key];
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
      else if (typeof value === 'boolean') out[key] = value;
    }
  }
  return out;
}

export function consoleLogger(entry: ToolCallLog): void {
  console.info(JSON.stringify(buildToolLogLine(entry)));
}
