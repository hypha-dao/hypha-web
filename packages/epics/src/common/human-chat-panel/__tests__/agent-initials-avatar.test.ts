import { describe, expect, it } from 'vitest';

import { getAgentAvatarInitials } from '../../ai-agent-competencies';
import { isAgentChatAuthor } from '../agent-initials-avatar';

describe('agent initials face', () => {
  it('builds two letters from the agent name', () => {
    expect(getAgentAvatarInitials('Pulse Objectives')).toBe('PO');
    expect(getAgentAvatarInitials('Aura Mission')).toBe('AM');
    expect(getAgentAvatarInitials('AI Agents')).toBe('AA');
  });

  it('treats a bot reply and a stamped specialist as an agent author', () => {
    expect(
      isAgentChatAuthor({
        matrixUserId: '@hypha_bot_prod:matrix.hypha.earth',
        label: 'Pulse Objectives',
      }),
    ).toBe(true);
    expect(
      isAgentChatAuthor({
        agentSpecialistId: 'senior-strategist',
        matrixUserId: '@someone:example.org',
      }),
    ).toBe(true);
    expect(
      isAgentChatAuthor({
        matrixUserId: '@ada:example.org',
        label: 'Ada Lovelace',
      }),
    ).toBe(false);
  });
});
