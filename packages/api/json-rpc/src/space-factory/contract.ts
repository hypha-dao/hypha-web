import { ethers } from 'ethers';
import { spaceFactoryAbi } from './abi';
import { provider } from '../provider';

export const spaceFactoryContract = new ethers.Contract(
  process.env.DAO_SPACE_FACTORY_ADDRESS!,
  spaceFactoryAbi,
  provider,
);

export const isMember = async (spaceId: number, userAddress: string) => {
  return await spaceFactoryContract.isMember(spaceId, userAddress);
};
