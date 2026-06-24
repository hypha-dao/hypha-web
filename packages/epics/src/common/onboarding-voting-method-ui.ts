'use client';

import {
  type OnboardingConversationContext,
  type OnboardingVotingMethod,
  isPostCreateOnboardingPhase,
} from './ai-onboarding-context';

const VOTING_METHODS = new Set<OnboardingVotingMethod>([
  '1m1v',
  '1v1v',
  '1t1v',
]);

export type { OnboardingVotingMethod };

export function isOnboardingVotingMethod(
  value: unknown,
): value is OnboardingVotingMethod {
  return (
    typeof value === 'string' &&
    VOTING_METHODS.has(value as OnboardingVotingMethod)
  );
}

export function shouldShowOnboardingVotingMethodPicker({
  onboardingContext,
  isStreaming,
}: {
  onboardingContext?: OnboardingConversationContext;
  isStreaming: boolean;
}): boolean {
  if (isStreaming || !isPostCreateOnboardingPhase(onboardingContext)) {
    return false;
  }
  if (onboardingContext?.votingMethod) return false;
  if (
    onboardingContext?.activeGovernanceProposal?.proposalType ===
      'change_voting_method' &&
    onboardingContext.activeGovernanceProposal.collectedFields.voting_method
  ) {
    return false;
  }
  return true;
}

export type OnboardingVotingMethodMessageLabels = {
  oneMemberOneVote: string;
  oneVoiceOneVote: string;
  oneTokenOneVote: string;
};

export function formatOnboardingVotingMethodSubmitMessage(
  method: OnboardingVotingMethod,
  labels: OnboardingVotingMethodMessageLabels,
): string {
  switch (method) {
    case '1m1v':
      return labels.oneMemberOneVote;
    case '1v1v':
      return labels.oneVoiceOneVote;
    case '1t1v':
      return labels.oneTokenOneVote;
  }
}

export function applyOnboardingVotingMethodToContext(
  context: OnboardingConversationContext,
  method: OnboardingVotingMethod,
  userMessage: string,
): OnboardingConversationContext {
  return {
    ...context,
    lastUserText: userMessage,
    activeGovernanceProposal: {
      proposalType: 'change_voting_method',
      collectedFields: { voting_method: method },
      formOpen: true,
    },
    setupPlan: {
      ...context.setupPlan,
      governance: {
        ...context.setupPlan?.governance,
        votingModel: method,
      },
    },
  };
}
