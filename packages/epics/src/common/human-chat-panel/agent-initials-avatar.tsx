'use client';

import {
  QUEST_HELPER_AUTHOR_ID,
  QUEST_HELPER_NAME,
} from '@hypha-platform/core/client';
import {
  getAgentAvatarInitials,
  tagGroupAccentClass,
} from '../ai-agent-competencies';
import { isHyphaBotMatrixIdentity } from './matrix-room-member-display';

/**
 * Quest Helper wins over the org-bot label. An unmarked bot message stays
 * AI Agents, including acceptance notices posted before the helper stamp.
 */
export function visibleAgentSenderName(input: {
  agentSpecialistId?: string | null;
  senderMatrixId?: string | null;
  senderName?: string | null;
  agentMentionLabel: string;
}): string | null {
  if (input.agentSpecialistId === QUEST_HELPER_AUTHOR_ID) {
    return QUEST_HELPER_NAME;
  }
  if (isHyphaBotMatrixIdentity(input.senderMatrixId, input.senderName)) {
    return input.agentMentionLabel;
  }
  return null;
}

/** A Matrix bot reply, or a message stamped with the specialist who answered. */
export function isAgentChatAuthor(input: {
  agentSpecialistId?: string | null;
  matrixUserId?: string | null;
  label?: string | null;
}): boolean {
  if (input.agentSpecialistId?.trim()) return true;
  return isHyphaBotMatrixIdentity(input.matrixUserId, input.label);
}

/**
 * Square initials tile for an agent author. People stay on the circular photo.
 */
export function AgentInitialsAvatar({
  name,
  size = 'chat',
}: {
  name: string;
  size?: 'chat' | 'sm';
}) {
  const box = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-10 w-10 text-xs';
  return (
    <div
      data-testid="agent-initials-avatar"
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-none font-semibold ${box} ${tagGroupAccentClass(
        name,
      )}`}
    >
      {getAgentAvatarInitials(name)}
    </div>
  );
}
