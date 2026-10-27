import { describe, expect, it } from 'vitest';
import {
  isAiAuthoredSignal,
  planAiSignalChatSignature,
} from '../ai-signal-signature';

const BOT = '@hypha_bot:example.org';
const MEMBER = '@alex:example.org';

describe('isAiAuthoredSignal', () => {
  it('recognises the agent tag and the space-memory update', () => {
    expect(isAiAuthoredSignal({ tags: ['Feedback Loop', 'AI Signal'] })).toBe(
      true,
    );
    expect(
      isAiAuthoredSignal({
        title: 'Live Earth Pitch: high-signal discussion summary update',
        description:
          'Recent space-memory activity indicates a coordination opportunity.',
      }),
    ).toBe(true);
    expect(
      isAiAuthoredSignal({
        title: 'Invite a member',
        description: 'We should invite Noor.',
        tags: ['General'],
      }),
    ).toBe(false);
  });
});

describe('planAiSignalChatSignature', () => {
  const description =
    'Recent space-memory activity indicates a coordination opportunity.';

  it('posts as the agent when the thread is empty', () => {
    expect(
      planAiSignalChatSignature({
        description,
        botUserId: BOT,
        events: [],
      }),
    ).toEqual({ send: true, redactEventId: null });
  });

  it('replaces a member seed of the same description and does not post twice', () => {
    expect(
      planAiSignalChatSignature({
        description,
        botUserId: BOT,
        events: [
          {
            eventId: '$seed',
            sender: MEMBER,
            body: description,
            timestamp: 1,
          },
        ],
      }),
    ).toEqual({ send: true, redactEventId: '$seed' });

    expect(
      planAiSignalChatSignature({
        description,
        botUserId: BOT,
        events: [
          {
            eventId: '$seed',
            sender: MEMBER,
            body: description,
            timestamp: 1,
          },
          {
            eventId: '$agent',
            sender: BOT,
            body: description,
            timestamp: 2,
          },
        ],
      }),
    ).toEqual({ send: false, redactEventId: '$seed' });
  });

  it('leaves a thread that already starts with someone else’s words', () => {
    expect(
      planAiSignalChatSignature({
        description,
        botUserId: BOT,
        events: [
          {
            eventId: '$talk',
            sender: MEMBER,
            body: 'Let’s decide an owner.',
            timestamp: 1,
          },
        ],
      }),
    ).toEqual({ send: false, redactEventId: null });
  });

  it('does nothing once the agent has signed an empty-looking thread', () => {
    expect(
      planAiSignalChatSignature({
        description,
        botUserId: BOT,
        events: [
          {
            eventId: '$agent',
            sender: BOT,
            body: description,
            timestamp: 1,
          },
        ],
      }),
    ).toEqual({ send: false, redactEventId: null });
  });
});
