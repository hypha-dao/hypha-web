import type { z } from 'zod';
import { onboardingConversationContextSchema } from '../request-schema';

type OnboardingContext = z.infer<typeof onboardingConversationContextSchema>;

export function buildActiveGovernanceProposalDirective(
  context: OnboardingContext | null | undefined,
): string | null {
  const active = context?.activeGovernanceProposal;
  if (!active?.proposalType) return null;

  const collected = JSON.stringify(active.collectedFields ?? {});

  return [
    `ACTIVE GOVERNANCE PROPOSAL WALKTHROUGH (${active.proposalType}) — form may already be open.`,
    `Collected fields so far: ${collected}.`,
    'Every turn during this walkthrough: (1) call proposal_guidance(proposal_type, collected_fields), (2) follow next_question and walkthrough_hint exactly.',
    'When the user accepts the current field: merge it into collected_fields, then call prepare_governance_proposal with partial:true, the merged proposal_fields, and focus_field from guidance — in the SAME turn.',
    'Walk through ALL required fields one at a time (decision fields first, then title, then description). Never skip to Publish until proposal_guidance.ready_to_publish is true.',
    'When ready_to_publish: call prepare_governance_proposal with partial:false, then tell the user briefly to review and click Publish.',
    'Never claim the space has no proposals or documents — a draft agreement form is in progress.',
    'Do not call prepare_governance_proposal on every chat turn unless the user just accepted a field or asked to change one.',
  ].join(' ');
}

export function hasActiveGovernanceProposalWalkthrough(
  context: OnboardingContext | null | undefined,
): boolean {
  return Boolean(context?.activeGovernanceProposal?.proposalType);
}
