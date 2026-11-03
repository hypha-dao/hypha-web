import { describe, expect, it } from 'vitest';

import {
  directConversationEmptyWelcomeKey,
  directConversationWelcomeName,
} from '../direct-conversation-welcome';

describe('directConversationWelcomeName', () => {
  it('uses the first name of the person on the chat', () => {
    expect(
      directConversationWelcomeName({
        mode: 'coherence',
        coherenceSlug: null,
        coherenceTitle: 'Kate Bennett',
      }),
    ).toBe('Kate');
  });

  it('uses a first name for each person in a group chat', () => {
    expect(
      directConversationWelcomeName({
        mode: 'coherence',
        coherenceSlug: null,
        coherenceTitle: 'Kate Bennett, Vlad Hramtsov',
      }),
    ).toBe('Kate, Vlad');
  });

  it('leaves a space room to its own welcome', () => {
    expect(
      directConversationWelcomeName({
        mode: 'space',
        coherenceSlug: null,
        coherenceTitle: 'António Cascalheira',
      }),
    ).toBeNull();
  });

  it('leaves a signal room to its own welcome', () => {
    expect(
      directConversationWelcomeName({
        mode: 'coherence',
        coherenceSlug: 'local-scale',
        coherenceTitle: 'Vlad Hramtsov',
      }),
    ).toBeNull();
  });
});

describe('directConversationEmptyWelcomeKey', () => {
  it('keeps Start-a-conversation copy only on a room-less direct shell', () => {
    expect(
      directConversationEmptyWelcomeKey({
        isDirectConversation: true,
        isStartConversation: true,
      }),
    ).toBe('welcomeWith');
  });

  it('uses the empty-DM copy after a real direct room is bound', () => {
    expect(
      directConversationEmptyWelcomeKey({
        isDirectConversation: true,
        isStartConversation: false,
      }),
    ).toBe('emptyDirectChat');
  });

  it('keeps welcomeWith for a space chat with a welcome partner', () => {
    expect(
      directConversationEmptyWelcomeKey({
        isDirectConversation: false,
        isStartConversation: false,
      }),
    ).toBe('welcomeWith');
  });
});
