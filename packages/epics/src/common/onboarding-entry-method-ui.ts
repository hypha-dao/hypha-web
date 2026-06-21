'use client';

import { EntryMethodType } from '@hypha-platform/core/client';

import {
  type OnboardingConversationContext,
  type OnboardingEntryMethod,
} from './ai-onboarding-context';
import { shouldShowOnboardingGuidancePicker } from './onboarding-guidance-picker-ui';

const ENTRY_METHODS = new Set<OnboardingEntryMethod>([
  'open_access',
  'invite_only',
  'token_based',
]);

export type { OnboardingEntryMethod };

export function isOnboardingEntryMethod(
  value: unknown,
): value is OnboardingEntryMethod {
  return (
    typeof value === 'string' &&
    ENTRY_METHODS.has(value as OnboardingEntryMethod)
  );
}

export function entryMethodToJoinMethod(
  method: OnboardingEntryMethod,
): EntryMethodType {
  switch (method) {
    case 'open_access':
      return EntryMethodType.OPEN_ACCESS;
    case 'token_based':
      return EntryMethodType.TOKEN_BASED;
    case 'invite_only':
    default:
      return EntryMethodType.INVITE_ONLY;
  }
}

type ChatUiMessage = {
  role: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

export function shouldShowOnboardingEntryMethodPicker({
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
    nextField: 'entry_method',
    requiresFlag: 'requires_entry_method_picker',
    alreadyAnswered: Boolean(onboardingContext?.entryMethod),
  });
}

export type OnboardingEntryMethodMessageLabels = {
  openAccess: string;
  inviteOnly: string;
  tokenBased: string;
};

export function formatOnboardingEntryMethodSubmitMessage(
  method: OnboardingEntryMethod,
  labels: OnboardingEntryMethodMessageLabels,
): string {
  switch (method) {
    case 'open_access':
      return labels.openAccess;
    case 'token_based':
      return labels.tokenBased;
    case 'invite_only':
      return labels.inviteOnly;
  }
}

export function applyOnboardingEntryMethodToContext(
  context: OnboardingConversationContext,
  method: OnboardingEntryMethod,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    entryMethod: method,
    lastUserText: userMessage,
    setupPlan: {
      ...context.setupPlan,
      governance: {
        ...context.setupPlan?.governance,
        entryMethod: method,
      },
    },
    setupPhase:
      context.setupPhase === 'discover' ? 'draft' : context.setupPhase,
  };
}
