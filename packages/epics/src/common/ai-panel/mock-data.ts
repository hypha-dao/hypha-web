// TODO: Replace with i18n translation keys (see ai-chat i18n follow-up)
export const MOCK_SUGGESTIONS = [
  'Tell me about this space',
  'How many members does this space have?',
  'What agreements exist in this space?',
  'Describe the structure of this space',
];

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

export function createMockWelcomeMessage(): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content:
      "Hello! I'm your Hypha AI assistant. I can look up space details like member counts, agreements, and structure. Ask me anything about the space you're viewing.",
    timestamp: new Date(),
  };
}
