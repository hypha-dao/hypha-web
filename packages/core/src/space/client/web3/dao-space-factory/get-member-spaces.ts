import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';

export const getMemberSpaces = ({
  memberAddress,
  chain = 8453,
}: {
  memberAddress: `0x${string}`;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  return {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'getMemberSpaces',
    args: [memberAddress],
  } as const;
};
