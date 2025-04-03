import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { SpaceHelper } from './helpers/SpaceHelper';

describe('DAOSpaceFactoryImplementation', function () {
  // We define a fixture to reuse the same setup in every test
  async function deployFixture() {
    const [owner, proposer, voter1, voter2, voter3, other] =
      await ethers.getSigners();

    // Deploy TokenFactory
    const TokenFactory = await ethers.getContractFactory(
      'TokenFactoryImplementation',
    );
    const tokenFactory = await upgrades.deployProxy(
      TokenFactory,
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

    // Deploy VotingPowerDirectory
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
    await daoSpaceFactory.setContracts(
      await tokenFactory.getAddress(),
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await votingPowerDirectory.getAddress(),
    );

    // Set DAOSpaceFactory address in TokenFactory
    await tokenFactory.setSpacesContract(await daoSpaceFactory.getAddress());

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

  describe('Deployment & Initialization', function () {
    it('Should set the right owner', async function () {
      const { daoSpaceFactory, owner } = await loadFixture(deployFixture);
      expect(await daoSpaceFactory.owner()).to.equal(owner.address);
    });

    it('Should initialize with zero spaces', async function () {
      const { daoSpaceFactory } = await loadFixture(deployFixture);
      await expect(daoSpaceFactory.getSpaceDetails(1)).to.be.revertedWith(
        'Invalid space ID',
      );
    });

    it('Should set contract addresses correctly', async function () {
      const {
        daoSpaceFactory,
        tokenFactory,
        joinMethodDirectory,
        exitMethodDirectory,
        votingPowerDirectory,
      } = await loadFixture(deployFixture);

      expect(await daoSpaceFactory.tokenFactoryAddress()).to.equal(
        await tokenFactory.getAddress(),
      );
      expect(await daoSpaceFactory.joinMethodDirectoryAddress()).to.equal(
        await joinMethodDirectory.getAddress(),
      );
      expect(await daoSpaceFactory.exitMethodDirectoryAddress()).to.equal(
        await exitMethodDirectory.getAddress(),
      );
      expect(await daoSpaceFactory.proposalManagerAddress()).to.equal(
        await votingPowerDirectory.getAddress(),
      );
    });
  });

  describe('Space Creation', function () {
    it('Should create a space with correct parameters', async function () {
      const { spaceHelper, owner } = await loadFixture(deployFixture);

      const tx = await spaceHelper.createDefaultSpace();
      const receipt = await tx.wait();

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
      ).to.be.revertedWith('Unity value must be between 1 and 100');
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
        'Already a member',
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
      const { daoSpaceFactory, spaceHelper, owner, other, votingPowerDirectory } = await loadFixture(deployFixture);

      // 1. Deploy SpaceVotingPower implementation first
      const SpaceVotingPower = await ethers.getContractFactory('SpaceVotingPowerImplementation');
      const spaceVotingPower = await upgrades.deployProxy(
        SpaceVotingPower,
        [owner.address],
        {
          initializer: 'initialize',
          kind: 'uups',
        }
      );
      await spaceVotingPower.waitForDeployment();
      
      // Set space factory in voting power source
      await spaceVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());

      // 2. Register the voting power source in the directory
      await votingPowerDirectory.addVotingPowerSource(await spaceVotingPower.getAddress());

      // 3. Deploy the real DAOProposalsImplementation contract
      const DAOProposals = await ethers.getContractFactory('DAOProposalsImplementation');
      const daoProposals = await upgrades.deployProxy(
        DAOProposals,
        [owner.address],
        {
          initializer: 'initialize',
          kind: 'uups',
        }
      );
      await daoProposals.waitForDeployment();

      // Configure the proposals contract with the space factory and directory
      await daoProposals.setContracts(
        await daoSpaceFactory.getAddress(),
        await votingPowerDirectory.getAddress()
      );

      // 4. Set the proposals contract in space factory
      await daoSpaceFactory.setProposalsContract(await daoProposals.getAddress());

      // 5. Create a space with join method 2
      const spaceParams = {
        name: 'Join By Proposal Space',
        description: 'Test Description',
        imageUrl: 'https://test.com/image.png',
        unity: 51,
        quorum: 51,
        votingPowerSource: 1, // This should match the ID registered in votingPowerDirectory
        exitMethod: 1,
        joinMethod: 2, // <-- Join method 2 (proposal required)
        createToken: false,
        tokenName: '',
        tokenSymbol: '',
      };

      await spaceHelper.contract.createSpace(spaceParams);

      // 6. Attempt to join the space (should create a proposal)
      const joinTx = await daoSpaceFactory.connect(other).joinSpace(1);
      const receipt = await joinTx.wait();

      // 7. Check for the JoinRequestedWithProposal event
      const joinRequestedEvents = receipt?.logs
        .filter(log => {
          try {
            return daoSpaceFactory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === 'JoinRequestedWithProposal';
          } catch (e) {
            return false;
          }
        })
        .map(log => daoSpaceFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        }));

      expect(joinRequestedEvents?.length).to.be.at.least(1);
      const joinEvent = joinRequestedEvents?.[0];
      expect(joinEvent?.args.spaceId).to.equal(1);
      expect(joinEvent?.args.member).to.equal(await other.getAddress());

      // Store the proposal ID for later use
      const proposalId = joinEvent?.args.proposalId;

      // 8. Verify the member is NOT yet added to the space
      expect(await daoSpaceFactory.isMember(1, await other.getAddress())).to.be.false;

      // 9. Verify the proposal exists in the DAO proposals contract
      const proposalData = await daoProposals.getProposalCore(proposalId);
      expect(proposalData.spaceId).to.equal(1);
      expect(proposalData.executed).to.be.false;
      
      // 10. The target contract in the proposal should be the space factory
      // This is difficult to check directly with the real implementation, but
      // we can verify that the proposal was created for the correct space
      expect(proposalData.spaceId).to.equal(1);
    });

    it('Should remove a member from a space', async function () {
      const { spaceHelper, daoSpaceFactory, owner, other } = await loadFixture(deployFixture);

      // Create space with exit method 1 (only executor can remove members)
      const spaceParams = {
        name: 'Space for Member Removal',
        description: 'Test Description',
        imageUrl: 'https://test.com/image.png',
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
      expect(await daoSpaceFactory.isMember(1, await other.getAddress())).to.be.true;
      
      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(1);
      
      // Impersonate the executor
      await ethers.provider.send("hardhat_impersonateAccount", [executorAddress]);
      const executorSigner = await ethers.getSigner(executorAddress);
      
      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther("1.0")
      });
      
      // Remove the member using removeMember (since we're the executor and exit method is 1)
      await expect(daoSpaceFactory.connect(executorSigner).removeMember(1, await other.getAddress()))
        .to.emit(daoSpaceFactory, 'MemberRemoved')
        .withArgs(1, await other.getAddress());
        
      // Verify member was removed
      expect(await daoSpaceFactory.isMember(1, await other.getAddress())).to.be.false;
      
      // Verify member's spaces were updated
      const memberSpaces = await daoSpaceFactory.getMemberSpaces(await other.getAddress());
      expect(memberSpaces.length).to.equal(0);
    });
  });

  describe('Access Control', function () {
    it('Should only allow owner to set contracts', async function () {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      await expect(
        spaceHelper.contract
          .connect(other)
          .setContracts(
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
          ),
      ).to.be.reverted;
    });

    it('Should only allow token factory to add tokens', async function () {
      const { spaceHelper, other } = await loadFixture(deployFixture);

      // Create space first
      const spaceParams = {
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
      };

      await spaceHelper.contract.createSpace(spaceParams);

      await expect(
        spaceHelper.contract
          .connect(other)
          .addTokenToSpace(1, ethers.ZeroAddress),
      ).to.be.revertedWith('Only token factory can add tokens');
    });
  });

  describe('Space Tokens', function () {
    it('Should allow executor to mint tokens', async function () {
      const { spaceHelper, tokenFactory, daoSpaceFactory, owner, voter1 } = await loadFixture(deployFixture);

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
      
      // Deploy token separately
      const deployTx = await tokenFactory.deployToken(1, 'Space Token', 'STKN', 0, true);
      const receipt = await deployTx.wait();
      
      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter(log => {
          try {
            return tokenFactory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === 'TokenDeployed';
          } catch (e) {
            return false;
          }
        })
        .map(log => tokenFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        }))[0];
      
      if (!tokenDeployedEvent) {
        throw new Error("Token deployment event not found");
      }
      
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt('SpaceToken', tokenAddress);
      
      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(1);
      
      // Impersonate the executor
      await ethers.provider.send("hardhat_impersonateAccount", [executorAddress]);
      const executorSigner = await ethers.getSigner(executorAddress);
      
      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther("1.0")
      });
      
      // Join the space
      await spaceHelper.joinSpace(1, voter1);
      
      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits("100", 18);
      await token.connect(executorSigner).mint(await voter1.getAddress(), mintAmount);
      
      // Check balance
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(mintAmount);
    });

    it('Should create a token with max supply and enforce it', async function () {
      const { daoSpaceFactory, tokenFactory, owner, voter1 } = await loadFixture(deployFixture);

      // Deploy a token directly with max supply
      const spaceId = 1;
      const tokenName = "Limited Token";
      const tokenSymbol = "LMT";
      const maxSupply = ethers.parseUnits("1000", 18);
      
      // Create a space first
      const spaceParams = {
        name: 'Limited Token Space',
        description: 'Space with Limited Token',
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
      
      await daoSpaceFactory.createSpace(spaceParams);
      
      // Deploy token with max supply
      const tx = await tokenFactory.deployToken(spaceId, tokenName, tokenSymbol, maxSupply, true);
      const receipt = await tx.wait();
      
      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter(log => {
          try {
            return tokenFactory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === 'TokenDeployed';
          } catch (e) {
            return false;
          }
        })
        .map(log => tokenFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        }))[0];
        
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt('SpaceToken', tokenAddress);
      
      // Verify max supply
      expect(await token.maxSupply()).to.equal(maxSupply);
      
      // Get executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
      await ethers.provider.send("hardhat_impersonateAccount", [executorAddress]);
      const executorSigner = await ethers.getSigner(executorAddress);
      
      // Fund the executor with some ETH for transactions
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther("1.0")
      });
      
      // Mint exactly max supply
      await token.connect(executorSigner).mint(await owner.getAddress(), maxSupply);
      
      // Check balance equals max supply
      expect(await token.balanceOf(await owner.getAddress())).to.equal(maxSupply);
      
      // Try to mint more (should fail)
      await expect(
        token.connect(executorSigner).mint(await voter1.getAddress(), 1)
      ).to.be.revertedWith('Mint would exceed maximum supply');
    });

    it('Should not allow non-executor to mint tokens', async function () {
      const { spaceHelper, tokenFactory, owner, voter1 } = await loadFixture(deployFixture);

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
      
      // Deploy token separately
      const deployTx = await tokenFactory.deployToken(1, 'Space Token', 'STKN', 0, true);
      const receipt = await deployTx.wait();
      
      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter(log => {
          try {
            return tokenFactory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === 'TokenDeployed';
          } catch (e) {
            return false;
          }
        })
        .map(log => tokenFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        }))[0];
      
      if (!tokenDeployedEvent) {
        throw new Error("Token deployment event not found");
      }
      
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt('SpaceToken', tokenAddress);
      
      // Try to mint as non-executor (should fail)
      const mintAmount = ethers.parseUnits("100", 18);
      await expect(
        token.connect(voter1).mint(await voter1.getAddress(), mintAmount)
      ).to.be.revertedWith('Only executor can call this function');
    });

    it('Should deploy a non-transferable token that prevents transfers', async function () {
      const { spaceHelper, tokenFactory, daoSpaceFactory, owner, voter1, voter2 } = await loadFixture(deployFixture);

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
      
      // Deploy non-transferable token
      const deployTx = await tokenFactory.deployToken(
        1, 'Non-Transferable Token', 'NTTKN', 0, false
      );
      const receipt = await deployTx.wait();
      
      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter(log => {
          try {
            return tokenFactory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === 'TokenDeployed';
          } catch (e) {
            return false;
          }
        })
        .map(log => tokenFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        }))[0];
      
      if (!tokenDeployedEvent) {
        throw new Error("Token deployment event not found");
      }
      
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt('SpaceToken', tokenAddress);
      
      // Verify token is non-transferable
      expect(await token.transferable()).to.equal(false);
      
      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(1);
      
      // Impersonate the executor
      await ethers.provider.send("hardhat_impersonateAccount", [executorAddress]);
      const executorSigner = await ethers.getSigner(executorAddress);
      
      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther("1.0")
      });
      
      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits("100", 18);
      await token.connect(executorSigner).mint(await voter1.getAddress(), mintAmount);
      
      // Check balance
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(mintAmount);
      
      // Try to transfer tokens (should fail)
      await expect(
        token.connect(voter1).transfer(await voter2.getAddress(), ethers.parseUnits("10", 18))
      ).to.be.revertedWith('Token transfers are disabled');
      
      // Try to use transferFrom (should also fail)
      await token.connect(voter1).approve(await voter2.getAddress(), ethers.parseUnits("10", 18));
      await expect(
        token.connect(voter2).transferFrom(
          await voter1.getAddress(), 
          await voter2.getAddress(), 
          ethers.parseUnits("10", 18)
        )
      ).to.be.revertedWith('Token transfers are disabled');
    });

    it('Should deploy a transferable token that allows transfers', async function () {
      const { spaceHelper, tokenFactory, daoSpaceFactory, owner, voter1, voter2 } = await loadFixture(deployFixture);

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
      
      // Deploy transferable token
      const deployTx = await tokenFactory.deployToken(
        1, 'Transferable Token', 'TTKN', 0, true
      );
      const receipt = await deployTx.wait();
      
      // Get token address from event
      const tokenDeployedEvent = receipt?.logs
        .filter(log => {
          try {
            return tokenFactory.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === 'TokenDeployed';
          } catch (e) {
            return false;
          }
        })
        .map(log => tokenFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        }))[0];
      
      if (!tokenDeployedEvent) {
        throw new Error("Token deployment event not found");
      }
      
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const token = await ethers.getContractAt('SpaceToken', tokenAddress);
      
      // Verify token is transferable
      expect(await token.transferable()).to.equal(true);
      
      // Get the executor
      const executorAddress = await daoSpaceFactory.getSpaceExecutor(1);
      
      // Impersonate the executor
      await ethers.provider.send("hardhat_impersonateAccount", [executorAddress]);
      const executorSigner = await ethers.getSigner(executorAddress);
      
      // Fund the executor
      await owner.sendTransaction({
        to: executorAddress,
        value: ethers.parseEther("1.0")
      });
      
      // Mint tokens to voter1
      const mintAmount = ethers.parseUnits("100", 18);
      await token.connect(executorSigner).mint(await voter1.getAddress(), mintAmount);
      
      // Check balance
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(mintAmount);
      
      // Transfer tokens (should succeed)
      const transferAmount = ethers.parseUnits("10", 18);
      await token.connect(voter1).transfer(await voter2.getAddress(), transferAmount);
      
      // Check balances after transfer
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(mintAmount - transferAmount);
      expect(await token.balanceOf(await voter2.getAddress())).to.equal(transferAmount);
      
      // Test transferFrom functionality
      await token.connect(voter1).approve(await owner.getAddress(), transferAmount);
      await token.connect(owner).transferFrom(
        await voter1.getAddress(), 
        await voter2.getAddress(), 
        transferAmount
      );
      
      // Check balances after transferFrom
      expect(await token.balanceOf(await voter1.getAddress())).to.equal(mintAmount - transferAmount - transferAmount);
      expect(await token.balanceOf(await voter2.getAddress())).to.equal(transferAmount + transferAmount);
    });
  });
});
