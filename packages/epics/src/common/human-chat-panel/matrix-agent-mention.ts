import type { ChatMentionCandidate } from './human-chat-panel-chat-bar';

/** The Matrix user people @ when they want Hypha in the room. */
export function matrixAgentUserId(): string | null {
  const id = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim();
  return id || null;
}

/** Keep Hypha in the @ picker under one name, in every room. */
export function withMatrixAgentMention(
  candidates: ChatMentionCandidate[],
  label: string,
): ChatMentionCandidate[] {
  const agentUserId = matrixAgentUserId();
  if (!agentUserId) return candidates;
  const rest = candidates.filter(
    (candidate) => candidate.userId !== agentUserId,
  );
  return [...rest, { userId: agentUserId, displayLabel: label }];
}

/** Ask the server to answer if the latest room message @mentions Hypha. */
export function requestMatrixAgentReply({
  authToken,
  roomId,
  mentionUserIds,
  spaceSlug,
}: {
  authToken: string | null | undefined;
  roomId: string;
  mentionUserIds: string[];
  spaceSlug?: string | null;
}) {
  const agentUserId = matrixAgentUserId();
  const token = authToken?.trim();
  if (!agentUserId || !token || !mentionUserIds.includes(agentUserId)) return;
  void fetch('/api/matrix/agent-reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomId,
      spaceSlug: spaceSlug?.trim() || null,
    }),
  }).catch(() => {
    // The room stays as the people left it when the reply cannot be posted.
  });
}
