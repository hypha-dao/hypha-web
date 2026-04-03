export type HumanChatMessage = {
  id: string;
  role: 'user' | 'member';
  content: string;
  timestamp: Date;
  senderName?: string;
  isStreaming?: boolean;
};

export function createMockWelcomeMessage(content: string): HumanChatMessage {
  return {
    id: 'welcome',
    role: 'member',
    content,
    timestamp: new Date(),
    senderName: 'System',
  };
}
