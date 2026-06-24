import type { AiCreatableProposalType } from './ai-proposal-types';

const ENTRY_METHOD_LABELS: Record<string, string> = {
  open_access: 'Open Access',
  invite_only: 'Invite Request',
  token_based: 'Token Based',
};

const ENTRY_METHOD_DESCRIPTIONS: Record<string, string> = {
  open_access:
    'This proposal opens membership so anyone can join the space freely, fostering inclusivity and community growth.',
  invite_only:
    'This proposal switches join access to Invite Request so new members join through an invitation and member vote.',
  token_based:
    'This proposal sets join access to Token Based so membership follows the space token requirements.',
};

const VOTING_METHOD_LABELS: Record<string, string> = {
  '1m1v': 'One Member One Vote',
  '1v1v': 'One Voice Token One Vote',
  '1t1v': 'One Token One Vote',
};

const VOTING_METHOD_DESCRIPTIONS: Record<string, string> = {
  '1m1v':
    'This proposal switches decision-making to one member, one vote so each member has equal say.',
  '1v1v':
    'This proposal switches decision-making to one voice token, one vote.',
  '1t1v': 'This proposal switches decision-making to one token, one vote.',
};

/** Silent title/description when the member already accepted a choice field. */
export function buildSilentProposalDrafts(
  proposalType: AiCreatableProposalType,
  collected: Record<string, unknown>,
): Record<string, unknown> {
  const drafts: Record<string, unknown> = {};

  if (proposalType === 'change_entry_method') {
    const method = collected.entry_method;
    if (typeof method === 'string' && method in ENTRY_METHOD_LABELS) {
      const label = ENTRY_METHOD_LABELS[method]!;
      if (!collected.title) {
        drafts.title = `Change Entry Method to ${label}`;
      }
      if (!collected.description) {
        drafts.description =
          ENTRY_METHOD_DESCRIPTIONS[method] ??
          `This proposal changes how people join the space to ${label}.`;
      }
    }
  }

  if (proposalType === 'change_voting_method') {
    const method = collected.voting_method;
    if (typeof method === 'string' && method in VOTING_METHOD_LABELS) {
      const label = VOTING_METHOD_LABELS[method]!;
      if (!collected.title) {
        drafts.title = `Change Voting Method to ${label}`;
      }
      if (!collected.description) {
        drafts.description =
          VOTING_METHOD_DESCRIPTIONS[method] ??
          `This proposal changes how decisions are made to ${label}.`;
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
