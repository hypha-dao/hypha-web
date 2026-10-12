import { describe, expect, it } from 'vitest';
import {
  assigneeAcknowledgementMap,
  dueAtHasChanged,
  hasAssigneeAcknowledged,
  markDeadlineOverdueSent,
  markDeadlineReminderSent,
  newlyAssignedPersonIds,
  resetDeadlineNotifyState,
  shouldSendDeadlineReminder,
  shouldSendOverdueAlert,
} from '../signal-notification-triggers';

describe('newlyAssignedPersonIds', () => {
  it('returns only people added to the assignee list', () => {
    expect(newlyAssignedPersonIds([1, 2], [2, 3, 3])).toEqual([3]);
  });
});

describe('dueAtHasChanged', () => {
  it('treats equivalent instants as unchanged', () => {
    const date = new Date('2026-10-09T12:00:00.000Z');
    expect(dueAtHasChanged(date, date.toISOString())).toBe(false);
    expect(dueAtHasChanged(date, new Date('2026-10-10T12:00:00.000Z'))).toBe(
      true,
    );
    expect(dueAtHasChanged(null, date)).toBe(true);
  });
});

describe('deadline reminder / overdue triggers', () => {
  const due = new Date('2026-10-09T12:00:00');

  it('reminds within 24h of the end of the due day and only once per due date', () => {
    const morningOf = new Date('2026-10-09T08:00:00');
    expect(shouldSendDeadlineReminder(due, {}, morningOf)).toBe(true);
    expect(
      shouldSendDeadlineReminder(
        due,
        markDeadlineReminderSent(due, morningOf),
        morningOf,
      ),
    ).toBe(false);
    expect(
      shouldSendDeadlineReminder(due, {}, new Date('2026-10-07T08:00:00')),
    ).toBe(false);
  });

  it('sends overdue once the due day has ended, and only once per due date', () => {
    const afterDue = new Date('2026-10-10T00:00:01');
    expect(shouldSendOverdueAlert(due, {}, afterDue)).toBe(true);
    expect(
      shouldSendOverdueAlert(
        due,
        markDeadlineOverdueSent(due, {}, afterDue),
        afterDue,
      ),
    ).toBe(false);
    expect(
      shouldSendOverdueAlert(due, {}, new Date('2026-10-09T18:00:00')),
    ).toBe(false);
  });

  it('resets reminder/overdue flags when the due date moves', () => {
    const previous = markDeadlineReminderSent(due);
    const moved = resetDeadlineNotifyState(
      new Date('2026-10-16T12:00:00'),
      previous,
    );
    expect(moved.reminderSentAt).toBeNull();
    expect(moved.dueAtIso).not.toBe(previous.dueAtIso);
  });
});

describe('assignee acknowledgement', () => {
  it('keeps acknowledgements only for people who remain assigned', () => {
    expect(
      assigneeAcknowledgementMap([2], {
        '1': '2026-10-01T00:00:00.000Z',
        '2': 'x',
      }),
    ).toEqual({ '2': 'x' });
  });

  it('is seen only when every current assignee has acknowledged', () => {
    expect(hasAssigneeAcknowledged([1, 2], { '1': 'x' })).toBe(false);
    expect(hasAssigneeAcknowledged([1, 2], { '1': 'x', '2': 'y' })).toBe(true);
    expect(hasAssigneeAcknowledged([], {})).toBe(false);
  });
});
