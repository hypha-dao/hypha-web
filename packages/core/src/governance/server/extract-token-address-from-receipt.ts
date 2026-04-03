import { parseEventLogs } from 'viem';
import { web3Client } from '../../common/server/web3-rpc/client';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '../../generated';

/**
 * Reads `TokenDeployed` from an execution transaction receipt (issue-token proposals).
 */
export async function extractTokenAddressFromExecutionReceipt(
  txHash: `0x${string}`,
): Promise<`0x${string}` | undefined> {
  const receipt = await web3Client.getTransactionReceipt({ hash: txHash });
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
  if (!deployLog || deployLog.args === undefined) {
    return undefined;
  }
  const addr = (deployLog.args as { tokenAddress?: `0x${string}` })
    .tokenAddress;
  return typeof addr === 'string' && addr.startsWith('0x')
    ? (addr as `0x${string}`)
    : undefined;
}
