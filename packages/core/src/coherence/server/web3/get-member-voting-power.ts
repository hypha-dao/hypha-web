import 'server-only';

import {
  tokenVotingPowerImplementationAddress,
  voteDecayTokenVotingPowerImplementationAddress,
} from '@hypha-platform/core/generated';
import { publicClient } from '../../../common/web3/public-client';
import { getSpaceDetails } from '../../../space/shared/web3/get-space-details';

/**
 * SpaceVotingPower (1 member = 1 vote) — voting power source id 2.
 * Not part of the wagmi-generated bindings; address from
 * packages/storage-evm/contracts/addresses.txt.
 */
const SPACE_VOTING_POWER_ADDRESS =
  '0x87537f0B5B8f34D689d484E743e83F82636E14a7' as const;

/** Shared `getVotingPower` view exposed by every voting power source contract. */
const votingPowerSourceAbi = [
  {
    type: 'function',
    name: 'getVotingPower',
    stateMutability: 'view',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_sourceSpaceId', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const VOTING_POWER_SOURCE_CONTRACTS: Record<
  number,
  { address: `0x${string}`; tokenDecimals: number }
> = {
  // 1 token = 1 vote (TokenVotingPower)
  1: {
    address: tokenVotingPowerImplementationAddress[8453],
    tokenDecimals: 18,
  },
  // 1 member = 1 vote (SpaceVotingPower)
  2: { address: SPACE_VOTING_POWER_ADDRESS, tokenDecimals: 0 },
  // 1 voice = 1 vote (VoteDecayTokenVotingPower)
  3: {
    address: voteDecayTokenVotingPowerImplementationAddress[8453],
    tokenDecimals: 18,
  },
};

export type MemberVotingPower = {
  votingPower: bigint;
  votingPowerSource: number;
  tokenDecimals: number;
};

/**
 * Reads a member's current voting power from the same on-chain voting power
 * source contract the space uses for proposal voting.
 */
export async function getMemberVotingPower({
  memberAddress,
  web3SpaceId,
}: {
  memberAddress: `0x${string}`;
  web3SpaceId: number;
}): Promise<MemberVotingPower> {
  const spaceDetails = await publicClient.readContract(
    getSpaceDetails({ spaceId: BigInt(web3SpaceId) }),
  );
  const votingPowerSource = Number(spaceDetails[2]);

  const source = VOTING_POWER_SOURCE_CONTRACTS[votingPowerSource];
  if (!source) {
    throw new Error(
      `Unsupported voting power source ${votingPowerSource} for space ${web3SpaceId}`,
    );
  }

  const votingPower = await publicClient.readContract({
    address: source.address,
    abi: votingPowerSourceAbi,
    functionName: 'getVotingPower',
    args: [memberAddress, BigInt(web3SpaceId)],
  });

  return {
    votingPower,
    votingPowerSource,
    tokenDecimals: source.tokenDecimals,
  };
}
