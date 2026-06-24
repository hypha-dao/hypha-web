import type { AiCreatableProposalType } from './ai-proposal-types';
import {
  getProposalCatalogEntry,
  orderFieldsForDiscovery,
} from './proposal-catalog';
import type { CatalogDiscoveryField } from './proposal-catalog/types';

export type ActiveProposalFormSnapshot = {
  templateSegment?: string;
  formOpen?: boolean;
  resubmitPayload?: Record<string, unknown>;
  liveFields?: Record<string, unknown>;
};

const TEMPLATE_SEGMENT_TO_PROPOSAL_TYPE: Record<
  string,
  AiCreatableProposalType
> = {
  'issue-new-token': 'issue_new_token',
  'change-voting-method': 'change_voting_method',
  'change-entry-method': 'change_entry_method',
  'space-settings-transparency': 'space_transparency',
};

function mapEntryMethodFromNumeric(value: unknown): string | undefined {
  if (value === 0 || value === '0') return 'open_access';
  if (value === 1 || value === '1') return 'token_based';
  if (value === 2 || value === '2') return 'invite_only';
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function hasIconValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return true;
  return false;
}

/** Normalize resubmit / live form values into catalog field keys. */
export function extractCatalogFieldValues(args: {
  proposalType: AiCreatableProposalType;
  resubmitPayload?: Record<string, unknown>;
  liveFields?: Record<string, unknown>;
}): Record<string, unknown> {
  const payload = args.resubmitPayload ?? {};
  const live = args.liveFields ?? {};
  const issueForm =
    (live.issueNewTokenForm as Record<string, unknown> | undefined) ??
    (payload.issueNewTokenForm as Record<string, unknown> | undefined) ??
    {};

  const mergedLive = { ...issueForm, ...live };
  const values: Record<string, unknown> = {};

  const title =
    readString(live.title) ??
    readString(payload.title) ??
    readString(mergedLive.title);
  const description =
    readString(live.description) ??
    readString(payload.description) ??
    readString(mergedLive.description);
  if (title) values.title = title;
  if (description) values.description = description;

  if (args.proposalType === 'issue_new_token') {
    const type = readString(mergedLive.type) ?? readString(live.type);
    const name = readString(mergedLive.name) ?? readString(live.name);
    const symbol = readString(mergedLive.symbol) ?? readString(live.symbol);
    const iconUrl =
      readString(mergedLive.iconUrl) ??
      readString(live.iconUrl) ??
      readString(mergedLive.icon);
    const maxSupply =
      readNumber(mergedLive.maxSupply) ?? readNumber(live.maxSupply);

    if (type) values.token_type = type;
    if (name) values.token_name = name;
    if (symbol) values.token_symbol = symbol;
    if (iconUrl || hasIconValue(mergedLive.icon) || hasIconValue(live.icon)) {
      values.token_icon_url = iconUrl ?? 'uploaded';
    }
    if (maxSupply !== undefined) values.max_supply = maxSupply;
  }

  if (args.proposalType === 'change_voting_method') {
    const votingMethod =
      readString(live.votingMethod) ?? readString(payload.votingMethod);
    if (votingMethod) values.voting_method = votingMethod;

    const quorumUnity =
      (live.quorumAndUnity as Record<string, unknown> | undefined) ??
      (payload.quorumAndUnity as Record<string, unknown> | undefined);
    const quorum = readNumber(quorumUnity?.quorum);
    const unity = readNumber(quorumUnity?.unity);
    if (quorum !== undefined) values.quorum_percent = quorum;
    if (unity !== undefined) values.unity_percent = unity;

    const duration =
      readNumber(live.votingDuration) ?? readNumber(payload.votingDuration);
    if (duration !== undefined) values.voting_duration_seconds = duration;

    const autoExecution =
      typeof live.autoExecution === 'boolean'
        ? live.autoExecution
        : typeof payload.autoExecution === 'boolean'
        ? payload.autoExecution
        : undefined;
    if (autoExecution !== undefined) values.auto_execution = autoExecution;
  }

  if (args.proposalType === 'change_entry_method') {
    const entryMethod =
      mapEntryMethodFromNumeric(live.entryMethod) ??
      mapEntryMethodFromNumeric(payload.entryMethod);
    if (entryMethod) values.entry_method = entryMethod;
  }

  return values;
}

function inferProposalType(
  snapshot: ActiveProposalFormSnapshot,
  explicit?: AiCreatableProposalType,
): AiCreatableProposalType | null {
  if (explicit) return explicit;
  const segment = snapshot.templateSegment?.trim();
  if (segment && TEMPLATE_SEGMENT_TO_PROPOSAL_TYPE[segment]) {
    return TEMPLATE_SEGMENT_TO_PROPOSAL_TYPE[segment];
  }
  const label = readString(snapshot.resubmitPayload?.label);
  if (label === 'Issue New Token') return 'issue_new_token';
  if (label === 'Voting Method') return 'change_voting_method';
  if (label === 'Entry Method') return 'change_entry_method';
  return null;
}

function fieldHasValue(
  field: CatalogDiscoveryField,
  values: Record<string, unknown>,
): boolean {
  const value = values[field.key];
  if (value === undefined || value === null || value === '') return false;
  return true;
}

export function buildProposalFormStateResponse(args: {
  snapshot?: ActiveProposalFormSnapshot | null;
  proposalType?: AiCreatableProposalType;
  collectedFields?: Record<string, unknown>;
}) {
  const snapshot = args.snapshot;
  if (!snapshot?.formOpen && !snapshot?.resubmitPayload) {
    return {
      ok: true as const,
      form_open: false,
      message:
        'No governance proposal form is open. Ask for title first, then call prepare_governance_proposal to open the form.',
    };
  }

  const proposalType = inferProposalType(snapshot ?? {}, args.proposalType);
  if (!proposalType) {
    return {
      ok: false as const,
      error:
        'Could not infer proposal type from the open form. Pass proposal_type explicitly.',
    };
  }

  const entry = getProposalCatalogEntry(proposalType);
  if (!entry) {
    return {
      ok: false as const,
      error: `Unknown proposal type: ${proposalType}`,
    };
  }

  const onScreen = extractCatalogFieldValues({
    proposalType,
    resubmitPayload: snapshot?.resubmitPayload,
    liveFields: snapshot?.liveFields,
  });

  const collected = args.collectedFields ?? {};
  const requiredFields = orderFieldsForDiscovery(entry.requiredFields);

  const filledOnScreen = requiredFields
    .filter((field) => fieldHasValue(field, onScreen))
    .map((field) => field.key);

  const missingOnScreen = requiredFields
    .filter((field) => !fieldHasValue(field, onScreen))
    .map((field) => field.key);

  const collectedButNotOnScreen = Object.keys(collected).filter((key) => {
    const collectedValue = collected[key];
    if (
      collectedValue === undefined ||
      collectedValue === null ||
      collectedValue === ''
    ) {
      return false;
    }
    return !fieldHasValue({ key } as CatalogDiscoveryField, onScreen);
  });

  const formSynced =
    missingOnScreen.length === 0 && collectedButNotOnScreen.length === 0;

  const nextMissingOnScreen = missingOnScreen[0] ?? null;

  return {
    ok: true as const,
    form_open: snapshot?.formOpen !== false,
    proposal_type: proposalType,
    document_label: entry.documentLabel,
    template_segment: snapshot?.templateSegment ?? null,
    fields_on_screen: onScreen,
    filled_on_screen: filledOnScreen,
    missing_on_screen: missingOnScreen,
    next_missing_field: nextMissingOnScreen,
    collected_fields_claimed: collected,
    collected_but_not_on_screen: collectedButNotOnScreen,
    form_synced: formSynced,
    ready_to_publish:
      missingOnScreen.length === 0 &&
      (proposalType !== 'issue_new_token' ||
        fieldHasValue(
          { key: 'token_icon_url' } as CatalogDiscoveryField,
          onScreen,
        )),
    handoff_rules:
      'ONE field at a time: ask or suggest ONLY next_missing_field, on acceptance call prepare_governance_proposal partial:true with that single new value merged. NEVER say ready unless form_synced is true and ready_to_publish is true. If collected_but_not_on_screen is non-empty, call prepare again immediately — do not tell the user to publish.',
  };
}

export function buildProposalFormStateDirective(
  snapshot?: ActiveProposalFormSnapshot | null,
): string | null {
  if (!snapshot?.formOpen && !snapshot?.resubmitPayload) return null;
  const response = buildProposalFormStateResponse({ snapshot });
  if (!response.ok || !('fields_on_screen' in response)) return null;

  return [
    'OPEN PROPOSAL FORM STATE (authoritative — from the member screen):',
    `proposal_type=${response.proposal_type}`,
    `filled_on_screen=${JSON.stringify(response.filled_on_screen)}`,
    `missing_on_screen=${JSON.stringify(response.missing_on_screen)}`,
    `form_synced=${response.form_synced}`,
    `ready_to_publish=${response.ready_to_publish}`,
    response.collected_but_not_on_screen &&
    response.collected_but_not_on_screen.length > 0
      ? `SYNC ERROR — AI claimed ${JSON.stringify(
          response.collected_but_not_on_screen,
        )} but form is empty for those fields. Call prepare_governance_proposal again before continuing.`
      : 'Continue one field at a time — ask ONLY next_missing_field, fill via prepare, then move on.',
  ].join('\n');
}
