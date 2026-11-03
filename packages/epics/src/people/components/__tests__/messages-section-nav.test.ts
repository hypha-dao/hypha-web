import { describe, expect, it } from 'vitest';

import {
  buildMessagesSectionNavItems,
  isMessagesSectionNavActive,
} from '../messages-section-nav';

describe('messages section nav', () => {
  it('includes Archived next to Messages and Suggestions', () => {
    const items = buildMessagesSectionNavItems('/en/messages');
    expect(items.map((item) => [item.key, item.href])).toEqual([
      ['messages', '/en/messages'],
      ['suggestions', '/en/messages/suggestions'],
      ['archived', '/en/messages/archived'],
    ]);
  });

  it('does not treat /archived as the Messages tab', () => {
    const items = buildMessagesSectionNavItems('/en/messages');
    const messages = items.find((item) => item.key === 'messages');
    const archived = items.find((item) => item.key === 'archived');
    expect(
      messages && isMessagesSectionNavActive(messages, '/en/messages'),
    ).toBe(true);
    expect(
      messages && isMessagesSectionNavActive(messages, '/en/messages/archived'),
    ).toBe(false);
    expect(
      archived && isMessagesSectionNavActive(archived, '/en/messages/archived'),
    ).toBe(true);
  });
});
