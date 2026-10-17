import 'server-only';

import type { ScheduledItem } from '@hypha-platform/core/client';
import { dispatch } from '../core/dispatch';
import { buildScheduledItemReminderEvent } from '../events/scheduled-item-reminder';

export type NotifyScheduledItemReminderInput = {
  item: ScheduledItem;
  occurrenceStartsAt: Date;
  spaceSlug: string;
  spaceTitle: string;
  memberSlugs: string[];
  channels: Array<'email' | 'push'>;
  lang?: string;
};

/**
 * Fires the reminder through `dispatch()` (#2549 D16): consent gating (`consent_meetings` for
 * calls/meetings) and the shared email layout live behind it. The caller keeps owning the
 * per-channel claim/release idempotency, so each channel is dispatched on its own and the ones
 * that failed are returned in `failedChannels` - the caller releases only those claims, keeping
 * the claims of channels that were delivered.
 */
export async function notifyScheduledItemReminder(
  input: NotifyScheduledItemReminderInput,
) {
  if (input.memberSlugs.length === 0 || input.channels.length === 0) {
    return { sent: 0, failedChannels: [] as Array<'email' | 'push'> };
  }

  let sent = 0;
  let url: string | undefined;
  const failedChannels: Array<'email' | 'push'> = [];
  for (const channel of input.channels) {
    const event = buildScheduledItemReminderEvent({
      ...input,
      channels: [channel],
    });
    url = event.payload.url;
    try {
      const result = await dispatch(event);
      sent += result?.sent ?? 0;
      if (result && result.sent === 0 && result.failed > 0) {
        failedChannels.push(channel);
      }
    } catch (error) {
      console.error('Scheduled item reminder dispatch failed:', {
        channel,
        error,
      });
      failedChannels.push(channel);
    }
  }

  return { sent, url, failedChannels };
}
