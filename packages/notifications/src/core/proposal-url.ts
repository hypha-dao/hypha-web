import { getAbsoluteAppUrl } from '@hypha-platform/core/server';

/**
 * Link target of proposal notification emails: the proposal page when its slug is known, else the
 * space's agreements list. A freshly created proposal may not have its database row yet when the
 * `ProposalCreated` webhook fires (join requests never do — the factory creates them on-chain), so
 * the list is the safe landing. Defaults to `en` like the other server-built links. `undefined`
 * without a space slug (nothing sensible to link to).
 */
export function buildProposalUrl({
  spaceSlug,
  proposalSlug,
}: {
  spaceSlug?: string | null;
  proposalSlug?: string | null;
}): string | undefined {
  if (!spaceSlug) return undefined;
  const base = `/en/dho/${spaceSlug}/agreements`;
  return getAbsoluteAppUrl(
    proposalSlug ? `${base}/proposal/${proposalSlug}` : base,
  );
}
