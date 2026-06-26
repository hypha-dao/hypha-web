import { decodeFunctionData, erc20Abi, type Abi } from 'viem';
import {
  escrowImplementationAbi,
  escrowLegacyCreateEscrowAbi,
} from '../escrow';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
  daoSpaceFactoryImplementationAbi,
} from '@hypha-platform/core/generated';
import { decayBasisPointsToFormPercent } from '../../voice-decay-units';

/** Pre-purchase deploy ABIs (tokenPrice + priceCurrencyFeed, no purchase params). */
const regularTokenFactoryDeployPrePurchaseAbi = [
  {
    type: 'function' as const,
    name: 'deployToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'tokenPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'priceCurrencyFeed', internalType: 'address', type: 'address' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const ownershipTokenFactoryDeployPrePurchaseAbi = [
  {
    type: 'function' as const,
    name: 'deployOwnershipToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'tokenPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'priceCurrencyFeed', internalType: 'address', type: 'address' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const decayingTokenFactoryDeployPrePurchaseAbi = [
  {
    type: 'function' as const,
    name: 'deployDecayingToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'tokenPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'priceCurrencyFeed', internalType: 'address', type: 'address' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'decayPercentage', internalType: 'uint256', type: 'uint256' },
      { name: 'decayInterval', internalType: 'uint256', type: 'uint256' },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];

/** Legacy deploy ABIs (priceInUSD, no priceCurrencyFeed) for older proposals. */
const regularTokenFactoryDeployLegacyAbi = [
  {
    type: 'function' as const,
    name: 'deployToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'priceInUSD', internalType: 'uint256', type: 'uint256' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const ownershipTokenFactoryDeployLegacyAbi = [
  {
    type: 'function' as const,
    name: 'deployOwnershipToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'priceInUSD', internalType: 'uint256', type: 'uint256' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const decayingTokenFactoryDeployLegacyAbi = [
  {
    type: 'function' as const,
    name: 'deployDecayingToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'priceInUSD', internalType: 'uint256', type: 'uint256' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'decayPercentage', internalType: 'uint256', type: 'uint256' },
      { name: 'decayInterval', internalType: 'uint256', type: 'uint256' },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];

/**
 * Pre-whitelist-space-ids deploy ABIs: includes purchase params (and credit
 * params for the regular factory) but NOT the new
 * `initial(Transfer|Receive)WhitelistSpaceIds` arrays. Kept so proposals
 * encoded against the previous current ABI continue to decode after the
 * factory upgrade.
 */
const regularTokenFactoryDeployCreditOnlyAbi = [
  {
    type: 'function' as const,
    name: 'deployToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'tokenPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'priceCurrencyFeed', internalType: 'address', type: 'address' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'defaultCreditLimit', internalType: 'uint256', type: 'uint256' },
      {
        name: 'initialCreditWhitelistSpaceIds',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
      { name: 'paymentToken', internalType: 'address', type: 'address' },
      {
        name: 'paymentTokenPricePerToken',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'tokensForSale', internalType: 'uint256', type: 'uint256' },
      { name: 'purchaseEligibilityMode', internalType: 'uint8', type: 'uint8' },
      {
        name: 'initialPurchaseWhitelistSpaceIds',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const ownershipTokenFactoryDeployPurchaseOnlyAbi = [
  {
    type: 'function' as const,
    name: 'deployOwnershipToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'tokenPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'priceCurrencyFeed', internalType: 'address', type: 'address' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'paymentToken', internalType: 'address', type: 'address' },
      {
        name: 'paymentTokenPricePerToken',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'tokensForSale', internalType: 'uint256', type: 'uint256' },
      { name: 'purchaseEligibilityMode', internalType: 'uint8', type: 'uint8' },
      {
        name: 'initialPurchaseWhitelistSpaceIds',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];
const decayingTokenFactoryDeployPurchaseOnlyAbi = [
  {
    type: 'function' as const,
    name: 'deployDecayingToken',
    inputs: [
      { name: 'spaceId', internalType: 'uint256', type: 'uint256' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
      { name: 'maxSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'transferable', internalType: 'bool', type: 'bool' },
      { name: 'fixedMaxSupply', internalType: 'bool', type: 'bool' },
      { name: 'autoMinting', internalType: 'bool', type: 'bool' },
      { name: 'tokenPrice', internalType: 'uint256', type: 'uint256' },
      { name: 'priceCurrencyFeed', internalType: 'address', type: 'address' },
      { name: 'useTransferWhitelist', internalType: 'bool', type: 'bool' },
      { name: 'useReceiveWhitelist', internalType: 'bool', type: 'bool' },
      {
        name: 'initialTransferWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      {
        name: 'initialReceiveWhitelist',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'decayPercentage', internalType: 'uint256', type: 'uint256' },
      { name: 'decayInterval', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentToken', internalType: 'address', type: 'address' },
      {
        name: 'paymentTokenPricePerToken',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'tokensForSale', internalType: 'uint256', type: 'uint256' },
      { name: 'purchaseEligibilityMode', internalType: 'uint8', type: 'uint8' },
      {
        name: 'initialPurchaseWhitelistSpaceIds',
        internalType: 'uint256[]',
        type: 'uint256[]',
      },
    ],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable' as const,
  },
];

import {
  decayingSpaceTokenAbi,
  tokenBalanceJoinImplementationAbi,
  tokenVotingPowerImplementationAbi,
  voteDecayTokenVotingPowerImplementationAbi,
  hyphaTokenAbi,
  votingPowerDelegationImplementationAbi,
  daoProposalsImplementationAbi,
  tokenBackingVaultImplementationAbi,
} from '@hypha-platform/core/generated';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

type Tx = {
  data: `0x${string}`;
  target: `0x${string}`;
  value: bigint;
};

type DecodedTransaction = ReturnType<typeof decodeFunctionData> & {
  args: readonly unknown[];
};

type DecodedPayload = {
  type: string;
  data: Record<string, unknown>;
};

type TransactionDecoder = {
  abi: Abi;
  handler: (decoded: DecodedTransaction, tx: Tx) => DecodedPayload | null;
};

/** DecayingSpaceToken admin calls used in update-token proposals (single switch vs many ABI entries). */
function decodeDecayingSpaceTokenAdminProposal(
  decoded: DecodedTransaction,
  tx: Tx,
): DecodedPayload | null {
  const address = tx.target;
  switch (decoded.functionName) {
    case 'setTokenName':
      return {
        type: 'setTokenName',
        data: { address, name: decoded.args[0] },
      };
    case 'setTokenSymbol':
      return {
        type: 'setTokenSymbol',
        data: { address, symbol: decoded.args[0] },
      };
    case 'setMaxSupply':
      return {
        type: 'setTokenMaxSupply',
        data: { address, maxSupply: decoded.args[0] },
      };
    case 'setTransferable':
      return {
        type: 'setTokenTransferable',
        data: { address, transferable: decoded.args[0] },
      };
    case 'setAutoMinting':
      return {
        type: 'setTokenAutoMinting',
        data: { address, autoMinting: decoded.args[0] },
      };
    case 'setPriceWithCurrency':
      return {
        type: 'setTokenPriceWithCurrency',
        data: {
          address,
          tokenPrice: decoded.args[0],
          priceCurrencyFeed: decoded.args[1],
        },
      };
    case 'setDecayPercentage':
      return {
        type: 'setTokenDecayPercentage',
        data: { address, decayPercentage: decoded.args[0] },
      };
    case 'setDecayInterval':
      return {
        type: 'setTokenDecayInterval',
        data: { address, decayInterval: decoded.args[0] },
      };
    case 'setUseTransferWhitelist':
      return {
        type: 'setTokenUseTransferWhitelist',
        data: { address, useTransferWhitelist: decoded.args[0] },
      };
    case 'setUseReceiveWhitelist':
      return {
        type: 'setTokenUseReceiveWhitelist',
        data: { address, useReceiveWhitelist: decoded.args[0] },
      };
    case 'batchSetTransferWhitelist':
      return {
        type: 'setTokenBatchTransferWhitelist',
        data: {
          address,
          accounts: decoded.args[0] as `0x${string}`[],
          allowed: decoded.args[1] as boolean[],
        },
      };
    case 'batchSetReceiveWhitelist':
      return {
        type: 'setTokenBatchReceiveWhitelist',
        data: {
          address,
          accounts: decoded.args[0] as `0x${string}`[],
          allowed: decoded.args[1] as boolean[],
        },
      };
    case 'batchAddTransferWhitelistSpaces':
      return {
        type: 'setTokenBatchAddTransferWhitelistSpaces',
        data: {
          address,
          spaceIds: decoded.args[0] as readonly bigint[],
        },
      };
    case 'batchRemoveTransferWhitelistSpaces':
      return {
        type: 'setTokenBatchRemoveTransferWhitelistSpaces',
        data: {
          address,
          spaceIds: decoded.args[0] as readonly bigint[],
        },
      };
    case 'batchAddReceiveWhitelistSpaces':
      return {
        type: 'setTokenBatchAddReceiveWhitelistSpaces',
        data: {
          address,
          spaceIds: decoded.args[0] as readonly bigint[],
        },
      };
    case 'batchRemoveReceiveWhitelistSpaces':
      return {
        type: 'setTokenBatchRemoveReceiveWhitelistSpaces',
        data: {
          address,
          spaceIds: decoded.args[0] as readonly bigint[],
        },
      };
    case 'setArchived':
      return {
        type: 'setTokenArchived',
        data: { address, archiveToken: decoded.args[0] },
      };
    case 'setDefaultCreditLimit':
      return {
        type: 'setTokenDefaultCreditLimit',
        data: { address, defaultCreditLimit: decoded.args[0] as bigint },
      };
    case 'batchAddCreditWhitelistSpaces':
      return {
        type: 'setTokenBatchAddCreditWhitelistSpaces',
        data: {
          address,
          spaceIds: decoded.args[0] as readonly bigint[],
        },
      };
    case 'batchRemoveCreditWhitelistSpaces':
      return {
        type: 'setTokenBatchRemoveCreditWhitelistSpaces',
        data: {
          address,
          spaceIds: decoded.args[0] as readonly bigint[],
        },
      };
    default:
      return null;
  }
}

/**
 * Shape of the single `DeployParams` struct arg used by the `deploy*WithMinters`
 * factory functions. Fields are a superset across regular/ownership/decaying:
 * ownership has no `transferable`, only decaying carries decay fields, and only
 * regular carries the mutual-credit fields. Optional members are simply absent
 * for token types that don't define them.
 */
type DeployWithMintersParams = {
  spaceId: bigint;
  name: string;
  symbol: string;
  maxSupply: bigint;
  transferable?: boolean;
  fixedMaxSupply: boolean;
  autoMinting: boolean;
  tokenPrice: bigint;
  priceCurrencyFeed: `0x${string}`;
  useTransferWhitelist: boolean;
  useReceiveWhitelist: boolean;
  initialTransferWhitelist: readonly `0x${string}`[];
  initialReceiveWhitelist: readonly `0x${string}`[];
  initialTransferWhitelistSpaceIds: readonly bigint[];
  initialReceiveWhitelistSpaceIds: readonly bigint[];
  defaultCreditLimit?: bigint;
  initialCreditWhitelistSpaceIds?: readonly bigint[];
  decayPercentage?: bigint;
  decayInterval?: bigint;
};

/**
 * Maps a `deploy*WithMinters` struct arg to the same `token` payload the plain
 * `deploy*Token` handlers produce, so the proposal card renders token info for
 * minter-based deployments too.
 */
const tokenPayloadFromWithMintersParams = (
  p: DeployWithMintersParams,
  tokenType: 'regular' | 'ownership' | 'voice',
): DecodedPayload => ({
  type: 'token',
  data: {
    tokenType,
    spaceId: p.spaceId,
    name: p.name,
    symbol: p.symbol,
    maxSupply: p.maxSupply,
    ...(p.transferable !== undefined && { transferable: p.transferable }),
    fixedMaxSupply: p.fixedMaxSupply,
    autoMinting: p.autoMinting,
    priceInUSD: p.tokenPrice,
    priceCurrencyFeed: p.priceCurrencyFeed,
    useTransferWhitelist: p.useTransferWhitelist,
    useReceiveWhitelist: p.useReceiveWhitelist,
    initialTransferWhitelist: p.initialTransferWhitelist,
    initialReceiveWhitelist: p.initialReceiveWhitelist,
    initialTransferWhitelistSpaceIds: p.initialTransferWhitelistSpaceIds,
    initialReceiveWhitelistSpaceIds: p.initialReceiveWhitelistSpaceIds,
    ...(p.defaultCreditLimit !== undefined && {
      defaultCreditLimit: p.defaultCreditLimit,
    }),
    ...(p.initialCreditWhitelistSpaceIds !== undefined && {
      initialCreditWhitelistSpaceIds: p.initialCreditWhitelistSpaceIds,
    }),
    ...(p.decayPercentage !== undefined && {
      decayPercentage: BigInt(
        decayBasisPointsToFormPercent(Number(p.decayPercentage)),
      ),
    }),
    ...(p.decayInterval !== undefined && { decayInterval: p.decayInterval }),
  },
});

export function decodeTransaction(tx: Tx) {
  const decoders: TransactionDecoder[] = [
    {
      abi: erc20Abi,
      handler: (decoded, tx) =>
        decoded.functionName === 'transfer'
          ? {
              type: 'transfer',
              data: {
                recipient: decoded.args[0],
                rawAmount: decoded.args[1],
                token: tx.target,
                value: tx.value,
              },
            }
          : null,
    },
    {
      abi: escrowImplementationAbi,
      handler: (decoded) => {
        if (decoded.functionName === 'receiveFunds') {
          return {
            type: 'exchangeEscrowReceive',
            data: {
              escrowId: decoded.args[0],
            },
          };
        }
        if (decoded.functionName !== 'createEscrow') return null;
        // Upgraded escrow: explicit partyA + partyB (7 args)
        return {
          type: 'exchangeEscrow',
          data: {
            partyA: decoded.args[0],
            partyB: decoded.args[1],
            tokenA: decoded.args[2],
            tokenB: decoded.args[3],
            amountA: decoded.args[4],
            amountB: decoded.args[5],
            sendFundsNow: decoded.args[6],
          },
        };
      },
    },
    {
      abi: escrowLegacyCreateEscrowAbi,
      handler: (decoded) => {
        if (decoded.functionName !== 'createEscrow') return null;
        // Legacy: partyA was msg.sender (executor) at execution — not in calldata
        return {
          type: 'exchangeEscrow',
          data: {
            partyA: undefined,
            partyB: decoded.args[0],
            tokenA: decoded.args[1],
            tokenB: decoded.args[2],
            amountA: decoded.args[3],
            amountB: decoded.args[4],
            sendFundsNow: decoded.args[5],
          },
        };
      },
    },
    {
      abi: regularTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'regular',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
                /**
                 * Whitelist space ids (added in the same release as the new
                 * factory deployments) live at args[13]/[14]; the credit fields
                 * shift to args[15]/[16].
                 */
                initialTransferWhitelistSpaceIds: decoded.args[13],
                initialReceiveWhitelistSpaceIds: decoded.args[14],
                defaultCreditLimit: decoded.args[15],
                initialCreditWhitelistSpaceIds: decoded.args[16],
              },
            }
          : null,
    },
    {
      abi: ownershipTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'ownership',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                fixedMaxSupply: decoded.args[4],
                autoMinting: decoded.args[5],
                priceInUSD: decoded.args[6],
                priceCurrencyFeed: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
                initialTransferWhitelistSpaceIds: decoded.args[12],
                initialReceiveWhitelistSpaceIds: decoded.args[13],
              },
            }
          : null,
    },
    {
      abi: decayingTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'voice',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
                initialTransferWhitelistSpaceIds: decoded.args[13],
                initialReceiveWhitelistSpaceIds: decoded.args[14],
                decayPercentage: BigInt(
                  decayBasisPointsToFormPercent(
                    Number(decoded.args[15] as bigint),
                  ),
                ),
                decayInterval: decoded.args[16],
              },
            }
          : null,
    },
    /**
     * `deploy*WithMinters` variants take a single `DeployParams` struct arg.
     * They live on the same generated factory ABIs, so the plain `deploy*Token`
     * handlers above return null for them and decoding falls through to here.
     */
    {
      abi: regularTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployTokenWithMinters'
          ? tokenPayloadFromWithMintersParams(
              decoded.args[0] as DeployWithMintersParams,
              'regular',
            )
          : null,
    },
    {
      abi: ownershipTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipTokenWithMinters'
          ? tokenPayloadFromWithMintersParams(
              decoded.args[0] as DeployWithMintersParams,
              'ownership',
            )
          : null,
    },
    {
      abi: decayingTokenFactoryAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingTokenWithMinters'
          ? tokenPayloadFromWithMintersParams(
              decoded.args[0] as DeployWithMintersParams,
              'voice',
            )
          : null,
    },
    /**
     * Pre-whitelist-space-ids ABI fallbacks: proposals encoded against the
     * previous factory shape (purchase + credit args, no transfer/receive
     * whitelist space ids) must keep decoding with the old positions.
     */
    {
      abi: regularTokenFactoryDeployCreditOnlyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'regular',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
                defaultCreditLimit: decoded.args[13],
                initialCreditWhitelistSpaceIds: decoded.args[14],
              },
            }
          : null,
    },
    {
      abi: ownershipTokenFactoryDeployPurchaseOnlyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'ownership',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                fixedMaxSupply: decoded.args[4],
                autoMinting: decoded.args[5],
                priceInUSD: decoded.args[6],
                priceCurrencyFeed: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
              },
            }
          : null,
    },
    {
      abi: decayingTokenFactoryDeployPurchaseOnlyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'voice',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
                decayPercentage: BigInt(
                  decayBasisPointsToFormPercent(
                    Number(decoded.args[13] as bigint),
                  ),
                ),
                decayInterval: decoded.args[14],
              },
            }
          : null,
    },
    {
      abi: regularTokenFactoryDeployPrePurchaseAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'regular',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
              },
            }
          : null,
    },
    {
      abi: ownershipTokenFactoryDeployPrePurchaseAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'ownership',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                fixedMaxSupply: decoded.args[4],
                autoMinting: decoded.args[5],
                priceInUSD: decoded.args[6],
                priceCurrencyFeed: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
              },
            }
          : null,
    },
    {
      abi: decayingTokenFactoryDeployPrePurchaseAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'voice',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                priceCurrencyFeed: decoded.args[8],
                useTransferWhitelist: decoded.args[9],
                useReceiveWhitelist: decoded.args[10],
                initialTransferWhitelist: decoded.args[11],
                initialReceiveWhitelist: decoded.args[12],
                decayPercentage: BigInt(
                  decayBasisPointsToFormPercent(
                    Number(decoded.args[13] as bigint),
                  ),
                ),
                decayInterval: decoded.args[14],
              },
            }
          : null,
    },
    {
      abi: regularTokenFactoryDeployLegacyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'regular',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
              },
            }
          : null,
    },
    {
      abi: ownershipTokenFactoryDeployLegacyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployOwnershipToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'ownership',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                fixedMaxSupply: decoded.args[4],
                autoMinting: decoded.args[5],
                priceInUSD: decoded.args[6],
                useTransferWhitelist: decoded.args[7],
                useReceiveWhitelist: decoded.args[8],
                initialTransferWhitelist: decoded.args[9],
                initialReceiveWhitelist: decoded.args[10],
              },
            }
          : null,
    },
    {
      abi: decayingTokenFactoryDeployLegacyAbi,
      handler: (decoded) =>
        decoded.functionName === 'deployDecayingToken'
          ? {
              type: 'token',
              data: {
                tokenType: 'voice',
                spaceId: decoded.args[0],
                name: decoded.args[1],
                symbol: decoded.args[2],
                maxSupply: decoded.args[3],
                transferable: decoded.args[4],
                fixedMaxSupply: decoded.args[5],
                autoMinting: decoded.args[6],
                priceInUSD: decoded.args[7],
                useTransferWhitelist: decoded.args[8],
                useReceiveWhitelist: decoded.args[9],
                initialTransferWhitelist: decoded.args[10],
                initialReceiveWhitelist: decoded.args[11],
                decayPercentage: BigInt(
                  decayBasisPointsToFormPercent(
                    Number(decoded.args[12] as bigint),
                  ),
                ),
                decayInterval: decoded.args[13],
              },
            }
          : null,
    },
    {
      abi: daoSpaceFactoryImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'changeVotingMethod'
          ? {
              type: 'votingMethod',
              data: {
                spaceId: decoded.args[0],
                votingPowerSource: decoded.args[1],
                unity: decoded.args[2],
                quorum: decoded.args[3],
              },
            }
          : decoded.functionName === 'changeEntryMethod'
          ? {
              type: 'entryMethod',
              data: {
                spaceId: decoded.args[0],
                joinMethod: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: decayingSpaceTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'mint'
          ? {
              type: 'mint',
              data: {
                member: decoded.args[0],
                number: decoded.args[1],
              },
            }
          : decoded.functionName === 'configureTokenSale'
          ? {
              type: 'spaceTokenPurchase',
              data: {
                tokenAddress: '',
                paymentToken: decoded.args[0],
                paymentTokenPricePerToken: decoded.args[1],
                tokensForSale: decoded.args[2],
              },
            }
          : null,
    },
    {
      abi: decayingSpaceTokenAbi,
      handler: (decoded) => {
        return decoded.functionName === 'burnFrom'
          ? {
              type: 'burn',
              data: {
                member: decoded.args[0],
                number: decoded.args[1],
              },
            }
          : decoded.functionName === 'burn'
          ? {
              type: 'burn',
              data: {
                member: ZERO_ADDRESS,
                number: decoded.args[0],
              },
            }
          : null;
      },
    },
    {
      abi: tokenBalanceJoinImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'setTokenRequirement'
          ? {
              type: 'tokenRequirement',
              data: {
                spaceId: decoded.args[0],
                token: decoded.args[1],
                amount: decoded.args[2],
              },
            }
          : null,
    },
    {
      abi: tokenVotingPowerImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'setSpaceToken'
          ? {
              type: 'votingToken',
              data: {
                spaceId: decoded.args[0],
                token: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: voteDecayTokenVotingPowerImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'setSpaceToken'
          ? {
              type: 'votingToken',
              data: {
                spaceId: decoded.args[0],
                token: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: hyphaTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'investInHypha'
          ? {
              type: 'investInHypha',
              data: {
                amount: decoded.args[0],
              },
            }
          : null,
    },
    {
      abi: hyphaTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'payForSpaces'
          ? {
              type: 'payForSpaces',
              data: {
                spaceIds: decoded.args[0],
                paymentAmounts: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: hyphaTokenAbi,
      handler: (decoded) =>
        decoded.functionName === 'payInHypha'
          ? {
              type: 'payInHypha',
              data: {
                spaceIds: decoded.args[0],
                paymentAmounts: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: votingPowerDelegationImplementationAbi,
      handler: (decoded) => {
        return decoded.functionName === 'delegate'
          ? {
              type: 'delegate',
              data: {
                member: decoded.args[0],
                space: decoded.args[1],
              },
            }
          : null;
      },
    },
    {
      abi: daoSpaceFactoryImplementationAbi,
      handler: (decoded) => {
        return decoded.functionName === 'joinSpace'
          ? {
              type: 'joinSpace',
              data: {
                spaceId: decoded.args[0],
              },
            }
          : decoded.functionName === 'setSpaceDiscoverability'
          ? {
              type: 'setSpaceDiscoverability',
              data: {
                spaceId: decoded.args[0],
                discoverability: decoded.args[1],
              },
            }
          : decoded.functionName === 'setSpaceAccess'
          ? {
              type: 'setSpaceAccess',
              data: {
                spaceId: decoded.args[0],
                access: decoded.args[1],
              },
            }
          : null;
      },
    },
    {
      abi: daoProposalsImplementationAbi,
      handler: (decoded) => {
        return decoded.functionName === 'setMinimumProposalDuration'
          ? {
              type: 'setMinimumProposalDuration',
              data: {
                spaceId: decoded.args[0],
                duration: decoded.args[1],
              },
            }
          : null;
      },
    },
    {
      abi: daoSpaceFactoryImplementationAbi,
      handler: (decoded) =>
        decoded.functionName === 'removeMember'
          ? {
              type: 'membershipExit',
              data: {
                space: decoded.args[0],
                member: decoded.args[1],
              },
            }
          : null,
    },
    {
      abi: tokenBackingVaultImplementationAbi,
      handler: (decoded) => {
        const spaceId = decoded.args[0];
        const spaceToken = decoded.args[1] as string;
        const base = { spaceId, spaceToken };
        switch (decoded.functionName) {
          case 'addBacking':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'addBacking',
                ...base,
                backingTokens: decoded.args[2] as `0x${string}`[],
                fundingAmounts: decoded.args[3] as bigint[],
              },
            };
          case 'addBackingToken':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'addBackingToken',
                ...base,
                backingTokens: decoded.args[2] as `0x${string}`[],
                priceFeeds: decoded.args[3] as `0x${string}`[],
                tokenDecimals: decoded.args[4] as number[],
                fundingAmounts: decoded.args[5] as bigint[],
                minimumBackingBps: decoded.args[6] as bigint,
                redemptionPrice: decoded.args[7] as bigint,
                redemptionPriceCurrencyFeed: decoded.args[8] as `0x${string}`,
                maxRedemptionBps: decoded.args[9] as bigint,
                maxRedemptionPeriodDays: decoded.args[10] as bigint,
              },
            };
          case 'setRedeemEnabled':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setRedeemEnabled',
                ...base,
                enabled: decoded.args[2] as boolean,
              },
            };
          case 'setRedemptionStartDate':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setRedemptionStartDate',
                ...base,
                startDate: decoded.args[2] as bigint,
              },
            };
          case 'setRedemptionPrice':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setRedemptionPrice',
                ...base,
                price: decoded.args[2] as bigint,
                currencyFeed: decoded.args[3] as `0x${string}`,
              },
            };
          case 'setMaxRedemptionPercentage':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setMaxRedemptionPercentage',
                ...base,
                maxRedemptionBps: decoded.args[2] as bigint,
                periodDays: decoded.args[3] as bigint,
              },
            };
          case 'setMinimumBacking':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setMinimumBacking',
                ...base,
                minimumBackingBps: decoded.args[2] as bigint,
              },
            };
          case 'withdrawBacking':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'withdrawBacking',
                ...base,
                backingToken: decoded.args[2] as `0x${string}`,
                amount: decoded.args[3] as bigint,
              },
            };
          case 'setWhitelistEnabled':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'setWhitelistEnabled',
                ...base,
                enabled: decoded.args[2] as boolean,
              },
            };
          case 'addToWhitelist':
            return {
              type: 'tokenBackingVault',
              data: {
                action: 'addToWhitelist',
                ...base,
                accounts: decoded.args[2] as `0x${string}`[],
              },
            };
          case 'redeem':
            return {
              type: 'redeemTokens',
              data: {
                web3SpaceId: decoded.args[0],
                token: decoded.args[1],
                amount: decoded.args[2],
                backingTokens: decoded.args[3],
                proportions: decoded.args[4],
              },
            };
          default:
            return null;
        }
      },
    },
    {
      abi: decayingSpaceTokenAbi,
      handler: (decoded, tx) =>
        decodeDecayingSpaceTokenAdminProposal(decoded, tx),
    },
  ];

  for (const { abi, handler } of decoders) {
    try {
      const decoded = decodeFunctionData({
        abi,
        data: tx.data,
      }) as DecodedTransaction;
      const result = handler(decoded, tx);
      if (result) return result;
    } catch {
      continue;
    }
  }

  return null;
}
