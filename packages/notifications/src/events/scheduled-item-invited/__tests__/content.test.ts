import { describe, expect, it } from 'vitest';

import { buildScheduledItemInvitedContent } from '../content';
import type { ScheduledItemInvitedEvent } from '../../../core/types';
import { TAG_MEETING_CONSENT } from '../../../constants/tags';

function makeEvent(
  overrides: Partial<ScheduledItemInvitedEvent['payload']> = {},
): ScheduledItemInvitedEvent {
  return {
    type: 'scheduled_item.invited',
    source: { kind: 'domain', entityType: 'scheduled_item', entityId: '1' },
    context: {
      item: {
        id: 1,
        spaceId: 1,
        creatorId: 1,
        title: 'Weekly sync',
        description: null,
        type: 'meeting',
        startsAt: new Date('2026-10-01T15:00:00Z'),
        endsAt: new Date('2026-10-01T15:30:00Z'),
        allDay: false,
        timezone: 'UTC',
        location: null,
        meetingUrl: null,
        color: null,
        recurrenceRule: null,
        recurrenceUntil: null,
        matrixRoomId: null,
        matrixAutoLink: false,
        reminderMinutesBefore: null,
        coherenceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as ScheduledItemInvitedEvent['context']['item'],
    },
    payload: {
      title: 'Weekly sync',
      description: null,
      spaceTitle: 'Hypha Energy',
      startsAt: new Date('2026-10-01T15:00:00Z'),
      endsAt: new Date('2026-10-01T15:30:00Z'),
      timezone: 'UTC',
      joinUrl: 'https://app.hypha.earth/en/dho/hypha-energy/calendar?item=1',
      channels: ['email', 'push'],
      lang: 'en',
      ...overrides,
    },
  };
}

describe('buildScheduledItemInvitedContent', () => {
  it('gates on the meeting-consent tag', () => {
    const result = buildScheduledItemInvitedContent(makeEvent(), {
      personSlug: 'alice',
    });
    expect(result.requiredTags).toEqual({ [TAG_MEETING_CONSENT]: 'true' });
  });

  it('only builds the channels the caller pre-claimed', () => {
    const emailOnly = buildScheduledItemInvitedContent(
      makeEvent({ channels: ['email'] }),
      { personSlug: 'alice' },
    );
    expect(emailOnly.channels).toEqual(['email']);
    expect(emailOnly.content.push).toBeUndefined();
    expect(emailOnly.content.email).toBeDefined();
  });

  it('includes the title, space, and join link in the email body', () => {
    const result = buildScheduledItemInvitedContent(makeEvent(), {
      personSlug: 'alice',
    });
    const { body } = result.content.email as { body: string };
    expect(body).toContain('Weekly sync');
    expect(body).toContain('Hypha Energy');
    expect(body).toContain('app.hypha.earth');
  });

  it('sanitizes a non-http join URL to a safe fallback', () => {
    const result = buildScheduledItemInvitedContent(
      makeEvent({ joinUrl: 'javascript:alert(1)' }),
      { personSlug: 'alice' },
    );
    expect((result.content.email as { body: string }).body).toContain(
      'href="#"',
    );
    expect((result.content.push as { url?: string }).url).toBeUndefined();
  });
});
