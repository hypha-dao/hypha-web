import { describe, expect, it } from 'vitest';
import { encodeFunctionData } from 'viem';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '@hypha-platform/core/generated';
import { decodeTransaction } from '../hooks/decoders';
import { decayBasisPointsToFormPercent } from '../../voice-decay-units';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

const tx = (data: `0x${string}`) => ({
  data,
  target: ZERO,
  value: 0n,
});

/** Common purchase/whitelist fields shared by every WithMinters struct. */
const purchaseFields = {
  tokenPrice: 0n,
  priceCurrencyFeed: ZERO,
  useTransferWhitelist: false,
  useReceiveWhitelist: false,
  initialTransferWhitelist: [],
  initialReceiveWhitelist: [],
  initialTransferWhitelistSpaceIds: [],
  initialReceiveWhitelistSpaceIds: [],
  paymentToken: ZERO,
  paymentTokenPricePerToken: 0n,
  tokensForSale: 0n,
  purchaseEligibilityMode: 0,
  initialPurchaseWhitelistSpaceIds: [],
  initialAuthorizedMinters: [ZERO],
} as const;

describe('decodeTransaction — deploy*WithMinters variants', () => {
  it('decodes deployTokenWithMinters as a regular token payload', () => {
    const data = encodeFunctionData({
      abi: regularTokenFactoryAbi,
      functionName: 'deployTokenWithMinters',
      args: [
        {
          spaceId: 1105n,
          name: 'Local Impact Token',
          symbol: 'LIT',
          maxSupply: 1000n,
          transferable: true,
          fixedMaxSupply: false,
          autoMinting: true,
          defaultCreditLimit: 0n,
          initialCreditWhitelistSpaceIds: [],
          ...purchaseFields,
        },
      ],
    });

    const result = decodeTransaction(tx(data));

    expect(result?.type).toBe('token');
    expect(result?.data).toMatchObject({
      tokenType: 'regular',
      spaceId: 1105n,
      name: 'Local Impact Token',
      symbol: 'LIT',
      maxSupply: 1000n,
      transferable: true,
      fixedMaxSupply: false,
      autoMinting: true,
    });
  });

  it('decodes deployOwnershipTokenWithMinters as an ownership token payload', () => {
    const data = encodeFunctionData({
      abi: ownershipTokenFactoryAbi,
      functionName: 'deployOwnershipTokenWithMinters',
      args: [
        {
          spaceId: 42n,
          name: 'Ownership Token',
          symbol: 'OWN',
          maxSupply: 500n,
          fixedMaxSupply: true,
          autoMinting: false,
          ...purchaseFields,
        },
      ],
    });

    const result = decodeTransaction(tx(data));

    expect(result?.type).toBe('token');
    expect(result?.data).toMatchObject({
      tokenType: 'ownership',
      spaceId: 42n,
      name: 'Ownership Token',
      symbol: 'OWN',
      maxSupply: 500n,
      fixedMaxSupply: true,
      autoMinting: false,
    });
    // Ownership tokens have no `transferable` field in their struct.
    expect(result?.data).not.toHaveProperty('transferable');
  });

  it('decodes deployDecayingTokenWithMinters as a voice token payload with decay', () => {
    const decayBasisPoints = 500n;
    const data = encodeFunctionData({
      abi: decayingTokenFactoryAbi,
      functionName: 'deployDecayingTokenWithMinters',
      args: [
        {
          spaceId: 7n,
          name: 'Voice Token',
          symbol: 'VOICE',
          maxSupply: 0n,
          transferable: false,
          fixedMaxSupply: false,
          autoMinting: true,
          decayPercentage: decayBasisPoints,
          decayInterval: 86400n,
          ...purchaseFields,
        },
      ],
    });

    const result = decodeTransaction(tx(data));

    expect(result?.type).toBe('token');
    expect(result?.data).toMatchObject({
      tokenType: 'voice',
      spaceId: 7n,
      name: 'Voice Token',
      symbol: 'VOICE',
      transferable: false,
      decayInterval: 86400n,
      decayPercentage: BigInt(
        decayBasisPointsToFormPercent(Number(decayBasisPoints)),
      ),
    });
  });
});
