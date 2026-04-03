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
  /** `batchSetTransfer(accounts, allowed)` — member wallets only */
  batchTransferWhitelistAccounts?: `0x${string}`[];
  batchTransferWhitelistAllowed?: boolean[];
  batchReceiveWhitelistAccounts?: `0x${string}`[];
  batchReceiveWhitelistAllowed?: boolean[];
  /** Space ids for `batchAddTransferWhitelistSpaces` / `batchRemoveTransferWhitelistSpaces` */
  batchAddTransferWhitelistSpaceIds?: bigint[];
  batchRemoveTransferWhitelistSpaceIds?: bigint[];
  batchAddReceiveWhitelistSpaceIds?: bigint[];
  batchRemoveReceiveWhitelistSpaceIds?: bigint[];
  archiveToken?: boolean;
}

type ProposalTx = {
  target: `0x${string}`;
  value: number;
  data: `0x${string}`;
};

/** Safe integer → bigint for on-chain args (avoids BigInt(1.5) throws). */
function integerBigInt(n: number, label: string): bigint {
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new RangeError(`${label} must be a finite integer`);
  }
  return BigInt(n);
}

/** Encodes DecayingSpaceToken admin calls for a multisig proposal (no network I/O). */
export function buildUpdateIssuedTokenTxData(
  arg: UpdateIssuedTokenInput,
): ProposalTx[] {
  const txData: ProposalTx[] = [];

  const tokenPriceWei =
    arg.tokenPrice !== undefined
      ? integerBigInt(arg.tokenPrice, 'tokenPrice')
      : 0n;
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
        args: [integerBigInt(arg.maxSupply, 'maxSupply') * 10n ** 18n],
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
        args: [integerBigInt(arg.decayPercentage, 'decayPercentage')],
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
        args: [integerBigInt(arg.decayInterval, 'decayInterval')],
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
  if (arg.batchAddTransferWhitelistSpaceIds?.length) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'batchAddTransferWhitelistSpaces',
        args: [arg.batchAddTransferWhitelistSpaceIds],
      }),
    });
  }
  if (arg.batchRemoveTransferWhitelistSpaceIds?.length) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'batchRemoveTransferWhitelistSpaces',
        args: [arg.batchRemoveTransferWhitelistSpaceIds],
      }),
    });
  }
  if (arg.batchAddReceiveWhitelistSpaceIds?.length) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'batchAddReceiveWhitelistSpaces',
        args: [arg.batchAddReceiveWhitelistSpaceIds],
      }),
    });
  }
  if (arg.batchRemoveReceiveWhitelistSpaceIds?.length) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'batchRemoveReceiveWhitelistSpaces',
        args: [arg.batchRemoveReceiveWhitelistSpaceIds],
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
