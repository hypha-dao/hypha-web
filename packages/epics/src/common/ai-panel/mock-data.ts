import { getLocaleMessagesSync } from '@hypha-platform/i18n/messages';

export const MOCK_SUGGESTION_KEYS = [
  'AiPanel.suggestions.spaceHealth',
  'AiPanel.suggestions.nextSignal',
  'AiPanel.suggestions.blindSpot',
  'AiPanel.suggestions.summarizeDiscussion',
  'AiPanel.suggestions.spaceMemory',
  'AiPanel.suggestions.valueFlows',
] as const;

const SUGGESTION_FIELD_NAMES = [
  'spaceHealth',
  'nextSignal',
  'blindSpot',
  'summarizeDiscussion',
  'spaceMemory',
  'valueFlows',
] as const;

type AiPanelMessages = {
  welcome?: string;
  suggestions?: Partial<
    Record<(typeof SUGGESTION_FIELD_NAMES)[number], string>
  >;
};

function getAiPanelMessages(locale?: string): AiPanelMessages {
  const { messages } = getLocaleMessagesSync(locale);
  return (messages.AiPanel ?? {}) as AiPanelMessages;
}

/** English defaults for tests and Storybook when translations are not wired. */
export function getMockSuggestions(locale?: string): string[] {
  const localizedSuggestions = getAiPanelMessages(locale).suggestions ?? {};
  const fallbackSuggestions = getAiPanelMessages('en').suggestions ?? {};

  return SUGGESTION_FIELD_NAMES.map(
    (key) => localizedSuggestions[key] ?? fallbackSuggestions[key] ?? '',
  ).filter(Boolean);
}

export const MOCK_SUGGESTIONS = getMockSuggestions();

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

export function createMockWelcomeMessage(
  spaceName = 'Hypha',
  locale?: string,
): Message {
  const welcomeTemplate =
    getAiPanelMessages(locale).welcome ??
    getAiPanelMessages('en').welcome ??
    '';

  return {
    id: 'welcome',
    role: 'assistant',
    content: welcomeTemplate.replace('{spaceName}', spaceName),
    timestamp: new Date(),
  };
}
