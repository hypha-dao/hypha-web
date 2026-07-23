import { getAddress, isAddress } from 'viem';

import { publicClient } from '../../../common/web3/public-client';
import {
  getSpaceOwnershipTokens,
  isMember,
} from '../../../space/client/web3/dao-space-factory';
import { getGovernanceChainId } from './governance-chain-id';

/** Stable English message mapped in `proposal-error-translations`. */
export const AIRDROP_OWNERSHIP_RECIPIENT_NOT_MEMBER =
  'Ownership token airdrop recipients must be space members.';

export const AIRDROP_OWNERSHIP_MEMBERSHIP_CHECK_FAILED =
  'Could not verify ownership token recipient membership. Please try again.';

const isEvmAddress = (value: string): value is `0x${string}` =>
  isAddress(value, { strict: false });

/**
 * Ownership-space tokens (`OwnershipSpaceToken`) revert transfers/mints from the
 * space executor to non-members with `!member`. That failure is wrapped by the
 * Executor as a generic treasury error at vote-auto-execution time.
 *
 * Call this before `createProposal` so invalid airdrops never reach the chain.
 *
 * No-ops when the token is not one of the space's ownership tokens.
 */
export async function assertAirdropOwnershipRecipientsAreMembers({
  spaceId,
  tokenAddress,
  recipients,
}: {
  spaceId: number;
  tokenAddress: string;
  recipients: readonly string[];
}): Promise<void> {
  if (!isEvmAddress(tokenAddress)) {
    return;
  }

  const uniqueRecipients = [
    ...new Set(
      recipients
        .map((r) => r?.trim())
        .filter((r): r is string => Boolean(r) && isEvmAddress(r))
        .map((r) => getAddress(r)),
    ),
  ];
  if (uniqueRecipients.length === 0) {
    return;
  }

  const chainId = getGovernanceChainId();
  const spaceIdBigInt = BigInt(spaceId);
  const token = getAddress(tokenAddress);

  let ownershipTokens: readonly `0x${string}`[];
  try {
    ownershipTokens = await publicClient.readContract(
      getSpaceOwnershipTokens({ spaceId: spaceIdBigInt, chain: chainId }),
    );
  } catch {
    throw new Error(AIRDROP_OWNERSHIP_MEMBERSHIP_CHECK_FAILED);
  }

  const isOwnershipToken = ownershipTokens.some(
    (addr) => getAddress(addr) === token,
  );
  if (!isOwnershipToken) {
    return;
  }

  let membershipResults: readonly boolean[];
  try {
    membershipResults = await publicClient.multicall({
      allowFailure: false,
      contracts: uniqueRecipients.map((memberAddress) =>
        isMember({
          spaceId: spaceIdBigInt,
          memberAddress,
          chain: chainId,
        }),
      ),
    });
  } catch {
    throw new Error(AIRDROP_OWNERSHIP_MEMBERSHIP_CHECK_FAILED);
  }

  const nonMembers = uniqueRecipients.filter(
    (_, index) => membershipResults[index] !== true,
  );
  if (nonMembers.length > 0) {
    throw new Error(AIRDROP_OWNERSHIP_RECIPIENT_NOT_MEMBER);
  }
}
