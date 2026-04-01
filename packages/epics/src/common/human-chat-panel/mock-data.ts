export type HumanChatMessage = {
  id: string;
  role: 'user' | 'member';
  content: string;
  timestamp: Date;
  senderName?: string;
  isStreaming?: boolean;
};

export function createMockWelcomeMessage(): HumanChatMessage {
  return {
    id: 'welcome',
    role: 'member',
    content:
      'Welcome to the chat! Start a conversation with other members of this space.',
    timestamp: new Date(),
    senderName: 'System',
  };
}
