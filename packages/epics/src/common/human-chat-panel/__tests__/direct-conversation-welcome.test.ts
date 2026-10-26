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
  it('keeps Start-a-conversation copy only on a room-less shell', () => {
    expect(
      directConversationEmptyWelcomeKey({ isStartConversation: true }),
    ).toBe('welcomeWith');
  });

  it('uses the empty-DM copy after a real room is bound', () => {
    expect(
      directConversationEmptyWelcomeKey({ isStartConversation: false }),
    ).toBe('emptyDirectChat');
  });
});
