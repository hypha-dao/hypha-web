/** Matches `schemaCreateProposalChangeVotingMethod` and agreement create forms. */
export const PROPOSAL_TITLE_MAX_LENGTH = 50;

export function truncateProposalTitle(
  title: string | null | undefined,
  maxLength: number = PROPOSAL_TITLE_MAX_LENGTH,
): string {
  const trimmed = title?.trim() ?? '';
  if (trimmed.length <= maxLength) return trimmed;
  if (maxLength <= 3) return trimmed.slice(0, maxLength);
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}
