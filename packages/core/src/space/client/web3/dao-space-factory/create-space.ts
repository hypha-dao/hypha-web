import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';
import { schemaCreateSpaceWeb3 } from '@core/space/validation';
import { base } from 'viem/chains';
import { z } from 'zod';

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

export const mapToCreateSpaceWeb3Input = (
  d: z.infer<typeof schemaCreateSpaceWeb3>,
): CreateSpaceWeb3Input => ({
  unity: BigInt(d.unity ?? 80),
  quorum: BigInt(d.quorum ?? 20),
  votingPowerSource: BigInt(d.votingPowerSource ?? 0),
  exitMethod: BigInt(d.exitMethod ?? 0),
  joinMethod: BigInt(d.joinMethod ?? 0),
});

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
