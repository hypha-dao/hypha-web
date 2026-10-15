import type {
  ChatMentionAgentIcon,
  ChatMentionCandidate,
} from './human-chat-panel-chat-bar';

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

/** Keep AI Agents at the top of the @ picker, one row per skill. */
export function withMatrixAgentMention(
  candidates: ChatMentionCandidate[],
  label: string,
  skills: readonly MatrixAgentSkill[] = [],
  icon?: ChatMentionAgentIcon,
): ChatMentionCandidate[] {
  const agentUserId = matrixAgentUserId();
  if (!agentUserId) return candidates;
  const rest = candidates.filter(
    (candidate) => candidate.userId !== agentUserId,
  );
  const prompts = skills.filter((skill) => skill.prompt.trim());
  const agentRows: ChatMentionCandidate[] = (
    prompts.length > 0 ? prompts : [{ id: 'agent', prompt: '' }]
  ).map((skill) => ({
    userId: agentUserId,
    displayLabel: label,
    rowKey: `agent-${skill.id}`,
    prompt: skill.prompt.trim() || undefined,
    ...(icon ? { agentIcon: icon } : {}),
  }));
  return [...agentRows, ...rest];
}

/** Ask the server to answer if the latest room message @mentions AI Agents. */
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
