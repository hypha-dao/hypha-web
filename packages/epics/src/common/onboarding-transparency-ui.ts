'use client';

import {
  type OnboardingActivationMethod,
  type OnboardingConversationContext,
  type OnboardingTransparencyMatrix,
} from './ai-onboarding-context';
import { shouldShowOnboardingGuidancePicker } from './onboarding-guidance-picker-ui';
import { TransparencyLevel } from '../spaces/components/transparency-level';

export type { OnboardingTransparencyMatrix } from './ai-onboarding-context';

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

export function shouldShowOnboardingTransparencyPicker({
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
    nextField: 'transparency_matrix',
    requiresFlag: 'requires_transparency_picker',
    alreadyAnswered: Boolean(onboardingContext?.transparencyMatrix),
  });
}

export type OnboardingTransparencyMessageLabels = {
  levelPublic: string;
  levelNetwork: string;
  levelOrganisation: string;
  levelSpace: string;
  summary: (discoverability: string, access: string) => string;
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

export function formatOnboardingTransparencySubmitMessage(
  matrix: OnboardingTransparencyMatrix,
  labels: OnboardingTransparencyMessageLabels,
): string {
  return labels.summary(
    transparencyLevelLabel(matrix.discoverability, labels),
    transparencyLevelLabel(matrix.access, labels),
  );
}

export function applyOnboardingTransparencyToContext(
  context: OnboardingConversationContext,
  matrix: OnboardingTransparencyMatrix,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    transparencyMatrix: matrix,
    lastUserText: userMessage,
    setupPhase:
      context.setupPhase === 'discover' ? 'draft' : context.setupPhase,
  };
}
