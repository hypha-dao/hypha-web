import { describe, expect, it } from 'vitest';

import { QUEST_HELPER_AUTHOR_ID } from '@hypha-platform/core/client';
import { getAgentAvatarInitials } from '../../ai-agent-competencies';
import {
  isAgentChatAuthor,
  visibleAgentSenderName,
} from '../agent-initials-avatar';

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

  it('shows a stamped acceptance notice as the Quest Helper and leaves an unmarked bot message as AI Agents', () => {
    expect(
      visibleAgentSenderName({
        agentSpecialistId: QUEST_HELPER_AUTHOR_ID,
        senderMatrixId: '@hypha_bot_prod:matrix.hypha.earth',
        senderName: 'AI Agents',
        agentMentionLabel: 'AI Agents',
      }),
    ).toBe('Quest Helper');
    expect(
      visibleAgentSenderName({
        senderMatrixId: '@hypha_bot_prod:matrix.hypha.earth',
        senderName: 'AI Agents',
        agentMentionLabel: 'AI Agents',
      }),
    ).toBe('AI Agents');
  });
});
