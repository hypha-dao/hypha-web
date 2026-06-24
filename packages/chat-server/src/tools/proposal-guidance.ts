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

export type { ProposalGuidancePlaybook };
export type ProposalGuidanceField =
  ProposalGuidancePlaybook['required_fields'][number];

export { buildProposalGuidancePromptLines };

function buildNextProposalQuestion(field: CatalogDiscoveryField): string {
  switch (field.key) {
    case 'voting_method':
      return 'Propose how this space should make decisions (one person one vote, voice-weighted, or token-weighted) with a brief why — ask if that fits. Never say "voting method" or list 1m1v/1v1v/1t1v codes unless confirming.';
    case 'entry_method':
      return 'Propose how people should join using Open Access, Invite Request, or Token Based (exact card titles) with a brief why — ask if that works. Never say invite-only, request access, or token-based entry. Never say "entry method".';
    case 'title':
      return 'Draft a short name for this proposal from context and offer it conversationally — never say title or proposal title.';
    case 'description':
      return 'Draft a one-sentence rationale from context and offer it naturally — never say "description".';
    case 'space_discoverability':
    case 'space_activity_access':
      return (
        field.description?.trim() ??
        'Propose discoverability or activity access levels with a brief why; ask if that works.'
      );
    case 'quorum_percent':
      return 'Propose minimum participation as a percentage (e.g. 30%) from space context — ask if that fits. Never say "quorum".';
    case 'unity_percent':
      return 'Propose minimum alignment as a percentage (e.g. 80%) — ask if that fits. Never say "unity".';
    case 'auto_execution':
      return 'Propose whether proposals should auto-execute when voting conditions are met (yes = auto, no = fixed minimum voting period). Ask which they prefer.';
    case 'voting_duration_seconds':
      return 'Propose a minimum voting period in plain language (e.g. 3 days) — ask if that works. Convert to seconds when calling prepare_governance_proposal (259200 = 3 days).';
    default:
      break;
  }
  if (field.description?.trim()) {
    return field.description.trim();
  }
  if (field.enumValues?.length) {
    return `Recommend the best fit for this space with a brief why, then ask the user to confirm or choose another.`;
  }
  return `Propose a sensible value from context and ask the user to confirm or adjust — never use the label "${field.label}" verbatim.`;
}

function buildInteractionHint(field: CatalogDiscoveryField): string {
  const base =
    'ONE short reply only: your recommendation or draft + one reaction ask. No recap, no summary of prior steps, no validation checklist. Never list field names (Title, Description, Quorum). Voice: 2 sentences max.';
  const acceptanceRule =
    ' When the user accepts (yes, sounds good, go ahead, or names the option), call prepare_governance_proposal in the SAME turn — never ask "shall I proceed" again.';
  if (field.key === 'title' || field.key === 'description') {
    return `${base} Offer drafted copy from context; user says yes/tweak/no.${acceptanceRule}`;
  }
  if (field.enumValues?.length) {
    return `${base} Recommend one option with brief why; user confirms or redirects.${acceptanceRule}`;
  }
  return `${base} Propose a default when sensible.${acceptanceRule}`;
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
}) {
  const entry = getProposalCatalogEntry(args.proposalType);
  if (!entry) {
    return {
      ok: false as const,
      error: `Unknown proposal type: ${args.proposalType}`,
    };
  }

  const collected = args.collectedFields ?? {};
  const orderedRequired = orderFieldsForDiscovery(entry.requiredFields);

  const remainingRequired = orderedRequired.filter(
    (field) => !hasCollectedValue(collected, field),
  );

  const remainingDecisionRequired = remainingRequired.filter(
    (field) => field.key !== 'title' && field.key !== 'description',
  );
  const remainingTitleDescription = remainingRequired.filter(
    (field) => field.key === 'title' || field.key === 'description',
  );

  const optionalPrompts = orderFieldsForDiscovery(
    pickOptionalDiscoveryPrompts(entry, collected).filter((field) => {
      if (field.key !== 'voting_duration_seconds') return true;
      return collected.auto_execution === false;
    }),
  );
  const nextQuestionField =
    remainingDecisionRequired[0] ??
    optionalPrompts[0] ??
    remainingTitleDescription[0] ??
    undefined;
  const nextQuestion = nextQuestionField
    ? buildNextProposalQuestion(nextQuestionField)
    : null;
  const interactionHint = nextQuestionField
    ? buildInteractionHint(nextQuestionField)
    : null;

  const hasSubstantiveCollected = orderedRequired.some(
    (field) =>
      field.key !== 'title' &&
      field.key !== 'description' &&
      hasCollectedValue(collected, field),
  );

  const readyToPublish = remainingRequired.length === 0;

  const suggestedTool =
    entry.prepareStrategy === 'prepare_governance_proposal'
      ? 'prepare_governance_proposal'
      : entry.prepareStrategy === 'create_space_setup_proposal'
      ? 'create_space_setup_proposal'
      : 'mcp_navigation';

  const syncFocusField =
    nextQuestionField?.key ??
    remainingDecisionRequired[0]?.key ??
    optionalPrompts[0]?.key ??
    remainingTitleDescription[0]?.key ??
    orderedRequired[0]?.key;

  return {
    ok: true as const,
    proposal_type: entry.key,
    document_label: entry.documentLabel,
    create_path: entry.createPath,
    do_not_use: entry.doNotUse,
    suggested_tool: suggestedTool,
    next_question_field: nextQuestionField?.key ?? null,
    next_question: nextQuestion,
    interaction_hint: interactionHint,
    ready_to_publish: readyToPublish,
    form_sync: {
      call_prepare_governance_proposal:
        entry.prepareStrategy === 'prepare_governance_proposal' &&
        (hasSubstantiveCollected || readyToPublish),
      partial: !readyToPublish,
      focus_field: syncFocusField,
      merge_collected_fields_into_proposal_fields: true,
    },
    user_reply_rules:
      'Never output numbered lists, field labels (Title, Description, Quorum), or multi-field checklists. Never use create_space_setup_proposal or collective_agreement for typed proposals — use prepare_governance_proposal with the correct proposal_type. After each user reaction: update collected_fields, call form_sync when true in the SAME turn — never ask again if they already accepted. Never loop with "shall I proceed" or "does this sound good" after yes.',
    walkthrough_hint: readyToPublish
      ? 'Required fields complete. Call prepare_governance_proposal (partial: false, focus_field: publish) to scroll to Publish. Tell the user briefly the form is ready — one short sentence.'
      : `${interactionHint} After the user reacts with yes/acceptance, call prepare_governance_proposal with partial: true, ALL collected proposal_fields merged (never drop earlier answers), focus_field for the section being discussed, and include title/description only after those steps are reached. Stay on the same open form — do not reopen. Then ask ONLY next_question for the NEXT field.`,
  };
}
