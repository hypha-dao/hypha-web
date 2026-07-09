import { decodeFunctionData, type Hex } from 'viem';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';

const spaceFactoryAddresses = new Set<string>(
  Object.values(daoSpaceFactoryImplementationAddress).map((address) =>
    address.toLowerCase(),
  ),
);

/**
 * Detects a join-request ("Invite") proposal from a `ProposalCreated` event.
 *
 * When a user requests to join an invite-only space, the proposal is created
 * on-chain by `DAOSpaceFactory.joinSpace()`, which wraps an
 * `addMember(spaceId, memberAddress)` call. In that case the event's `creator`
 * is the space factory contract (not the requester), so the requester can only
 * be recovered by decoding the event's `executionData`.
 *
 * Returns the requester's wallet address, or `null` when the event is not a
 * join-request proposal.
 */
export function decodeJoinRequestProposal({
  creator,
  executionData,
}: {
  creator: string;
  executionData: Hex | undefined;
}): `0x${string}` | null {
  if (!spaceFactoryAddresses.has(creator.toLowerCase())) {
    return null;
  }
  if (!executionData || executionData === '0x') {
    return null;
  }

  try {
    const { functionName, args } = decodeFunctionData({
      abi: daoSpaceFactoryImplementationAbi,
      data: executionData,
    });
    if (functionName !== 'addMember') {
      return null;
    }

    const [, memberAddress] = args;

    return memberAddress ?? null;
  } catch {
    return null;
  }
}
