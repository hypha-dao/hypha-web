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

export function shouldShowOnboardingSetupJourneyPicker({
  messages,
  onboardingContext,
  isStreaming,
}: {
  messages: ChatUiMessage[];
  onboardingContext?: OnboardingConversationContext;
  isStreaming: boolean;
}): boolean {
  return shouldShowOnboardingGuidancePicker({
    messages,
    isStreaming,
    nextField: 'setup_journey',
    requiresFlag: 'requires_setup_journey_picker',
    alreadyAnswered: Boolean(onboardingContext?.setupJourney),
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
