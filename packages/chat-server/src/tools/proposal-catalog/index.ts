import type {
  CatalogDiscoveryField,
  PrepareGovernanceProposalInput,
  ProposalCatalogEntry,
} from './types';
import {
  PREPARE_GOVERNANCE_PROPOSAL_TYPES,
  PROPOSAL_CATALOG,
  PROPOSAL_CATALOG_KEYS,
} from './entries';
import { normalizeVotingDurationSeconds } from '../../voting-duration-options';

export * from './types';
export {
  PROPOSAL_CATALOG,
  PROPOSAL_CATALOG_KEYS,
  PREPARE_GOVERNANCE_PROPOSAL_TYPES,
} from './entries';

export type ProposalGuidancePlaybook = {
  proposal_type: string;
  document_label: string;
  create_path: string;
  summary: string;
  discovery_intro: string;
  required_fields: CatalogDiscoveryField[];
  optional_fields: CatalogDiscoveryField[];
  publish_flow: string;
  do_not_use: string[];
  prepare_strategy: ProposalCatalogEntry['prepareStrategy'];
  focus_sections: string[];
};

export function getProposalCatalogEntry(
  proposalType: string,
): ProposalCatalogEntry | undefined {
  return PROPOSAL_CATALOG[proposalType];
}

export function listProposalCatalogEntries(): ProposalCatalogEntry[] {
  return PROPOSAL_CATALOG_KEYS.map((key) => PROPOSAL_CATALOG[key]!);
}

export function catalogEntryToPlaybook(
  entry: ProposalCatalogEntry,
): ProposalGuidancePlaybook {
  const focusSections = [...entry.requiredFields, ...entry.optionalFields]
    .map((f) => f.formSection)
    .filter((s): s is string => Boolean(s));

  return {
    proposal_type: entry.key,
    document_label: entry.documentLabel,
    create_path: entry.createPath,
    summary: entry.summary,
    discovery_intro: entry.discoveryIntro,
    required_fields: entry.requiredFields,
    optional_fields: entry.optionalFields,
    publish_flow:
      entry.prepareStrategy === 'prepare_governance_proposal'
        ? 'Call prepare_governance_proposal after discovery. Form opens pre-filled; member clicks Publish.'
        : entry.prepareStrategy === 'create_space_setup_proposal'
        ? 'Call create_space_setup_proposal after confirmation (collective agreements only).'
        : 'Use mcp_navigation to the create form.',
    do_not_use: entry.doNotUse,
    prepare_strategy: entry.prepareStrategy,
    focus_sections: [...new Set(focusSections)],
  };
}

export function buildProposalGuidancePromptLines(): string {
  return PREPARE_GOVERNANCE_PROPOSAL_TYPES.map((key) => {
    const entry = PROPOSAL_CATALOG[key]!;
    const required = entry.requiredFields.map((f) => f.key).join(', ');
    return `- ${key}: ${entry.documentLabel} — one question at a time via proposal_guidance(collected_fields) → prepare_governance_proposal → Publish`;
  }).join('\n');
}

function buildProposalFormHref(
  lang: string,
  spaceSlug: string,
  createPath: string,
): string {
  const marker = 'agreements/create/';
  const idx = createPath.indexOf(marker);
  const segment = idx === -1 ? '' : createPath.slice(idx + marker.length);
  return segment
    ? `/${lang}/dho/${spaceSlug}/agreements/create/${segment}`
    : `/${lang}/dho/${spaceSlug}/agreements/create`;
}

function mapEntryMethodToNumeric(method: string): number {
  switch (method) {
    case 'open_access':
      return 0;
    case 'token_based':
      return 1;
    case 'invite_only':
    default:
      return 2;
  }
}

export function validatePrepareInput(
  entry: ProposalCatalogEntry,
  input: PrepareGovernanceProposalInput,
): string | null {
  const fields = input.proposal_fields ?? {};

  for (const field of entry.requiredFields) {
    if (field.key === 'title' || field.key === 'description') continue;
    const value = fields[field.key];
    if (value === undefined || value === null || value === '') {
      return `${field.key} is required for ${entry.key}. ${field.description}`;
    }
  }

  if (
    entry.key === 'change_voting_method' &&
    fields.auto_execution === false &&
    !fields.voting_duration_seconds
  ) {
    return 'voting_duration_seconds is required when auto_execution is false.';
  }

  if (entry.key === 'issue_new_token') {
    const tokenForm = buildIssueNewTokenFormFromFields(fields);
    if (!tokenForm?.type) {
      return 'token_type is required for issue_new_token.';
    }
    if (!tokenForm.name) {
      return 'token_name is required for issue_new_token.';
    }
    if (!tokenForm.symbol) {
      return 'token_symbol is required for issue_new_token.';
    }
  }

  return null;
}

function buildIssueNewTokenFormFromFields(
  fields: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const form: Record<string, unknown> = {};
  if (fields.token_type !== undefined) form.type = fields.token_type;
  if (fields.token_name !== undefined) form.name = fields.token_name;
  if (fields.token_symbol !== undefined) form.symbol = fields.token_symbol;
  if (fields.token_icon_url !== undefined) form.iconUrl = fields.token_icon_url;
  if (fields.max_supply !== undefined) {
    const supply = Number(fields.max_supply);
    if (Number.isFinite(supply)) {
      form.maxSupply = supply;
      form.enableLimitedSupply = supply > 0;
    }
  }
  return Object.keys(form).length > 0 ? form : undefined;
}

export function buildResubmitPayload(
  entry: ProposalCatalogEntry,
  input: PrepareGovernanceProposalInput,
  options?: { isPartial?: boolean },
): Record<string, unknown> {
  const fields = input.proposal_fields ?? {};
  const isPartial = options?.isPartial === true;
  const payload: Record<string, unknown> = {
    resubmitTemplateSegment: entry.templateSegment,
    label: entry.documentLabel,
  };

  const title = input.title?.trim();
  const description = input.description?.trim();
  if (title && (!isPartial || title !== PARTIAL_PREPARE_DRAFT_TITLE)) {
    payload.title = title;
  }
  if (
    description &&
    (!isPartial || description !== PARTIAL_PREPARE_DRAFT_DESCRIPTION)
  ) {
    payload.description = description;
  }

  if (
    fields.auto_execution !== undefined ||
    input.auto_execution !== undefined
  ) {
    payload.autoExecution = fields.auto_execution ?? input.auto_execution;
  }

  if (entry.key === 'change_voting_method') {
    if (fields.voting_method !== undefined) {
      payload.votingMethod = fields.voting_method;
    }
    if (
      fields.quorum_percent !== undefined ||
      fields.unity_percent !== undefined
    ) {
      payload.quorumAndUnity = {
        ...(fields.quorum_percent !== undefined
          ? { quorum: fields.quorum_percent }
          : {}),
        ...(fields.unity_percent !== undefined
          ? { unity: fields.unity_percent }
          : {}),
      };
    }
    if (fields.voting_duration_seconds !== undefined) {
      payload.votingDuration = normalizeVotingDurationSeconds(
        Number(fields.voting_duration_seconds),
      );
    }
  }

  if (entry.key === 'change_entry_method') {
    if (fields.entry_method !== undefined) {
      payload.entryMethod = mapEntryMethodToNumeric(
        String(fields.entry_method),
      );
    }
    if (fields.token_address) {
      payload.tokenBase = fields.token_address;
    }
  }

  if (entry.key === 'space_transparency') {
    if (fields.space_discoverability !== undefined) {
      payload.spaceDiscoverability = fields.space_discoverability;
    }
    if (fields.space_activity_access !== undefined) {
      payload.spaceActivityAccess = fields.space_activity_access;
    }
  }

  if (fields.propose_contribution_form !== undefined) {
    payload.proposeContributionForm = fields.propose_contribution_form;
  }
  if (fields.pay_for_expenses_form !== undefined) {
    payload.payForExpensesForm = fields.pay_for_expenses_form;
  }
  if (fields.deploy_funds_form !== undefined) {
    payload.deployFundsForm = fields.deploy_funds_form;
  }
  if (fields.issue_new_token_form !== undefined) {
    payload.issueNewTokenForm = fields.issue_new_token_form;
  }
  if (entry.key === 'issue_new_token') {
    const tokenForm = buildIssueNewTokenFormFromFields(fields);
    if (tokenForm && Object.keys(tokenForm).length > 0) {
      payload.issueNewTokenForm = {
        ...(typeof payload.issueNewTokenForm === 'object' &&
        payload.issueNewTokenForm !== null
          ? (payload.issueNewTokenForm as Record<string, unknown>)
          : {}),
        ...tokenForm,
      };
    }
  }
  if (fields.space_token_purchase_form !== undefined) {
    payload.spaceTokenPurchaseForm = fields.space_token_purchase_form;
  }
  if (fields.buy_hypha_tokens_form !== undefined) {
    payload.buyHyphaTokensForm = fields.buy_hypha_tokens_form;
  }
  if (fields.token_backing_vault !== undefined) {
    payload.tokenBackingVault = fields.token_backing_vault;
  }
  if (fields.redeem_resubmit !== undefined) {
    payload.redeemResubmit = fields.redeem_resubmit;
  }
  if (fields.mint !== undefined) {
    payload.mint = fields.mint;
  }
  if (fields.token_burning !== undefined) {
    payload.tokenBurning = fields.token_burning;
  }
  if (fields.members !== undefined) {
    payload.members = fields.members;
  }
  if (fields.recipient !== undefined) {
    payload.recipient = fields.recipient;
  }
  if (fields.investor_send_legs !== undefined) {
    payload.investorSendLegs = fields.investor_send_legs;
  }
  if (fields.space_receive_legs !== undefined) {
    payload.spaceReceiveLegs = fields.space_receive_legs;
  }
  if (fields.space_to_space_target_address !== undefined) {
    payload.spaceToSpaceTargetAddress = fields.space_to_space_target_address;
  }
  if (fields.space_to_space_member_address !== undefined) {
    payload.spaceToSpaceMemberAddress = fields.space_to_space_member_address;
  }
  if (fields.change_delegate_target_address !== undefined) {
    payload.changeDelegateTargetAddress = fields.change_delegate_target_address;
  }
  if (fields.change_delegate_member_address !== undefined) {
    payload.changeDelegateMemberAddress = fields.change_delegate_member_address;
  }
  if (fields.update_issued_token_resubmit_payload !== undefined) {
    payload.updateIssuedTokenResubmitPayload =
      fields.update_issued_token_resubmit_payload;
  }

  return payload;
}

export function buildPrepareNavigation(args: {
  entry: ProposalCatalogEntry;
  lang: string;
  spaceSlug: string;
  focusField?: string;
}): {
  kind: 'internal';
  href: string;
  open_agreements_form: true;
  label: string;
  focus_field?: string;
  focus_section?: string;
} {
  const playbook = catalogEntryToPlaybook(args.entry);
  const focusField = args.focusField?.trim();
  const focusSection = focusField
    ? [...args.entry.requiredFields, ...args.entry.optionalFields].find(
        (f) => f.key === focusField,
      )?.formSection
    : playbook.focus_sections[0];

  return {
    kind: 'internal',
    href: buildProposalFormHref(
      args.lang,
      args.spaceSlug,
      args.entry.createPath,
    ),
    open_agreements_form: true,
    label: args.entry.documentLabel,
    ...(focusField ? { focus_field: focusField } : {}),
    ...(focusSection ? { focus_section: focusSection } : {}),
  };
}

export function mergeLegacyPrepareFields(
  input: PrepareGovernanceProposalInput,
): PrepareGovernanceProposalInput {
  const fields = { ...(input.proposal_fields ?? {}) };

  // Back-compat: top-level fields from early prepare_governance_proposal API.
  const legacy = input as PrepareGovernanceProposalInput &
    Record<string, unknown>;
  const legacyMap: Record<string, string> = {
    voting_method: 'voting_method',
    quorum_percent: 'quorum_percent',
    unity_percent: 'unity_percent',
    voting_duration_seconds: 'voting_duration_seconds',
    entry_method: 'entry_method',
    token_address: 'token_address',
    space_discoverability: 'space_discoverability',
    space_activity_access: 'space_activity_access',
    auto_execution: 'auto_execution',
  };
  for (const [legacyKey, fieldKey] of Object.entries(legacyMap)) {
    if (legacy[legacyKey] !== undefined && fields[fieldKey] === undefined) {
      fields[fieldKey] = legacy[legacyKey];
    }
  }

  return { ...input, proposal_fields: fields };
}

export function pickOptionalDiscoveryPrompts(
  entry: ProposalCatalogEntry,
  collectedFields: Record<string, unknown>,
): CatalogDiscoveryField[] {
  /** Advanced or governance-only — fill from form defaults in prepare; skip chat. */
  const deferToForm = new Set([
    'max_supply',
    'quorum_percent',
    'unity_percent',
    'auto_execution',
    'voting_duration_seconds',
  ]);

  return entry.optionalFields.filter((field) => {
    if (deferToForm.has(field.key)) return false;
    return (
      field.required === false &&
      collectedFields[field.key] === undefined &&
      field.key !== 'title' &&
      field.key !== 'description'
    );
  });
}

/** Form order: title and description first, then body fields top-to-bottom. */
const DISCOVERY_FIELD_ORDER: Record<string, number> = {
  title: 1,
  description: 2,
  token_type: 10,
  token_name: 11,
  token_symbol: 12,
  token_icon_url: 13,
  max_supply: 14,
  quorum_percent: 15,
  unity_percent: 16,
  auto_execution: 17,
  voting_duration_seconds: 18,
  voting_method: 19,
  entry_method: 19,
  space_discoverability: 20,
  space_activity_access: 21,
  token_address: 22,
};

export function orderFieldsForDiscovery(
  fields: CatalogDiscoveryField[],
): CatalogDiscoveryField[] {
  return [...fields].sort(
    (a, b) =>
      (DISCOVERY_FIELD_ORDER[a.key] ?? 50) -
      (DISCOVERY_FIELD_ORDER[b.key] ?? 50),
  );
}

export const PARTIAL_PREPARE_DRAFT_TITLE = 'Governance proposal';
export const PARTIAL_PREPARE_DRAFT_DESCRIPTION =
  'Prepared with Hypha AI — review and edit on the form before publishing.';
