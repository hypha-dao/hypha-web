import { describe, expect, it } from 'vitest';

import { buildScheduledItemReminderContent } from '../content';
import type {
  Recipient,
  ScheduledItemReminderEvent,
} from '../../../core/types';
import { TAG_MEETING_CONSENT } from '../../../constants/tags';

const event = (
  itemType: string,
  channels: Array<'email' | 'push'> = ['email', 'push'],
): ScheduledItemReminderEvent => ({
  type: 'scheduled_item.reminder',
  source: { kind: 'domain', entityType: 'scheduled_item', entityId: '1:x' },
  context: { memberSlugs: ['bob'], itemType },
  payload: {
    title: 'Standup',
    spaceTitle: 'Acme',
    whenLabel: 'Oct 16, 2026, 10:00 AM',
    url: 'https://meet.test/room',
    settingsUrl: 'https://app.hypha.earth/en/network/notification-centre',
    channels,
  },
});

const recipient: Recipient = { personSlug: 'bob', role: 'member' };

describe('buildScheduledItemReminderContent', () => {
  it('gates calls and meetings on consent_meetings', () => {
    expect(
      buildScheduledItemReminderContent(event('call'), recipient).requiredTags,
    ).toEqual([TAG_MEETING_CONSENT]);
    expect(
      buildScheduledItemReminderContent(event('meeting'), recipient)
        .requiredTags,
    ).toEqual([TAG_MEETING_CONSENT]);
  });

  it('does not add a consent tag for other item types', () => {
    expect(
      buildScheduledItemReminderContent(event('event'), recipient).requiredTags,
    ).toEqual([]);
  });

  it('only builds content for the claimed channels', () => {
    const emailOnly = buildScheduledItemReminderContent(
      event('call', ['email']),
      recipient,
    );
    expect(emailOnly.channels).toEqual(['email']);
    expect(emailOnly.content.push).toBeUndefined();
    expect(emailOnly.content.email).toBeDefined();

    const pushOnly = buildScheduledItemReminderContent(
      event('call', ['push']),
      recipient,
    );
    expect(pushOnly.content.email).toBeUndefined();
    expect(pushOnly.content.push).toMatchObject({
      kind: 'plain',
      headings: { en: 'Standup starts soon' },
      contents: { en: 'Standup starts at Oct 16, 2026, 10:00 AM' },
      url: 'https://meet.test/room',
    });
  });

  it('renders the email on the shared layout', () => {
    const { content } = buildScheduledItemReminderContent(
      event('call'),
      recipient,
    );
    const email = content.email as { subject: string; body: string };
    expect(email.subject).toBe('Standup starts soon');
    expect(email.body).toContain(
      '<strong>Standup</strong> in <strong>Acme</strong>',
    );
    expect(email.body).toContain('>Join now<');
    expect(email.body).toContain('Manage notification settings');
  });
});
