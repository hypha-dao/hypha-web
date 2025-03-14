import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';
import { base } from 'viem/chains';

export type CreateSpaceWeb3Input = {
  unity?: bigint;
  quorum?: bigint;
  votingPowerSource?: bigint;
  exitMethod?: bigint;
  joinMethod?: bigint;
};

export type CreateSpaceWeb3Config = {
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
};

export const createSpaceWeb3 = (
  {
    unity = 0n,
    quorum = 0n,
    votingPowerSource = 0n,
    exitMethod = 0n,
    joinMethod = 0n,
  }: CreateSpaceWeb3Input,
  { chain = base.id }: CreateSpaceWeb3Config = {},
) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  const callConfig = {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'createSpace' as const,
    args: [
      {
        unity,
        quorum,
        votingPowerSource,
        exitMethod,
        joinMethod,
      },
    ] as const,
  };
  return callConfig;
};
