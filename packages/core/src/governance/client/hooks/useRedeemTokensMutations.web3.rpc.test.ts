import { describe, expect, test, vi } from 'vitest';
import { decodeFunctionData } from 'viem';

import {
  tokenBackingVaultImplementationAbi,
  tokenBackingVaultImplementationAddress,
} from '@hypha-platform/core/generated';

vi.mock('@hypha-platform/core/client', async () => {
  return {
    getTokenDecimals: vi.fn(async () => 18),
    percentageStringToBigInt: vi.fn((value: string) =>
      BigInt(Math.round(Number.parseFloat(value) * 100)),
    ),
    getSpaceMinProposalDuration: vi.fn(() => ({})),
    getSpaceDetails: vi.fn(() => ({})),
    publicClient: {
      readContract: vi.fn(),
    },
  };
});

describe('prepareRedeemProposalParams', () => {
  test('adds addToWhitelist before redeem when vault whitelist is enabled and executor is not whitelisted', async () => {
    const { publicClient } = await import('@hypha-platform/core/client');
    const { prepareRedeemProposalParams } = await import(
      './useRedeemTokensMutations.web3.rpc'
    );
    const readContractMock = vi.mocked(publicClient.readContract);
    readContractMock
      .mockResolvedValueOnce(3600n) // getSpaceMinProposalDuration
      .mockResolvedValueOnce(true) // vaultExists
      .mockResolvedValueOnce([
        '0x00000000000000000000000000000000000000b1',
      ] as `0x${string}`[]) // getBackingTokens
      .mockResolvedValueOnce({
        redeemEnabled: true,
        membersOnly: false,
        whitelistEnabled: true,
        minimumBackingBps: 0n,
        redemptionStartDate: 0n,
      }) // getVaultConfig
      .mockResolvedValueOnce([
        0n,
        0n,
        0n,
        [],
        [],
        0n,
        0n,
        0n,
        '0x00000000000000000000000000000000000000a1',
        '0x00000000000000000000000000000000000000e1',
      ]) // getSpaceDetails
      .mockResolvedValueOnce(false); // isWhitelisted

    const result = await prepareRedeemProposalParams({
      proposalWeb3SpaceId: 123,
      redemption: {
        amount: '10',
        token: '0x00000000000000000000000000000000000000c1',
      },
      conversions: [
        {
          asset: '0x00000000000000000000000000000000000000b1',
          percentage: '100.00',
        },
      ],
    });

    expect(result.transactions).toHaveLength(3);

    const addToWhitelistTx = result.transactions[0];
    const approveTx = result.transactions[1];
    const redeemTx = result.transactions[2];

    expect(addToWhitelistTx?.target).toBe(
      tokenBackingVaultImplementationAddress[8453],
    );
    expect(approveTx?.target).toBe(
      '0x00000000000000000000000000000000000000c1',
    );
    expect(redeemTx?.target).toBe(tokenBackingVaultImplementationAddress[8453]);

    const addToWhitelistDecoded = decodeFunctionData({
      abi: tokenBackingVaultImplementationAbi,
      data: addToWhitelistTx!.data,
    });
    expect(addToWhitelistDecoded.functionName).toBe('addToWhitelist');

    const redeemDecoded = decodeFunctionData({
      abi: tokenBackingVaultImplementationAbi,
      data: redeemTx!.data,
    });
    expect(redeemDecoded.functionName).toBe('redeem');
  });

  test('prepends ERC20 approve on space token before redeem when whitelist is disabled', async () => {
    const { publicClient } = await import('@hypha-platform/core/client');
    const { prepareRedeemProposalParams } = await import(
      './useRedeemTokensMutations.web3.rpc'
    );
    const readContractMock = vi.mocked(publicClient.readContract);
    readContractMock
      .mockResolvedValueOnce(3600n) // getSpaceMinProposalDuration
      .mockResolvedValueOnce(true) // vaultExists
      .mockResolvedValueOnce([
        '0x00000000000000000000000000000000000000b1',
      ] as `0x${string}`[]) // getBackingTokens
      .mockResolvedValueOnce({
        redeemEnabled: true,
        membersOnly: false,
        whitelistEnabled: false,
        minimumBackingBps: 0n,
        redemptionStartDate: 0n,
      }); // getVaultConfig — no whitelist branch

    const spaceToken = '0x00000000000000000000000000000000000000c1' as const;
    const result = await prepareRedeemProposalParams({
      proposalWeb3SpaceId: 123,
      redemption: {
        amount: '10',
        token: spaceToken,
      },
      conversions: [
        {
          asset: '0x00000000000000000000000000000000000000b1',
          percentage: '100.00',
        },
      ],
    });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]?.target).toBe(spaceToken);
    expect(result.transactions[1]?.target).toBe(
      tokenBackingVaultImplementationAddress[8453],
    );
  });

  test('creates proposal in current space while redeeming from vault owner space', async () => {
    const { publicClient } = await import('@hypha-platform/core/client');
    const { prepareRedeemProposalParams } = await import(
      './useRedeemTokensMutations.web3.rpc'
    );
    const readContractMock = vi.mocked(publicClient.readContract);
    readContractMock
      .mockResolvedValueOnce(3600n) // getSpaceMinProposalDuration (proposal space)
      .mockResolvedValueOnce(true) // vaultExists (vault space)
      .mockResolvedValueOnce([
        '0x00000000000000000000000000000000000000b1',
      ] as `0x${string}`[]) // getBackingTokens
      .mockResolvedValueOnce({
        redeemEnabled: true,
        membersOnly: false,
        whitelistEnabled: false,
        minimumBackingBps: 0n,
        redemptionStartDate: 0n,
      }); // getVaultConfig

    const result = await prepareRedeemProposalParams({
      proposalWeb3SpaceId: 111,
      redemption: {
        vaultWeb3SpaceId: 222,
        amount: '10',
        token: '0x00000000000000000000000000000000000000c1',
      },
      conversions: [
        {
          asset: '0x00000000000000000000000000000000000000b1',
          percentage: '100.00',
        },
      ],
    });

    expect(result.spaceId).toBe(111n);
    const redeemTx = result.transactions[1];
    expect(redeemTx?.target).toBe(tokenBackingVaultImplementationAddress[8453]);
    const redeemDecoded = decodeFunctionData({
      abi: tokenBackingVaultImplementationAbi,
      data: redeemTx!.data,
    });
    expect(redeemDecoded.functionName).toBe('redeem');
    expect(redeemDecoded.args[0]).toBe(222n);
  });
});
