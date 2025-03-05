import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SpaceHelper } from "./helpers/SpaceHelper";

describe("DAOSpaceFactoryImplementation", function () {
  // We define a fixture to reuse the same setup in every test
  async function deployFixture() {
    const [owner, proposer, voter1, voter2, voter3, other] = await ethers.getSigners();

    // Deploy TokenFactory
    const TokenFactory = await ethers.getContractFactory("TokenFactoryImplementation");
    const tokenFactory = await upgrades.deployProxy(TokenFactory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups'
    });

    // Deploy JoinMethodDirectory with OpenJoin
    const JoinMethodDirectory = await ethers.getContractFactory("JoinMethodDirectoryImplementation");
    const joinMethodDirectory = await upgrades.deployProxy(JoinMethodDirectory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups'
    });

    const OpenJoin = await ethers.getContractFactory("OpenJoin");
    const openJoin = await OpenJoin.deploy();
    await joinMethodDirectory.addJoinMethod(1, await openJoin.getAddress());

    // Deploy ExitMethodDirectory with NoExit
    const ExitMethodDirectory = await ethers.getContractFactory("ExitMethodDirectoryImplementation");
    const exitMethodDirectory = await upgrades.deployProxy(ExitMethodDirectory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups'
    });

    const NoExit = await ethers.getContractFactory("NoExit");
    const noExit = await NoExit.deploy();
    await exitMethodDirectory.addExitMethod(1, await noExit.getAddress());

    // Deploy VotingPowerDirectory
    const VotingPowerDirectory = await ethers.getContractFactory("VotingPowerDirectoryImplementation");
    const votingPowerDirectory = await upgrades.deployProxy(VotingPowerDirectory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups'
    });

    // Deploy the main DAOSpaceFactory contract
    const DAOSpaceFactory = await ethers.getContractFactory("DAOSpaceFactoryImplementation");
    const daoSpaceFactory = await upgrades.deployProxy(DAOSpaceFactory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups'
    });

    // Set contracts in DAOSpaceFactory
    await daoSpaceFactory.setContracts(
      await tokenFactory.getAddress(),
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await votingPowerDirectory.getAddress()
    );

    // Set DAOSpaceFactory address in TokenFactory
    await tokenFactory.setSpacesContract(await daoSpaceFactory.getAddress());

    // Set DAOSpaceFactory in directories
    await joinMethodDirectory.setSpaceFactory(await daoSpaceFactory.getAddress());
    await exitMethodDirectory.setSpaceFactory(await daoSpaceFactory.getAddress());

    const spaceHelper = new SpaceHelper(daoSpaceFactory);

    return {
      daoSpaceFactory,
      tokenFactory,
      joinMethodDirectory,
      exitMethodDirectory,
      votingPowerDirectory,
      owner,
      proposer,
      voter1,
      voter2,
      voter3,
      other,
      spaceHelper,
    };
  }

  describe("Deployment & Initialization", function() {
    it("Should set the right owner", async function() {
      const { daoSpaceFactory, owner } = await loadFixture(deployFixture);
      expect(await daoSpaceFactory.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero spaces", async function() {
      const { daoSpaceFactory } = await loadFixture(deployFixture);
      await expect(daoSpaceFactory.getSpaceDetails(1))
        .to.be.revertedWith("Invalid space ID");
    });

    it("Should set contract addresses correctly", async function() {
      const { daoSpaceFactory, tokenFactory, joinMethodDirectory, exitMethodDirectory, votingPowerDirectory } = await loadFixture(deployFixture);
      
      expect(await daoSpaceFactory.tokenFactoryAddress()).to.equal(await tokenFactory.getAddress());
      expect(await daoSpaceFactory.joinMethodDirectoryAddress()).to.equal(await joinMethodDirectory.getAddress());
      expect(await daoSpaceFactory.exitMethodDirectoryAddress()).to.equal(await exitMethodDirectory.getAddress());
      expect(await daoSpaceFactory.proposalManagerAddress()).to.equal(await votingPowerDirectory.getAddress());
    });
  });

  describe("Space Creation", function() {
    it("Should create a space with correct parameters", async function() {
      const { spaceHelper, owner } = await loadFixture(deployFixture);

      const tx = await spaceHelper.createDefaultSpace();
      const receipt = await tx.wait();
      
      const spaceDetails = await spaceHelper.getSpaceDetails(1);
      const executor = spaceDetails.executor;

      await expect(tx)
        .to.emit(spaceHelper.contract, "SpaceCreated")
        .withArgs(
          1n, // spaceId
          51n, // unity
          51n, // quorum
          1n, // votingPowerSource
          1n, // exitMethod
          1n, // joinMethod
          owner.address, // creator
          executor // executor address
        );

      expect(spaceDetails.unity).to.equal(51);
      expect(spaceDetails.quorum).to.equal(51);
      expect(spaceDetails.votingPowerSource).to.equal(1);
      expect(spaceDetails.exitMethod).to.equal(1);
      expect(spaceDetails.joinMethod).to.equal(1);
      expect(spaceDetails.creator).to.equal(owner.address);
      expect(spaceDetails.executor).to.not.equal(ethers.ZeroAddress);
    });

    it("Should fail with invalid unity value", async function() {
      const { spaceHelper } = await loadFixture(deployFixture);

      const spaceParams = {
        name: "Test Space",
        description: "Test Description", 
        imageUrl: "https://test.com/image.png",
        unity: 101, // Invalid: > 100
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: "",
        tokenSymbol: ""
      };

      await expect(spaceHelper.contract.createSpace(spaceParams))
        .to.be.revertedWith("Unity value must be between 1 and 100");
    });

    it("Should create a space with token", async function() {
      const { spaceHelper } = await loadFixture(deployFixture);

      const spaceParams = {
        name: "Test Space",
        description: "Test Description",
        imageUrl: "https://test.com/image.png",
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: true,
        tokenName: "Test Token",
        tokenSymbol: "TEST"
      };

      await expect(spaceHelper.contract.createSpace(spaceParams))
        .to.emit(spaceHelper.contract, "SpaceCreated");

      const spaceDetails = await spaceHelper.getSpaceDetails(1);
      expect(spaceDetails.tokenAddresses.length).to.equal(1);
    });
  });

  describe("Space Membership", function() {
    it("Should allow joining a space", async function() {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      await spaceHelper.createDefaultSpace();
      
      await expect(spaceHelper.joinSpace(1, other))
        .to.emit(spaceHelper.contract, "MemberJoined")
        .withArgs(1, await other.getAddress());
    });

    it("Should prevent joining twice", async function() {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      await spaceHelper.createDefaultSpace();
      await spaceHelper.joinSpace(1, other);

      await expect(spaceHelper.joinSpace(1, other))
        .to.be.revertedWith("Already a member");
    });
  });

  describe("Access Control", function() {
    it("Should only allow owner to set contracts", async function() {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      await expect(spaceHelper.contract.connect(other).setContracts(
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress
      )).to.be.reverted;
    });

    it("Should only allow token factory to add tokens", async function() {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      // Create space first
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

      await spaceHelper.contract.createSpace(spaceParams);

      await expect(spaceHelper.contract.connect(other).addTokenToSpace(1, ethers.ZeroAddress))
        .to.be.revertedWith("Only token factory can add tokens");
    });
  });
}); 