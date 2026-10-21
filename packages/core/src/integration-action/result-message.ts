/**
 * What the approval page tells the application that opened it. Pure and
 * framework-free so the rules (origin, shape, never `*`) are testable.
 */
export const INTEGRATION_ACTION_MESSAGE_TYPE = 'hypha:integration-action';

export const INTEGRATION_ACTION_MESSAGE_STATUSES = [
  'submitted',
  'rejected',
  'failed',
  'expired',
] as const;

export type IntegrationActionMessageStatus =
  (typeof INTEGRATION_ACTION_MESSAGE_STATUSES)[number];

export type IntegrationActionMessage = {
  type: typeof INTEGRATION_ACTION_MESSAGE_TYPE;
  version: 1;
  actionId: string;
  status: IntegrationActionMessageStatus;
  /** Only with `submitted`. */
  txHash?: string;
};

export function buildIntegrationActionMessage(args: {
  actionId: string;
  status: IntegrationActionMessageStatus;
  txHash?: string | null;
}): IntegrationActionMessage {
  return {
    type: INTEGRATION_ACTION_MESSAGE_TYPE,
    version: 1,
    actionId: args.actionId,
    status: args.status,
    ...(args.status === 'submitted' && args.txHash
      ? { txHash: args.txHash }
      : {}),
  };
}

/** A registered origin is `scheme://host[:port]` with nothing after it. */
function exactOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin === value ? value : null;
  } catch {
    return null;
  }
}

/**
 * Post the message to the opener, once per registered origin of the client
 * that asked for the action. The browser delivers it only where the opener's
 * origin equals the target, so the others are dropped silently. The target is
 * never `*`; with no opener or no registered origin nothing is sent.
 * Returns how many targets were tried.
 */
export function notifyOpener(
  opener: Pick<Window, 'postMessage'> | null | undefined,
  message: IntegrationActionMessage,
  registeredOrigins: readonly string[],
): number {
  if (!opener) return 0;
  let tried = 0;
  for (const registered of registeredOrigins) {
    const origin = exactOrigin(registered);
    if (!origin) continue;
    try {
      opener.postMessage(message, origin);
      tried++;
    } catch {
      // A closed or cross-origin-isolated opener: polling stays the fallback.
    }
  }
  return tried;
}
