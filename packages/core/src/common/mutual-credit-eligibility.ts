/**
 * On-chain mutual-credit eligibility (`RegularSpaceToken._isCreditEligible`):
 * address whitelist OR membership in a credit-whitelisted space.
 *
 * `creditLimitOf` already returns 0 when the account is not eligible, so a
 * positive `creditLimit` is also sufficient — including any future eligibility
 * path the contract adds.
 */
export function isMutualCreditEligible(input: {
  addressWhitelisted?: boolean;
  creditLimit?: number;
  whitelistedSpaceIds?: readonly number[];
  memberWeb3SpaceIds?: Iterable<number>;
}): boolean {
  if (input.addressWhitelisted) return true;
  if (typeof input.creditLimit === 'number' && input.creditLimit > 0) {
    return true;
  }

  const spaceIds = input.whitelistedSpaceIds;
  if (!spaceIds?.length || !input.memberWeb3SpaceIds) return false;

  const memberSet =
    input.memberWeb3SpaceIds instanceof Set
      ? input.memberWeb3SpaceIds
      : new Set(input.memberWeb3SpaceIds);

  return spaceIds.some((id) => memberSet.has(id));
}
