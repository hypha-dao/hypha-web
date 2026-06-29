'use client';

import {
  type OnboardingActivationMethod,
  type OnboardingConversationContext,
  type OnboardingTransparencyLevel,
  type OnboardingTransparencyMatrix,
} from './ai-onboarding-context';
import {
  findLatestOnboardingGuidanceOutput,
  shouldShowOnboardingGuidancePicker,
} from './onboarding-guidance-picker-ui';
import { TransparencyLevel } from '../spaces/components/transparency-level';

export type { OnboardingTransparencyMatrix } from './ai-onboarding-context';

export type OnboardingTransparencyPickerStep = 'discoverability' | 'activity';

export function defaultTransparencyForActivation(
  method: OnboardingActivationMethod | undefined,
): OnboardingTransparencyMatrix {
  switch (method) {
    case 'sandbox':
      return {
        discoverability: TransparencyLevel.SPACE,
        access: TransparencyLevel.ORGANISATION,
      };
    case 'pilot':
      return {
        discoverability: TransparencyLevel.NETWORK,
        access: TransparencyLevel.ORGANISATION,
      };
    case 'deployment':
    default:
      return {
        discoverability: TransparencyLevel.PUBLIC,
        access: TransparencyLevel.ORGANISATION,
      };
  }
}

export function isOnboardingTransparencyMatrix(
  value: unknown,
): value is OnboardingTransparencyMatrix {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OnboardingTransparencyMatrix>;
  return (
    typeof candidate.discoverability === 'number' &&
    candidate.discoverability >= 0 &&
    candidate.discoverability <= 3 &&
    typeof candidate.access === 'number' &&
    candidate.access >= 0 &&
    candidate.access <= 3
  );
}

type ChatUiMessage = {
  role: string;
  parts?: Array<{ type: string; [key: string]: unknown }>;
};

export function resolveOnboardingTransparencyPickerStep(
  messages: ChatUiMessage[],
  onboardingContext?: OnboardingConversationContext,
): OnboardingTransparencyPickerStep | null {
  if (onboardingContext?.transparencyMatrix) return null;

  const output = findLatestOnboardingGuidanceOutput(messages);
  if (output?.transparency_picker_step === 'activity') {
    return 'activity';
  }
  if (output?.transparency_picker_step === 'discoverability') {
    return 'discoverability';
  }
  if (
    output?.requires_transparency_activity_picker ||
    output?.next_field === 'transparency_activity_access'
  ) {
    return 'activity';
  }
  if (
    output?.requires_transparency_discoverability_picker ||
    output?.next_field === 'transparency_discoverability'
  ) {
    return 'discoverability';
  }
  return null;
}

export function shouldShowOnboardingTransparencyPicker({
  messages,
  onboardingContext,
  isStreaming,
}: {
  messages: ChatUiMessage[];
  onboardingContext?: OnboardingConversationContext;
  isStreaming: boolean;
}): boolean {
  if (isStreaming || messages.length === 0) return false;
  if (onboardingContext?.transparencyMatrix) return false;

  const step = resolveOnboardingTransparencyPickerStep(
    messages,
    onboardingContext,
  );
  if (!step) return false;

  const latestMessage = messages[messages.length - 1];
  if (latestMessage?.role !== 'assistant') return false;

  return shouldShowOnboardingGuidancePicker({
    messages,
    isStreaming,
    nextField:
      step === 'activity'
        ? 'transparency_activity_access'
        : 'transparency_discoverability',
    requiresFlag:
      step === 'activity'
        ? 'requires_transparency_activity_picker'
        : 'requires_transparency_discoverability_picker',
    alreadyAnswered: false,
  });
}

export type OnboardingTransparencyMessageLabels = {
  levelPublic: string;
  levelNetwork: string;
  levelOrganisation: string;
  levelSpace: string;
  summary: (discoverability: string, access: string) => string;
  discoverabilitySummary: (discoverability: string) => string;
};

function transparencyLevelLabel(
  level: TransparencyLevel,
  labels: Pick<
    OnboardingTransparencyMessageLabels,
    'levelPublic' | 'levelNetwork' | 'levelOrganisation' | 'levelSpace'
  >,
): string {
  switch (level) {
    case TransparencyLevel.PUBLIC:
      return labels.levelPublic;
    case TransparencyLevel.NETWORK:
      return labels.levelNetwork;
    case TransparencyLevel.ORGANISATION:
      return labels.levelOrganisation;
    case TransparencyLevel.SPACE:
      return labels.levelSpace;
    default:
      return labels.levelPublic;
  }
}

export function formatOnboardingDiscoverabilitySubmitMessage(
  level: OnboardingTransparencyLevel,
  labels: OnboardingTransparencyMessageLabels,
): string {
  return labels.discoverabilitySummary(transparencyLevelLabel(level, labels));
}

export function formatOnboardingTransparencySubmitMessage(
  matrix: OnboardingTransparencyMatrix,
  labels: OnboardingTransparencyMessageLabels,
): string {
  return labels.summary(
    transparencyLevelLabel(matrix.discoverability, labels),
    transparencyLevelLabel(matrix.access, labels),
  );
}

export function applyOnboardingDiscoverabilityToContext(
  context: OnboardingConversationContext,
  level: OnboardingTransparencyLevel,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    pendingTransparencyDiscoverability: level,
    lastUserText: userMessage,
  };
}

export function applyOnboardingTransparencyToContext(
  context: OnboardingConversationContext,
  matrix: OnboardingTransparencyMatrix,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    transparencyMatrix: matrix,
    pendingTransparencyDiscoverability: undefined,
    lastUserText: userMessage,
    setupPhase:
      context.setupPhase === 'discover' ? 'draft' : context.setupPhase,
  };
}
