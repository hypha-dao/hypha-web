import type {
  ChatMentionAgentIcon,
  ChatMentionCandidate,
} from './human-chat-panel-chat-bar';
import { isHyphaBotMatrixIdentity } from './matrix-room-member-display';

export type MatrixAgentSkill = {
  id: string;
  prompt: string;
};

/** The Matrix user people @ when they want AI Agents in the room. */
export function matrixAgentUserId(): string | null {
  const id = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim();
  return id || null;
}

/** One question per skill, under the AI Agents name. */
export function matrixAgentSkills(
  text: (key: string) => string,
): MatrixAgentSkill[] {
  return [
    { id: 'tension', prompt: text('agentSkillTension') },
    { id: 'opportunity', prompt: text('agentSkillOpportunity') },
    { id: 'need', prompt: text('agentSkillNeed') },
    { id: 'resources', prompt: text('agentSkillResources') },
  ];
}

/** Keep one AI Agents row at the top of the @ picker. Skills are chosen after it. */
export function withMatrixAgentMention(
  candidates: ChatMentionCandidate[],
  label: string,
  skills: readonly MatrixAgentSkill[] = [],
  icon?: ChatMentionAgentIcon,
): ChatMentionCandidate[] {
  const rest = candidates.filter(
    (candidate) =>
      !isHyphaBotMatrixIdentity(candidate.userId, candidate.displayLabel),
  );
  const agentUserId = matrixAgentUserId();
  if (!agentUserId) return rest;
  const prompts = skills
    .map((skill) => ({ id: skill.id, prompt: skill.prompt.trim() }))
    .filter((skill) => skill.prompt);
  const agentRow: ChatMentionCandidate = {
    userId: agentUserId,
    displayLabel: label,
    rowKey: 'agent',
    skills: prompts,
    ...(icon ? { agentIcon: icon } : {}),
  };
  return [agentRow, ...rest];
}

type MatrixInviteClient = {
  getRoom?: (roomId: string) =>
    | {
        getMember?: (
          userId: string,
        ) => { membership?: string } | null | undefined;
      }
    | null
    | undefined;
  invite: (roomId: string, userId: string) => Promise<unknown>;
};

/**
 * Invite AI Agents into an invite-only room before the server tries to read/reply.
 * No-op when the agent is already invited or joined, or when the sender cannot invite.
 */
export async function inviteMatrixAgentIfNeeded(
  client: MatrixInviteClient | null | undefined,
  roomId: string,
  mentionUserIds: string[],
): Promise<void> {
  const agentUserId = matrixAgentUserId();
  const trimmedRoom = roomId.trim();
  if (!client || !agentUserId || !trimmedRoom) return;
  if (!mentionUserIds.includes(agentUserId)) return;
  try {
    const membership = client
      .getRoom?.(trimmedRoom)
      ?.getMember?.(agentUserId)?.membership;
    if (membership === 'join' || membership === 'invite') return;
    await client.invite(trimmedRoom, agentUserId);
  } catch {
    // Already a member, or this room does not allow invites from the sender.
  }
}

/**
 * Where the mention happened. The agent reads this so it answers against the
 * right surface — proposal, signal, space, ecosystem, network, or a DM.
 */
export type MatrixAgentRoomContext = {
  kind:
    | 'proposal'
    | 'signal'
    | 'space'
    | 'ecosystem'
    | 'public'
    | 'network'
    | 'dm';
  spaceSlug?: string | null;
  documentSlug?: string | null;
  documentTitle?: string | null;
  signalSlug?: string | null;
  signalTitle?: string | null;
};

/** Ask the server to answer if the latest room message @mentions AI Agents. */
export function requestMatrixAgentReply({
  authToken,
  roomId,
  mentionUserIds,
  spaceSlug,
  context,
}: {
  authToken: string | null | undefined;
  roomId: string;
  mentionUserIds: string[];
  /** @deprecated Prefer `context.spaceSlug` — kept for older call sites. */
  spaceSlug?: string | null;
  context?: MatrixAgentRoomContext | null;
}) {
  const agentUserId = matrixAgentUserId();
  const token = authToken?.trim();
  if (!agentUserId || !token || !mentionUserIds.includes(agentUserId)) return;
  const resolvedSlug = context?.spaceSlug?.trim() || spaceSlug?.trim() || null;
  void fetch('/api/matrix/agent-reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomId,
      spaceSlug: resolvedSlug,
      context: context
        ? {
            kind: context.kind,
            spaceSlug: resolvedSlug,
            documentSlug: context.documentSlug?.trim() || null,
            documentTitle: context.documentTitle?.trim() || null,
            signalSlug: context.signalSlug?.trim() || null,
            signalTitle: context.signalTitle?.trim() || null,
          }
        : null,
    }),
  }).catch(() => {
    // The room stays as the people left it when the reply cannot be posted.
  });
}
