import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import { schemaCreateSpaceWeb3 } from '@hypha-platform/core/client';
import { base } from 'viem/chains';
import { z } from 'zod';

export type CreateSpaceWeb3Input = {
  unity?: bigint;
  quorum?: bigint;
  votingPowerSource?: bigint;
  exitMethod?: bigint;
  joinMethod?: bigint;
  access?: bigint;
  discoverability?: bigint;
};

export type CreateSpaceWeb3Config = {
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
};

export const mapToCreateSpaceWeb3Input = (
  d: z.infer<typeof schemaCreateSpaceWeb3>,
): CreateSpaceWeb3Input => ({
  unity: BigInt(d.unity ?? 80),
  quorum: BigInt(d.quorum ?? 50),
  votingPowerSource: BigInt(d.votingPowerSource ?? 0),
  exitMethod: BigInt(d.exitMethod ?? 0),
  joinMethod: BigInt(d.joinMethod ?? 0),
  access: d.access !== undefined ? BigInt(d.access) : 2n,
  discoverability:
    d.discoverability !== undefined ? BigInt(d.discoverability) : 0n,
});

export const createSpaceWeb3 = (
  {
    unity = 0n,
    quorum = 0n,
    votingPowerSource = 0n,
    exitMethod = 0n,
    joinMethod = 2n,
    access = 2n,
    discoverability = 0n,
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
        access,
        discoverability,
      },
    ] as const,
  };
  return callConfig;
};
