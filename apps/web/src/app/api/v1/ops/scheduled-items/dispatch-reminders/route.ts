import { NextRequest, NextResponse } from 'next/server';
import {
  findDueScheduledReminders,
  findSpaceMemberSlugsBySpaceId,
  hasScheduledReminderBeenDispatched,
  recordScheduledReminderDispatch,
} from '@hypha-platform/core/server';
import { notifyScheduledItemReminder } from '@hypha-platform/notifications/server';
import { db } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const configuredSecret =
    process.env.HYPHA_SPACE_MEMORY_OPS_SECRET?.trim() ?? '';
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'HYPHA_SPACE_MEMORY_OPS_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (readOpsSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const due = await findDueScheduledReminders({ now: new Date() }, { db });
    const memberSlugsBySpace = new Map<number, string[]>();
    let dispatched = 0;
    let skipped = 0;

    for (const reminder of due) {
      const pendingChannels: Array<'email' | 'push'> = [];
      for (const channel of reminder.channels) {
        const alreadySent = await hasScheduledReminderBeenDispatched(
          {
            scheduledItemId: reminder.item.id,
            occurrenceStartsAt: reminder.occurrenceStartsAt,
            channel,
          },
          { db },
        );
        if (!alreadySent) pendingChannels.push(channel);
      }

      if (pendingChannels.length === 0) {
        skipped += 1;
        continue;
      }

      let memberSlugs = memberSlugsBySpace.get(reminder.item.spaceId);
      if (!memberSlugs) {
        memberSlugs = await findSpaceMemberSlugsBySpaceId(
          { spaceId: reminder.item.spaceId },
          { db },
        );
        memberSlugsBySpace.set(reminder.item.spaceId, memberSlugs);
      }

      await notifyScheduledItemReminder({
        item: reminder.item,
        occurrenceStartsAt: reminder.occurrenceStartsAt,
        spaceSlug: reminder.spaceSlug,
        spaceTitle: reminder.spaceTitle,
        memberSlugs,
        channels: pendingChannels,
      });

      for (const channel of pendingChannels) {
        await recordScheduledReminderDispatch(
          {
            scheduledItemId: reminder.item.id,
            occurrenceStartsAt: reminder.occurrenceStartsAt,
            channel,
          },
          { db },
        );
      }

      dispatched += 1;
    }

    return NextResponse.json({
      due: due.length,
      dispatched,
      skipped,
    });
  } catch (error) {
    console.error('Failed to dispatch scheduled item reminders:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch scheduled item reminders' },
      { status: 500 },
    );
  }
}
