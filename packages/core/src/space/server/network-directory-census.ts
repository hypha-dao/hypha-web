/**
 * One space after a chain read.
 * `memberCount` and `documentCount` stay null when that call failed, so the
 * space is kept rather than treated as empty.
 */
export type DirectoryCensusRow = {
  web3SpaceId: number;
  memberCount: number | null;
  memberAddresses: `0x${string}`[];
  documentCount: number | null;
  creatorAddress: string | null;
};

function memberAddressesFrom(result: unknown): `0x${string}`[] {
  if (!Array.isArray(result) || result.length < 5) return [];
  const members = result[4];
  if (!Array.isArray(members)) return [];
  return members.flatMap((value) => {
    if (typeof value !== 'string') return [];
    const address = value.toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(address) ? [address as `0x${string}`] : [];
  });
}

function acceptedCountFrom(result: unknown): number | null {
  if (!Array.isArray(result) || result.length < 1) return null;
  const accepted = result[0];
  return Array.isArray(accepted) ? accepted.length : null;
}

/** Creator is the 9th getSpaceDetails field. A zero address is not a person. */
function creatorAddressFrom(result: unknown): string | null {
  if (!Array.isArray(result) || result.length < 9) return null;
  const creator = result[8];
  if (typeof creator !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(creator)) {
    return null;
  }
  if (creator.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  return creator;
}

export function directoryCensusFromCalls(
  web3SpaceId: number,
  details: { status?: string; result?: unknown } | undefined,
  proposals: { status?: string; result?: unknown } | undefined,
): DirectoryCensusRow {
  const detailsOk = details?.status === 'success';
  const members = detailsOk ? memberAddressesFrom(details?.result) : [];
  return {
    web3SpaceId,
    memberCount: detailsOk ? members.length : null,
    memberAddresses: detailsOk && members.length > 0 ? members : [],
    documentCount:
      proposals?.status === 'success'
        ? acceptedCountFrom(proposals.result)
        : null,
    creatorAddress: detailsOk ? creatorAddressFrom(details?.result) : null,
  };
}

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
