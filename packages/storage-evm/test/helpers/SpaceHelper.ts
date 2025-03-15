import { ethers } from 'hardhat';
import type { DAOSpaceFactoryImplementation } from '../../typechain-types';

export interface SpaceParams {
  name: string;
  description: string;
  imageUrl: string;
  unity: number;
  quorum: number;
  votingPowerSource: number;
  exitMethod: number;
  joinMethod: number;
  createToken: boolean;
  tokenName: string;
  tokenSymbol: string;
}

export class SpaceHelper {
  constructor(public contract: DAOSpaceFactoryImplementation) {}

  async createDefaultSpace(overrides: Partial<SpaceParams> = {}) {
    const defaultParams: SpaceParams = {
      name: 'Test Space',
      description: 'Test Description',
      imageUrl: 'https://test.com/image.png',
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
      ...overrides,
    };

    return this.contract.createSpace(defaultParams);
  }

  async getSpaceDetails(spaceId: number) {
    return this.contract.getSpaceDetails(spaceId);
  }

  async getSpaceMembers(spaceId: number) {
    return this.contract.getSpaceMembers(spaceId);
  }

  async createAndJoinSpace(
    member: ethers.Signer,
    overrides: Partial<SpaceParams> = {},
  ) {
    await this.createDefaultSpace(overrides);
    return this.contract.connect(member).joinSpace(1);
  }

  async joinSpace(spaceId: number, member: ethers.Signer) {
    return this.contract.connect(member).joinSpace(spaceId);
  }
}
