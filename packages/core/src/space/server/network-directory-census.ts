export type NetworkCensusAttachment = {
  memberCount?: number;
  memberAddresses?: `0x${string}`[];
  documentCount?: number;
};

/**
 * Attaches on-chain census figures onto directory spaces.
 *
 * `memberCount: 0` is treated as archived by `isSpaceArchived`, which hid the
 * whole directory when the count source was empty. A space whose chain read
 * returned no members stays listed; only a positive member list is attached.
 * Agreement totals are the accepted proposal counts. A missing chain read
 * leaves `documentCount` unset rather than claiming zero.
 */
export function attachNetworkCensusCounts<
  T extends { web3SpaceId?: number | null },
>(
  spaces: T[],
  membersByWeb3Id: ReadonlyMap<number, readonly `0x${string}`[]>,
  agreementsByWeb3Id: ReadonlyMap<number, number>,
): Array<T & NetworkCensusAttachment> {
  return spaces.map((space) => {
    const web3SpaceId = space.web3SpaceId;
    if (web3SpaceId == null) return space;

    const members = membersByWeb3Id.get(web3SpaceId);
    const agreements = agreementsByWeb3Id.get(web3SpaceId);
    const hasMembers = members != null && members.length > 0;

    return {
      ...space,
      ...(hasMembers
        ? {
            memberCount: members.length,
            memberAddresses: [...members],
          }
        : {}),
      ...(agreements != null ? { documentCount: agreements } : {}),
    };
  });
}
