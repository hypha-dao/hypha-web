'use client';

export const ACTIVE_GOVERNANCE_PROPOSAL_SESSION_KEY =
  'hypha:active-governance-proposal-walkthrough:v1';

export type StoredActiveGovernanceProposal = {
  proposalType: string;
  collectedFields: Record<string, unknown>;
  formOpen?: boolean;
  spaceSlug?: string;
};

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

/** Map resubmit payload fields into catalog discovery keys for the AI walkthrough. */
export function collectedFieldsFromResubmitPayload(
  proposalType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  const title = readString(payload.title);
  const description = readString(payload.description);
  if (title) fields.title = title;
  if (description) fields.description = description;

  if (proposalType === 'change_voting_method') {
    const votingMethod = readString(payload.votingMethod);
    if (votingMethod) fields.voting_method = votingMethod;

    const quorumUnity = payload.quorumAndUnity as
      | Record<string, unknown>
      | undefined;
    const quorum = readNumber(quorumUnity?.quorum);
    const unity = readNumber(quorumUnity?.unity);
    if (quorum !== undefined) fields.quorum_percent = quorum;
    if (unity !== undefined) fields.unity_percent = unity;

    if (typeof payload.autoExecution === 'boolean') {
      fields.auto_execution = payload.autoExecution;
    }

    const duration = readNumber(payload.votingDuration);
    if (duration !== undefined) fields.voting_duration_seconds = duration;
  }

  if (proposalType === 'change_entry_method') {
    const entryMethod = payload.entryMethod;
    if (entryMethod === 0 || entryMethod === '0') {
      fields.entry_method = 'open_access';
    } else if (entryMethod === 1 || entryMethod === '1') {
      fields.entry_method = 'token_based';
    } else if (entryMethod === 2 || entryMethod === '2') {
      fields.entry_method = 'invite_only';
    }
  }

  const issueForm = payload.issueNewTokenForm as
    | Record<string, unknown>
    | undefined;
  if (issueForm && typeof issueForm === 'object') {
    const type = readString(issueForm.type);
    const name = readString(issueForm.name);
    const symbol = readString(issueForm.symbol);
    if (type) fields.token_type = type;
    if (name) fields.token_name = name;
    if (symbol) fields.token_symbol = symbol;
    const maxSupply = readNumber(issueForm.maxSupply);
    if (maxSupply !== undefined) fields.max_supply = maxSupply;
  }

  return fields;
}

export function readActiveGovernanceProposalSession(): StoredActiveGovernanceProposal | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_GOVERNANCE_PROPOSAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredActiveGovernanceProposal;
    if (!parsed?.proposalType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveGovernanceProposalSession(
  value: StoredActiveGovernanceProposal,
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    ACTIVE_GOVERNANCE_PROPOSAL_SESSION_KEY,
    JSON.stringify(value),
  );
}

export function clearActiveGovernanceProposalSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACTIVE_GOVERNANCE_PROPOSAL_SESSION_KEY);
}

export function mergeActiveGovernanceProposalFromPrepareOutput(args: {
  proposalType: string;
  resubmitPayload?: Record<string, unknown>;
  spaceSlug?: string;
}): void {
  const proposalType = args.proposalType.trim();
  if (!proposalType) return;

  const incoming = args.resubmitPayload
    ? collectedFieldsFromResubmitPayload(proposalType, args.resubmitPayload)
    : {};

  const prev = readActiveGovernanceProposalSession();
  const collectedFields = {
    ...(prev?.proposalType === proposalType ? prev.collectedFields : {}),
    ...incoming,
  };

  writeActiveGovernanceProposalSession({
    proposalType,
    collectedFields,
    formOpen: true,
    spaceSlug: args.spaceSlug?.trim() || prev?.spaceSlug,
  });
}
