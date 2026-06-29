import type { DbToken } from '../common/types';

export type IssueTokenDuplicateCheckOptions = {
  spaceId: number;
  name: string;
  symbol: string;
  rejectedProposalIds: ReadonlySet<number>;
  withdrawnProposalIds: ReadonlySet<number>;
};

const matchesNameAndSymbol = (
  token: DbToken,
  name: string,
  symbol: string,
): boolean =>
  token.name?.toLowerCase() === name.toLowerCase() &&
  token.symbol?.toLowerCase() === symbol.toLowerCase();

const isRejectedOrWithdrawnDraft = (
  token: DbToken,
  rejectedProposalIds: ReadonlySet<number>,
  withdrawnProposalIds: ReadonlySet<number>,
): boolean => {
  const proposalId = token.agreementWeb3Id;
  if (proposalId == null) {
    return false;
  }
  return (
    rejectedProposalIds.has(proposalId) || withdrawnProposalIds.has(proposalId)
  );
};

/**
 * Returns true when an existing DB token should block creating another issue-token
 * proposal with the same name and symbol in the same space.
 *
 * Deployed tokens always block. Undeployed draft rows from rejected or withdrawn
 * proposals do not — those records can remain after client-side cleanup misses.
 */
export const isBlockingDuplicateIssueToken = (
  token: DbToken,
  {
    spaceId,
    name,
    symbol,
    rejectedProposalIds,
    withdrawnProposalIds,
  }: IssueTokenDuplicateCheckOptions,
): boolean => {
  if (token.spaceId !== spaceId) {
    return false;
  }
  if (!matchesNameAndSymbol(token, name, symbol)) {
    return false;
  }
  if (token.address) {
    return true;
  }
  if (
    isRejectedOrWithdrawnDraft(token, rejectedProposalIds, withdrawnProposalIds)
  ) {
    return false;
  }
  return true;
};

export const findBlockingDuplicateIssueToken = (
  tokens: DbToken[] | undefined,
  options: IssueTokenDuplicateCheckOptions,
): DbToken | undefined =>
  tokens?.find((token) => isBlockingDuplicateIssueToken(token, options));
