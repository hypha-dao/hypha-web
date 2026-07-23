'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import {
  ONBOARDING_MOBILIZED_SCOPE,
  readMobilizedAiAgents,
  resolveMobilizedAgentsForAssistantMessage,
} from '../ai-agent-competencies';
import type { OnboardingConversationContext } from '../ai-onboarding-context';
import { shouldShowOnboardingLocationPicker } from '../onboarding-location-ui';
import { shouldShowOnboardingSetupJourneyPicker } from '../onboarding-setup-journey-ui';
import { shouldShowOnboardingActivationPicker } from '../onboarding-activation-ui';
import {
  shouldShowOnboardingTransparencyPicker,
  resolveOnboardingTransparencyPickerStep,
} from '../onboarding-transparency-ui';
import { shouldShowOnboardingEntryMethodPicker } from '../onboarding-entry-method-ui';
import { shouldShowOnboardingVotingMethodPicker } from '../onboarding-voting-method-ui';
import { isPostCreateOnboardingPhase } from '../ai-onboarding-context';
import { isOnboardingWalletSessionActive } from '../onboarding-wallet-handoff';
import { AiPanelMessageBubble } from './ai-panel-message-bubble';
import { OnboardingSpaceLocationCard } from './onboarding-space-location-card';
import { OnboardingSetupJourneyCard } from './onboarding-setup-journey-card';
import { OnboardingActivationModeCard } from './onboarding-activation-mode-card';
import { OnboardingTransparencyMatrixCard } from './onboarding-transparency-matrix-card';
import { OnboardingEntryMethodCard } from './onboarding-entry-method-card';
import { OnboardingVotingMethodCard } from './onboarding-voting-method-card';
import {
  AiPanelSuggestions,
  type AiPanelSuggestionItem,
} from './ai-panel-suggestions';
import type { OnboardingActivationMethod } from '../onboarding-activation-ui';
import type { OnboardingSetupJourney } from '../onboarding-setup-journey-ui';
import type { OnboardingTransparencyMatrix } from '../ai-onboarding-context';
import type { OnboardingEntryMethod } from '../onboarding-entry-method-ui';
import type { OnboardingVotingMethod } from '../onboarding-voting-method-ui';
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
  /** Signed-in profile photo for user bubbles. */
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
  /** Active space logo for assistant bubbles. */
  assistantAvatarUrl?: string | null;
  isStreaming?: boolean;
  onActionReplySelect?: (text: string) => void;
  onboardingContext?: OnboardingConversationContext;
  onOnboardingLocationConfirm?: (value: SpaceLocationValue) => void;
  onOnboardingLocationSkip?: () => void;
  onOnboardingSetupJourneySelect?: (
    journey: OnboardingSetupJourney,
    submitLabel: string,
  ) => void;
  onOnboardingActivationSelect?: (method: OnboardingActivationMethod) => void;
  onOnboardingTransparencyConfirm?: (
    matrix: OnboardingTransparencyMatrix,
  ) => void;
  onOnboardingDiscoverabilityConfirm?: (
    level: OnboardingTransparencyMatrix['discoverability'],
  ) => void;
  onOnboardingEntryMethodConfirm?: (method: OnboardingEntryMethod) => void;
  onOnboardingVotingMethodSelect?: (method: OnboardingVotingMethod) => void;
};

export function AiPanelMessages({
  messages,
  suggestionItems,
  showInlineSuggestions = false,
  onSuggestionSelect,
  userAvatarUrl,
  userDisplayName,
  assistantAvatarUrl,
  isStreaming = false,
  onActionReplySelect,
  onboardingContext,
  onOnboardingLocationConfirm,
  onOnboardingLocationSkip,
  onOnboardingSetupJourneySelect,
  onOnboardingActivationSelect,
  onOnboardingTransparencyConfirm,
  onOnboardingDiscoverabilityConfirm,
  onOnboardingEntryMethodConfirm,
  onOnboardingVotingMethodSelect,
}: AiPanelMessagesProps) {
  const t = useTranslations('AiPanel');
  const containerRef = useRef<HTMLDivElement>(null);

  const showSetupJourneyPicker = shouldShowOnboardingSetupJourneyPicker({
    messages,
    onboardingContext,
    isStreaming,
  });
  const showLocationPicker = shouldShowOnboardingLocationPicker({
    messages,
    onboardingContext,
    isStreaming,
  });
  const locationSearchHint =
    showLocationPicker &&
    !onboardingContext?.spaceLocation?.latitude &&
    onboardingContext?.spaceLocation?.skipped !== true
      ? onboardingContext?.lastUserText?.trim()
      : undefined;
  const showActivationPicker = shouldShowOnboardingActivationPicker({
    messages,
    onboardingContext,
    isStreaming,
  });
  const showTransparencyPicker = shouldShowOnboardingTransparencyPicker({
    messages,
    onboardingContext,
    isStreaming,
  });
  const transparencyPickerStep = showTransparencyPicker
    ? resolveOnboardingTransparencyPickerStep(messages, onboardingContext)
    : null;
  const showEntryMethodPicker =
    shouldShowOnboardingEntryMethodPicker({
      messages,
      onboardingContext,
      isStreaming,
    }) ||
    (isPostCreateOnboardingPhase(onboardingContext) &&
      !onboardingContext?.entryMethod &&
      !isStreaming &&
      Boolean(onboardingContext?.votingMethod));
  const showVotingMethodPicker = shouldShowOnboardingVotingMethodPicker({
    onboardingContext,
    isStreaming,
  });
  const suppressWalletSignaturePrompt = isOnboardingWalletSessionActive();

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
            userAvatarUrl={userAvatarUrl}
            userDisplayName={userDisplayName}
            assistantAvatarUrl={assistantAvatarUrl}
            mobilizedAgents={
              msg.role === 'assistant' && msg.id !== 'welcome'
                ? [
                    ...resolveMobilizedAgentsForAssistantMessage(
                      displayMessages,
                      index,
                    ),
                    ...(onboardingContext
                      ? readMobilizedAiAgents(ONBOARDING_MOBILIZED_SCOPE).map(
                          ({
                            id,
                            tagGroup,
                            role,
                            focus,
                            avatarLabel,
                            roleDefinition,
                          }) => ({
                            id,
                            tagGroup,
                            role,
                            focus,
                            avatarLabel,
                            roleDefinition,
                          }),
                        )
                      : []),
                  ].filter(
                    (agent, agentIndex, list) =>
                      list.findIndex((item) => item.id === agent.id) ===
                      agentIndex,
                  )
                : []
            }
            onActionReplySelect={onActionReplySelect}
            suppressWalletSignaturePrompt={suppressWalletSignaturePrompt}
            isStreaming={
              msg.role === 'assistant' &&
              isStreaming &&
              index === displayMessages.length - 1
            }
          />
        ))}

        {showSetupJourneyPicker && onOnboardingSetupJourneySelect ? (
          <OnboardingSetupJourneyCard
            disabled={isStreaming}
            onSelect={onOnboardingSetupJourneySelect}
          />
        ) : null}

        {showTransparencyPicker &&
        transparencyPickerStep &&
        onOnboardingTransparencyConfirm ? (
          <OnboardingTransparencyMatrixCard
            disabled={isStreaming}
            step={transparencyPickerStep}
            activationMethod={onboardingContext?.activationMethod}
            selectedDiscoverability={
              onboardingContext?.pendingTransparencyDiscoverability ??
              onboardingContext?.transparencyMatrix?.discoverability
            }
            onConfirmDiscoverability={onOnboardingDiscoverabilityConfirm}
            onConfirm={onOnboardingTransparencyConfirm}
          />
        ) : null}

        {showVotingMethodPicker && onOnboardingVotingMethodSelect ? (
          <OnboardingVotingMethodCard
            disabled={isStreaming}
            onSelect={onOnboardingVotingMethodSelect}
          />
        ) : null}

        {showEntryMethodPicker && onOnboardingEntryMethodConfirm ? (
          <OnboardingEntryMethodCard
            disabled={isStreaming}
            onConfirm={onOnboardingEntryMethodConfirm}
          />
        ) : null}

        {showActivationPicker && onOnboardingActivationSelect ? (
          <OnboardingActivationModeCard
            disabled={isStreaming}
            onSelect={onOnboardingActivationSelect}
          />
        ) : null}

        {showLocationPicker &&
        onOnboardingLocationConfirm &&
        onOnboardingLocationSkip ? (
          <OnboardingSpaceLocationCard
            disabled={isStreaming}
            initialSearchQuery={locationSearchHint}
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
