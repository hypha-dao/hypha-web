import { gateRecipientChannels } from './consent-gate';
import { getEventHandlers, getStrategy } from './registry';
import type {
  DecidedNotification,
  NotificationChannel,
  NotificationEvent,
} from './types';
import { getNotificationDispatcher, type DispatchResult } from '../delivery';

/**
 * The one function every ingest path calls (implementation-plan.md §3.A.5): resolve candidate
 * recipients → strategy filter ("does this recipient want this?") → consent gate (which channels
 * are they subscribed to?) → build content → hand each recipient's `DecidedNotification` to the
 * delivery-layer port.
 *
 * Adding a new event type is a new `NotificationEvent` member + a `registerEventHandlers` call —
 * this function does not change.
 *
 * Returns `null` when nothing was decided (no recipients, or none survived strategy/consent) —
 * not a failure, just nothing to send. Returns the delivery layer's `DispatchResult` otherwise;
 * most callers fire-and-forget it, but a caller with its own idempotency/retry contract (e.g.
 * `dispatch-scheduled-item-invitation.ts`) can inspect `failed` to decide whether to retry. Note
 * the delivery layer itself never rejects (it catches and counts per-send failures) — `dispatch`
 * only rejects if the resolver/content builder itself throws.
 */
export async function dispatch(
  event: NotificationEvent,
): Promise<DispatchResult | null> {
  const { resolver, contentBuilder } = getEventHandlers(event.type);
  const strategy = getStrategy(event.type);

  const candidates = await resolver(event);
  const recipients = candidates.filter((recipient) =>
    strategy(event, recipient),
  );
  if (recipients.length === 0) return null;

  const built = recipients.map((recipient) => ({
    recipient,
    ...contentBuilder(event, recipient),
  }));

  // Recipients of the same event overwhelmingly share the same requested channels + requiredTags
  // (e.g. every `proposal.created` recipient needs `sub_newProposalOpen`) — group so consent
  // gating is one OneSignal lookup per (channels, requiredTags) group, not one per recipient.
  const groups = new Map<
    string,
    {
      channels: NotificationChannel[];
      requiredTags: Record<string, string>;
      entries: typeof built;
    }
  >();
  for (const entry of built) {
    const key = JSON.stringify([entry.channels, entry.requiredTags]);
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else
      groups.set(key, {
        channels: entry.channels,
        requiredTags: entry.requiredTags,
        entries: [entry],
      });
  }

  const decided: DecidedNotification[] = [];
  await Promise.all(
    Array.from(groups.values()).map(
      async ({ channels, requiredTags, entries }) => {
        const allowedByChannel = await gateRecipientChannels(
          entries.map((e) => e.recipient),
          channels,
          requiredTags,
        );
        for (const entry of entries) {
          const allowedChannels = channels.filter(
            (channel: NotificationChannel) =>
              allowedByChannel.get(channel)?.has(entry.recipient.personSlug),
          );
          if (allowedChannels.length === 0) continue;
          decided.push({
            recipient: entry.recipient,
            channels: allowedChannels,
            content: entry.content,
          });
        }
      },
    ),
  );

  if (decided.length === 0) return null;

  return getNotificationDispatcher().sendMany(decided);
}
