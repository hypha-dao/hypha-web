import { and, asc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { coherences } from '@hypha-platform/storage-postgres';
import { DatabaseInstance } from '../../server';
import {
  markDeadlineOverdueSent,
  markDeadlineReminderSent,
  shouldSendDeadlineReminder,
  shouldSendOverdueAlert,
  type SignalDeadlineNotifyState,
} from '../signal-notification-triggers';
import { getSignalLifecycleNotifier } from './signal-assigned-notifier';

export type SignalDeadlineAlertResult = {
  reminders: number;
  overdue: number;
  failures: number;
};

export async function processSignalDeadlineAlerts(
  { now = new Date(), limit = 2000 }: { now?: Date; limit?: number } = {},
  { db }: { db: DatabaseInstance },
): Promise<SignalDeadlineAlertResult> {
  const notifier = getSignalLifecycleNotifier();
  if (!notifier) {
    return { reminders: 0, overdue: 0, failures: 0 };
  }

  const pageSize = Math.max(1, Math.min(limit, 5000));
  const maxPages = 200;
  let lastId = 0;
  let reminders = 0;
  let overdue = 0;
  let failures = 0;

  for (let page = 0; page < maxPages; page += 1) {
    if (reminders + overdue + failures >= limit) break;

    const rows = await db
      .select({
        id: coherences.id,
        spaceId: coherences.spaceId,
        slug: coherences.slug,
        title: coherences.title,
        dueAt: coherences.dueAt,
        assigneeIds: coherences.assigneeIds,
        deadlineNotifyState: coherences.deadlineNotifyState,
        archived: coherences.archived,
      })
      .from(coherences)
      .where(
        and(
          eq(coherences.archived, false),
          isNotNull(coherences.dueAt),
          gt(coherences.id, lastId),
          sql`jsonb_array_length(coalesce(${coherences.assigneeIds}, '[]'::jsonb)) > 0`,
          sql`(
            ${coherences.deadlineNotifyState}->>'dueAtIso' is null
            or ${coherences.deadlineNotifyState}->>'reminderSentAt' is null
            or ${coherences.deadlineNotifyState}->>'overdueSentAt' is null
          )`,
        ),
      )
      .orderBy(asc(coherences.id))
      .limit(pageSize);

    if (rows.length === 0) break;
    lastId = rows[rows.length - 1]?.id ?? lastId;

    for (const row of rows) {
      if (reminders + overdue + failures >= limit) break;
      if (row.spaceId == null || !row.slug || !row.dueAt) continue;
      const assignees = (row.assigneeIds ?? []).filter(
        (id) => Number.isInteger(id) && id > 0,
      );
      if (assignees.length === 0) continue;

      const state = (row.deadlineNotifyState ??
        {}) as SignalDeadlineNotifyState;
      const sendReminder = shouldSendDeadlineReminder(row.dueAt, state, now);
      const sendOverdue = shouldSendOverdueAlert(row.dueAt, state, now);
      if (!sendReminder && !sendOverdue) continue;

      const nextState = sendOverdue
        ? markDeadlineOverdueSent(row.dueAt, state, now)
        : markDeadlineReminderSent(row.dueAt, now);

      try {
        await notifier({
          kind: sendOverdue ? 'deadline_overdue' : 'deadline_reminder',
          spaceId: row.spaceId,
          recipientPersonIds: assignees,
          actorPersonId: null,
          signalSlug: row.slug,
          signalTitle: row.title,
          dueAt: row.dueAt,
        });
        await db
          .update(coherences)
          .set({ deadlineNotifyState: nextState, updatedAt: now })
          .where(eq(coherences.id, row.id));
        if (sendOverdue) overdue += 1;
        else reminders += 1;
      } catch (error) {
        failures += 1;
        console.error('[signal-deadline-alerts] notify failed', {
          slug: row.slug,
          error,
        });
      }
    }

    if (rows.length < pageSize) break;
  }

  return { reminders, overdue, failures };
}
