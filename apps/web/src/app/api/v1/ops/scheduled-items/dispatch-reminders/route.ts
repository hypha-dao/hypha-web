import { NextRequest, NextResponse } from 'next/server';
import {
  findDueScheduledReminders,
  findSpaceMemberSlugsBySpaceId,
  releaseScheduledReminderDispatch,
  tryClaimScheduledReminderDispatch,
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
    let failed = 0;

    for (const reminder of due) {
      const claimedChannels: Array<'email' | 'push'> = [];
      try {
        for (const channel of reminder.channels) {
          const claimed = await tryClaimScheduledReminderDispatch(
            {
              scheduledItemId: reminder.item.id,
              occurrenceStartsAt: reminder.occurrenceStartsAt,
              channel,
            },
            { db },
          );
          if (claimed) claimedChannels.push(channel);
        }

        if (claimedChannels.length === 0) {
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
          channels: claimedChannels,
        });

        dispatched += 1;
      } catch (error) {
        for (const channel of claimedChannels) {
          await releaseScheduledReminderDispatch(
            {
              scheduledItemId: reminder.item.id,
              occurrenceStartsAt: reminder.occurrenceStartsAt,
              channel,
            },
            { db },
          );
        }
        failed += 1;
        console.error(
          'Failed to dispatch scheduled item reminder:',
          {
            scheduledItemId: reminder.item.id,
            occurrenceStartsAt: reminder.occurrenceStartsAt.toISOString(),
            channels: reminder.channels,
          },
          error,
        );
      }
    }

    return NextResponse.json({
      due: due.length,
      dispatched,
      skipped,
      failed,
    });
  } catch (error) {
    console.error('Failed to dispatch scheduled item reminders:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch scheduled item reminders' },
      { status: 500 },
    );
  }
}
