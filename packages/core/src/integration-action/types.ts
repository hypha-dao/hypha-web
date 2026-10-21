import type { IntegrationActionStatus as StoredStatus } from '@hypha-platform/storage-postgres';

export const INTEGRATION_ACTION_OPERATIONS = ['vote'] as const;
export type IntegrationActionOperation =
  (typeof INTEGRATION_ACTION_OPERATIONS)[number];

/** What a client reads: `expired` is derived from `expiresAt`, never stored. */
export type IntegrationActionStatus = StoredStatus | 'expired';

/** Lifetime of a prepared action. */
export const INTEGRATION_ACTION_TTL_SECONDS = 10 * 60;

/** Open actions one client may hold for one person. */
export const INTEGRATION_ACTION_MAX_PENDING = 5;

export type VoteActionParameters = {
  spaceSlug: string;
  proposalSlug: string;
  choice: 'yes' | 'no';
};

/** Resolved by the server when the action is prepared; the approval page shows it. */
export type VoteActionContext = {
  spaceTitle: string;
  proposalTitle: string;
  web3ProposalId: number;
};

export type IntegrationActionRecord = {
  id: string;
  clientId: number;
  personId: number;
  operation: IntegrationActionOperation;
  parameters: VoteActionParameters;
  context: VoteActionContext;
  status: StoredStatus;
  expiresAt: Date;
  resolvedAt: Date | null;
  txHash: string | null;
  createdAt: Date;
};

export function effectiveActionStatus(
  action: Pick<IntegrationActionRecord, 'status' | 'expiresAt'>,
  now: Date,
): IntegrationActionStatus {
  return action.status === 'pending' && action.expiresAt <= now
    ? 'expired'
    : action.status;
}

/**
 * The text the approval page shows. Built only from the stored row (the
 * parameters and the snapshot the server resolved), plus the calling client's
 * registered name. Nothing the client sent as free text can reach it.
 */
export function describeIntegrationAction(
  action: Pick<IntegrationActionRecord, 'operation' | 'parameters' | 'context'>,
  clientName: string,
): { headline: string; lines: { label: string; value: string }[] } {
  const { parameters, context } = action;
  const choice =
    parameters.choice === 'yes' ? 'Yes (in favour)' : 'No (against)';
  return {
    headline: `${clientName} asks you to vote ${parameters.choice.toUpperCase()} on a proposal`,
    lines: [
      { label: 'Application', value: clientName },
      { label: 'Space', value: context.spaceTitle },
      { label: 'Proposal', value: context.proposalTitle },
      { label: 'Your vote', value: choice },
    ],
  };
}

/** What the client sees about an action it prepared. */
export function toClientAction(action: IntegrationActionRecord, now: Date) {
  return {
    actionId: action.id,
    operation: action.operation,
    status: effectiveActionStatus(action, now),
    expiresAt: action.expiresAt.toISOString(),
    txHash: action.txHash,
  };
}

/** An action plus the registered name of the client that asked for it. */
export type IntegrationActionWithClient = IntegrationActionRecord & {
  clientName: string;
  /** The client's registered origins (`allowedOrigins`), as ops approved them. */
  clientOrigins: string[];
  /** The client's logo URL, only when the client is approved (see `visibleClientLogoUrl`); else null. */
  clientLogoUrl: string | null;
};
