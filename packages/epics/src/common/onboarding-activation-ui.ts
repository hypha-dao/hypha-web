'use client';

import type { SpaceFlags } from '@hypha-platform/core/client';

import {
  type OnboardingActivationMethod,
  type OnboardingConversationContext,
} from './ai-onboarding-context';
import { shouldShowOnboardingGuidancePicker } from './onboarding-guidance-picker-ui';

const ACTIVATION_METHODS = new Set<OnboardingActivationMethod>([
  'sandbox',
  'pilot',
  'deployment',
]);

export type { OnboardingActivationMethod };

export function isOnboardingActivationMethod(
  value: unknown,
): value is OnboardingActivationMethod {
  return (
    typeof value === 'string' &&
    ACTIVATION_METHODS.has(value as OnboardingActivationMethod)
  );
}

export function activationMethodToFlags(
  method: OnboardingActivationMethod,
): SpaceFlags[] {
  switch (method) {
    case 'sandbox':
      return ['sandbox'];
    case 'pilot':
      return ['demo'];
    case 'deployment':
      return [];
  }
}

type ChatUiMessage = {
  role: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

export function shouldShowOnboardingActivationPicker({
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
    nextField: 'activation_method',
    requiresFlag: 'requires_activation_picker',
    alreadyAnswered: Boolean(onboardingContext?.activationMethod),
  });
}

export type OnboardingActivationMessageLabels = {
  sandbox: string;
  pilot: string;
  deployment: string;
};

export function formatOnboardingActivationSubmitMessage(
  method: OnboardingActivationMethod,
  labels: OnboardingActivationMessageLabels,
): string {
  switch (method) {
    case 'sandbox':
      return labels.sandbox;
    case 'pilot':
      return labels.pilot;
    case 'deployment':
      return labels.deployment;
  }
}

export function applyOnboardingActivationToContext(
  context: OnboardingConversationContext,
  method: OnboardingActivationMethod,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    activationMethod: method,
    lastUserText: userMessage,
    setupPhase:
      context.setupPhase === 'discover' ? 'draft' : context.setupPhase,
  };
}
