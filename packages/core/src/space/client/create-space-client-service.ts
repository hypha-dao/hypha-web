import { createEventSubscription } from '@core/common/event-subscription';
import { Config, writeContract } from '@wagmi/core';
import { z } from 'zod';
import {
  schemaCreateSpace,
  schemaCreateSpaceWeb2,
  schemaCreateSpaceWeb3,
} from '../validation';
import { ApiConfig, createSpaceWeb2, updateSpaceWeb2 } from './web2';
import {
  createSpaceWeb3,
  getSpaceIdFromLogs,
  type CreateSpaceWeb3Input,
} from './web3';
import { publicClient } from '@core/common/web3/public-client';
import {
  Web3SpaceNotFoundInTransactionLog,
  Web2SpaceCreationError,
  Web3SpaceCreationError,
  SpaceLinkingError,
} from '../errors';
import {} from '.';
import {
  errorTask,
  finishTask,
  resetService,
  ServiceState,
  startTask,
  subscribeToServiceState,
} from './create-space-client-service.state';

const mapToCreateSpaceWeb3Input = (
  d: z.infer<typeof schemaCreateSpaceWeb3>,
): CreateSpaceWeb3Input => ({
  unity: BigInt(d.unity),
  quorum: BigInt(d.quorum),
  votingPowerSource: BigInt(d.votingPowerSource),
  exitMethod: BigInt(d.exitMethod),
  joinMethod: BigInt(d.joinMethod),
});

type SpaceClientConfig = {
  web3: Config;
  web2: ApiConfig;
};

// Define a type for subscriber callbacks
type Subscriber = (state: any) => void;

export const createSpaceClientService = (config: SpaceClientConfig) => {
  const { subscribe, send } = createEventSubscription<ServiceState>();
  subscribeToServiceState(send);

  const _waitForSpaceCreatedEvent = async (hash: `0x${string}`) => {
    const { logs } = await publicClient.waitForTransactionReceipt({
      hash,
    });
    const spaceId = getSpaceIdFromLogs(logs);
    if (!spaceId) throw new Web3SpaceNotFoundInTransactionLog(hash);
    return spaceId;
  };

  return {
    subscribe,
    reset: resetService,

    createSpace: async (data: z.infer<typeof schemaCreateSpace>) => {
      startTask('CREATE_WEB2_SPACE');
      startTask('CREATE_WEB3_SPACE');
      const inputCreateSpaceWeb2 = schemaCreateSpaceWeb2.parse(data);
      const inputCreateSpaceWeb3 = schemaCreateSpaceWeb3.parse(data);

      // Launch both creation processes in parallel
      const [web2Result, transactionHash] = await Promise.all([
        createSpaceWeb2(inputCreateSpaceWeb2, config.web2)
          .catch((e) => {
            errorTask('CREATE_WEB2_SPACE', e.message);
            throw new Web2SpaceCreationError('could not create web2 space');
          })
          .finally(() => finishTask('CREATE_WEB2_SPACE')),
        writeContract(
          config.web3,
          createSpaceWeb3(mapToCreateSpaceWeb3Input(inputCreateSpaceWeb3)),
        )
          .catch((e) => {
            errorTask('CREATE_WEB3_SPACE', e.message);
            throw new Web3SpaceCreationError('could not create web3 space');
          })
          .finally(() => finishTask('CREATE_WEB3_SPACE')),
      ]);

      startTask('GET_WEB3_SPACE_CREATED_EVENT');
      const spaceId = await _waitForSpaceCreatedEvent(transactionHash)
        .catch((e) => {
          errorTask('GET_WEB3_SPACE_CREATED_EVENT', e.message);
          throw new Web3SpaceNotFoundInTransactionLog(transactionHash);
        })
        .finally(() => finishTask('GET_WEB3_SPACE_CREATED_EVENT'));

      startTask('LINK_WEB2_AND_WEB3_SPACE');
      const space = await updateSpaceWeb2(
        {
          web3SpaceId: spaceId,
        },
        {
          endpoint: `/api/v1/spaces/${web2Result.slug}/update`,
          headers: config.web2.headers,
        },
      )
        .catch((e) => {
          errorTask('LINK_WEB2_AND_WEB3_SPACE', e.message);
          throw new SpaceLinkingError(`Failed to link spaces: ${e.message}`);
        })
        .finally(() => {
          finishTask('LINK_WEB2_AND_WEB3_SPACE');
        });
      return space;
    },
  };
};

export { type ServiceState as CreateSpaceServiceState } from './create-space-client-service.state';
