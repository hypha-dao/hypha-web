import { describe, expect, it } from 'vitest';

import { buildChatContent } from '../content';
import type { ChatNotificationEvent, Recipient } from '../../../core/types';
import { TAG_MENTION_CONSENT } from '../../../constants';

function makeEvent(
  type: ChatNotificationEvent['type'],
  overrides: Partial<ChatNotificationEvent['payload']> = {},
): ChatNotificationEvent {
  return {
    type,
    source: { kind: 'matrix', externalEventId: '$abc123' },
    roomId: '!room:hs',
    actor: { externalUserId: '@alice:hs' },
    context: { kind: 'space', spaceId: 1, spaceSlug: 'hypha-energy' },
    payload: {
      body: 'Hello team, standup in 5',
      mentionedMatrixUserIds: [],
      occurredAt: Date.now(),
      ...overrides,
    },
  };
}

const recipient: Recipient = {
  personSlug: 'bob',
  data: {
    actorDisplayName: 'Alice',
    messagePreview: 'Hello team, standup in 5',
    url: 'https://app.hypha.earth/en/dho/hypha-energy?msg=%24abc123',
    spaceTitle: 'Hypha Energy',
  },
};

describe('buildChatContent — chat.message (all-messages)', () => {
  it('requests push only — no email, no digest needed (D15)', () => {
    const result = buildChatContent(makeEvent('chat.message'), recipient);
    expect(result.channels).toEqual(['push']);
    expect(result.content.email).toBeUndefined();
    expect(result.content.push).toMatchObject({ kind: 'plain' });
  });

  it('gates on base tags only — no extra requiredTag', () => {
    const result = buildChatContent(makeEvent('chat.message'), recipient);
    expect(result.requiredTags).toEqual({});
  });

  it('push body names the actor and previews the message', () => {
    const result = buildChatContent(makeEvent('chat.message'), recipient);
    const push = result.content.push as { contents: { en: string } };
    expect(push.contents.en).toBe('Alice: Hello team, standup in 5');
  });
});

describe('buildChatContent — chat.mention', () => {
  it('requests push and email, gated on consent_mentions', () => {
    const result = buildChatContent(makeEvent('chat.mention'), recipient);
    expect(result.channels).toEqual(['push', 'email']);
    expect(result.requiredTags).toEqual({ [TAG_MENTION_CONSENT]: 'true' });
    expect(result.content.push).toBeDefined();
    expect(result.content.email).toBeDefined();
  });

  it('both channels lead with "mentioned you"', () => {
    const result = buildChatContent(makeEvent('chat.mention'), recipient);
    const push = result.content.push as { headings: { en: string } };
    const email = result.content.email as { subject: string; body: string };
    expect(push.headings.en).toContain('mentioned you');
    expect(email.subject).toContain('mentioned you');
    expect(email.body).toContain('Alice');
  });
});
