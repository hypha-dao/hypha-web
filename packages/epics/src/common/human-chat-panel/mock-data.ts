export type HumanChatMessage = {
  id: string;
  role: 'user' | 'member';
  parts?: { type: 'text'; text: string }[];
  timestamp?: Date;
  senderName?: string;
  isStreaming?: boolean;
};

export function createMockWelcomeMessage(
  content: string,
  senderName = 'System',
): HumanChatMessage {
  return {
    id: 'welcome',
    role: 'member',
    parts: [{ type: 'text', text: content }],
    timestamp: new Date(),
    senderName,
  };
}
