import { ethers } from "hardhat";
import type { DAOProposalsImplementation } from "../../typechain-types";

export interface ProposalParams {
  spaceId: number;
  duration: number;
  targetContract: string;
  executionData: string;
  value: number;
  question?: string;
  description?: string;
}

export class ProposalHelper {
  constructor(public contract: DAOProposalsImplementation) {}

  async createDefaultProposal(overrides: Partial<ProposalParams> = {}) {
    const defaultParams: ProposalParams = {
      spaceId: 1,
      duration: 86400,
      targetContract: ethers.Wallet.createRandom().address,
      executionData: "0x1234",
      value: 0,
      ...overrides
    };

    return this.contract.createProposal(defaultParams);
  }

  async vote(proposalId: number, voter: ethers.Signer, support: boolean) {
    return this.contract.connect(voter).vote(proposalId, support);
  }

  async getProposalCore(proposalId: number) {
    return this.contract.getProposalCore(proposalId);
  }

  async hasVoted(proposalId: number, voter: string) {
    return this.contract.hasVoted(proposalId, voter);
  }
} 