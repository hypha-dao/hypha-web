import { ethers } from 'hardhat';
import type { DAOSpaceFactoryImplementation } from '../../typechain-types';

export interface SpaceParams {
  unity: number;
  quorum: number;
  votingPowerSource: number;
  exitMethod: number;
  joinMethod: number;
  access: number;
  discoverability: number;
}

export class SpaceHelper {
  constructor(public contract: DAOSpaceFactoryImplementation) {}

  async createDefaultSpace() {
    const spaceParams = {
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 1,
      access: 0,
      discoverability: 0,
    };

    return this.contract.createSpace(spaceParams);
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
    await this.createDefaultSpace();
    return this.contract.connect(member).joinSpace(1);
  }

  async joinSpace(spaceId: number, member: ethers.Signer) {
    return this.contract.connect(member).joinSpace(spaceId);
  }
}
