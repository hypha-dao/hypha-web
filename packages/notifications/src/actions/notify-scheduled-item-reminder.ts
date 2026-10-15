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
 * per-channel claim/release idempotency, so a delivery failure throws and lets it release.
 */
export async function notifyScheduledItemReminder(
  input: NotifyScheduledItemReminderInput,
) {
  if (input.memberSlugs.length === 0 || input.channels.length === 0) {
    return { sent: 0 };
  }

  const event = buildScheduledItemReminderEvent(input);
  const result = await dispatch(event);

  if (result && result.sent === 0 && result.failed > 0) {
    throw new Error('Failed to deliver scheduled item reminder');
  }

  return { sent: result?.sent ?? 0, url: event.payload.url };
}
