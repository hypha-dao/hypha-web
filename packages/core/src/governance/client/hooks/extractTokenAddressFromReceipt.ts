import { publicClient } from '@hypha-platform/core/client';
import {
  regularTokenFactoryAbi,
  ownershipTokenFactoryAbi,
  decayingTokenFactoryAbi,
} from '@hypha-platform/core/generated';
import { parseEventLogs } from 'viem';

export const extractTokenAddressFromReceipt = async (txHash: `0x${string}`) => {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
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

    if (deployLog) {
      return deployLog.args.tokenAddress as string;
    } else {
      throw new Error('TokenDeployed event not found in logs');
    }
  } catch (error) {
    console.error('Failed to extract token address:', error);
    throw error;
  }
};
