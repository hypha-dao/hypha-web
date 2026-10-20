export type NetworkCensusAttachment = {
  memberCount?: number;
  memberAddresses?: `0x${string}`[];
  documentCount?: number;
};

/**
 * Attaches on-chain census figures onto directory spaces.
 *
 * A successful chain read with no members sets `memberCount: 0`, which
 * `isSpaceArchived` drops from the network page — the same rule as live.
 * A missing read does not: that used to archive every space when the count
 * source failed. Agreement totals are accepted proposal counts.
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
    if (web3SpaceId == null) {
      return { ...space, memberCount: 0 };
    }

    const members = membersByWeb3Id.get(web3SpaceId);
    const agreements = agreementsByWeb3Id.get(web3SpaceId);
    const hasMembers = members != null && members.length > 0;
    const confirmedEmpty = members != null && members.length === 0;

    return {
      ...space,
      ...(hasMembers
        ? {
            memberCount: members.length,
            memberAddresses: [...members],
          }
        : confirmedEmpty
        ? { memberCount: 0 }
        : {}),
      ...(agreements != null ? { documentCount: agreements } : {}),
    };
  });
}
