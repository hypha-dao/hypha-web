import { publicClient } from '@core/common/web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@core/generated';

export const getSpaceProposals = async ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof daoProposalsImplementationAddress;
}) => {
  const address = daoProposalsImplementationAddress[chain];

  const [accepted, rejected] = await publicClient.readContract({
    address,
    abi: daoProposalsImplementationAbi,
    functionName: 'getSpaceProposals',
    args: [spaceId],
  });

  return { accepted, rejected };
};
