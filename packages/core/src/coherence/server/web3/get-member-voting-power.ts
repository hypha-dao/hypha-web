import 'server-only';

import { web3Client } from '../../../common/server/web3-rpc/client';
import { getSpaceDetails } from '../../../space/shared/web3/get-space-details';

/**
 * VotingPowerDirectory — resolves a voting power source id to its contract,
 * exactly like DAOProposalsImplementation does when tallying proposal votes.
 * Not part of the wagmi-generated bindings; address from
 * packages/storage-evm/contracts/addresses.txt.
 */
const VOTING_POWER_DIRECTORY_ADDRESS =
  '0x9780a96B4382bdd0Aa6fC41B6b6A68A04c5C5727' as const;

const votingPowerDirectoryAbi = [
  {
    type: 'function',
    name: 'getVotingPowerSourceContract',
    stateMutability: 'view',
    inputs: [{ name: '_id', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
] as const;

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

/** Source 2 (SpaceVotingPower, 1 member = 1 vote) counts votes as plain integers. */
const ONE_MEMBER_ONE_VOTE_SOURCE = 2;

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
  const spaceDetails = await web3Client.readContract(
    getSpaceDetails({ spaceId: BigInt(web3SpaceId) }),
  );
  const votingPowerSource = Number(spaceDetails[2]);

  const sourceAddress = await web3Client.readContract({
    address: VOTING_POWER_DIRECTORY_ADDRESS,
    abi: votingPowerDirectoryAbi,
    functionName: 'getVotingPowerSourceContract',
    args: [BigInt(votingPowerSource)],
  });

  const votingPower = await web3Client.readContract({
    address: sourceAddress,
    abi: votingPowerSourceAbi,
    functionName: 'getVotingPower',
    args: [memberAddress, BigInt(web3SpaceId)],
  });

  return {
    votingPower,
    votingPowerSource,
    tokenDecimals: votingPowerSource === ONE_MEMBER_ONE_VOTE_SOURCE ? 0 : 18,
  };
}
