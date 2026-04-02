import { encodeFunctionData } from 'viem';
import { decayingSpaceTokenAbi } from '../../../generated';

export interface UpdateIssuedTokenInput {
  address: `0x${string}`;
  spaceId: number;
  name?: string;
  symbol?: string;
  maxSupply?: number;
  /** Read from `fixedMaxSupply()`; no setter in ABI — persisted only in Web2 token update data */
  fixedMaxSupply?: boolean;
  transferable?: boolean;
  decayPercentage?: number;
  decayInterval?: number;
  autoMinting?: boolean;
  tokenPrice?: number;
  priceCurrencyFeed?: `0x${string}`;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  /** `batchSetTransfer(accounts, allowed)` — add/remove in one call */
  batchTransferWhitelistAccounts?: `0x${string}`[];
  batchTransferWhitelistAllowed?: boolean[];
  batchReceiveWhitelistAccounts?: `0x${string}`[];
  batchReceiveWhitelistAllowed?: boolean[];
  archiveToken?: boolean;
}

type ProposalTx = {
  target: `0x${string}`;
  value: number;
  data: `0x${string}`;
};

/** Encodes DecayingSpaceToken admin calls for a multisig proposal (no network I/O). */
export function buildUpdateIssuedTokenTxData(
  arg: UpdateIssuedTokenInput,
): ProposalTx[] {
  const txData: ProposalTx[] = [];

  const tokenPriceWei =
    arg.tokenPrice !== undefined ? BigInt(arg.tokenPrice) : 0n;
  const zeroFeed =
    '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const priceCurrencyFeed = arg.priceCurrencyFeed ?? zeroFeed;

  if (arg.name !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setTokenName',
        args: [arg.name],
      }),
    });
  }
  if (arg.symbol !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setTokenSymbol',
        args: [arg.symbol],
      }),
    });
  }
  if (arg.maxSupply !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setMaxSupply',
        args: [BigInt(arg.maxSupply) * 10n ** 18n],
      }),
    });
  }
  if (arg.transferable !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setTransferable',
        args: [arg.transferable],
      }),
    });
  }
  if (arg.autoMinting !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setAutoMinting',
        args: [arg.autoMinting],
      }),
    });
  }
  if (arg.tokenPrice !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setPriceWithCurrency',
        args: [tokenPriceWei, priceCurrencyFeed],
      }),
    });
  }
  if (arg.decayPercentage !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setDecayPercentage',
        args: [BigInt(arg.decayPercentage)],
      }),
    });
  }
  if (arg.decayInterval !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setDecayInterval',
        args: [BigInt(arg.decayInterval)],
      }),
    });
  }
  if (
    arg.batchTransferWhitelistAccounts?.length &&
    arg.batchTransferWhitelistAllowed?.length ===
      arg.batchTransferWhitelistAccounts.length
  ) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'batchSetTransferWhitelist',
        args: [
          arg.batchTransferWhitelistAccounts,
          arg.batchTransferWhitelistAllowed,
        ],
      }),
    });
  }
  if (
    arg.batchReceiveWhitelistAccounts?.length &&
    arg.batchReceiveWhitelistAllowed?.length ===
      arg.batchReceiveWhitelistAccounts.length
  ) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'batchSetReceiveWhitelist',
        args: [
          arg.batchReceiveWhitelistAccounts,
          arg.batchReceiveWhitelistAllowed,
        ],
      }),
    });
  }
  if (arg.useTransferWhitelist !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setUseTransferWhitelist',
        args: [arg.useTransferWhitelist],
      }),
    });
  }
  if (arg.useReceiveWhitelist !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setUseReceiveWhitelist',
        args: [arg.useReceiveWhitelist],
      }),
    });
  }
  if (arg.archiveToken !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setArchived',
        args: [arg.archiveToken],
      }),
    });
  }

  return txData;
}

/**
 * `createProposal` reverts when the transaction list is empty. If the partial
 * update encodes no calls, include `setTokenName` with the current name (no
 * on-chain state change when it already matches).
 */
export function padUpdateIssuedTokenInputIfNoTxs(
  arg: UpdateIssuedTokenInput,
  currentName: string,
): UpdateIssuedTokenInput {
  if (buildUpdateIssuedTokenTxData(arg).length > 0) {
    return arg;
  }
  return { ...arg, name: currentName };
}
