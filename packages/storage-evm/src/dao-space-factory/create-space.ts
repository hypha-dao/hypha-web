import { writeContract } from '@wagmi/core';
import { config } from '../config';
import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '../generated';

export const createSpace = async ({
  name,
  description = '',
  imageUrl = '',
  unity = 0n,
  quorum = 0n,
  votingPowerSource = 0n,
  exitMethod = 0n,
  joinMethod = 0n,
  createToken = false,
  tokenName = '',
  tokenSymbol = '',
  chain = 8453,
}: {
  name: string;
  description?: string;
  imageUrl?: string;
  unity?: bigint;
  quorum?: bigint;
  votingPowerSource?: bigint;
  exitMethod?: bigint;
  joinMethod?: bigint;
  createToken?: boolean;
  tokenName?: string;
  tokenSymbol?: string;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const spaceId = await writeContract(config, {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'createSpace',
    args: [
      {
        name,
        description,
        imageUrl,
        unity,
        quorum,
        votingPowerSource,
        exitMethod,
        joinMethod,
        createToken,
        tokenName,
        tokenSymbol,
      },
    ],
  });
  return spaceId;
};
