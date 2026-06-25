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
import {
  buildSilentProposalDrafts,
  hasChoiceFieldAccepted,
  resolveProposalPrepareNow,
} from './proposal-auto-drafts';
import {
  PROPOSAL_DISCOVERY_NARRATION_FORBIDDEN,
  PROPOSAL_PREMATURE_COMPLETE_FORBIDDEN,
} from './proposal-member-voice';
import { getEnumFieldOptionsForLocale } from '../locale-ui-labels';

export {
  buildSilentProposalDrafts,
  hasChoiceFieldAccepted,
  resolveProposalPrepareNow,
};

export type { ProposalGuidancePlaybook };
export type ProposalGuidanceField =
  ProposalGuidancePlaybook['required_fields'][number];

export { buildProposalGuidancePromptLines };

function formatEnumOptionsList(
  field: CatalogDiscoveryField,
  locale?: string | null,
): string {
  if (!field.enumValues?.length) return '';
  const labels = getEnumFieldOptionsForLocale(locale)[field.key];
  return field.enumValues.map((value) => labels?.[value] ?? value).join('; ');
}

function buildNextProposalQuestion(
  field: CatalogDiscoveryField,
  locale?: string | null,
): string {
  switch (field.key) {
    case 'voting_method': {
      const options = formatEnumOptionsList(field, locale);
      return `List ALL three ways to decide (${options}) — every option, one short phrase — THEN your one-line pick and ask which they want. Never recommend before listing all options. Never say "voting method" or read 1m1v/1v1v/1t1v codes.`;
    }
    case 'entry_method': {
      const options = formatEnumOptionsList(field, locale);
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
      const options = formatEnumOptionsList(field, locale);
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
    const options = formatEnumOptionsList(field, locale);
    return `List ALL options first (${options}) — mandatory — then one-line recommendation and ask which they want.`;
  }
  return `Propose a sensible default from context in one line — never use the label "${field.label}" verbatim.`;
}

function buildInteractionHint(
  field: CatalogDiscoveryField,
  locale?: string | null,
): string {
  const speed =
    'Max 3–4 short sentences. No preamble, no recap, no numbered lists. Voice: 2 sentences max.';
  const acceptanceRule =
    ' On yes/named option: call prepare_governance_proposal same turn with ALL merged fields — form must show the value before the next question. Include on-chain defaults for quorum/unity/voting period when opening or updating the form — never ask "shall I proceed".';
  if (field.key === 'title' || field.key === 'description') {
    return `${speed} Offer drafted copy; user says yes/tweak/no.${acceptanceRule}`;
  }
  if (field.enumValues?.length) {
    const options = formatEnumOptionsList(field, locale);
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
  locale?: string | null;
}) {
  const entry = getProposalCatalogEntry(args.proposalType);
  if (!entry) {
    return {
      ok: false as const,
      error: `Unknown proposal type: ${args.proposalType}`,
    };
  }

  const collected = args.collectedFields ?? {};
  const silentDrafts = buildSilentProposalDrafts(
    args.proposalType,
    collected,
    args.locale,
  );
  const effectiveCollected = { ...silentDrafts, ...collected };
  const formIsOpen = Boolean(
    args.formSnapshot?.formOpen || args.formSnapshot?.resubmitPayload,
  );
  const choiceAccepted = hasChoiceFieldAccepted(
    args.proposalType,
    effectiveCollected,
  );

  const optionalPrompts = orderFieldsForDiscovery(
    pickOptionalDiscoveryPrompts(entry, effectiveCollected).filter((field) => {
      if (field.key !== 'voting_duration_seconds') return true;
      return effectiveCollected.auto_execution === false;
    }),
  );

  const allDiscoveryFields = orderFieldsForDiscovery([
    ...entry.requiredFields,
    ...optionalPrompts,
  ]);

  const filledFields = allDiscoveryFields
    .filter((field) => hasCollectedValue(effectiveCollected, field))
    .map((field) => field.key);

  const remainingRequired = orderFieldsForDiscovery(
    entry.requiredFields,
  ).filter((field) => !hasCollectedValue(effectiveCollected, field));

  const readyToPublish = remainingRequired.length === 0;

  const orderedRemaining = readyToPublish
    ? []
    : orderFieldsForDiscovery([
        ...remainingRequired,
        ...allDiscoveryFields.filter(
          (field) =>
            !remainingRequired.some((required) => required.key === field.key) &&
            !hasCollectedValue(effectiveCollected, field),
        ),
      ]);

  const nextQuestionField = orderedRemaining[0];
  const nextQuestion = nextQuestionField
    ? buildNextProposalQuestion(nextQuestionField, args.locale)
    : null;
  const interactionHint = nextQuestionField
    ? buildInteractionHint(nextQuestionField, args.locale)
    : null;

  const hasAnyCollected = Object.entries(effectiveCollected).some(
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
        collectedFields: effectiveCollected,
      })
    : null;

  const formSynced =
    formState && 'form_synced' in formState ? formState.form_synced : undefined;
  const readyOnScreen =
    formState && 'ready_to_publish' in formState
      ? formState.ready_to_publish
      : undefined;
  const effectiveReadyToPublish =
    formIsOpen &&
    readyToPublish &&
    formSynced === true &&
    readyOnScreen === true;

  const pendingPrepareAllFields = readyToPublish && !formIsOpen;

  const prepareNow = resolveProposalPrepareNow({
    effectiveCollected,
    formIsOpen,
    filledFields,
    readyToPublish,
    choiceAccepted,
    formState:
      formState && 'filled_on_screen' in formState
        ? {
            ok: formState.ok,
            filled_on_screen: formState.filled_on_screen,
            collected_but_not_on_screen: formState.collected_but_not_on_screen,
          }
        : null,
  });

  const prepareNowHint = prepareNow.hint;

  const openFormAfterTitle =
    nextQuestionField?.key === 'title' &&
    !hasCollectedValue(effectiveCollected, {
      key: 'title',
    } as CatalogDiscoveryField);

  const titleOnlyOpenHint =
    openFormAfterTitle && prepareNow.stepMode !== 'prepare_now'
      ? 'STEP 1 — title ONLY: offer a draft title in one line. On yes/tweak: call prepare_governance_proposal partial:true with ONLY title (+ chain defaults) to OPEN the form. Do not ask description or token fields yet.'
      : null;

  const singleFieldHint =
    nextQuestionField?.key === 'title' && filledFields.includes('title')
      ? null
      : nextQuestionField && prepareNow.stepMode !== 'prepare_now'
      ? `ONE field now (${nextQuestionField.key}): ask or suggest ONLY this field — nothing else. On acceptance call prepare_governance_proposal partial:true with this single field merged, then call get_proposal_form_state before the next question.`
      : null;

  const usePrepareNow = prepareNow.stepMode === 'prepare_now';
  const formIncomplete = Boolean(
    formState &&
      'missing_on_screen' in formState &&
      (formState.missing_on_screen?.length ?? 0) > 0,
  );

  return {
    ok: true as const,
    proposal_type: entry.key,
    document_label: entry.documentLabel,
    create_path: entry.createPath,
    do_not_use: entry.doNotUse,
    suggested_tool: suggestedTool,
    step_mode: usePrepareNow ? 'prepare_now' : 'one_field_at_a_time',
    prepare_now_reason: prepareNow.reason,
    next_question_field: usePrepareNow ? null : nextQuestionField?.key ?? null,
    next_question: usePrepareNow ? null : nextQuestion,
    interaction_hint: usePrepareNow ? null : interactionHint,
    silent_drafts:
      Object.keys(silentDrafts).length > 0 ? silentDrafts : undefined,
    effective_collected_fields: effectiveCollected,
    filled_fields: filledFields,
    remaining_field_order: orderedRemaining.map((field) => field.key),
    ready_to_publish: effectiveReadyToPublish && !formIncomplete,
    form_incomplete: formIncomplete,
    pending_prepare_all_fields: pendingPrepareAllFields,
    forbidden_reply_patterns: [
      'does that sound good',
      'does that work for you',
      'does that work',
      'shall I proceed',
      'does this sound good',
      'how about we title',
      'how about we call',
      ...PROPOSAL_DISCOVERY_NARRATION_FORBIDDEN,
      ...(formIncomplete ? PROPOSAL_PREMATURE_COMPLETE_FORBIDDEN : []),
    ],
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
        (hasAnyCollected || effectiveReadyToPublish || pendingPrepareAllFields),
      partial: !effectiveReadyToPublish,
      focus_field: syncFocusField,
      merge_collected_fields_into_proposal_fields: true,
      verify_with: 'get_proposal_form_state',
    },
    user_reply_rules:
      'Hand-holding: ONE field per turn in form order unless step_mode is prepare_now. On yes/sounds good/go ahead: that IS acceptance — call prepare_governance_proposal same turn; never ask again. FORBIDDEN after acceptance: "does that sound good", "shall I proceed", re-offering the same title/description. FORBIDDEN discovery narration: "It looks like I need to", "I now need to add" — act done ("I\'ve drafted", "I\'ll open the form"). If form_incomplete is true OR missing_on_screen is non-empty: NEVER say complete/ready/click Publish — fill next_missing_field via prepare. If the member says fields are empty, believe them. NEVER say ready/all set unless ready_to_publish is true AND form_state.form_synced is true.',
    walkthrough_hint:
      effectiveReadyToPublish && !formIncomplete
        ? 'Call get_proposal_form_state — if form_synced and ready_to_publish, prepare partial:false, then one sentence: click Publish.'
        : formIncomplete
        ? `FORM INCOMPLETE — missing ${JSON.stringify(
            formState?.missing_on_screen ?? [],
          )}. Call prepare partial:true for next_missing_field only. FORBIDDEN: complete, click Publish.`
        : usePrepareNow && prepareNowHint
        ? prepareNowHint
        : prepareNow.hint
        ? prepareNow.hint
        : [titleOnlyOpenHint, singleFieldHint, interactionHint]
            .filter(Boolean)
            .join(' '),
  };
}
