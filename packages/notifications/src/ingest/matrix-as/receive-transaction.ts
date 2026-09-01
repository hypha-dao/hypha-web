import { ingestParsedMessage } from './ingest-message';
import { parseMessageEvent } from './parse-message-event';
import type {
  ReceiveResult,
  ReceiveTransactionInput,
  ReceiverDeps,
} from './types';

/**
 * Framework-agnostic core of the inbound AS transaction receiver (#2483).
 *
 * Contract with the route adapter:
 *  - Resolves normally  → the adapter returns **200** (transaction fully accounted for).
 *  - THROWS             → the adapter returns **5xx**; Dendrite keeps the transaction queued and
 *                         replays it in order later. So this only throws on a *durable-write*
 *                         failure — never on a `dispatch()` failure (that is swallowed).
 *
 * Per event: parse → drop non-messages / `m.notice` → delegate to the shared per-message
 * pipeline (`ingestParsedMessage`), which also backs the bounded reconciler.
 */
export async function receiveTransaction(
  { txnId, body }: ReceiveTransactionInput,
  deps: ReceiverDeps,
): Promise<ReceiveResult> {
  const logger = deps.logger ?? console;
  const botUserIds = new Set(
    deps.botUserIds.map((id) => id.trim()).filter(Boolean),
  );

  const result: ReceiveResult = {
    dispatched: 0,
    dispatchFailures: 0,
    duplicates: 0,
    ignored: 0,
  };

  const events = Array.isArray(body.events) ? body.events : [];

  for (const raw of events) {
    const parsed = parseMessageEvent(raw);
    if (!parsed) {
      result.ignored += 1;
      continue;
    }

    const outcome = await ingestParsedMessage(
      parsed,
      { txnId },
      { db: deps.db, dispatch: deps.dispatch, botUserIds, logger },
    );

    switch (outcome) {
      case 'dispatched':
        result.dispatched += 1;
        break;
      case 'dispatch_failed':
        result.dispatchFailures += 1;
        break;
      case 'duplicate':
        result.duplicates += 1;
        break;
      default:
        result.ignored += 1;
    }
  }

  return result;
}
