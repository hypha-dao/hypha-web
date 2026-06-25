'use client';

import type {
  ActiveGovernanceProposal,
  OnboardingConversationContext,
} from './ai-onboarding-context';
import type { OnboardingVotingMethod } from './onboarding-voting-method-ui';

export type { ActiveGovernanceProposal };

export function getActiveGovernanceProposal(
  context: OnboardingConversationContext | undefined,
): ActiveGovernanceProposal | undefined {
  return context?.activeGovernanceProposal;
}

export function hasActiveVotingMethodDraft(
  context: OnboardingConversationContext | undefined,
): boolean {
  const active = getActiveGovernanceProposal(context);
  if (active?.proposalType !== 'change_voting_method') return false;
  return Boolean(active.collectedFields.voting_method);
}

export function startVotingMethodGovernanceWalkthrough(
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

export function mergeActiveGovernanceProposalFields(
  context: OnboardingConversationContext,
  fields: Record<string, unknown>,
): OnboardingConversationContext {
  const active = getActiveGovernanceProposal(context);
  if (!active) return context;
  return {
    ...context,
    activeGovernanceProposal: {
      ...active,
      collectedFields: {
        ...active.collectedFields,
        ...fields,
      },
    },
  };
}

export function completeVotingMethodGovernanceWalkthrough(
  context: OnboardingConversationContext,
  method: OnboardingVotingMethod,
): OnboardingConversationContext {
  const { activeGovernanceProposal: _active, ...rest } = context;
  return {
    ...rest,
    votingMethod: method,
    setupPlan: {
      ...context.setupPlan,
      governance: {
        ...context.setupPlan?.governance,
        votingModel: method,
      },
    },
  };
}
