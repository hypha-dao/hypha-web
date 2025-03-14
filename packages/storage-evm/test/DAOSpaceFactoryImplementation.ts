import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("DAOSpaceFactoryImplementation", function () {
  // We define a fixture to reuse the same setup in every test
  async function deployDAOSpaceFactoryFixture() {
    // Get the signers
    const [owner, otherAccount] = await ethers.getSigners();

    // Deploy the contract
    const DAOSpaceFactory = await ethers.getContractFactory("DAOSpaceFactoryImplementation");
    const daoSpaceFactory = await upgrades.deployProxy(DAOSpaceFactory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups',
    });

    // Deploy mock contracts for testing
    const MockProposalManager = await ethers.getContractFactory("MockProposalManager");
    const mockProposalManager = await MockProposalManager.deploy();

    return { daoSpaceFactory, mockProposalManager, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { daoSpaceFactory, owner } = await loadFixture(deployDAOSpaceFactoryFixture);
      expect(await daoSpaceFactory.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero spaces", async function () {
      const { daoSpaceFactory } = await loadFixture(deployDAOSpaceFactoryFixture);
      // Instead of checking space details, we can verify the counter is 0
      await expect(daoSpaceFactory.getSpaceDetails(1))
        .to.be.revertedWith("Invalid space ID");
    });
  });

  describe("Space Creation", function () {
    it("Should create a new space with correct parameters", async function () {
      const { daoSpaceFactory, mockProposalManager, owner } = await loadFixture(deployDAOSpaceFactoryFixture);
      
      // Set required contracts first with mock addresses
      await daoSpaceFactory.setContracts(
        ethers.ZeroAddress, // tokenFactory
        ethers.ZeroAddress, // joinMethodDirectory
        ethers.ZeroAddress, // exitMethodDirectory
        await mockProposalManager.getAddress()  // proposalManager - needs to be set
      );

      const spaceParams = {
        name: "Test Space",
        description: "Test Description",
        imageUrl: "https://test.com/image.png",
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: "",
        tokenSymbol: ""
      };

      await expect(daoSpaceFactory.createSpace(spaceParams))
        .to.emit(daoSpaceFactory, "SpaceCreated")
        .withArgs(
          1, // spaceId
          spaceParams.name,
          spaceParams.description,
          spaceParams.imageUrl,
          spaceParams.unity,
          spaceParams.quorum,
          spaceParams.votingPowerSource,
          spaceParams.exitMethod,
          spaceParams.joinMethod,
          owner.address,
          anyValue // executor address
        );
    });

    it("Should fail if space name is empty", async function () {
      const { daoSpaceFactory, mockProposalManager } = await loadFixture(deployDAOSpaceFactoryFixture);
      
      await daoSpaceFactory.setContracts(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        await mockProposalManager.getAddress()
      );

      const spaceParams = {
        name: "", // Empty name
        description: "Test Description",
        imageUrl: "https://test.com/image.png",
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: "",
        tokenSymbol: ""
      };

      await expect(daoSpaceFactory.createSpace(spaceParams))
        .to.be.revertedWith("Space name cannot be empty");
    });
  });

  describe("Space Membership", function () {
    it("Should allow joining a space", async function () {
      const { daoSpaceFactory, mockProposalManager, owner, otherAccount } = await loadFixture(deployDAOSpaceFactoryFixture);
      
      // Setup space first
      await daoSpaceFactory.setContracts(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        await mockProposalManager.getAddress()
      );

      const spaceParams = {
        name: "Test Space",
        description: "Test Description",
        imageUrl: "https://test.com/image.png",
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: "",
        tokenSymbol: ""
      };

      await daoSpaceFactory.createSpace(spaceParams);
      
      // Test joining
      await expect(daoSpaceFactory.connect(otherAccount).joinSpace(1))
        .to.emit(daoSpaceFactory, "MemberJoined")
        .withArgs(1, otherAccount.address);
    });
  });
}); 