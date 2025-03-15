import { publicClient } from '@core/common/web3/public-client';
import { getSpaceIdFromLogs } from './get-space-created-event';
import { Web3SpaceNotFoundInTransactionLog } from '@core/space/errors';

type WaitForSpaceCreatedEventInput = {
  hash: `0x${string}`;
};
export const waitForSpaceTransactionReceipt = async ({
  hash,
}: WaitForSpaceCreatedEventInput) => {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  return receipt;
};
