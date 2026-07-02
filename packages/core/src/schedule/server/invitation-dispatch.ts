import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { spaceScheduledItemInvitationDispatches } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import type { ScheduledItem } from '../types';
import { isJoinableScheduledItem } from '../meeting-url';

export function buildScheduledItemInviteRevision(
  item: Pick<
    ScheduledItem,
    'title' | 'startsAt' | 'endsAt' | 'meetingUrl' | 'matrixAutoLink' | 'type'
  >,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        title: item.title.trim(),
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
        meetingUrl: item.meetingUrl?.trim() ?? null,
        matrixAutoLink: Boolean(item.matrixAutoLink),
        type: item.type,
      }),
    )
    .digest('hex')
    .slice(0, 32);
}

export function shouldDispatchScheduledItemInvitation(
  item: ScheduledItem,
): boolean {
  return isJoinableScheduledItem(item);
}

export async function tryClaimScheduledItemInvitationDispatch(
  {
    scheduledItemId,
    inviteRevision,
    channel,
  }: {
    scheduledItemId: number;
    inviteRevision: string;
    channel: 'email' | 'push';
  },
  { db }: DbConfig,
): Promise<boolean> {
  const [row] = await db
    .insert(spaceScheduledItemInvitationDispatches)
    .values({
      scheduledItemId,
      inviteRevision,
      channel,
    })
    .onConflictDoNothing({
      target: [
        spaceScheduledItemInvitationDispatches.scheduledItemId,
        spaceScheduledItemInvitationDispatches.inviteRevision,
        spaceScheduledItemInvitationDispatches.channel,
      ],
    })
    .returning();

  return Boolean(row);
}

export async function releaseScheduledItemInvitationDispatch(
  {
    scheduledItemId,
    inviteRevision,
    channel,
  }: {
    scheduledItemId: number;
    inviteRevision: string;
    channel: 'email' | 'push';
  },
  { db }: DbConfig,
) {
  await db
    .delete(spaceScheduledItemInvitationDispatches)
    .where(
      and(
        eq(
          spaceScheduledItemInvitationDispatches.scheduledItemId,
          scheduledItemId,
        ),
        eq(
          spaceScheduledItemInvitationDispatches.inviteRevision,
          inviteRevision,
        ),
        eq(spaceScheduledItemInvitationDispatches.channel, channel),
      ),
    );
}
