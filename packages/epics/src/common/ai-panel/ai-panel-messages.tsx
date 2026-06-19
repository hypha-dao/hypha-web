'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { resolveMobilizedAgentsForAssistantMessage } from '../ai-agent-competencies';
import type { OnboardingConversationContext } from '../ai-onboarding-context';
import { shouldShowOnboardingLocationPicker } from '../onboarding-location-ui';
import { AiPanelMessageBubble } from './ai-panel-message-bubble';
import { OnboardingSpaceLocationCard } from './onboarding-space-location-card';
import {
  AiPanelSuggestions,
  type AiPanelSuggestionItem,
} from './ai-panel-suggestions';
import type { SpaceLocationValue } from '../../spaces/components/space-location-picker';

type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

type AiPanelMessagesProps = {
  messages: UIMessage[];
  suggestionItems: readonly AiPanelSuggestionItem[];
  /** Large suggestion cards below welcome — only before the user sends a message. */
  showInlineSuggestions?: boolean;
  onSuggestionSelect?: (text: string) => void;
  activeSpaceName?: string;
  isStreaming?: boolean;
  onActionReplySelect?: (text: string) => void;
  onboardingContext?: OnboardingConversationContext;
  enableNetworkMap?: boolean;
  onOnboardingLocationConfirm?: (value: SpaceLocationValue) => void;
  onOnboardingLocationSkip?: () => void;
};

export function AiPanelMessages({
  messages,
  suggestionItems,
  showInlineSuggestions = false,
  onSuggestionSelect,
  isStreaming = false,
  onActionReplySelect,
  onboardingContext,
  enableNetworkMap = false,
  onOnboardingLocationConfirm,
  onOnboardingLocationSkip,
}: AiPanelMessagesProps) {
  const t = useTranslations('AiPanel');
  const containerRef = useRef<HTMLDivElement>(null);

  const showLocationPicker = shouldShowOnboardingLocationPicker({
    messages,
    onboardingContext,
    isStreaming,
    enableNetworkMap,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  const displayMessages =
    messages.length > 0
      ? messages
      : [
          {
            id: 'welcome',
            role: 'assistant' as const,
            parts: [
              {
                type: 'text' as const,
                text: t('welcome'),
              },
            ],
          },
        ];

  return (
    <div
      ref={containerRef}
      className="narrow-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3"
    >
      <div className="flex flex-col gap-4">
        {displayMessages.map((msg, index) => (
          <AiPanelMessageBubble
            key={msg.id}
            message={msg}
            mobilizedAgents={
              msg.role === 'assistant' && msg.id !== 'welcome'
                ? resolveMobilizedAgentsForAssistantMessage(
                    displayMessages,
                    index,
                  )
                : []
            }
            onActionReplySelect={onActionReplySelect}
            isStreaming={
              msg.role === 'assistant' &&
              isStreaming &&
              index === displayMessages.length - 1
            }
          />
        ))}

        {showLocationPicker &&
        onOnboardingLocationConfirm &&
        onOnboardingLocationSkip ? (
          <OnboardingSpaceLocationCard
            disabled={isStreaming}
            onConfirm={onOnboardingLocationConfirm}
            onSkip={onOnboardingLocationSkip}
          />
        ) : null}

        {showInlineSuggestions && onSuggestionSelect ? (
          <div className="flex flex-col gap-2">
            <AiPanelSuggestions
              items={suggestionItems}
              onSelect={onSuggestionSelect}
              variant="cards"
            />
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              {t('welcomeSpecialistsHint')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
