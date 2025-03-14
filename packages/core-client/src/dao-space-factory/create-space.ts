import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '../generated';

export const createSpace = ({
  unity = 0n,
  quorum = 0n,
  votingPowerSource = 0n,
  exitMethod = 0n,
  joinMethod = 0n,
  chain = 8453,
}: {
  unity?: bigint;
  quorum?: bigint;
  votingPowerSource?: bigint;
  exitMethod?: bigint;
  joinMethod?: bigint;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
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
