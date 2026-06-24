/**
 * Discovery playbooks for governance proposals — backed by the canonical catalog.
 */
import type { AiCreatableProposalType } from './ai-proposal-types';
import {
  buildProposalGuidancePromptLines,
  catalogEntryToPlaybook,
  getProposalCatalogEntry,
  orderFieldsForDiscovery,
  pickOptionalDiscoveryPrompts,
  type ProposalGuidancePlaybook,
} from './proposal-catalog';
import type { CatalogDiscoveryField } from './proposal-catalog/types';
import {
  buildProposalFormStateResponse,
  type ActiveProposalFormSnapshot,
} from './proposal-form-state';

export type { ProposalGuidancePlaybook };
export type ProposalGuidanceField =
  ProposalGuidancePlaybook['required_fields'][number];

export { buildProposalGuidancePromptLines };

const ENUM_FIELD_OPTIONS: Record<string, Record<string, string>> = {
  voting_method: {
    '1m1v': 'one member, one vote',
    '1v1v': 'one voice token, one vote',
    '1t1v': 'one token, one vote',
  },
  entry_method: {
    open_access: 'Open Access',
    invite_only: 'Invite Request',
    token_based: 'Token Based',
  },
  token_type: {
    utility: 'Utility Token',
    credits: 'Credits',
    ownership: 'Ownership',
    voice: 'Voice',
    impact: 'Impact',
    community_currency: 'Community Currency',
  },
};

function formatEnumOptionsList(field: CatalogDiscoveryField): string {
  if (!field.enumValues?.length) return '';
  const labels = ENUM_FIELD_OPTIONS[field.key];
  return field.enumValues.map((value) => labels?.[value] ?? value).join('; ');
}

function buildNextProposalQuestion(field: CatalogDiscoveryField): string {
  switch (field.key) {
    case 'voting_method': {
      const options = formatEnumOptionsList(field);
      return `List ALL three ways to decide (${options}) — every option, one short phrase — THEN your one-line pick and ask which they want. Never recommend before listing all options. Never say "voting method" or read 1m1v/1v1v/1t1v codes.`;
    }
    case 'entry_method': {
      const options = formatEnumOptionsList(field);
      return `List ALL three join options (${options}) — every option, one short phrase — THEN your one-line pick and ask which they want. Never recommend before listing all options. Never say "entry method".`;
    }
    case 'title':
      return 'Draft a short name silently from context — offer it in one line; never say title.';
    case 'description':
      return 'Draft a one-sentence rationale silently — offer it in one line; never say description.';
    case 'space_discoverability':
    case 'space_activity_access':
      return (
        field.description?.trim() ??
        'State every level option briefly, then your pick — ask which they want.'
      );
    case 'quorum_percent':
      return 'Propose minimum participation as a percentage (e.g. 30%) from space context — ask if that fits. Never say "quorum".';
    case 'unity_percent':
      return 'Propose minimum alignment as a percentage (e.g. 80%) — ask if that fits. Never say "unity".';
    case 'auto_execution':
      return 'State both choices (auto when conditions met vs fixed minimum voting period), then your pick — ask which they prefer.';
    case 'voting_duration_seconds':
      return 'Propose a minimum voting period in plain language (e.g. 3 days) — ask if that works. Convert to seconds when calling prepare_governance_proposal (259200 = 3 days).';
    case 'token_type': {
      const options = formatEnumOptionsList(field);
      return `List ALL token types (${options}) — every option, one short phrase — THEN your one-line pick and ask which they want. Never recommend before listing all options. Never ask about supply before type is set.`;
    }
    case 'token_name':
      return 'Propose a short token name from context in one line — ask if it fits. Never ask name before token type is collected.';
    case 'token_symbol':
      return 'Propose an uppercase symbol (2–10 letters) derived from the name — ask if it fits. Never ask symbol before name is collected.';
    case 'token_icon_url':
      return 'Optional: ask for an HTTPS icon URL, or say they can upload on the form. Skip if they prefer to upload later.';
    case 'max_supply':
      return 'Ask only after type, name, and symbol are set. Propose unlimited (0) or a number — ask which they want.';
    default:
      break;
  }
  if (field.description?.trim()) {
    return field.description.trim();
  }
  if (field.enumValues?.length) {
    const options = formatEnumOptionsList(field);
    return `List ALL options first (${options}) — mandatory — then one-line recommendation and ask which they want.`;
  }
  return `Propose a sensible default from context in one line — never use the label "${field.label}" verbatim.`;
}

function buildInteractionHint(field: CatalogDiscoveryField): string {
  const speed =
    'Max 3–4 short sentences. No preamble, no recap, no numbered lists. Voice: 2 sentences max.';
  const acceptanceRule =
    ' On yes/named option: call prepare_governance_proposal same turn with ALL merged fields — form must show the value before the next question. Include on-chain defaults for quorum/unity/voting period when opening or updating the form — never ask "shall I proceed".';
  if (field.key === 'title' || field.key === 'description') {
    return `${speed} Offer drafted copy; user says yes/tweak/no.${acceptanceRule}`;
  }
  if (field.enumValues?.length) {
    const options = formatEnumOptionsList(field);
    return `${speed} MANDATORY ORDER: (1) list EVERY option (${options}) — all of them; (2) one-line recommendation; (3) ask which they want. Never skip step 1.${acceptanceRule}`;
  }
  return `${speed} Propose a default when sensible.${acceptanceRule}`;
}

function hasCollectedValue(
  collected: Record<string, unknown>,
  field: CatalogDiscoveryField,
): boolean {
  if (field.key === 'title' || field.key === 'description') {
    return Boolean(collected[field.key]);
  }
  return collected[field.key] !== undefined && collected[field.key] !== null;
}

export function getProposalGuidancePlaybook(
  proposalType: AiCreatableProposalType,
): ProposalGuidancePlaybook {
  const entry = getProposalCatalogEntry(proposalType);
  if (!entry) {
    throw new Error(`Unknown proposal type: ${proposalType}`);
  }
  return catalogEntryToPlaybook(entry);
}

export function buildGuidanceResponse(args: {
  proposalType: AiCreatableProposalType;
  collectedFields?: Record<string, unknown>;
  formSnapshot?: ActiveProposalFormSnapshot | null;
}) {
  const entry = getProposalCatalogEntry(args.proposalType);
  if (!entry) {
    return {
      ok: false as const,
      error: `Unknown proposal type: ${args.proposalType}`,
    };
  }

  const collected = args.collectedFields ?? {};
  const optionalPrompts = orderFieldsForDiscovery(
    pickOptionalDiscoveryPrompts(entry, collected).filter((field) => {
      if (field.key !== 'voting_duration_seconds') return true;
      return collected.auto_execution === false;
    }),
  );

  const allDiscoveryFields = orderFieldsForDiscovery([
    ...entry.requiredFields,
    ...optionalPrompts,
  ]);

  const filledFields = allDiscoveryFields
    .filter((field) => hasCollectedValue(collected, field))
    .map((field) => field.key);

  const remainingRequired = orderFieldsForDiscovery(
    entry.requiredFields,
  ).filter((field) => !hasCollectedValue(collected, field));

  const readyToPublish = remainingRequired.length === 0;

  const orderedRemaining = readyToPublish
    ? []
    : orderFieldsForDiscovery([
        ...remainingRequired,
        ...allDiscoveryFields.filter(
          (field) =>
            !remainingRequired.some((required) => required.key === field.key) &&
            !hasCollectedValue(collected, field),
        ),
      ]);

  const nextQuestionField = orderedRemaining[0];
  const nextQuestion = nextQuestionField
    ? buildNextProposalQuestion(nextQuestionField)
    : null;
  const interactionHint = nextQuestionField
    ? buildInteractionHint(nextQuestionField)
    : null;

  const hasAnyCollected = Object.entries(collected).some(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );

  const suggestedTool =
    entry.prepareStrategy === 'prepare_governance_proposal'
      ? 'prepare_governance_proposal'
      : entry.prepareStrategy === 'create_space_setup_proposal'
      ? 'create_space_setup_proposal'
      : 'mcp_navigation';

  const syncFocusField =
    nextQuestionField?.key ??
    orderedRemaining[0]?.key ??
    allDiscoveryFields[0]?.key;

  const formState = args.formSnapshot
    ? buildProposalFormStateResponse({
        snapshot: args.formSnapshot,
        proposalType: args.proposalType,
        collectedFields: collected,
      })
    : null;

  const formSynced =
    formState && 'form_synced' in formState ? formState.form_synced : undefined;
  const readyOnScreen =
    formState && 'ready_to_publish' in formState
      ? formState.ready_to_publish
      : undefined;
  const effectiveReadyToPublish =
    readyToPublish &&
    (formSynced === undefined || formSynced === true) &&
    (readyOnScreen === undefined || readyOnScreen === true);

  const openFormAfterTitle =
    nextQuestionField?.key === 'title' &&
    !hasCollectedValue(collected, { key: 'title' } as CatalogDiscoveryField);

  const titleOnlyOpenHint = openFormAfterTitle
    ? 'STEP 1 — title ONLY: offer a draft title in one line. On yes/tweak: call prepare_governance_proposal partial:true with ONLY title (+ chain defaults) to OPEN the form. Do not ask description or token fields yet.'
    : null;

  const singleFieldHint =
    nextQuestionField?.key === 'title' && filledFields.includes('title')
      ? null
      : nextQuestionField
      ? `ONE field now (${nextQuestionField.key}): ask or suggest ONLY this field — nothing else. On acceptance call prepare_governance_proposal partial:true with this single field merged, then call get_proposal_form_state before the next question.`
      : null;

  return {
    ok: true as const,
    proposal_type: entry.key,
    document_label: entry.documentLabel,
    create_path: entry.createPath,
    do_not_use: entry.doNotUse,
    suggested_tool: suggestedTool,
    step_mode: 'one_field_at_a_time',
    next_question_field: nextQuestionField?.key ?? null,
    next_question: nextQuestion,
    interaction_hint: interactionHint,
    filled_fields: filledFields,
    remaining_field_order: orderedRemaining.map((field) => field.key),
    ready_to_publish: effectiveReadyToPublish,
    form_state:
      formState && 'fields_on_screen' in formState
        ? {
            filled_on_screen: formState.filled_on_screen,
            missing_on_screen: formState.missing_on_screen,
            form_synced: formState.form_synced,
            collected_but_not_on_screen: formState.collected_but_not_on_screen,
            next_missing_field: formState.next_missing_field,
          }
        : undefined,
    form_sync: {
      call_prepare_governance_proposal:
        entry.prepareStrategy === 'prepare_governance_proposal' &&
        (hasAnyCollected || effectiveReadyToPublish),
      partial: !effectiveReadyToPublish,
      focus_field: syncFocusField,
      merge_collected_fields_into_proposal_fields: true,
      verify_with: 'get_proposal_form_state',
    },
    user_reply_rules:
      'Hand-holding: ONE field per turn in form order. Be terse — max 3–4 short sentences. Never skip ahead or re-ask filled_fields. On acceptance: prepare_governance_proposal same turn, then get_proposal_form_state. NEVER say ready/all set unless ready_to_publish is true AND form_state.form_synced is true.',
    walkthrough_hint: effectiveReadyToPublish
      ? 'Call get_proposal_form_state — if form_synced and ready_to_publish, prepare partial:false, then one sentence: click Publish.'
      : [titleOnlyOpenHint, singleFieldHint, interactionHint]
          .filter(Boolean)
          .join(' '),
  };
}
