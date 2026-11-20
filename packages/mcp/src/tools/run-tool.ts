import type { Failure } from '@hypha-platform/core/server';
import { ERRORS } from '../descriptions';
import type { McpDeps, UserCaller } from '../deps';

export type ToolResult = {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: { [key: string]: unknown };
  isError?: boolean;
};

export const DEFAULT_DEADLINE_MS = 20_000;

const toolError = (text: string): ToolResult => ({
  isError: true,
  content: [{ type: 'text', text }],
});

/** A structured result with a text copy of the same data, for hosts that ignore structured output. */
export const toolOk = (data: { [key: string]: unknown }): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: data,
});

/** Maps a feature function's neutral failure to the text an assistant sees (R15). */
export function failureText(failure: Failure): string {
  switch (failure.code) {
    case 'access_check_failed':
    case 'chain_read_failed':
      return ERRORS.unavailable;
    case 'no_profile':
      return ERRORS.noProfile;
    default:
      // unknown, not visible, forbidden, unauthenticated: one answer, so existence never leaks
      return ERRORS.notFound;
  }
}

class DeadlineError extends Error {}

/**
 * The one wrapper every tool goes through: refuses callers that could not be resolved, applies
 * the per-tool deadline, turns expected failures into tool errors and unexpected exceptions
 * into a generic one (never raw text), and writes exactly one allow-listed log line.
 */
export async function runTool(
  deps: McpDeps,
  tool: string,
  run: (
    caller: UserCaller,
  ) => Promise<
    | { ok: true; result: { [key: string]: unknown }; itemCount?: number }
    | { ok: false; text: string; outcome: string }
  >,
): Promise<ToolResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const finish = (outcome: string, itemCount?: number) =>
    deps.log({
      tool,
      outcome,
      durationMs: now() - started,
      clientId: deps.clientId ?? null,
      itemCount,
    });

  if (deps.access.kind === 'refused') {
    finish(deps.access.refusal.code);
    return toolError(deps.access.refusal.message);
  }
  const caller = deps.access.caller;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const out = await Promise.race([
      run(caller),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DeadlineError()),
          deps.deadlineMs ?? DEFAULT_DEADLINE_MS,
        );
      }),
    ]);
    if (!out.ok) {
      finish(out.outcome);
      return toolError(out.text);
    }
    finish('ok', out.itemCount);
    return toolOk(out.result);
  } catch (error) {
    if (error instanceof DeadlineError) {
      finish('timeout');
      return toolError(ERRORS.timeout);
    }
    // Raw error text can carry data; the operator gets the outcome, the model a generic line.
    finish('error');
    return toolError(ERRORS.internal);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
