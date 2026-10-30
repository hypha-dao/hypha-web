export type AgentRoomLine = {
  sender: string;
  body: string;
  mentionsAgent: boolean;
};

export type AgentTurnLimits = {
  /** Earlier lines kept before the mention. */
  earlierLines: number;
  /** Characters kept from each earlier line. */
  earlierChars: number;
  /** Characters kept from the message that mentioned the agent. */
  questionChars: number;
  /** How the agent's own earlier lines are labelled. */
  agentLabel: string;
};

const DEFAULT_LIMITS: AgentTurnLimits = {
  earlierLines: 12,
  earlierChars: 500,
  questionChars: 2000,
  agentLabel: 'Hypha',
};

/**
 * The latest text message is the only one that can invite the agent. A later message that
 * does not mention it, or a reply already posted, leaves the room alone.
 */
export function mentionAwaitingAgent(
  newestFirst: AgentRoomLine[],
  agentUserId: string,
  limits: Partial<AgentTurnLimits> = {},
): { question: string; earlier: string } | null {
  const { earlierLines, earlierChars, questionChars, agentLabel } = {
    ...DEFAULT_LIMITS,
    ...limits,
  };
  const latest = newestFirst[0];
  if (!latest || latest.sender === agentUserId || !latest.mentionsAgent) {
    return null;
  }
  const earlier = newestFirst
    .slice(1)
    .reverse()
    .slice(-earlierLines)
    .map((line) => {
      const speaker = line.sender === agentUserId ? agentLabel : 'member';
      return `${speaker}: ${line.body.slice(0, earlierChars)}`;
    })
    .join('\n');
  return { question: latest.body.slice(0, questionChars), earlier };
}
