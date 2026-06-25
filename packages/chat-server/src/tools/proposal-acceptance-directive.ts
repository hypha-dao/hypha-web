import type { AiCreatableProposalType } from './ai-proposal-types';
import type { ActiveProposalFormSnapshot } from './proposal-form-state';
import {
  inferVotingMethodFromConversation,
  isPlainConfirmationReply,
} from './onboarding-voting-method-inference';
import { getEntryMethodInferencePatterns } from '../locale-ui-labels';

const TITLE_OFFER_PATTERNS = [
  /(?:call(?:ing)?|title(?:\s+this)?(?:\s+proposal)?|name(?:\s+this)?(?:\s+proposal)?|suggest(?:ing)?)\s+(?:this\s+proposal\s+)?['"]([^'"]{3,120})['"]/i,
  /(?:how about (?:we )?(?:call|title)|title this proposal)\s+['"]([^'"]{3,120})['"]/i,
  /proposal\s+['"]([^'"]{3,120})['"]\s*[.?!]/i,
];

const ENTRY_METHOD_PATTERNS = getEntryMethodInferencePatterns();

const TOKEN_TYPE_PATTERNS: Record<string, RegExp> = {
  utility: /\butility token\b/i,
  credits: /\bcredits?\b/i,
  ownership: /\bownership token\b/i,
  voice: /\bvoice token\b/i,
  impact: /\bimpact token\b/i,
  community_currency: /\bcommunity currency\b/i,
};

const TEMPLATE_TO_PROPOSAL: Record<string, AiCreatableProposalType> = {
  'issue-new-token': 'issue_new_token',
  'change-voting-method': 'change_voting_method',
  'change-entry-method': 'change_entry_method',
  'space-settings-transparency': 'space_transparency',
};

export function extractOfferedProposalTitle(
  assistantText: string | null | undefined,
): string | null {
  if (!assistantText?.trim()) return null;
  for (const pattern of TITLE_OFFER_PATTERNS) {
    const match = assistantText.match(pattern);
    const title = match?.[1]?.trim();
    if (title && title.length >= 3) return title;
  }
  return null;
}

export function inferProposalTypeFromConversation(
  assistantText: string | null | undefined,
  userText: string | null | undefined,
): AiCreatableProposalType | null {
  const combined = `${assistantText ?? ''}\n${userText ?? ''}`.toLowerCase();
  if (
    /issue new token|create a (?:new )?token|issuing a token|new token for/i.test(
      combined,
    )
  ) {
    return 'issue_new_token';
  }
  if (
    /entry method|how people join|join your space|open access|invite request|token based|m[eé]thode d['']entr[eé]e|comment (?:rejoindre|rejoindre l['']espace)|acc[eè]s ouvert|m[eé]todo de entrada|c[oó]mo unirse|beitrittsmethode|zutritt|m[eé]thode d'acc[eè]s/i.test(
      combined,
    )
  ) {
    return 'change_entry_method';
  }
  if (
    /voting method|one member one vote|one voice|one token one vote|how decisions|m[eé]thode de vote|m[eé]todo de votaci[oó]n|abstimmungsmethode|one member|one voice one vote/i.test(
      combined,
    )
  ) {
    return 'change_voting_method';
  }
  if (/transparency|discoverability|activity access/i.test(combined)) {
    return 'space_transparency';
  }
  return null;
}

function inferEntryMethodFromText(
  text: string | null | undefined,
): string | undefined {
  if (!text?.trim()) return undefined;
  for (const [key, pattern] of Object.entries(ENTRY_METHOD_PATTERNS)) {
    if (pattern.test(text)) return key;
  }
  return undefined;
}

function inferRecommendedEntryMethod(
  text: string | null | undefined,
): string | undefined {
  if (!text?.trim()) return undefined;
  const recommendationMatch = text.match(
    /(?:recommend|recommande|suggest|sugg[eè]re|conseille|i(?:'d| would) suggest|je recommande|my recommendation|ma recommandation)[^.!?\n]{0,180}/i,
  );
  if (!recommendationMatch) return undefined;
  return inferEntryMethodFromText(recommendationMatch[0]);
}

function inferEntryMethodFromConversation(args: {
  userText: string | null | undefined;
  assistantText?: string | null | undefined;
}): string | undefined {
  const fromUser = inferEntryMethodFromText(args.userText);
  if (fromUser) return fromUser;
  if (!isPlainConfirmationReply(args.userText)) return undefined;
  return (
    inferRecommendedEntryMethod(args.assistantText) ??
    inferEntryMethodFromText(args.assistantText)
  );
}

function inferTokenTypeFromText(
  text: string | null | undefined,
): string | undefined {
  if (!text?.trim()) return undefined;
  for (const [key, pattern] of Object.entries(TOKEN_TYPE_PATTERNS)) {
    if (pattern.test(text)) return key;
  }
  return undefined;
}

function inferTokenTypeFromConversation(args: {
  userText: string | null | undefined;
  assistantText?: string | null | undefined;
}): string | undefined {
  const fromUser = inferTokenTypeFromText(args.userText);
  if (fromUser) return fromUser;
  if (!isPlainConfirmationReply(args.userText)) return undefined;
  return inferTokenTypeFromText(args.assistantText);
}

function normalizeProposalTitle(value: string): string {
  return value.replace(/\.$/, '').trim().toLowerCase();
}

function readTitleOnScreen(
  snapshot?: ActiveProposalFormSnapshot | null,
): string | undefined {
  const fromLive = snapshot?.liveFields?.title;
  const fromPayload = snapshot?.resubmitPayload?.title;
  if (typeof fromLive === 'string' && fromLive.trim()) return fromLive.trim();
  if (typeof fromPayload === 'string' && fromPayload.trim()) {
    return fromPayload.trim();
  }
  return undefined;
}

function resolveProposalType(args: {
  assistantText?: string | null;
  userText?: string | null;
  formSnapshot?: ActiveProposalFormSnapshot | null;
  explicitType?: AiCreatableProposalType | null;
}): AiCreatableProposalType | null {
  if (args.explicitType) return args.explicitType;
  const segment = args.formSnapshot?.templateSegment?.trim();
  if (segment && TEMPLATE_TO_PROPOSAL[segment]) {
    return TEMPLATE_TO_PROPOSAL[segment];
  }
  return inferProposalTypeFromConversation(args.assistantText, args.userText);
}

export function buildProposalAcceptanceDirective(args: {
  userText: string | null | undefined;
  assistantText?: string | null | undefined;
  spaceSlug?: string | null;
  formSnapshot?: ActiveProposalFormSnapshot | null;
  activeProposalType?: AiCreatableProposalType | null;
  collectedFields?: Record<string, unknown>;
}): string | null {
  if (!args.spaceSlug?.trim()) return null;
  if (!isPlainConfirmationReply(args.userText)) return null;

  const proposalType = resolveProposalType({
    assistantText: args.assistantText,
    userText: args.userText,
    formSnapshot: args.formSnapshot,
    explicitType: args.activeProposalType ?? null,
  });
  if (!proposalType) return null;

  const spaceSlug = args.spaceSlug.trim();
  const offeredTitle = extractOfferedProposalTitle(args.assistantText);
  const titleOnScreen = readTitleOnScreen(args.formSnapshot);
  const formIsOpen = Boolean(
    args.formSnapshot?.formOpen || args.formSnapshot?.resubmitPayload,
  );

  if (
    offeredTitle &&
    (!titleOnScreen ||
      normalizeProposalTitle(offeredTitle) !==
        normalizeProposalTitle(titleOnScreen)) &&
    !args.collectedFields?.title
  ) {
    return [
      'CRITICAL — user accepted the proposal title you offered in your last message. Do NOT ask "does that work" or re-offer the title.',
      `Call proposal_guidance(proposal_type: ${proposalType}, collected_fields: { title: ${JSON.stringify(
        offeredTitle,
      )} }) then prepare_governance_proposal partial:true in THIS turn (space_slug: "${spaceSlug}", title only) to OPEN the form.`,
      'One short sentence to the user — then continue with the next field on the form.',
    ].join(' ');
  }

  const entryMethod = inferEntryMethodFromConversation({
    userText: args.userText,
    assistantText: args.assistantText,
  });
  if (
    proposalType === 'change_entry_method' &&
    entryMethod &&
    !args.collectedFields?.entry_method
  ) {
    return [
      'CRITICAL — user accepted the entry method choice. Do NOT ask again.',
      `Call proposal_guidance(proposal_type: change_entry_method, collected_fields: { entry_method: "${entryMethod}" }) then prepare_governance_proposal partial:true in THIS turn (space_slug: "${spaceSlug}") with effective_collected_fields.`,
      'FORBIDDEN: "does that sound good", "shall I proceed", re-offering title/description.',
    ].join(' ');
  }

  const votingMethod = inferVotingMethodFromConversation({
    userText: args.userText,
    assistantText: args.assistantText,
  });
  if (
    proposalType === 'change_voting_method' &&
    votingMethod &&
    !args.collectedFields?.voting_method
  ) {
    return [
      'CRITICAL — user accepted the voting method choice. Do NOT ask again.',
      `Call proposal_guidance(proposal_type: change_voting_method, collected_fields: { voting_method: "${votingMethod}" }) then prepare_governance_proposal partial:true in THIS turn (space_slug: "${spaceSlug}") with effective_collected_fields.`,
      'FORBIDDEN: "does that sound good", "shall I proceed".',
    ].join(' ');
  }

  const tokenType = inferTokenTypeFromConversation({
    userText: args.userText,
    assistantText: args.assistantText,
  });
  if (
    proposalType === 'issue_new_token' &&
    tokenType &&
    !args.collectedFields?.token_type &&
    formIsOpen
  ) {
    return [
      'CRITICAL — user accepted the token type. Do NOT re-ask.',
      `Call proposal_guidance(proposal_type: issue_new_token, collected_fields merged with token_type: "${tokenType}") then prepare_governance_proposal partial:true in THIS turn (space_slug: "${spaceSlug}").`,
    ].join(' ');
  }

  return null;
}
