import { beforeEach, describe, expect, it, vi } from 'vitest';

const readContract = vi.fn();
const multicall = vi.fn();

vi.mock('../../../../common/web3/public-client', () => ({
  publicClient: {
    readContract: (...args: unknown[]) => readContract(...args),
    multicall: (...args: unknown[]) => multicall(...args),
  },
}));

vi.mock('../governance-chain-id', () => ({
  getGovernanceChainId: () => 8453,
}));

import {
  AIRDROP_OWNERSHIP_MEMBERSHIP_CHECK_FAILED,
  AIRDROP_OWNERSHIP_RECIPIENT_NOT_MEMBER,
  assertAirdropOwnershipRecipientsAreMembers,
} from '../assert-airdrop-ownership-recipients';

const OWNERSHIP_TOKEN = '0xeDCcFE61355f0Cb63B3C7265730dC1f60aD96827' as const;
const MEMBER = '0xbEda819cE46126EeAeA7f738d0593Cac3501Ac4d' as const;
const NON_MEMBER = '0xA7236dFFf74d1393726265f623fafCe6A7EC7366' as const;
const OTHER_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

describe('assertAirdropOwnershipRecipientsAreMembers', () => {
  beforeEach(() => {
    readContract.mockReset();
    multicall.mockReset();
  });

  it('no-ops when the token is not a space ownership token', async () => {
    readContract.mockResolvedValueOnce([OWNERSHIP_TOKEN]);

    await expect(
      assertAirdropOwnershipRecipientsAreMembers({
        spaceId: 1143,
        tokenAddress: OTHER_TOKEN,
        recipients: [NON_MEMBER],
      }),
    ).resolves.toBeUndefined();

    expect(multicall).not.toHaveBeenCalled();
  });

  it('allows ownership airdrops when every recipient is a member', async () => {
    readContract.mockResolvedValueOnce([OWNERSHIP_TOKEN]);
    multicall.mockResolvedValueOnce([true]);

    await expect(
      assertAirdropOwnershipRecipientsAreMembers({
        spaceId: 1143,
        tokenAddress: OWNERSHIP_TOKEN,
        recipients: [MEMBER],
      }),
    ).resolves.toBeUndefined();

    expect(multicall).toHaveBeenCalledOnce();
  });

  it('rejects ownership airdrops that include a non-member', async () => {
    readContract.mockResolvedValueOnce([OWNERSHIP_TOKEN]);
    multicall.mockResolvedValueOnce([true, false]);

    await expect(
      assertAirdropOwnershipRecipientsAreMembers({
        spaceId: 1143,
        tokenAddress: OWNERSHIP_TOKEN,
        recipients: [MEMBER, NON_MEMBER],
      }),
    ).rejects.toThrow(AIRDROP_OWNERSHIP_RECIPIENT_NOT_MEMBER);
  });

  it('surfaces a retryable error when ownership token lookup fails', async () => {
    readContract.mockRejectedValueOnce(new Error('rpc down'));

    await expect(
      assertAirdropOwnershipRecipientsAreMembers({
        spaceId: 1143,
        tokenAddress: OWNERSHIP_TOKEN,
        recipients: [MEMBER],
      }),
    ).rejects.toThrow(AIRDROP_OWNERSHIP_MEMBERSHIP_CHECK_FAILED);
  });
});
