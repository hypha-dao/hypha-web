'use client';

import {
  type OnboardingConversationContext,
  type OnboardingSetupJourney,
} from './ai-onboarding-context';
import { shouldShowOnboardingGuidancePicker } from './onboarding-guidance-picker-ui';

type ChatUiMessage = {
  role: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

export type { OnboardingSetupJourney };

export function isOnboardingSetupJourney(
  value: unknown,
): value is OnboardingSetupJourney {
  return value === 'single_space' || value === 'ecosystem';
}

function extractUserMessageText(message: ChatUiMessage): string {
  return (message.parts ?? [])
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function inferSetupJourneyFromMessages(
  messages: ChatUiMessage[],
): OnboardingSetupJourney | undefined {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const normalized = extractUserMessageText(message).toLowerCase();
    if (
      normalized.includes('full ecosystem') ||
      normalized.includes('multiple spaces') ||
      normalized.includes('full organisation') ||
      normalized.includes('full organization') ||
      normalized.includes('organisation blueprint') ||
      normalized.includes('organization blueprint')
    ) {
      return 'ecosystem';
    }
    if (
      normalized.includes('single space') ||
      normalized === 'single' ||
      normalized.includes('one space')
    ) {
      return 'single_space';
    }
  }
  return undefined;
}

function isSetupJourneyGuidanceOutput(
  output: {
    requires_setup_journey_picker?: boolean;
    next_field?: string | null;
  } | null,
): boolean {
  if (!output) return false;
  return (
    output.requires_setup_journey_picker === true ||
    output.next_field === 'setup_journey'
  );
}

function hasUserReplyAfterFirstSetupJourneyPrompt(
  messages: ChatUiMessage[],
): boolean {
  let firstJourneyPromptIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || message.role !== 'assistant') continue;
    for (const part of message.parts ?? []) {
      if (part.type !== 'tool-onboarding_guidance') continue;
      if (part.state !== 'output-available') continue;
      const output = part.output as
        | {
            ok?: boolean;
            requires_setup_journey_picker?: boolean;
            next_field?: string | null;
          }
        | undefined;
      if (output?.ok && isSetupJourneyGuidanceOutput(output)) {
        firstJourneyPromptIndex = index;
        break;
      }
    }
    if (firstJourneyPromptIndex >= 0) break;
  }
  if (firstJourneyPromptIndex < 0) return false;
  return messages
    .slice(firstJourneyPromptIndex + 1)
    .some((message) => message.role === 'user');
}

export function shouldShowOnboardingSetupJourneyPicker({
  messages,
  onboardingContext,
  isStreaming,
}: {
  messages: ChatUiMessage[];
  onboardingContext?: OnboardingConversationContext;
  isStreaming: boolean;
}): boolean {
  const journeyAnswered =
    Boolean(onboardingContext?.setupJourney) ||
    inferSetupJourneyFromMessages(messages) != null ||
    hasUserReplyAfterFirstSetupJourneyPrompt(messages);

  return shouldShowOnboardingGuidancePicker({
    messages,
    isStreaming,
    nextField: 'setup_journey',
    requiresFlag: 'requires_setup_journey_picker',
    alreadyAnswered: journeyAnswered,
  });
}

export type OnboardingSetupJourneyMessageLabels = {
  singleSpace: string;
  ecosystem: string;
};

export function formatOnboardingSetupJourneySubmitMessage(
  journey: OnboardingSetupJourney,
  labels: OnboardingSetupJourneyMessageLabels,
): string {
  return journey === 'ecosystem' ? labels.ecosystem : labels.singleSpace;
}

export function applyOnboardingSetupJourneyToContext(
  context: OnboardingConversationContext,
  journey: OnboardingSetupJourney,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    setupJourney: journey,
    lastUserText: userMessage,
    setupPhase:
      context.setupPhase === 'discover' ? 'draft' : context.setupPhase,
  };
}
