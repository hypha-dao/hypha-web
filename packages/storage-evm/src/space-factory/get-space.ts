import { readContract } from '@wagmi/core';
import { config } from '../config';
import { spaceFactoryAbi, spaceFactoryAddress } from '../generated';

export const getSpace = async ({
  slug,
  chain = 31337,
}: {
  slug: string;
  chain?: keyof typeof spaceFactoryAddress;
}) => {
  const address = spaceFactoryAddress[chain];

  const result = await readContract(config, {
    address,
    abi: spaceFactoryAbi,
    functionName: 'getSpace',
    args: [slug],
  });

  return result;
};
