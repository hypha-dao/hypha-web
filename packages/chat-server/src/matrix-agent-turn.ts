export type AgentRoomLine = {
  sender: string;
  body: string;
  mentionsAgent: boolean;
};

/**
 * The latest text message is the only one that can invite the agent. A later message that
 * does not mention it, or a reply already posted, leaves the room alone.
 */
export function mentionAwaitingAgent(
  newestFirst: AgentRoomLine[],
  agentUserId: string,
): { question: string; earlier: string } | null {
  const latest = newestFirst[0];
  if (!latest || latest.sender === agentUserId || !latest.mentionsAgent) {
    return null;
  }
  const earlier = newestFirst
    .slice(1)
    .reverse()
    .slice(-12)
    .map((line) => {
      const speaker = line.sender === agentUserId ? 'Hypha' : 'member';
      return `${speaker}: ${line.body.slice(0, 500)}`;
    })
    .join('\n');
  return { question: latest.body.slice(0, 2000), earlier };
}
