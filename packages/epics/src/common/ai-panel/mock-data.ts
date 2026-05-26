export const MOCK_SUGGESTION_KEYS = [
  'AiPanel.suggestions.spaceHealth',
  'AiPanel.suggestions.nextSignal',
  'AiPanel.suggestions.blindSpot',
  'AiPanel.suggestions.summarizeDiscussion',
  'AiPanel.suggestions.spaceMemory',
  'AiPanel.suggestions.valueFlows',
] as const;

// Fallback values used when translations are not yet loaded
export const MOCK_SUGGESTIONS = [
  'How is our space doing overall?',
  'What signal should we create or share next?',
  "What's our biggest blind spot?",
  'Summarize recent team discussion',
  'What does our space remember?',
  'How does value flow through our tokens?',
];

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

export function createMockWelcomeMessage(spaceName = 'Hypha'): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `I'm your ${spaceName} AI. I help your space and the broader ecosystem think with you—purpose, direction, operations, coherence signals, org memory, impact, and value flows—with specialist AI agents when you ask.`,
    timestamp: new Date(),
  };
}
