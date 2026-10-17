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
    expect(result.requiredTags).toEqual([]);
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
    expect(result.requiredTags).toEqual([TAG_MENTION_CONSENT]);
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

describe('buildChatContent — chat.mention email', () => {
  it('is rendered in code as plain HTML with the mention subject and preheader', () => {
    const result = buildChatContent(makeEvent('chat.mention'), recipient);
    expect(result.content.email).toMatchObject({
      kind: 'plain',
      subject: expect.stringContaining('mentioned you'),
    });
  });
});

describe('buildChatContent — mention event, plain-message recipient', () => {
  it('gives non-mentioned room members the message push only (no mention email)', () => {
    const result = buildChatContent(makeEvent('chat.mention'), {
      ...recipient,
      role: 'chat.message',
    });
    expect(result.channels).toEqual(['push']);
    expect(result.requiredTags).toEqual([]);
    expect(result.content.email).toBeUndefined();
    const push = result.content.push as { contents: { en: string } };
    expect(push.contents.en).toBe('Alice: Hello team, standup in 5');
  });

  it('keeps the mention content for mentioned recipients', () => {
    const result = buildChatContent(makeEvent('chat.mention'), {
      ...recipient,
      role: 'chat.mention',
    });
    expect(result.channels).toEqual(['push', 'email']);
    expect(result.requiredTags).toEqual([TAG_MENTION_CONSENT]);
  });
});

describe('buildChatContent — mention push without a preview', () => {
  it('names the space like the email preheader does', () => {
    const noPreview: Recipient = {
      ...recipient,
      role: 'chat.mention',
      data: { ...recipient.data, messagePreview: '' },
    };
    const push = buildChatContent(makeEvent('chat.mention'), noPreview).content
      .push as { contents: { en: string } };
    expect(push.contents.en).toBe('Alice mentioned you in Hypha Energy.');
  });
});
