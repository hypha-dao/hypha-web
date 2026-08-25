import {
  fetchSpaceProposalsIds,
  getProposalDetails,
  getWithdrawnProposalsBySpace,
  publicClient,
} from '@hypha-platform/core/client';
import {
  toProposalIdSet,
  type ProposalLiveness,
  type ProposalOutcomeLookup,
} from './home-activity';

export async function fetchOutcomesBySpaceId(
  web3SpaceIds: number[],
): Promise<Map<number, ProposalOutcomeLookup>> {
  const uniqueIds = [
    ...new Set(web3SpaceIds.filter((id) => Number.isFinite(id))),
  ];
  const map = new Map<number, ProposalOutcomeLookup>();
  if (uniqueIds.length === 0) return map;

  try {
    const [outcomes, withdrawnPages] = await Promise.all([
      fetchSpaceProposalsIds({
        spaceIds: uniqueIds.map((id) => BigInt(id)),
        allowFailure: true,
      }),
      publicClient.multicall({
        allowFailure: true,
        blockTag: 'safe',
        contracts: uniqueIds.map((id) =>
          getWithdrawnProposalsBySpace({ spaceId: BigInt(id) }),
        ),
      }),
    ]);

    const outcomesBySpace = new Map(
      outcomes.map((row) => [Number(row.spaceId), row]),
    );

    uniqueIds.forEach((spaceId, index) => {
      const row = outcomesBySpace.get(spaceId);
      const withdrawnResult = withdrawnPages[index];
      const withdrawn =
        withdrawnResult?.status === 'success' && withdrawnResult.result
          ? withdrawnResult.result
          : [];
      map.set(spaceId, {
        accepted: toProposalIdSet(row?.accepted),
        rejected: toProposalIdSet(row?.rejected),
        withdrawn: toProposalIdSet(withdrawn),
      });
    });
  } catch {
    return map;
  }

  return map;
}

export async function fetchProposalLiveness(
  proposalIds: number[],
): Promise<Map<number, ProposalLiveness>> {
  const uniqueIds = [
    ...new Set(proposalIds.filter((id) => Number.isFinite(id))),
  ];
  const map = new Map<number, ProposalLiveness>();
  if (uniqueIds.length === 0) return map;

  try {
    const results = await publicClient.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: uniqueIds.map((id) =>
        getProposalDetails({ proposalId: BigInt(id) }),
      ),
    });

    uniqueIds.forEach((id, index) => {
      const result = results[index];
      if (result?.status !== 'success' || result.result == null) {
        map.set(id, { expired: true });
        return;
      }
      const [, , endTime, executed, expired] = result.result;
      map.set(id, {
        endTime: new Date(Number(endTime) * 1000),
        executed: Boolean(executed),
        expired: Boolean(expired),
      });
    });
  } catch {
    uniqueIds.forEach((id) => {
      map.set(id, { expired: true });
    });
  }

  return map;
}
