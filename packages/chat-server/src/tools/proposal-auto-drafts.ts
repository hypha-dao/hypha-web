import type { AiCreatableProposalType } from './ai-proposal-types';
import { truncateProposalTitle } from '../proposal-title-limits';
import {
  buildEntryMethodProposalDraft,
  buildVotingMethodProposalDraft,
  type EntryMethodId,
  type VotingMethodId,
} from '../locale-ui-labels';

const ENTRY_METHOD_IDS = new Set<EntryMethodId>([
  'open_access',
  'invite_only',
  'token_based',
]);

const VOTING_METHOD_IDS = new Set<VotingMethodId>(['1m1v', '1v1v', '1t1v']);

/** Silent title/description when the member already accepted a choice field. */
export function buildSilentProposalDrafts(
  proposalType: AiCreatableProposalType,
  collected: Record<string, unknown>,
  locale?: string | null,
): Record<string, unknown> {
  const drafts: Record<string, unknown> = {};

  if (proposalType === 'change_entry_method') {
    const method = collected.entry_method;
    if (
      typeof method === 'string' &&
      ENTRY_METHOD_IDS.has(method as EntryMethodId)
    ) {
      const draft = buildEntryMethodProposalDraft(
        locale,
        method as EntryMethodId,
      );
      if (!collected.title && draft.title) {
        drafts.title = truncateProposalTitle(draft.title);
      }
      if (!collected.description && draft.description) {
        drafts.description = draft.description;
      }
    }
  }

  if (proposalType === 'change_voting_method') {
    const method = collected.voting_method;
    if (
      typeof method === 'string' &&
      VOTING_METHOD_IDS.has(method as VotingMethodId)
    ) {
      const draft = buildVotingMethodProposalDraft(
        locale,
        method as VotingMethodId,
      );
      if (!collected.title && draft.title) {
        drafts.title = truncateProposalTitle(draft.title);
      }
      if (!collected.description && draft.description) {
        drafts.description = draft.description;
      }
    }
  }

  return drafts;
}

export function hasChoiceFieldAccepted(
  proposalType: AiCreatableProposalType,
  collected: Record<string, unknown>,
): boolean {
  if (proposalType === 'change_entry_method') {
    return typeof collected.entry_method === 'string';
  }
  if (proposalType === 'change_voting_method') {
    return typeof collected.voting_method === 'string';
  }
  return false;
}

export type ProposalPrepareNowReason =
  | 'choice_accepted'
  | 'title_accepted'
  | 'fields_complete'
  | 'form_out_of_sync'
  | null;

export type ProposalPrepareNowState = {
  stepMode: 'prepare_now' | 'one_field_at_a_time';
  hint: string | null;
  reason: ProposalPrepareNowReason;
};

type FormStateSlice = {
  ok: boolean;
  filled_on_screen?: string[];
  collected_but_not_on_screen?: string[];
};

export function resolveProposalPrepareNow(args: {
  effectiveCollected: Record<string, unknown>;
  formIsOpen: boolean;
  filledFields: string[];
  readyToPublish: boolean;
  choiceAccepted: boolean;
  formState: FormStateSlice | null;
}): ProposalPrepareNowState {
  const {
    effectiveCollected,
    formIsOpen,
    filledFields,
    readyToPublish,
    choiceAccepted,
    formState,
  } = args;

  const title =
    typeof effectiveCollected.title === 'string'
      ? effectiveCollected.title.trim()
      : '';
  const description =
    typeof effectiveCollected.description === 'string'
      ? effectiveCollected.description.trim()
      : '';

  if (choiceAccepted && !formIsOpen) {
    return {
      stepMode: 'prepare_now',
      reason: 'choice_accepted',
      hint: 'Member already accepted the join/voting choice (yes/sounds good counts). Do NOT ask "does that sound good", "shall I proceed", or re-offer title/description. Call prepare_governance_proposal partial:true THIS TURN with effective_collected_fields — form opens with everything filled. One short sentence only.',
    };
  }

  if (readyToPublish && !formIsOpen) {
    return {
      stepMode: 'prepare_now',
      reason: 'fields_complete',
      hint: 'All required fields are collected — call prepare_governance_proposal partial:true NOW to open the form with effective_collected_fields. Do not ask for more verbal confirmation.',
    };
  }

  if (title.length >= 3 && !formIsOpen && !description) {
    return {
      stepMode: 'prepare_now',
      reason: 'title_accepted',
      hint: `Title "${title}" is accepted — call prepare_governance_proposal partial:true with title ONLY to OPEN the form. Do NOT ask "does that work", "does that sound good", or re-offer the title.`,
    };
  }

  if (
    !formIsOpen &&
    filledFields.length > 0 &&
    !readyToPublish &&
    (description || filledFields.length > 1)
  ) {
    return {
      stepMode: 'one_field_at_a_time',
      reason: null,
      hint: `Call prepare_governance_proposal partial:true with effective_collected_fields to OPEN the form, then ask ONLY the next missing field. Do not re-ask filled fields.`,
    };
  }

  if (
    formState?.ok &&
    formState.collected_but_not_on_screen &&
    formState.collected_but_not_on_screen.length > 0
  ) {
    return {
      stepMode: 'prepare_now',
      reason: 'form_out_of_sync',
      hint: `Form is missing on-screen values for: ${formState.collected_but_not_on_screen.join(
        ', ',
      )}. Call prepare partial:true immediately with effective_collected_fields. Do NOT re-ask those fields.`,
    };
  }

  if (
    title.length >= 3 &&
    formIsOpen &&
    formState?.ok &&
    formState.filled_on_screen &&
    !formState.filled_on_screen.includes('title')
  ) {
    return {
      stepMode: 'prepare_now',
      reason: 'title_accepted',
      hint: `Title "${title}" was accepted but is not on the form — call prepare partial:true with title now. Do not re-ask.`,
    };
  }

  if (!formIsOpen && filledFields.length > 0 && !title && !choiceAccepted) {
    return {
      stepMode: 'prepare_now',
      reason: 'form_out_of_sync',
      hint: `Fields already collected (${filledFields.join(
        ', ',
      )}) — call prepare partial:true with effective_collected_fields to open the form. Do not re-ask.`,
    };
  }

  return { stepMode: 'one_field_at_a_time', hint: null, reason: null };
}
