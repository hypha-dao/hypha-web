'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { encodeFunctionData, getAddress, isAddress } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import {
  schemaCreateProposalWeb3,
  publicClient,
  getSpaceMinProposalDuration,
} from '@hypha-platform/core/client';
import {
  getProposalFromLogs,
  mapToCreateProposalWeb3Input,
  createProposal,
} from '../web3';
import {
  regularTokenFactoryAbi,
  regularTokenFactoryAddress,
  ownershipTokenFactoryAbi,
  ownershipTokenFactoryAddress,
  decayingTokenFactoryAbi,
  decayingTokenFactoryAddress,
} from '@hypha-platform/core/generated';
import { decayPercentToBasisPoints } from '../../voice-decay-units';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';

interface CreateTokenArgs {
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  transferable: boolean;
  isVotingToken: boolean;
  type:
    | 'utility'
    | 'credits'
    | 'ownership'
    | 'voice'
    | 'impact'
    | 'community_currency';
  decayPercentage?: number;
  decayInterval?: number;
  fixedMaxSupply?: boolean;
  autoMinting?: boolean;
  tokenPrice?: number;
  priceCurrencyFeed?: `0x${string}`;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  initialTransferWhitelist?: `0x${string}`[];
  initialReceiveWhitelist?: `0x${string}`[];
  initialTransferWhitelistSpaceIds?: number[];
  initialReceiveWhitelistSpaceIds?: number[];
  defaultCreditLimit?: number;
  initialCreditWhitelistSpaceIds?: number[];
  salePaymentToken?: `0x${string}`;
  salePaymentTokenPricePerToken?: bigint;
  tokensForSale?: number;
  purchaseEligibilityMode?: 0 | 1 | 2;
  initialPurchaseWhitelistSpaceIds?: number[];
  /**
   * Extra wallet addresses granted minter rights (mint, burnFrom,
   * batchSetCreditWhitelistAddresses) on the new token, in addition to the space
   * executor. When non-empty, the factory's `deploy*WithMinters` entrypoint is used.
   */
  authorizedMinters?: string[];
}

const chainId = getGovernanceChainId();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** Validate, checksum and de-duplicate the authorized-minter list. */
const normalizeAuthorizedMinters = (
  addresses: string[] | undefined,
): `0x${string}`[] => {
  const seen = new Set<string>();
  const out: `0x${string}`[] = [];
  for (const raw of addresses ?? []) {
    const trimmed = raw.trim();
    if (!isAddress(trimmed)) continue;
    const checksummed = getAddress(trimmed);
    const key = checksummed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(checksummed);
  }
  return out;
};

export const useIssueTokenMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createIssueToken,
    reset: resetCreateIssueToken,
    isMutating: isCreatingToken,
    data: createTokenHash,
    error: errorCreateToken,
  } = useSWRMutation(
    `createIssueToken-${proposalSlug}`,
    async (_, { arg }: { arg: CreateTokenArgs }) => {
      if (!client) throw new Error('Smart wallet client not available');

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      let txData: Array<{
        target: `0x${string}`;
        value: number;
        data: `0x${string}`;
      }> = [];

      const fixedMaxSupply = arg.fixedMaxSupply ?? false;
      const autoMinting = arg.autoMinting ?? true;
      const tokenPrice = arg.tokenPrice ? BigInt(arg.tokenPrice) : 0n;
      const priceCurrencyFeed =
        arg.priceCurrencyFeed ??
        ('0x0000000000000000000000000000000000000000' as `0x${string}`);
      const useTransferWhitelist = arg.useTransferWhitelist ?? false;
      const useReceiveWhitelist = arg.useReceiveWhitelist ?? false;
      const initialTransferWhitelist = arg.initialTransferWhitelist ?? [];
      const initialReceiveWhitelist = arg.initialReceiveWhitelist ?? [];
      const initialTransferWhitelistSpaceIds = (
        arg.initialTransferWhitelistSpaceIds ?? []
      ).map((id) => BigInt(id));
      const initialReceiveWhitelistSpaceIds = (
        arg.initialReceiveWhitelistSpaceIds ?? []
      ).map((id) => BigInt(id));
      const defaultCreditLimit =
        BigInt(arg.defaultCreditLimit ?? 0) * 10n ** 18n;
      const initialCreditWhitelistSpaceIds = (
        arg.initialCreditWhitelistSpaceIds ?? []
      ).map((id) => BigInt(id));
      const salePaymentToken = arg.salePaymentToken ?? ZERO_ADDRESS;
      const salePaymentTokenPricePerToken =
        arg.salePaymentTokenPricePerToken ?? 0n;
      const tokensForSale = BigInt(arg.tokensForSale ?? 0) * 10n ** 18n;
      const purchaseEligibilityMode = arg.purchaseEligibilityMode ?? 0;
      const initialPurchaseWhitelistSpaceIds = (
        arg.initialPurchaseWhitelistSpaceIds ?? []
      ).map((id) => BigInt(id));
      const initialAuthorizedMinters = normalizeAuthorizedMinters(
        arg.authorizedMinters,
      );
      const useMinters = initialAuthorizedMinters.length > 0;
      const maxSupplyWei = BigInt(arg.maxSupply) * 10n ** 18n;

      if (
        ['utility', 'credits', 'impact', 'community_currency'].includes(
          arg.type,
        )
      ) {
        txData = [
          {
            target: regularTokenFactoryAddress[chainId],
            value: 0,
            data: useMinters
              ? encodeFunctionData({
                  abi: regularTokenFactoryAbi,
                  functionName: 'deployTokenWithMinters',
                  args: [
                    {
                      spaceId: BigInt(arg.spaceId),
                      name: arg.name,
                      symbol: arg.symbol,
                      maxSupply: maxSupplyWei,
                      transferable: arg.transferable,
                      fixedMaxSupply,
                      autoMinting,
                      tokenPrice,
                      priceCurrencyFeed,
                      useTransferWhitelist,
                      useReceiveWhitelist,
                      initialTransferWhitelist,
                      initialReceiveWhitelist,
                      initialTransferWhitelistSpaceIds,
                      initialReceiveWhitelistSpaceIds,
                      defaultCreditLimit,
                      initialCreditWhitelistSpaceIds,
                      paymentToken: salePaymentToken,
                      paymentTokenPricePerToken: salePaymentTokenPricePerToken,
                      tokensForSale,
                      purchaseEligibilityMode,
                      initialPurchaseWhitelistSpaceIds,
                      initialAuthorizedMinters,
                    },
                  ],
                })
              : encodeFunctionData({
                  abi: regularTokenFactoryAbi,
                  functionName: 'deployToken',
                  args: [
                    BigInt(arg.spaceId),
                    arg.name,
                    arg.symbol,
                    maxSupplyWei,
                    arg.transferable,
                    fixedMaxSupply,
                    autoMinting,
                    tokenPrice,
                    priceCurrencyFeed,
                    useTransferWhitelist,
                    useReceiveWhitelist,
                    initialTransferWhitelist,
                    initialReceiveWhitelist,
                    initialTransferWhitelistSpaceIds,
                    initialReceiveWhitelistSpaceIds,
                    defaultCreditLimit,
                    initialCreditWhitelistSpaceIds,
                    salePaymentToken,
                    salePaymentTokenPricePerToken,
                    tokensForSale,
                    purchaseEligibilityMode,
                    initialPurchaseWhitelistSpaceIds,
                  ],
                }),
          },
        ];
      } else if (arg.type === 'ownership') {
        txData = [
          {
            target: ownershipTokenFactoryAddress[chainId],
            value: 0,
            data: useMinters
              ? encodeFunctionData({
                  abi: ownershipTokenFactoryAbi,
                  functionName: 'deployOwnershipTokenWithMinters',
                  args: [
                    {
                      spaceId: BigInt(arg.spaceId),
                      name: arg.name,
                      symbol: arg.symbol,
                      maxSupply: maxSupplyWei,
                      fixedMaxSupply,
                      autoMinting,
                      tokenPrice,
                      priceCurrencyFeed,
                      useTransferWhitelist,
                      useReceiveWhitelist,
                      initialTransferWhitelist,
                      initialReceiveWhitelist,
                      initialTransferWhitelistSpaceIds,
                      initialReceiveWhitelistSpaceIds,
                      paymentToken: salePaymentToken,
                      paymentTokenPricePerToken: salePaymentTokenPricePerToken,
                      tokensForSale,
                      purchaseEligibilityMode,
                      initialPurchaseWhitelistSpaceIds,
                      initialAuthorizedMinters,
                    },
                  ],
                })
              : encodeFunctionData({
                  abi: ownershipTokenFactoryAbi,
                  functionName: 'deployOwnershipToken',
                  args: [
                    BigInt(arg.spaceId),
                    arg.name,
                    arg.symbol,
                    maxSupplyWei,
                    fixedMaxSupply,
                    autoMinting,
                    tokenPrice,
                    priceCurrencyFeed,
                    useTransferWhitelist,
                    useReceiveWhitelist,
                    initialTransferWhitelist,
                    initialReceiveWhitelist,
                    initialTransferWhitelistSpaceIds,
                    initialReceiveWhitelistSpaceIds,
                    salePaymentToken,
                    salePaymentTokenPricePerToken,
                    tokensForSale,
                    purchaseEligibilityMode,
                    initialPurchaseWhitelistSpaceIds,
                  ],
                }),
          },
        ];
      } else if (arg.type === 'voice') {
        if (
          typeof arg.decayPercentage !== 'number' ||
          typeof arg.decayInterval !== 'number'
        ) {
          throw new Error(
            'Missing decayPercentage or decayInterval for voice token',
          );
        }

        const decayPercentageBp = BigInt(
          decayPercentToBasisPoints(arg.decayPercentage),
        );
        const decayIntervalBig = BigInt(arg.decayInterval);
        txData = [
          {
            target: decayingTokenFactoryAddress[chainId],
            value: 0,
            data: useMinters
              ? encodeFunctionData({
                  abi: decayingTokenFactoryAbi,
                  functionName: 'deployDecayingTokenWithMinters',
                  args: [
                    {
                      spaceId: BigInt(arg.spaceId),
                      name: arg.name,
                      symbol: arg.symbol,
                      maxSupply: maxSupplyWei,
                      transferable: arg.transferable,
                      fixedMaxSupply,
                      autoMinting,
                      tokenPrice,
                      priceCurrencyFeed,
                      useTransferWhitelist,
                      useReceiveWhitelist,
                      initialTransferWhitelist,
                      initialReceiveWhitelist,
                      initialTransferWhitelistSpaceIds,
                      initialReceiveWhitelistSpaceIds,
                      decayPercentage: decayPercentageBp,
                      decayInterval: decayIntervalBig,
                      paymentToken: salePaymentToken,
                      paymentTokenPricePerToken: salePaymentTokenPricePerToken,
                      tokensForSale,
                      purchaseEligibilityMode,
                      initialPurchaseWhitelistSpaceIds,
                      initialAuthorizedMinters,
                    },
                  ],
                })
              : encodeFunctionData({
                  abi: decayingTokenFactoryAbi,
                  functionName: 'deployDecayingToken',
                  args: [
                    BigInt(arg.spaceId),
                    arg.name,
                    arg.symbol,
                    maxSupplyWei,
                    arg.transferable,
                    fixedMaxSupply,
                    autoMinting,
                    tokenPrice,
                    priceCurrencyFeed,
                    useTransferWhitelist,
                    useReceiveWhitelist,
                    initialTransferWhitelist,
                    initialReceiveWhitelist,
                    initialTransferWhitelistSpaceIds,
                    initialReceiveWhitelistSpaceIds,
                    decayPercentageBp,
                    decayIntervalBig,
                    salePaymentToken,
                    salePaymentTokenPricePerToken,
                    tokensForSale,
                    purchaseEligibilityMode,
                    initialPurchaseWhitelistSpaceIds,
                  ],
                }),
          },
        ];
      }

      const parsedProposal = schemaCreateProposalWeb3.parse({
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions: txData,
      });

      const proposalArgs = mapToCreateProposalWeb3Input(parsedProposal);

      const txHash = await client.writeContract(createProposal(proposalArgs));
      return txHash;
    },
  );

  const {
    data: createdToken,
    isLoading: isLoadingTokenFromTx,
    error: errorWaitTokenFromTx,
  } = useSWR(
    createTokenHash ? [createTokenHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    createIssueToken,
    resetCreateIssueToken,
    isCreatingToken,
    createTokenHash,
    errorCreateToken,
    createdToken,
    isLoadingTokenFromTx,
    errorWaitTokenFromTx,
  };
};
