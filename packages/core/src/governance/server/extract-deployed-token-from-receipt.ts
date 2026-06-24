import 'server-only';

import { parseEventLogs } from 'viem';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '@hypha-platform/core/generated';

import { web3Client } from '../../common/server/web3-rpc/client';

export type DeployedTokenInfo = {
  tokenAddress: `0x${string}`;
  spaceId: bigint;
  name: string;
  symbol: string;
};

/**
 * Server-side counterpart of the client `extractTokenAddressFromReceipt`.
 * Reads a proposal-execution receipt and pulls the deployed token address from
 * the factory `TokenDeployed` event. Works for both the plain `deploy*Token`
 * and `deploy*WithMinters` paths since they emit the same event.
 *
 * Returns `null` when the receipt has no `TokenDeployed` log (e.g. the executed
 * proposal didn't deploy a token).
 */
export const extractDeployedTokenFromReceipt = async (
  transactionHash: `0x${string}`,
): Promise<DeployedTokenInfo | null> => {
  const receipt = await web3Client.getTransactionReceipt({
    hash: transactionHash,
  });

  const logs = parseEventLogs({
    abi: [
      ...regularTokenFactoryAbi,
      ...ownershipTokenFactoryAbi,
      ...decayingTokenFactoryAbi,
    ],
    logs: receipt.logs,
    strict: false,
  });

  const deployLog = logs.find((log) => log.eventName === 'TokenDeployed');
  if (!deployLog) return null;

  const args = deployLog.args as {
    tokenAddress: `0x${string}`;
    spaceId: bigint;
    name: string;
    symbol: string;
  };

  return {
    tokenAddress: args.tokenAddress,
    spaceId: args.spaceId,
    name: args.name,
    symbol: args.symbol,
  };
};
