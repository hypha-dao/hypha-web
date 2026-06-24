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
    'Follow proposal_guidance remaining_field_order — form top-to-bottom. Never re-ask filled_fields. Fill live: prepare partial:true after every acceptance so the form shows values before the next question.',
    'Be terse — max 3–4 short sentences per turn.',
    'When step_mode is prepare_now: call prepare_governance_proposal immediately — no more questions this turn.',
    'FORBIDDEN after user says yes: "does that sound good", "does that work", "how about we title", re-offering the same field.',
    'FORBIDDEN discovery narration: "It looks like I need to", "I now need to add", "Let me add" — you are doing the work, not discovering aloud.',
    'For choice fields: list EVERY option in plain language FIRST — all of them — THEN one-line recommendation. Never recommend before listing all options.',
    'On acceptance: prepare_governance_proposal partial:true same turn — merge all fields, fill quorum/unity/voting period from chain defaults.',
    'NEVER say ready/all set unless proposal_guidance.ready_to_publish is true AND the form displays the collected values.',
    'When ready_to_publish: prepare partial:false — tell user briefly to click Publish (one sentence).',
    'Do not reopen the same proposal form after Publish.',
  ].join(' ');
}

export function hasActiveGovernanceProposalWalkthrough(
  context: OnboardingContext | null | undefined,
): boolean {
  return Boolean(context?.activeGovernanceProposal?.proposalType);
}
