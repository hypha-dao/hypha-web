import type { z } from 'zod';
import { onboardingConversationContextSchema } from '../request-schema';
import { PROPOSAL_TITLE_MAX_LENGTH } from '../proposal-title-limits';
import { VOICE_SPOKEN_SENTENCE_LIMIT } from '../system-prompt';

type OnboardingContext = z.infer<typeof onboardingConversationContextSchema>;

export function buildActiveGovernanceProposalDirective(
  context:
    | {
        activeGovernanceProposal?: {
          proposalType: string;
          collectedFields?: Record<string, unknown>;
          formOpen?: boolean;
        };
      }
    | null
    | undefined,
): string | null {
  const active = context?.activeGovernanceProposal;
  if (!active?.proposalType) return null;

  const collected = JSON.stringify(active.collectedFields ?? {});

  return [
    `ACTIVE GOVERNANCE PROPOSAL WALKTHROUGH (${active.proposalType}) — your primary job is to walk the member step-by-step and fill the form live as they confirm each value.`,
    `Collected fields so far: ${collected}.`,
    `Follow proposal_guidance remaining_field_order — form top-to-bottom. Never re-ask filled_fields. After EVERY acceptance call prepare_governance_proposal partial:true with that field merged, then get_proposal_form_state — the form must show the value before the next question.`,
    `Proposal titles max ${PROPOSAL_TITLE_MAX_LENGTH} characters — draft short titles that fit.`,
    `Minimum voting period: never mention seconds in chat — use plain durations ("3 days") and set the form dropdown via prepare; never read raw second counts aloud.`,
    `Voice/Live Voice: ${VOICE_SPOKEN_SENTENCE_LIMIT} short sentences per turn. Typed chat: max 3–4. Before tool calls, one short acknowledgment sentence first.`,
    'When step_mode is prepare_now: call prepare_governance_proposal immediately — no more questions this turn.',
    'FORBIDDEN after user says yes: "does that sound good", "does that work", "how about we title", re-offering the same field.',
    'FORBIDDEN discovery narration: "It looks like I need to", "I now need to add", "Let me add" — you are doing the work, not discovering aloud.',
    'For choice fields in voice: one-line recommendation and point to on-screen options — do NOT read every enum aloud. Typed chat: list EVERY option in plain language FIRST — all of them — THEN one-line recommendation.',
    'On acceptance: prepare_governance_proposal partial:true same turn — merge all fields, fill quorum/unity/voting period from chain defaults using dropdown-compatible duration values.',
    'NEVER say ready/all set unless proposal_guidance.ready_to_publish is true AND get_proposal_form_state confirms form_synced with every required field in filled_on_screen.',
    'When ready_to_publish: prepare partial:false — tell user briefly to click Publish (one sentence).',
    'Do not reopen the same proposal form after Publish.',
  ].join(' ');
}

export function hasActiveGovernanceProposalWalkthrough(
  context: OnboardingContext | null | undefined,
): boolean {
  return Boolean(context?.activeGovernanceProposal?.proposalType);
}
