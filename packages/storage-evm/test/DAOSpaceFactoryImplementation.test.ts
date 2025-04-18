import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SpaceHelper } from './helpers/SpaceHelper';

describe('DAOSpaceFactoryImplementation', function () {
  // We define a fixture to reuse the same setup in every test
  async function deployFixture() {
    const [owner, proposer, voter1, voter2, voter3, other] =
      await ethers.getSigners();

    // Deploy RegularTokenFactory instead of TokenFactory
    const RegularTokenFactory = await ethers.getContractFactory(
      'RegularTokenFactory',
    );
    const regularTokenFactory = await upgrades.deployProxy(
      RegularTokenFactory,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Deploy DecayingTokenFactory
    const DecayingTokenFactory = await ethers.getContractFactory(
      'DecayingTokenFactory',
    );
    const decayingTokenFactory = await upgrades.deployProxy(
      DecayingTokenFactory,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Deploy JoinMethodDirectory with OpenJoin
    const JoinMethodDirectory = await ethers.getContractFactory(
      'JoinMethodDirectoryImplementation',
    );
    const joinMethodDirectory = await upgrades.deployProxy(
      JoinMethodDirectory,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    const OpenJoin = await ethers.getContractFactory('OpenJoin');
    const openJoin = await OpenJoin.deploy();
    await joinMethodDirectory.addJoinMethod(1, await openJoin.getAddress());

    // Deploy ExitMethodDirectory with NoExit
    const ExitMethodDirectory = await ethers.getContractFactory(
      'ExitMethodDirectoryImplementation',
    );
    const exitMethodDirectory = await upgrades.deployProxy(
      ExitMethodDirectory,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    const NoExit = await ethers.getContractFactory('NoExit');
    const noExit = await NoExit.deploy();
    await exitMethodDirectory.addExitMethod(1, await noExit.getAddress());

    // Deploy TokenVotingPowerImplementation for regular tokens
    const TokenVotingPower = await ethers.getContractFactory(
      'TokenVotingPowerImplementation',
    );
    const tokenVotingPower = await upgrades.deployProxy(
      TokenVotingPower,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Deploy VoteDecayTokenVotingPowerImplementation for decaying tokens
    const DecayTokenVotingPower = await ethers.getContractFactory(
      'VoteDecayTokenVotingPowerImplementation',
    );
    const decayTokenVotingPower = await upgrades.deployProxy(
      DecayTokenVotingPower,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Deploy the main DAOSpaceFactory contract
    const DAOSpaceFactory = await ethers.getContractFactory(
      'DAOSpaceFactoryImplementation',
    );
    const daoSpaceFactory = await upgrades.deployProxy(
      DAOSpaceFactory,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Set contracts in DAOSpaceFactory
    // Note: The proposalManagerAddress is initially set to tokenVotingPower
    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await tokenVotingPower.getAddress(),
    );

    // Set DAOSpaceFactory in TokenVotingPower
    await tokenVotingPower.setTokenFactory(
      await regularTokenFactory.getAddress(),
    );

    // Set DAOSpaceFactory in DecayTokenVotingPower
    await decayTokenVotingPower.setDecayTokenFactory(
      await decayingTokenFactory.getAddress(),
    );

    // Set SpacesContract in both token factories
    await regularTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await regularTokenFactory.setVotingPowerContract(
      await tokenVotingPower.getAddress(),
    );

    await decayingTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await decayingTokenFactory.setDecayVotingPowerContract(
      await decayTokenVotingPower.getAddress(),
    );

    // Set DAOSpaceFactory in directories
    await joinMethodDirectory.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );
    await exitMethodDirectory.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );

    const spaceHelper = new SpaceHelper(daoSpaceFactory);

    return {
      daoSpaceFactory,
      regularTokenFactory,
      decayingTokenFactory,
      tokenVotingPower,
      decayTokenVotingPower,
      joinMethodDirectory,
      exitMethodDirectory,
      owner,
      proposer,
      voter1,
      voter2,
      voter3,
      other,
      spaceHelper,
    };
  }

  describe('Deployment & Initialization', function () {
    it('Should set the right owner', async function () {
      const { daoSpaceFactory, owner } = await loadFixture(deployFixture);
      expect(await daoSpaceFactory.owner()).to.equal(owner.address);
    });

    it('Should initialize with zero spaces', async function () {
      const { daoSpaceFactory } = await loadFixture(deployFixture);
      // Instead of expecting a revert, check if the space counter is 0
      // or check for default values in a non-existent space
      const spaceDetails = await daoSpaceFactory.getSpaceDetails(1);

      // Expect empty/default values for a non-existent space
      expect(spaceDetails.unity).to.equal(0);
      expect(spaceDetails.quorum).to.equal(0);
      expect(spaceDetails.members.length).to.equal(0);
      expect(spaceDetails.creator).to.equal(ethers.ZeroAddress);
    });

    it('Should set contract addresses correctly', async function () {
      const {
        daoSpaceFactory,
        joinMethodDirectory,
        exitMethodDirectory,
        tokenVotingPower,
      } = await loadFixture(deployFixture);

      expect(await daoSpaceFactory.joinMethodDirectoryAddress()).to.equal(
        await joinMethodDirectory.getAddress(),
      );
      expect(await daoSpaceFactory.exitMethodDirectoryAddress()).to.equal(
        await exitMethodDirectory.getAddress(),
      );
      expect(await daoSpaceFactory.proposalManagerAddress()).to.equal(
        await tokenVotingPower.getAddress(),
      );
    });
  });

  describe('Space Creation', function () {
    it('Should create a space with correct parameters', async function () {
      const { spaceHelper, owner } = await loadFixture(deployFixture);

      const tx = await spaceHelper.createDefaultSpace();
      await tx.wait();

      const spaceDetails = await spaceHelper.getSpaceDetails(1);
      const executor = spaceDetails.executor;

      await expect(tx).to.emit(spaceHelper.contract, 'SpaceCreated').withArgs(
        1n, // spaceId
        51n, // unity
        51n, // quorum
        1n, // votingPowerSource
        1n, // exitMethod
        1n, // joinMethod
        owner.address, // creator
        executor, // executor address
      );

      expect(spaceDetails.unity).to.equal(51);
      expect(spaceDetails.quorum).to.equal(51);
      expect(spaceDetails.votingPowerSource).to.equal(1);
      expect(spaceDetails.exitMethod).to.equal(1);
      expect(spaceDetails.joinMethod).to.equal(1);
      expect(spaceDetails.creator).to.equal(owner.address);
      expect(spaceDetails.executor).to.not.equal(ethers.ZeroAddress);
    });

    it('Should fail with invalid unity value', async function () {
      const { spaceHelper } = await loadFixture(deployFixture);

      const spaceParams = {
        name: 'Test Space',
        description: 'Test Description',
        imageUrl: 'https://test.com/image.png',
        unity: 101, // Invalid: > 100
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await expect(
        spaceHelper.contract.createSpace(spaceParams),
      ).to.be.revertedWith('unity');
    });
  });

  describe('Space Membership', function () {
    it('Should allow joining a space', async function () {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      await spaceHelper.createDefaultSpace();

      await expect(spaceHelper.joinSpace(1, other))
        .to.emit(spaceHelper.contract, 'MemberJoined')
        .withArgs(1, await other.getAddress());
    });

    it('Should prevent joining twice', async function () {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      await spaceHelper.createDefaultSpace();
      await spaceHelper.joinSpace(1, other);

      await expect(spaceHelper.joinSpace(1, other)).to.be.revertedWith(
        'member',
      );
    });

    it('Should track spaces a member has joined', async function () {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      // Create three spaces
      await spaceHelper.createDefaultSpace();
      await spaceHelper.createDefaultSpace();
      await spaceHelper.createDefaultSpace();

      // Join spaces 1 and 3
      await spaceHelper.joinSpace(1, other);
      await spaceHelper.joinSpace(3, other);

      // Check spaces the member has joined
      const memberSpaces = await spaceHelper.contract.getMemberSpaces(
        await other.getAddress(),
      );
      expect(memberSpaces.length).to.equal(2);
      expect(memberSpaces).to.deep.equal([1n, 3n]);
    });

    it('Should create a proposal when joining a space with join method 2', async function () {
      const { daoSpaceFactory, owner, voter1, other } = await loadFixture(
        deployFixture,
      );

      // First we need to deploy a proper DAOProposals contract to use
      const DAOProposals = await ethers.getContractFactory(
        'DAOProposalsImplementation',
      );
      const daoProposals = await upgrades.deployProxy(
        DAOProposals,
        [owner.address],
        { initializer: 'initialize', kind: 'uups' },
      );

      // Deploy SpaceVotingPower for proposal voting
      const SpaceVotingPower = await ethers.getContractFactory(
        'SpaceVotingPowerImplementation',
      );
      const spaceVotingPower = await upgrades.deployProxy(
        SpaceVotingPower,
        [owner.address],
        { initializer: 'initialize', kind: 'uups' },
      );

      // Set space factory in voting power source
      await spaceVotingPower.setSpaceFactory(
        await daoSpaceFactory.getAddress(),
      );

      // Register the voting power source in the directory
      const VotingPowerDirectory = await ethers.getContractFactory(
        'VotingPowerDirectoryImplementation',
      );
      const votingPowerDirectory = await upgrades.deployProxy(
        VotingPowerDirectory,
        [owner.address],
        {
          initializer: 'initialize',
          kind: 'uups',
        },
      );

      await votingPowerDirectory.addVotingPowerSource(
        await spaceVotingPower.getAddress(),
      );

      // Configure proposals contract
      await daoProposals.setContracts(
        await daoSpaceFactory.getAddress(),
        await votingPowerDirectory.getAddress(),
      );

      // Update the proposalManagerAddress in DAOSpaceFactory
      await daoSpaceFactory.setContracts(
        await daoSpaceFactory.joinMethodDirectoryAddress(),
        await daoSpaceFactory.exitMethodDirectoryAddress(),
        await daoProposals.getAddress(),
      );

      // Create a space with join method 2
      const spaceParams = {
        name: 'Join By Proposal Space',
        description: 'Test Description',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 10,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 2, // Join requires proposal approval
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await daoSpaceFactory.createSpace(spaceParams);
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Add a member to the space (owner is already a member)
      // This is needed to have sufficient voting power
      await daoSpaceFactory.connect(voter1).joinSpace(spaceId);

      // Get proposal count before join attempt
      const proposalCountBefore = await daoProposals.proposalCounter();

      // User attempts to join the space which should create a proposal
      await daoSpaceFactory.connect(other).joinSpace(spaceId);

      // Check if a new proposal was created
      const proposalCountAfter = await daoProposals.proposalCounter();

      expect(proposalCountAfter).to.be.gt(proposalCountBefore);

      // Get the latest proposal ID
      const proposalId = await daoProposals.proposalCounter();

      // Get proposal details using getProposalCore instead
      const [
        proposalSpaceId,
        // Ignore other fields
      ] = await daoProposals.getProposalCore(proposalId);

      // Verify proposal is for the correct space
      expect(proposalSpaceId).to.equal(spaceId);
    });

    it('Should remove a member from a space', async function () {
      const { spaceHelper, daoSpaceFactory, owner, other } = await loadFixture(
        deployFixture,
      );

      // Create space with exit method 1 (only executor can remove members)
      const spaceParams = {
        name: 'Space for Member Removal',
        description: 'Test Description',
        imageUrl: 'https://test.com/test.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1, // Using exit method 1 where only executor can remove
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);

      // Join the space
      await spaceHelper.joinSpace(1, other);
      expect(
        await daoSpaceFactory.isMember(1, await other.getAddress()),
      ).to.equal(true);

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(1);

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Remove the member using removeMember (since we're the executor and exit method is 1)
      await expect(
        daoSpaceFactory
          .connect(executorSigner)
          .removeMember(1, await other.getAddress()),
      )
        .to.emit(daoSpaceFactory, 'MemberRemoved')
        .withArgs(1, await other.getAddress());

      // Verify member was removed
      expect(
        await daoSpaceFactory.isMember(1, await other.getAddress()),
      ).to.equal(false);

      // Verify member's spaces were updated
      const memberSpaces = await daoSpaceFactory.getMemberSpaces(
        await other.getAddress(),
      );
      expect(memberSpaces.length).to.equal(0);
    });
  });

  describe('Access Control', function () {
    it('Should only allow owner to set contracts', async function () {
      const { daoSpaceFactory, other } = await loadFixture(deployFixture);

      await expect(
        daoSpaceFactory
          .connect(other)
          .setContracts(
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ),
      ).to.be.reverted;
    });
  });

  describe('Regular Space Token Tests', function () {
    it('Should allow executor to mint regular tokens', async function () {
      const {
        spaceHelper,
        regularTokenFactory,
        daoSpaceFactory,
        owner,
        voter1,
      } = await loadFixture(deployFixture);

      // Create space first
      const spaceParams = {
        name: 'Token Space',
        description: 'Space with Token',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Deploy token through the executor
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Space Token',
        'STKN',
        0, // maxSupply (0 = unlimited)
        true, // transferable
        true, // isVotingToken
      );

      const receipt = await tx.wait();

      // Fix for 'tokenDeployedEvent' is possibly 'null' or 'undefined' errors
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              regularTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          regularTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      // Fix for property access errors - update type casting for token
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);

      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits('100', 18);
      await (token as any)
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);

      // Check balance
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(
        mintAmount,
      );
    });

    it('Should not allow non-executor to mint tokens', async function () {
      const { regularTokenFactory, spaceHelper, voter1, other, owner } =
        await loadFixture(deployFixture);

      // Create space
      await spaceHelper.createDefaultSpace();
      const spaceId = (await spaceHelper.contract.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await spaceHelper.contract.getSpaceExecutor(
        spaceId,
      );

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Deploy token through the executor
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Space Token',
        'STKN',
        0, // maxSupply (0 = unlimited)
        true, // transferable
        true, // isVotingToken
      );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              regularTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          regularTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // Try to mint as non-executor (should fail)
      const mintAmount = ethers.parseUnits('100', 18);
      await expect(
        (token as any)
          .connect(other)
          .mint(await voter1.getAddress(), mintAmount),
      ).to.be.revertedWith('Only executor can call this function');
    });
  });

  describe('Decaying Token Tests', function () {
    it('Should deploy a token with decay and verify decay parameters', async function () {
      const { decayingTokenFactory, spaceHelper, owner } = await loadFixture(
        deployFixture,
      );

      // Create space
      const spaceParams = {
        name: 'Decay Token Space',
        description: 'Space for testing decay tokens',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await spaceHelper.contract.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await spaceHelper.contract.getSpaceExecutor(
        spaceId,
      );

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Define decay parameters
      const decayPercentage = 500; // 5% decay per interval (in basis points)
      const decayInterval = 86400; // 1 day in seconds

      // Deploy decaying token through the executor
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Decay Token',
          'DECAY',
          0, // maxSupply (0 = unlimited)
          true, // transferable
          true, // isVotingToken
          decayPercentage,
          decayInterval,
        );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              decayingTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          decayingTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const decayToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Verify decay parameters are set correctly
      expect(await decayToken.decayPercentage()).to.equal(decayPercentage);
      expect(await decayToken.decayInterval()).to.equal(decayInterval);
    });

    it('Should demonstrate token decay over time', async function () {
      const { decayingTokenFactory, spaceHelper, owner, voter1 } =
        await loadFixture(deployFixture);

      // Create space
      const spaceParams = {
        name: 'Decay Test Space',
        description: 'Testing token decay',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await spaceHelper.contract.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await spaceHelper.contract.getSpaceExecutor(
        spaceId,
      );

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Define decay parameters (high decay for testing)
      const decayPercentage = 1000; // 10% decay per interval (in basis points)
      const decayInterval = 3600; // 1 hour in seconds

      // Deploy decaying token through the executor
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Fast Decay Token',
          'FDECAY',
          0, // maxSupply
          true, // transferable
          true, // isVotingToken
          decayPercentage,
          decayInterval,
        );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              decayingTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          decayingTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const decayToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);

      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits('100', 18);
      await decayToken
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);

      // Check initial balance
      expect(await decayToken.balanceOf(await voter1.getAddress())).to.equal(
        mintAmount,
      );

      // Advance time by 2 decay intervals
      await ethers.provider.send('evm_increaseTime', [decayInterval * 2]);
      await ethers.provider.send('evm_mine', []);

      // Check balance after time advance (should be decayed in view function)
      const expectedDecayedBalance =
        (mintAmount * BigInt(8100)) / BigInt(10000); // After 2 periods of 10% decay: 100 * (0.9)^2
      const decayedBalanceView = await decayToken.balanceOf(
        await voter1.getAddress(),
      );

      // Allow for small rounding differences
      const tolerance = ethers.parseUnits('1', 15); // 0.001 tokens tolerance
      expect(decayedBalanceView).to.be.closeTo(
        expectedDecayedBalance,
        tolerance,
      );

      // Apply decay to actually update the storage
      await decayToken.applyDecay(await voter1.getAddress());

      // Check balance after applying decay (should be the same as the view function showed)
      const decayedBalanceStorage = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      expect(decayedBalanceStorage).to.equal(decayedBalanceView);
    });

    it('Should properly handle decay when tokens are transferred', async function () {
      const { decayingTokenFactory, spaceHelper, owner, voter1, voter2 } =
        await loadFixture(deployFixture);

      // Create space
      const spaceParams = {
        name: 'Transfer Decay Space',
        description: 'Testing transfer with decay',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await spaceHelper.contract.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await spaceHelper.contract.getSpaceExecutor(
        spaceId,
      );

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Define decay parameters
      const decayPercentage = 2000; // 20% decay per interval (higher for visible effect)
      const decayInterval = 3600; // 1 hour in seconds

      // Deploy decaying token through the executor
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Transfer Decay Token',
          'TDECAY',
          0, // maxSupply
          true, // transferable
          true, // isVotingToken
          decayPercentage,
          decayInterval,
        );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              decayingTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          decayingTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const decayToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);
      await spaceHelper.joinSpace(Number(spaceId), voter2);

      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits('100', 18);
      await decayToken
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);

      // Advance time by 1 decay interval
      await ethers.provider.send('evm_increaseTime', [decayInterval]);
      await ethers.provider.send('evm_mine', []);

      // Get balance before transfer (should show decay in view)
      const balanceBeforeTransfer = await decayToken.balanceOf(
        await voter1.getAddress(),
      );

      // Expected decay: 100 * 0.8 = 80
      const expectedBalanceAfterDecay =
        (mintAmount * BigInt(8000)) / BigInt(10000);
      expect(balanceBeforeTransfer).to.be.closeTo(
        expectedBalanceAfterDecay,
        ethers.parseUnits('1', 15),
      );

      // Transfer half of the tokens to voter2
      // This should automatically apply decay to voter1's balance first
      const transferAmount = balanceBeforeTransfer / 2n;
      await decayToken
        .connect(voter1)
        .transfer(await voter2.getAddress(), transferAmount);

      // Check balances after transfer
      const voter1Balance = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      const voter2Balance = await decayToken.balanceOf(
        await voter2.getAddress(),
      );

      // voter1 should have half of the decayed amount
      expect(voter1Balance).to.be.closeTo(
        balanceBeforeTransfer - transferAmount,
        ethers.parseUnits('1', 15),
      );

      // voter2 should have the transferred amount (without decay since it was just transferred)
      expect(voter2Balance).to.equal(transferAmount);

      // Advance time again
      await ethers.provider.send('evm_increaseTime', [decayInterval]);
      await ethers.provider.send('evm_mine', []);

      // Both balances should now show decay
      const voter1DecayedBalance = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      const voter2DecayedBalance = await decayToken.balanceOf(
        await voter2.getAddress(),
      );

      // Expected decay for voter1: previous balance * 0.8
      const expectedVoter1Balance =
        (voter1Balance * BigInt(8000)) / BigInt(10000);
      expect(voter1DecayedBalance).to.be.closeTo(
        expectedVoter1Balance,
        ethers.parseUnits('1', 15),
      );

      // Expected decay for voter2: previous balance * 0.8
      const expectedVoter2Balance =
        (voter2Balance * BigInt(8000)) / BigInt(10000);
      expect(voter2DecayedBalance).to.be.closeTo(
        expectedVoter2Balance,
        ethers.parseUnits('1', 15),
      );
    });
  });

  describe('Enhanced Decay Token Tests', function () {
    it('Should demonstrate detailed vote decay with precise measurements', async function () {
      const { decayingTokenFactory, spaceHelper, owner, voter1 } =
        await loadFixture(deployFixture);

      console.log('\n=== STARTING DETAILED VOTE DECAY TEST ===');

      // Create space
      const spaceParams = {
        name: 'Detailed Decay Test Space',
        description: 'Demonstrating precise token decay',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await spaceHelper.contract.spaceCounter()).toString();
      console.log(`Space created with ID: ${spaceId}`);

      // Get the executor
      const executorAddress = await spaceHelper.contract.getSpaceExecutor(
        spaceId,
      );
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Define decay parameters for easier tracking
      const decayPercentage = 1000; // 10% decay per interval (in basis points)
      const decayInterval = 3600; // 1 hour in seconds
      console.log(
        `Decay parameters: ${decayPercentage / 100}% every ${
          decayInterval / 3600
        } hour(s)`,
      );

      // Deploy decaying token through the executor
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Precise Decay Token',
          'PDECAY',
          0, // maxSupply
          true, // transferable
          true, // isVotingToken
          decayPercentage,
          decayInterval,
        );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              decayingTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          decayingTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      console.log(`Decay token deployed at: ${tokenAddress}`);
      const decayToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);
      console.log(`Voter1 (${await voter1.getAddress()}) joined the space`);

      // Mint a clean amount for easy calculation
      const mintAmount = ethers.parseUnits('1000', 18);
      await decayToken
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);
      console.log(
        `\nMinted ${ethers.formatUnits(mintAmount, 18)} tokens to Voter1`,
      );

      // Check initial balance
      const initialBalance = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      console.log(
        `Initial balance: ${ethers.formatUnits(initialBalance, 18)} tokens`,
      );
      expect(initialBalance).to.equal(mintAmount);

      // Get current blockchain timestamp
      const blockBefore = await ethers.provider.getBlock('latest');
      const initialTimestamp = blockBefore?.timestamp || 0;
      console.log(
        `Initial timestamp: ${initialTimestamp} (${new Date(
          initialTimestamp * 1000,
        ).toISOString()})`,
      );

      // Advance time by exactly 1 decay interval
      await ethers.provider.send('evm_increaseTime', [decayInterval]);
      await ethers.provider.send('evm_mine', []);

      // Get new timestamp
      const blockAfter1 = await ethers.provider.getBlock('latest');
      const timestampAfter1 = blockAfter1?.timestamp || 0;
      console.log(
        `\nTimestamp after 1 interval: ${timestampAfter1} (${new Date(
          timestampAfter1 * 1000,
        ).toISOString()})`,
      );
      console.log(
        `Time elapsed: ${timestampAfter1 - initialTimestamp} seconds (${
          (timestampAfter1 - initialTimestamp) / decayInterval
        } intervals)`,
      );

      // Check view balance (should reflect decay without storage update)
      const balanceAfter1Interval = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      const expectedBalance1 = (mintAmount * BigInt(9000)) / BigInt(10000); // 90% of original after 10% decay
      console.log(
        `\nBalance after 1 interval (view function): ${ethers.formatUnits(
          balanceAfter1Interval,
          18,
        )} tokens`,
      );
      console.log(
        `Expected balance (90% of ${ethers.formatUnits(
          mintAmount,
          18,
        )}): ${ethers.formatUnits(expectedBalance1, 18)} tokens`,
      );
      console.log(
        `Decay amount: ${ethers.formatUnits(
          mintAmount - balanceAfter1Interval,
          18,
        )} tokens (should be ~10%)`,
      );

      const decayPercent1 =
        Number(
          ((mintAmount - balanceAfter1Interval) * BigInt(10000)) / mintAmount,
        ) / 100;
      console.log(`Actual decay percentage: ${decayPercent1}%`);

      expect(balanceAfter1Interval).to.be.closeTo(
        expectedBalance1,
        ethers.parseUnits('0.01', 18),
      );

      // Check storage state (should not be updated yet)
      const lastUpdated1 = await decayToken.lastDecayTimestamp(
        await voter1.getAddress(),
      );

      console.log(
        `\nLast updated timestamp: ${lastUpdated1} (${new Date(
          Number(lastUpdated1) * 1000,
        ).toISOString()})`,
      );

      // For the first error around line 1925
      // Convert the expression into a variable first
      const matchesMintTime =
        Number(lastUpdated1) <= initialTimestamp + 5 &&
        Number(lastUpdated1) >= initialTimestamp - 5;
      console.log(
        `Last updated matches mint time: ${matchesMintTime ? 'Yes' : 'No'}`,
      );

      // Apply decay to update storage
      console.log('\n=== EXPLICITLY APPLYING DECAY TO UPDATE STORAGE ===');
      const applyTx = await decayToken.applyDecay(await voter1.getAddress());
      await applyTx.wait();

      // Check storage state (should be updated now)
      const balanceAfterApply1 = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      console.log(
        `Balance after applying decay: ${ethers.formatUnits(
          balanceAfterApply1,
          18,
        )} tokens`,
      );
      expect(balanceAfterApply1).to.equal(balanceAfter1Interval);

      const lastUpdatedAfterApply = await decayToken.lastDecayTimestamp(
        await voter1.getAddress(),
      );

      console.log(
        `Last updated timestamp: ${lastUpdatedAfterApply} (${new Date(
          Number(lastUpdatedAfterApply) * 1000,
        ).toISOString()})`,
      );

      // For the second error around line 1947
      // Convert the expression into a variable first
      const isCurrentTime =
        lastUpdatedAfterApply <= BigInt(timestampAfter1 + 5) &&
        lastUpdatedAfterApply >= BigInt(timestampAfter1 - 5);
      console.log(`Last updated is current: ${isCurrentTime ? 'Yes' : 'No'}`);

      // Advance time by another 2 decay intervals for compounding decay
      console.log('\n=== ADVANCING TIME BY 2 MORE INTERVALS ===');
      await ethers.provider.send('evm_increaseTime', [decayInterval * 2]);
      await ethers.provider.send('evm_mine', []);

      // Get new timestamp
      const blockAfter3 = await ethers.provider.getBlock('latest');
      const timestampAfter3 = blockAfter3?.timestamp || 0;
      console.log(
        `Timestamp after 3 intervals total: ${timestampAfter3} (${new Date(
          timestampAfter3 * 1000,
        ).toISOString()})`,
      );
      console.log(
        `Time since last update: ${
          timestampAfter3 - Number(lastUpdatedAfterApply)
        } seconds (${
          (timestampAfter3 - Number(lastUpdatedAfterApply)) / decayInterval
        } intervals)`,
      );

      // Check compounded decay after 2 more intervals
      const balanceAfter3Intervals = await decayToken.balanceOf(
        await voter1.getAddress(),
      );

      // Starting from balanceAfterApply1, we apply 10% decay twice: balanceAfterApply1 * 0.9 * 0.9
      const expectedBalance3 =
        (balanceAfterApply1 * BigInt(9000) * BigInt(9000)) /
        (BigInt(10000) * BigInt(10000));
      console.log(
        `\nBalance after 3 intervals (view function): ${ethers.formatUnits(
          balanceAfter3Intervals,
          18,
        )} tokens`,
      );
      console.log(
        `Expected balance (90% of 90% of ${ethers.formatUnits(
          balanceAfterApply1,
          18,
        )}): ${ethers.formatUnits(expectedBalance3, 18)} tokens`,
      );

      const totalDecayPercent =
        Number(
          ((mintAmount - balanceAfter3Intervals) * BigInt(10000)) / mintAmount,
        ) / 100;
      console.log(
        `Total decay from original: ${ethers.formatUnits(
          mintAmount - balanceAfter3Intervals,
          18,
        )} tokens (${totalDecayPercent}%)`,
      );
      console.log(
        `Expected total decay percentage after 3 intervals: ${
          100 - 0.9 * 0.9 * 0.9 * 100
        }%`,
      );

      expect(balanceAfter3Intervals).to.be.closeTo(
        expectedBalance3,
        ethers.parseUnits('0.01', 18),
      );

      // Test partial interval decay
      console.log('\n=== TESTING PARTIAL INTERVAL DECAY ===');
      // Advance time by half an interval
      await ethers.provider.send('evm_increaseTime', [decayInterval / 2]);
      await ethers.provider.send('evm_mine', []);

      const blockPartial = await ethers.provider.getBlock('latest');
      const timestampPartial = blockPartial?.timestamp || 0;
      console.log(`Timestamp after 3.5 intervals: ${timestampPartial}`);
      console.log(
        `Time since last update: ${
          timestampPartial - Number(lastUpdatedAfterApply)
        } seconds (${
          (timestampPartial - Number(lastUpdatedAfterApply)) / decayInterval
        } intervals)`,
      );

      // Check partial decay
      const balanceAfterPartial = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      console.log(
        `Balance after 3.5 intervals: ${ethers.formatUnits(
          balanceAfterPartial,
          18,
        )} tokens`,
      );

      // This should be between the 3-interval decay and 4-interval decay values
      expect(balanceAfterPartial).to.equal(balanceAfter3Intervals);
      expect(balanceAfterPartial).to.be.gt(
        (balanceAfter3Intervals * BigInt(9000)) / BigInt(10000),
      );

      console.log('\n=== DETAILED VOTE DECAY TEST COMPLETED ===');
    });

    it('Should demonstrate decay with multiple users and transfers', async function () {
      const { decayingTokenFactory, spaceHelper, owner, voter1, voter2 } =
        await loadFixture(deployFixture);

      console.log('\n=== STARTING MULTI-USER DECAY TEST WITH TRANSFERS ===');

      // Create space
      await spaceHelper.createDefaultSpace();
      const spaceId = (await spaceHelper.contract.spaceCounter()).toString();
      console.log(`Space created with ID: ${spaceId}`);

      // Get the executor
      const executorAddress = await spaceHelper.contract.getSpaceExecutor(
        spaceId,
      );
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Define decay parameters
      const decayPercentage = 2000; // 20% decay per interval (for more visible impact)
      const decayInterval = 3600; // 1 hour in seconds
      console.log(
        `Decay parameters: ${decayPercentage / 100}% every ${
          decayInterval / 3600
        } hour(s)`,
      );

      // Deploy decaying token
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Multi-User Decay Token',
          'MUDECAY',
          0, // maxSupply
          true, // transferable
          true, // isVotingToken
          decayPercentage,
          decayInterval,
        );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              decayingTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          decayingTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      console.log(`Decay token deployed at: ${tokenAddress}`);
      const decayToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);
      await spaceHelper.joinSpace(Number(spaceId), voter2);
      console.log(
        `Voter1 (${await voter1.getAddress()}) and Voter2 (${await voter2.getAddress()}) joined the space`,
      );

      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits('1000', 18);
      await decayToken
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);
      console.log(
        `\nMinted ${ethers.formatUnits(mintAmount, 18)} tokens to Voter1`,
      );

      // Store mint timestamp for calculations
      const initialBlock = await ethers.provider.getBlock('latest');
      const initialTimestamp = initialBlock?.timestamp || 0;
      console.log(
        `Initial timestamp: ${initialTimestamp} (${new Date(
          initialTimestamp * 1000,
        ).toISOString()})`,
      );

      // Advance time by 1 decay interval
      await ethers.provider.send('evm_increaseTime', [decayInterval]);
      await ethers.provider.send('evm_mine', []);

      const blockAfter1 = await ethers.provider.getBlock('latest');
      const timestampAfter1 = blockAfter1?.timestamp || 0;
      console.log(
        `\nTimestamp after 1 interval: ${timestampAfter1} (${new Date(
          timestampAfter1 * 1000,
        ).toISOString()})`,
      );
      console.log(
        `Time elapsed: ${timestampAfter1 - initialTimestamp} seconds (${
          (timestampAfter1 - initialTimestamp) / decayInterval
        } intervals)`,
      );

      // Check voter1's balance (should show decay)
      const balanceAfter1Interval = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      const expectedBalance1 = (mintAmount * BigInt(8000)) / BigInt(10000); // 80% after 20% decay
      console.log(
        `\nVoter1 balance after 1 interval: ${ethers.formatUnits(
          balanceAfter1Interval,
          18,
        )} tokens`,
      );
      console.log(
        `Expected Voter1 balance: ${ethers.formatUnits(
          expectedBalance1,
          18,
        )} tokens`,
      );
      console.log(
        `Decay amount: ${ethers.formatUnits(
          mintAmount - balanceAfter1Interval,
          18,
        )} tokens (~20%)`,
      );

      expect(balanceAfter1Interval).to.be.closeTo(
        expectedBalance1,
        ethers.parseUnits('0.01', 18),
      );

      // Transfer half of the tokens to voter2
      // This should automatically apply decay to voter1's balance first
      console.log(`\n=== TRANSFERRING TOKENS FROM VOTER1 TO VOTER2 ===`);
      const transferAmount = balanceAfter1Interval / 2n;
      console.log(
        `Transferring ${ethers.formatUnits(
          transferAmount,
          18,
        )} tokens (half of current balance)`,
      );

      const transferTx = await decayToken
        .connect(voter1)
        .transfer(await voter2.getAddress(), transferAmount);
      await transferTx.wait();

      // Check both balances after transfer
      const voter1BalanceAfterTransfer = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      const voter2BalanceAfterTransfer = await decayToken.balanceOf(
        await voter2.getAddress(),
      );

      console.log(
        `\nVoter1 balance after transfer: ${ethers.formatUnits(
          voter1BalanceAfterTransfer,
          18,
        )} tokens`,
      );
      console.log(
        `Voter2 balance after transfer: ${ethers.formatUnits(
          voter2BalanceAfterTransfer,
          18,
        )} tokens`,
      );

      // Voter1 should have decayed balance minus transfer
      expect(voter1BalanceAfterTransfer).to.equal(
        balanceAfter1Interval - transferAmount,
      );

      // Voter2 should have exactly the transferred amount
      expect(voter2BalanceAfterTransfer).to.equal(transferAmount);

      // Check lastUpdated timestamps for both accounts
      const voter1LastUpdated = await decayToken.lastDecayTimestamp(
        await voter1.getAddress(),
      );
      const voter2LastUpdated = await decayToken.lastDecayTimestamp(
        await voter2.getAddress(),
      );

      console.log(
        `\nVoter1 last updated: ${voter1LastUpdated} (${new Date(
          Number(voter1LastUpdated) * 1000,
        ).toISOString()})`,
      );
      console.log(
        `Voter2 last updated: ${voter2LastUpdated} (${new Date(
          Number(voter2LastUpdated) * 1000,
        ).toISOString()})`,
      );

      // Both should have recent timestamps from the transfer
      const transferBlock = await ethers.provider.getBlock('latest');
      const transferTimestamp = transferBlock?.timestamp || 0;

      expect(voter1LastUpdated).to.be.closeTo(BigInt(transferTimestamp), 5n);
      expect(voter2LastUpdated).to.be.closeTo(BigInt(transferTimestamp), 5n);

      // Advance time by 2 more decay intervals
      console.log(`\n=== ADVANCING TIME BY 2 MORE INTERVALS ===`);
      await ethers.provider.send('evm_increaseTime', [decayInterval * 2]);
      await ethers.provider.send('evm_mine', []);

      const blockAfter3 = await ethers.provider.getBlock('latest');
      const timestampAfter3 = blockAfter3?.timestamp || 0;
      console.log(
        `Timestamp after 3 intervals total: ${timestampAfter3} (${new Date(
          timestampAfter3 * 1000,
        ).toISOString()})`,
      );
      console.log(
        `Time since transfer: ${timestampAfter3 - transferTimestamp} seconds (${
          (timestampAfter3 - transferTimestamp) / decayInterval
        } intervals)`,
      );

      // Both accounts should show decay from their last update (the transfer time)
      const voter1BalanceAfter3 = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      const voter2BalanceAfter3 = await decayToken.balanceOf(
        await voter2.getAddress(),
      );

      // Expected decay: 2 intervals of 20% decay
      const expectedVoter1Balance =
        (voter1BalanceAfterTransfer * BigInt(8000) * BigInt(8000)) /
        (BigInt(10000) * BigInt(10000));
      const expectedVoter2Balance =
        (voter2BalanceAfterTransfer * BigInt(8000) * BigInt(8000)) /
        (BigInt(10000) * BigInt(10000));

      console.log(
        `\nVoter1 balance after 3 intervals total: ${ethers.formatUnits(
          voter1BalanceAfter3,
          18,
        )} tokens`,
      );
      console.log(
        `Expected Voter1 balance: ${ethers.formatUnits(
          expectedVoter1Balance,
          18,
        )} tokens`,
      );
      console.log(
        `Voter1 decay since transfer: ${ethers.formatUnits(
          voter1BalanceAfterTransfer - voter1BalanceAfter3,
          18,
        )} tokens`,
      );

      console.log(
        `\nVoter2 balance after 3 intervals total: ${ethers.formatUnits(
          voter2BalanceAfter3,
          18,
        )} tokens`,
      );
      console.log(
        `Expected Voter2 balance: ${ethers.formatUnits(
          expectedVoter2Balance,
          18,
        )} tokens`,
      );
      console.log(
        `Voter2 decay since transfer: ${ethers.formatUnits(
          voter2BalanceAfterTransfer - voter2BalanceAfter3,
          18,
        )} tokens`,
      );

      expect(voter1BalanceAfter3).to.be.closeTo(
        expectedVoter1Balance,
        ethers.parseUnits('0.01', 18),
      );

      // Demonstrate how applyDecay updates storage
      console.log(`\n=== APPLYING DECAY TO VOTER1 EXPLICITLY ===`);
      await decayToken.applyDecay(await voter1.getAddress());

      const voter1BalanceAfterApply = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      console.log(
        `Voter1 balance after applying decay: ${ethers.formatUnits(
          voter1BalanceAfterApply,
          18,
        )} tokens`,
      );
      expect(voter1BalanceAfterApply).to.equal(voter1BalanceAfter3);

      const voter1LastUpdatedAfterApply = await decayToken.lastDecayTimestamp(
        await voter1.getAddress(),
      );
      console.log(
        `Voter1 last updated after applying decay: ${voter1LastUpdatedAfterApply} (${new Date(
          Number(voter1LastUpdatedAfterApply) * 1000,
        ).toISOString()})`,
      );

      // Advance time by half an interval and mint to voter2 to demonstrate how minting affects decay
      console.log(`\n=== TESTING MINTING WITH ONGOING DECAY FOR VOTER2 ===`);
      await ethers.provider.send('evm_increaseTime', [decayInterval / 2]);
      await ethers.provider.send('evm_mine', []);

      // Check voter2's decayed balance before minting
      const voter2BalanceBeforeMint = await decayToken.balanceOf(
        await voter2.getAddress(),
      );
      console.log(
        `Voter2 balance before minting (after 3.5 intervals): ${ethers.formatUnits(
          voter2BalanceBeforeMint,
          18,
        )} tokens`,
      );

      // Mint more tokens to voter2
      const additionalMint = ethers.parseUnits('500', 18);
      await decayToken
        .connect(executorSigner)
        .mint(await voter2.getAddress(), additionalMint);
      console.log(
        `Minted additional ${ethers.formatUnits(
          additionalMint,
          18,
        )} tokens to Voter2`,
      );

      // Check voter2's balance after minting
      const voter2BalanceAfterMint = await decayToken.balanceOf(
        await voter2.getAddress(),
      );
      console.log(
        `Voter2 balance after minting: ${ethers.formatUnits(
          voter2BalanceAfterMint,
          18,
        )} tokens`,
      );

      // Should apply decay before adding new tokens
      expect(voter2BalanceAfterMint).to.be.closeTo(
        voter2BalanceBeforeMint + additionalMint,
        ethers.parseUnits('0.01', 18),
      );

      // Check lastUpdated timestamp (should be current)
      const voter2LastUpdatedAfterMint = await decayToken.lastDecayTimestamp(
        await voter2.getAddress(),
      );
      const mintBlock = await ethers.provider.getBlock('latest');
      const mintTimestamp = mintBlock?.timestamp || 0;

      console.log(
        `Voter2 last updated after minting: ${voter2LastUpdatedAfterMint} (${new Date(
          Number(voter2LastUpdatedAfterMint) * 1000,
        ).toISOString()})`,
      );
      expect(voter2LastUpdatedAfterMint).to.be.closeTo(
        BigInt(mintTimestamp),
        5n,
      );

      console.log('\n=== MULTI-USER DECAY TEST WITH TRANSFERS COMPLETED ===');
    });
  });

  describe('Token Deployment via Proposals', function () {
    it('Should deploy both regular and decaying tokens via proposals', async function () {
      // Get our test fixtures
      const {
        daoSpaceFactory,
        regularTokenFactory,
        decayingTokenFactory,
        owner,
        voter1,
        voter2,
        spaceHelper,
      } = await loadFixture(deployFixture);

      // First we need to deploy a proper DAOProposals contract to use
      const DAOProposals = await ethers.getContractFactory(
        'DAOProposalsImplementation',
      );
      const daoProposals = await upgrades.deployProxy(
        DAOProposals,
        [owner.address],
        { initializer: 'initialize', kind: 'uups' },
      );

      // Deploy SpaceVotingPower for proposal voting
      const SpaceVotingPower = await ethers.getContractFactory(
        'SpaceVotingPowerImplementation',
      );
      const spaceVotingPower = await upgrades.deployProxy(
        SpaceVotingPower,
        [owner.address],
        { initializer: 'initialize', kind: 'uups' },
      );

      // Set space factory in voting power source
      await spaceVotingPower.setSpaceFactory(
        await daoSpaceFactory.getAddress(),
      );

      // Register the voting power source in the directory
      const VotingPowerDirectory = await ethers.getContractFactory(
        'VotingPowerDirectoryImplementation',
      );
      const votingPowerDirectory = await upgrades.deployProxy(
        VotingPowerDirectory,
        [owner.address],
        {
          initializer: 'initialize',
          kind: 'uups',
        },
      );

      await votingPowerDirectory.addVotingPowerSource(
        await spaceVotingPower.getAddress(),
      );

      // Configure proposals contract
      await daoProposals.setContracts(
        await daoSpaceFactory.getAddress(),
        await votingPowerDirectory.getAddress(),
      );

      // Update the proposalManagerAddress in DAOSpaceFactory
      await daoSpaceFactory.setContracts(
        await daoSpaceFactory.joinMethodDirectoryAddress(),
        await daoSpaceFactory.exitMethodDirectoryAddress(),
        await daoProposals.getAddress(),
      );

      // 1. Create a space with space voting power
      const spaceParams = {
        name: 'Proposal Token Test Space',
        description: 'Test Description',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 10,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await daoSpaceFactory.createSpace(spaceParams);
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // 2. Join the space with voter1 and voter2
      await daoSpaceFactory.connect(voter1).joinSpace(spaceId);
      await daoSpaceFactory.connect(voter2).joinSpace(spaceId);

      // 3. Get the executor address
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);

      // 4. Create a proposal to deploy a regular token
      // Prepare the calldata for deploying a regular token
      const regularDeployCalldata =
        regularTokenFactory.interface.encodeFunctionData('deployToken', [
          spaceId,
          'Regular Token',
          'REG',
          0, // maxSupply (0 = unlimited)
          true, // transferable
          true, // isVotingToken
        ]);

      // Create the proposal
      const proposalParams = {
        spaceId: spaceId,
        duration: 86400, // 1 day
        transactions: [
          {
            target: await regularTokenFactory.getAddress(),
            value: 0,
            data: regularDeployCalldata,
          },
        ],
      };

      const createTx = await daoProposals
        .connect(voter1)
        .createProposal(proposalParams);
      await createTx.wait();

      const proposalId = await daoProposals.proposalCounter();

      // Check that the proposal is not executed before voting
      const proposalBeforeVoting = await daoProposals.getProposalCore(
        proposalId,
      );
      expect(proposalBeforeVoting[3]).to.equal(false); // Check that executed is false

      // 5. Vote on the proposal with enough votes to pass
      // Vote with voter1 first
      await daoProposals.connect(voter1).vote(proposalId, true);

      // Check if the proposal was executed after voter1 votes
      // If it was executed already, don't try to vote with voter2
      const proposalAfterVoter1 = await daoProposals.getProposalCore(
        proposalId,
      );

      if (!proposalAfterVoter1[3]) {
        // Only vote with voter2 if the proposal isn't already executed
        await daoProposals.connect(voter2).vote(proposalId, true);
      }

      // Wait a bit to ensure the proposal execution completes
      await ethers.provider.send('evm_mine', []);

      // Verify the proposal was executed
      const finalProposal = await daoProposals.getProposalCore(proposalId);
      expect(finalProposal[3]).to.equal(true); // executed should be true

      // 6. Find the deployed token address by checking the TokenDeployed event
      const deployedEvents = await regularTokenFactory.queryFilter(
        regularTokenFactory.filters.TokenDeployed(spaceId),
      );

      expect(deployedEvents.length).to.be.at.least(1);
      const tokenAddress = deployedEvents[0].args.tokenAddress;

      // 7. Verify the token exists and has the right properties
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      expect(await token.name()).to.equal('Regular Token');
      expect(await token.symbol()).to.equal('REG');
    });
  });

  describe('Token Voting Power Tests', function () {
    it('Should correctly calculate voting power using regular tokens', async function () {
      const {
        spaceHelper,
        regularTokenFactory,
        tokenVotingPower,
        daoSpaceFactory,
        owner,
        voter1,
        voter2,
      } = await loadFixture(deployFixture);

      // Create space
      await spaceHelper.createDefaultSpace();
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Deploy a regular token through the executor
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Voting Token',
        'VOTE',
        0, // maxSupply (0 = unlimited)
        true, // transferable
        true, // isVotingToken
      );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              regularTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          regularTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);
      await spaceHelper.joinSpace(Number(spaceId), voter2);

      // Mint different amounts to different users
      await (token as any)
        .connect(executorSigner)
        .mint(await voter1.getAddress(), ethers.parseUnits('100', 18));
      await (token as any)
        .connect(executorSigner)
        .mint(await voter2.getAddress(), ethers.parseUnits('50', 18));

      // Check voting power through token voting power contract
      const voter1Power = await tokenVotingPower.getVotingPower(
        await voter1.getAddress(),
        spaceId,
      );
      const voter2Power = await tokenVotingPower.getVotingPower(
        await voter2.getAddress(),
        spaceId,
      );
      const totalPower = await tokenVotingPower.getTotalVotingPower(spaceId);

      expect(voter1Power).to.equal(ethers.parseUnits('100', 18));
      expect(voter2Power).to.equal(ethers.parseUnits('50', 18));
      expect(totalPower).to.equal(ethers.parseUnits('150', 18));
    });

    it('Should correctly calculate voting power using decaying tokens', async function () {
      const {
        spaceHelper,
        decayingTokenFactory,
        decayTokenVotingPower,
        daoSpaceFactory,
        owner,
        voter1,
      } = await loadFixture(deployFixture);

      // Create space
      await spaceHelper.createDefaultSpace();
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Define decay parameters (high decay for testing)
      const decayPercentage = 2000; // 20% decay per interval
      const decayInterval = 3600; // 1 hour in seconds

      // Deploy a decaying token through the executor
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Decaying Voting Token',
          'DVOTE',
          0, // maxSupply
          true, // transferable
          true, // isVotingToken
          decayPercentage,
          decayInterval,
        );

      const receipt = await tx.wait();
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              decayingTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          decayingTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const decayToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Join the space
      await spaceHelper.joinSpace(Number(spaceId), voter1);

      // Mint tokens
      await decayToken
        .connect(executorSigner)
        .mint(await voter1.getAddress(), ethers.parseUnits('100', 18));

      // Initial voting power should be the full amount
      const initialPower = await decayTokenVotingPower.getVotingPower(
        await voter1.getAddress(),
        spaceId,
      );
      expect(initialPower).to.equal(ethers.parseUnits('100', 18));

      // Advance time by one decay interval
      await ethers.provider.send('evm_increaseTime', [decayInterval]);
      await ethers.provider.send('evm_mine', []);

      // Voting power should show decay in view function
      const powerAfterDecay = await decayTokenVotingPower.getVotingPower(
        await voter1.getAddress(),
        spaceId,
      );
      const expectedPowerAfterDecay =
        (ethers.parseUnits('100', 18) * BigInt(8000)) / BigInt(10000); // 100 * 0.8
      expect(powerAfterDecay).to.be.closeTo(
        expectedPowerAfterDecay,
        ethers.parseUnits('1', 15),
      );

      // Apply decay and check updated power
      await decayTokenVotingPower.applyDecayAndGetVotingPower(
        await voter1.getAddress(),
        spaceId,
      );
      const powerAfterApplying = await decayTokenVotingPower.getVotingPower(
        await voter1.getAddress(),
        spaceId,
      );
      expect(powerAfterApplying).to.equal(powerAfterDecay);

      // Verify the storage was actually updated by checking the token balance directly
      const tokenBalance = await decayToken.balanceOf(
        await voter1.getAddress(),
      );
      expect(tokenBalance).to.equal(powerAfterApplying);
    });
  });

  describe('Token Functionality Tests', function () {
    it('Should deploy a token with maximum supply and enforce it', async function () {
      const {
        spaceHelper,
        regularTokenFactory,
        daoSpaceFactory,
        owner,
        voter1,
      } = await loadFixture(deployFixture);

      // Create space first
      const spaceParams = {
        name: 'Max Supply Space',
        description: 'Space with token max supply',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Set token parameters
      const tokenName = 'Limited Supply Token';
      const tokenSymbol = 'LIMITED';
      const maxSupply = ethers.parseUnits('1000', 18);

      // Deploy token with max supply
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(spaceId, tokenName, tokenSymbol, maxSupply, true, true);

      const receipt = await tx.wait();

      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              regularTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          regularTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // Verify max supply
      expect(await token.maxSupply()).to.equal(maxSupply);

      // Mint exactly max supply
      interface MintableToken {
        connect(signer: any): {
          mint(to: string, amount: bigint): Promise<any>;
          transfer(to: string, amount: bigint): Promise<any>;
          approve(spender: string, amount: bigint): Promise<any>;
          transferFrom(from: string, to: string, amount: bigint): Promise<any>;
        };
      }

      await (token as unknown as MintableToken)
        .connect(executorSigner)
        .mint(await owner.getAddress(), maxSupply);

      // Check balance equals max supply
      expect(await token.balanceOf(await owner.getAddress())).to.equal(
        maxSupply,
      );

      // Try to mint more (should fail)
      await expect(
        (token as any)
          .connect(executorSigner)
          .mint(await voter1.getAddress(), 1),
      ).to.be.revertedWith('Mint would exceed maximum supply');
    });

    it('Should deploy a non-transferable token that prevents transfers', async function () {
      const {
        spaceHelper,
        regularTokenFactory,
        daoSpaceFactory,
        owner,
        voter1,
        voter2,
      } = await loadFixture(deployFixture);

      // Create space first
      const spaceParams = {
        name: 'Non-Transferable Token Space',
        description: 'Space with locked token',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Deploy non-transferable token
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Non-Transferable Token',
        'NTTKN',
        0, // maxSupply
        false, // non-transferable
        true, // isVotingToken
      );

      const receipt = await tx.wait();

      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              regularTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          regularTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // Verify token is non-transferable
      expect(await token.transferable()).to.equal(false);

      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits('100', 18);
      await (token as any)
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);

      // Check balance
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(
        mintAmount,
      );

      // Try to transfer tokens (should fail)
      await expect(
        (token as any)
          .connect(voter1)
          .transfer(await voter2.getAddress(), ethers.parseUnits('10', 18)),
      ).to.be.revertedWith('Token transfers are disabled');

      // Try to use transferFrom (should also fail)
      await (token as any)
        .connect(voter1)
        .approve(await voter2.getAddress(), ethers.parseUnits('10', 18));
      await expect(
        (token as any)
          .connect(voter2)
          .transferFrom(
            await voter1.getAddress(),
            await voter2.getAddress(),
            ethers.parseUnits('10', 18),
          ),
      ).to.be.revertedWith('Token transfers are disabled');
    });

    it('Should deploy a transferable token that allows transfers', async function () {
      const {
        spaceHelper,
        regularTokenFactory,
        daoSpaceFactory,
        owner,
        voter1,
        voter2,
      } = await loadFixture(deployFixture);

      // Create space first
      const spaceParams = {
        name: 'Transferable Token Space',
        description: 'Space with liquid token',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);
      const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);

      // Impersonate the executor
      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);

      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther('1.0'),
      });

      // Deploy transferable token
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Transferable Token',
        'TTKN',
        0, // maxSupply
        true, // transferable
        true, // isVotingToken
      );

      const receipt = await tx.wait();

      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter((log) => {
          try {
            return (
              regularTokenFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              })?.name === 'TokenDeployed'
            );
          } catch (_unused) {
            return false;
          }
        })
        .map((log) =>
          regularTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          }),
        )[0];

      if (!tokenDeployedEvent) {
        throw new Error('Token deployment event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // Verify token is transferable
      expect(await token.transferable()).to.equal(true);

      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits('100', 18);
      await (token as any)
        .connect(executorSigner)
        .mint(await voter1.getAddress(), mintAmount);

      // Check balance
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(
        mintAmount,
      );

      // Transfer tokens (should succeed)
      const transferAmount = ethers.parseUnits('10', 18);
      await (token as any)
        .connect(voter1)
        .transfer(await voter2.getAddress(), transferAmount);

      // Check balances after transfer
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(
        mintAmount - transferAmount,
      );
      expect(await token.balanceOf(await voter2.getAddress())).to.equal(
        transferAmount,
      );

      // Test transferFrom functionality
      await (token as any)
        .connect(voter1)
        .approve(await owner.getAddress(), transferAmount);
      await (token as any)
        .connect(owner)
        .transferFrom(
          await voter1.getAddress(),
          await voter2.getAddress(),
          transferAmount,
        );

      // Check balances after transferFrom
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(
        mintAmount - transferAmount - transferAmount,
      );
      expect(await token.balanceOf(await voter2.getAddress())).to.equal(
        transferAmount + transferAmount,
      );
    });
  });
});
