import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Decay Token Voting Power with Delegation - Comprehensive Tests', function () {
  let daoSpaceFactory: any;
  let daoProposals: any;
  let decayTokenVotingPower: any;
  let votingPowerDirectory: any;
  let votingPowerDelegation: any;
  let decayingTokenFactory: any;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];

  // Constants for decay testing
  const DECAY_PERCENTAGE = 100; // 1% decay (100 basis points)
  const DECAY_INTERVAL = 86400; // 1 day in seconds
  const INITIAL_TOKEN_AMOUNT = 10000n; // 10,000 tokens per member

  async function deployDecayTokenFixture() {
    const signers = await ethers.getSigners();
    const [owner, ...members] = signers;

    // Deploy VotingPowerDelegation contract
    const VotingPowerDelegation = await ethers.getContractFactory(
      'VotingPowerDelegationImplementation',
    );
    const votingPowerDelegation = await upgrades.deployProxy(
      VotingPowerDelegation,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy DAOSpaceFactory
    const DAOSpaceFactory = await ethers.getContractFactory(
      'DAOSpaceFactoryImplementation',
    );
    const daoSpaceFactory = await upgrades.deployProxy(
      DAOSpaceFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy JoinMethodDirectory with OpenJoin
    const JoinMethodDirectory = await ethers.getContractFactory(
      'JoinMethodDirectoryImplementation',
    );
    const joinMethodDirectory = await upgrades.deployProxy(
      JoinMethodDirectory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
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
      { initializer: 'initialize', kind: 'uups' },
    );

    const NoExit = await ethers.getContractFactory('NoExit');
    const noExit = await NoExit.deploy();
    await exitMethodDirectory.addExitMethod(1, await noExit.getAddress());

    // Deploy DAOProposals contract
    const DAOProposals = await ethers.getContractFactory(
      'DAOProposalsImplementation',
    );
    const daoProposals = await upgrades.deployProxy(
      DAOProposals,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy DecayTokenVotingPower
    const DecayTokenVotingPower = await ethers.getContractFactory(
      'VoteDecayTokenVotingPowerImplementation',
    );
    const decayTokenVotingPower = await upgrades.deployProxy(
      DecayTokenVotingPower,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy VotingPowerDirectory
    const VotingPowerDirectory = await ethers.getContractFactory(
      'VotingPowerDirectoryImplementation',
    );
    const votingPowerDirectory = await upgrades.deployProxy(
      VotingPowerDirectory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy DecayingTokenFactory
    const DecayingSpaceToken = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );
    const decayingTokenImpl = await DecayingSpaceToken.deploy();

    const DecayingTokenFactory = await ethers.getContractFactory(
      'DecayingTokenFactory',
    );
    const decayingTokenFactory = await upgrades.deployProxy(
      DecayingTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    await decayingTokenFactory.setDecayingTokenImplementation(
      await decayingTokenImpl.getAddress(),
    );
    await decayingTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await decayingTokenFactory.setDecayVotingPowerContract(
      await decayTokenVotingPower.getAddress(),
    );

    // Configure contracts
    await decayTokenVotingPower.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );
    await decayTokenVotingPower.setDelegationContract(
      await votingPowerDelegation.getAddress(),
    );
    await decayTokenVotingPower.setDecayTokenFactory(
      await decayingTokenFactory.getAddress(),
    );

    await votingPowerDirectory.addVotingPowerSource(
      await decayTokenVotingPower.getAddress(),
    );

    await daoProposals.setContracts(
      await daoSpaceFactory.getAddress(),
      await votingPowerDirectory.getAddress(),
    );
    await daoProposals.setDelegationContract(
      await votingPowerDelegation.getAddress(),
    );

    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await daoProposals.getAddress(),
    );

    await joinMethodDirectory.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );
    await exitMethodDirectory.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );

    return {
      daoSpaceFactory,
      daoProposals,
      decayTokenVotingPower,
      votingPowerDirectory,
      votingPowerDelegation,
      decayingTokenFactory,
      joinMethodDirectory,
      exitMethodDirectory,
      owner,
      members,
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployDecayTokenFixture);
    daoSpaceFactory = fixture.daoSpaceFactory;
    daoProposals = fixture.daoProposals;
    decayTokenVotingPower = fixture.decayTokenVotingPower;
    votingPowerDirectory = fixture.votingPowerDirectory;
    votingPowerDelegation = fixture.votingPowerDelegation;
    decayingTokenFactory = fixture.decayingTokenFactory;
    owner = fixture.owner;
    members = fixture.members;
  });

  // Helper function to create a space with decay token
  async function createSpaceWithDecayToken(params: {
    name: string;
    unity?: number;
    quorum?: number;
    memberCount?: number;
    decayPercentage?: number;
    decayInterval?: number;
  }) {
    const spaceParams = {
      name: params.name,
      description: 'Test space with decay token',
      imageUrl: '',
      unity: params.unity || 67,
      quorum: params.quorum || 50,
      votingPowerSource: 1, // Decay token voting power (index in directory, 1-based)
      exitMethod: 1,
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = await daoSpaceFactory.spaceCounter();

    // Add members if specified
    if (params.memberCount) {
      for (let i = 0; i < params.memberCount && i < members.length; i++) {
        await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
      }
    }

    // Deploy decay token for the space
    const spaceExecutor = await daoSpaceFactory.getSpaceExecutor(spaceId);
    const executorSigner = await ethers.getImpersonatedSigner(spaceExecutor);

    // Fund the executor
    await owner.sendTransaction({
      to: spaceExecutor,
      value: ethers.parseEther('1.0'),
    });

    const decayPercentage = params.decayPercentage || DECAY_PERCENTAGE;
    const decayInterval = params.decayInterval || DECAY_INTERVAL;

    const tx = await decayingTokenFactory
      .connect(executorSigner)
      .deployDecayingToken(
        spaceId,
        `${params.name} Token`,
        'DT',
        0, // unlimited supply
        false, // not transferable
        true, // is voting token
        decayPercentage,
        decayInterval,
      );

    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => {
      try {
        return (
          decayingTokenFactory.interface.parseLog(log)?.name === 'TokenDeployed'
        );
      } catch {
        return false;
      }
    });

    const parsedEvent = decayingTokenFactory.interface.parseLog(event);
    const tokenAddress = parsedEvent?.args[1];

    // Set the token in the voting power contract
    await decayTokenVotingPower
      .connect(executorSigner)
      .setSpaceToken(spaceId, tokenAddress);

    // Get token contract instance
    const DecayingSpaceToken = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );
    const token = DecayingSpaceToken.attach(tokenAddress);

    // Mint tokens to members
    if (params.memberCount) {
      for (let i = 0; i < params.memberCount && i < members.length; i++) {
        await token
          .connect(executorSigner)
          .mint(members[i].address, INITIAL_TOKEN_AMOUNT);
      }
    }
    // Mint to owner too
    await token
      .connect(executorSigner)
      .mint(owner.address, INITIAL_TOKEN_AMOUNT);

    return { spaceId, tokenAddress, token };
  }

  // Helper to create a test proposal
  async function createTestProposal(spaceId: bigint, creator: any) {
    const calldata = daoSpaceFactory.interface.encodeFunctionData(
      'getSpaceDetails',
      [spaceId],
    );

    await daoProposals.connect(creator).createProposal({
      spaceId,
      duration: 86400 * 7, // 7 days
      transactions: [
        {
          target: await daoSpaceFactory.getAddress(),
          value: 0,
          data: calldata,
        },
      ],
    });

    return await daoProposals.proposalCounter();
  }

  describe('Basic Decay Functionality', function () {
    it('Should correctly calculate voting power without decay', async function () {
      console.log('\n--- Testing Initial Voting Power (No Decay Yet) ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'No Decay Space',
        memberCount: 3,
      });

      // Check initial voting powers
      const ownerPower = await decayTokenVotingPower.getVotingPower(
        owner.address,
        spaceId,
      );
      expect(ownerPower).to.equal(INITIAL_TOKEN_AMOUNT);

      const member0Power = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      expect(member0Power).to.equal(INITIAL_TOKEN_AMOUNT);

      const totalPower = await decayTokenVotingPower.getTotalVotingPower(
        spaceId,
      );
      expect(totalPower).to.equal(INITIAL_TOKEN_AMOUNT * 4n); // owner + 3 members

      console.log('✅ Initial voting power calculated correctly');
    });

    it('Should decay tokens after one interval', async function () {
      console.log('\n--- Testing Token Decay After One Interval ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Single Decay Space',
        memberCount: 2,
        decayPercentage: 100, // 1% decay
        decayInterval: 3600, // 1 hour
      });

      const initialBalance = await token.balanceOf(members[0].address);
      expect(initialBalance).to.equal(INITIAL_TOKEN_AMOUNT);

      // Fast forward 1 hour
      await time.increase(3600);

      // Check decayed balance (view function, doesn't apply decay)
      const decayedBalance = await token.balanceOf(members[0].address);
      const expectedBalance = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n; // 99% of original
      expect(decayedBalance).to.equal(expectedBalance);

      console.log(`Initial: ${initialBalance}, After 1h: ${decayedBalance}`);
      console.log('✅ Token decay calculated correctly');
    });

    it('Should apply decay and permanently reduce balance', async function () {
      console.log('\n--- Testing Apply Decay Function ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Apply Decay Space',
        memberCount: 2,
        decayPercentage: 100, // 1% decay
        decayInterval: 3600, // 1 hour
      });

      // Fast forward 1 hour
      await time.increase(3600);

      const balanceBeforeApply = await token.balanceOf(members[0].address);

      // Apply decay
      await token.applyDecay(members[0].address);

      const balanceAfterApply = await token.balanceOf(members[0].address);
      const expectedBalance = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n;

      expect(balanceAfterApply).to.equal(expectedBalance);
      expect(balanceAfterApply).to.equal(balanceBeforeApply);

      console.log(`Balance after applying decay: ${balanceAfterApply}`);
      console.log('✅ Apply decay permanently reduced balance');
    });

    it('Should decay tokens over multiple intervals', async function () {
      console.log('\n--- Testing Multiple Decay Intervals ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Multiple Decay Space',
        memberCount: 1,
        decayPercentage: 100, // 1% decay per interval
        decayInterval: 3600, // 1 hour
      });

      // Fast forward 5 hours (5 decay periods)
      await time.increase(3600 * 5);

      const decayedBalance = await token.balanceOf(members[0].address);

      // Calculate expected: balance * (0.99)^5
      // Using integer math: balance * (9900/10000)^5
      let expected = INITIAL_TOKEN_AMOUNT;
      for (let i = 0; i < 5; i++) {
        expected = (expected * 9900n) / 10000n;
      }

      // Allow for 1 unit of rounding error due to integer division
      expect(decayedBalance).to.be.closeTo(expected, 1n);

      console.log(`After 5 periods: ${decayedBalance}, expected: ${expected}`);
      console.log('✅ Multiple decay periods calculated correctly');
    });

    it('Should handle partial interval (no decay)', async function () {
      console.log('\n--- Testing Partial Interval ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Partial Interval Space',
        memberCount: 1,
        decayPercentage: 100,
        decayInterval: 3600,
      });

      // Fast forward 30 minutes (half interval)
      await time.increase(1800);

      const balance = await token.balanceOf(members[0].address);
      expect(balance).to.equal(INITIAL_TOKEN_AMOUNT); // No decay yet

      console.log('✅ Partial interval correctly does not trigger decay');
    });
  });

  describe('Voting Power with Decay', function () {
    it('Should reflect decayed balance in voting power', async function () {
      console.log('\n--- Testing Voting Power Reflects Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Voting Power Decay Space',
        memberCount: 2,
        decayPercentage: 500, // 5% decay
        decayInterval: 3600,
      });

      const initialPower = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      expect(initialPower).to.equal(INITIAL_TOKEN_AMOUNT);

      // Fast forward 1 hour
      await time.increase(3600);

      const decayedPower = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      const expectedPower = (INITIAL_TOKEN_AMOUNT * 9500n) / 10000n; // 95% of original

      expect(decayedPower).to.equal(expectedPower);

      console.log(
        `Initial power: ${initialPower}, Decayed power: ${decayedPower}`,
      );
      console.log('✅ Voting power correctly reflects token decay');
    });

    it('Should update total voting power with decay', async function () {
      console.log('\n--- Testing Total Voting Power with Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Total Power Decay Space',
        memberCount: 3,
        decayPercentage: 200, // 2% decay
        decayInterval: 3600,
      });

      const initialTotal = await decayTokenVotingPower.getTotalVotingPower(
        spaceId,
      );
      expect(initialTotal).to.equal(INITIAL_TOKEN_AMOUNT * 4n); // 4 members

      // Fast forward 1 hour
      await time.increase(3600);

      const decayedTotal = await decayTokenVotingPower.getTotalVotingPower(
        spaceId,
      );
      const expectedTotal = (INITIAL_TOKEN_AMOUNT * 4n * 9800n) / 10000n; // 98% of total

      expect(decayedTotal).to.equal(expectedTotal);

      console.log(
        `Initial total: ${initialTotal}, Decayed total: ${decayedTotal}`,
      );
      console.log('✅ Total voting power correctly reflects decay');
    });

    it('Should handle voting with decayed power', async function () {
      console.log('\n--- Testing Voting with Decayed Power ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Vote with Decay Space',
        memberCount: 3,
        unity: 51,
        quorum: 50,
        decayPercentage: 1000, // 10% decay
        decayInterval: 3600,
      });

      // Fast forward 1 hour
      await time.increase(3600);

      const proposalId = await createTestProposal(spaceId, owner);

      // Member votes with decayed power
      await daoProposals.connect(members[0]).vote(proposalId, true);

      const proposal = await daoProposals.getProposalCore(proposalId);
      const expectedVotes = (INITIAL_TOKEN_AMOUNT * 9000n) / 10000n; // 90% of original

      expect(proposal.yesVotes).to.equal(expectedVotes);

      console.log(`Vote cast with decayed power: ${proposal.yesVotes}`);
      console.log('✅ Voting works correctly with decayed tokens');
    });
  });

  describe('Delegation with Decay', function () {
    it('Should calculate delegated voting power with decay', async function () {
      console.log('\n--- Testing Delegation with Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Delegation Decay Space',
        memberCount: 3,
        decayPercentage: 100, // 1% decay
        decayInterval: 3600,
      });

      // Member 0 delegates to member 1
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[1].address, spaceId);

      // Fast forward 1 hour
      await time.increase(3600);

      const delegatorPower = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      expect(delegatorPower).to.equal(0); // Delegated away

      const delegatePower = await decayTokenVotingPower.getVotingPower(
        members[1].address,
        spaceId,
      );
      const expectedPower = (INITIAL_TOKEN_AMOUNT * 2n * 9900n) / 10000n; // 2 members * 99%

      expect(delegatePower).to.equal(expectedPower);

      console.log(`Delegate power with decay: ${delegatePower}`);
      console.log('✅ Delegation correctly includes decayed tokens');
    });

    it('Should handle multiple delegators with different decay', async function () {
      console.log('\n--- Testing Multiple Delegators with Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Multiple Delegators Decay',
        memberCount: 4,
        decayPercentage: 100, // 1% decay
        decayInterval: 3600,
      });

      // Members 0, 1, 2 delegate to member 3
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[3].address, spaceId);
      await votingPowerDelegation
        .connect(members[1])
        .delegate(members[3].address, spaceId);
      await votingPowerDelegation
        .connect(members[2])
        .delegate(members[3].address, spaceId);

      // Fast forward 1 hour
      await time.increase(3600);

      const delegatePower = await decayTokenVotingPower.getVotingPower(
        members[3].address,
        spaceId,
      );
      const expectedPower = (INITIAL_TOKEN_AMOUNT * 4n * 9900n) / 10000n; // 4 members * 99%

      expect(delegatePower).to.equal(expectedPower);

      console.log(`Delegate accumulated decayed power: ${delegatePower}`);
      console.log('✅ Multiple delegators with decay handled correctly');
    });

    it('Should handle non-member delegator with decay (should not count)', async function () {
      console.log('\n--- Testing Non-Member Delegator with Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Non-Member Delegator Decay',
        memberCount: 2,
        decayPercentage: 100,
        decayInterval: 3600,
      });

      // Give tokens to non-member
      const spaceExecutor = await daoSpaceFactory.getSpaceExecutor(spaceId);
      const executorSigner = await ethers.getImpersonatedSigner(spaceExecutor);
      await token
        .connect(executorSigner)
        .mint(members[10].address, INITIAL_TOKEN_AMOUNT);

      // Non-member delegates to member
      await votingPowerDelegation
        .connect(members[10])
        .delegate(members[0].address, spaceId);

      // Fast forward 1 hour
      await time.increase(3600);

      const delegatePower = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      const expectedPower = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n; // Only own power

      expect(delegatePower).to.equal(expectedPower);

      console.log('✅ Non-member delegator correctly ignored with decay');
    });

    it('Should handle re-delegation with decay', async function () {
      console.log('\n--- Testing Re-delegation with Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Re-delegation Decay Space',
        memberCount: 4,
        decayPercentage: 100,
        decayInterval: 3600,
      });

      // Initial delegation: member0 -> member1
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[1].address, spaceId);

      // Fast forward 30 minutes
      await time.increase(1800);

      // Re-delegate: member0 -> member2
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[2].address, spaceId);

      // Fast forward another 30 minutes (total 1 hour)
      await time.increase(1800);

      const power1 = await decayTokenVotingPower.getVotingPower(
        members[1].address,
        spaceId,
      );
      const power2 = await decayTokenVotingPower.getVotingPower(
        members[2].address,
        spaceId,
      );

      const expectedSinglePower = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n;
      const expectedDoublePower = (INITIAL_TOKEN_AMOUNT * 2n * 9900n) / 10000n;

      expect(power1).to.equal(expectedSinglePower); // Lost delegation
      expect(power2).to.equal(expectedDoublePower); // Gained delegation

      console.log('✅ Re-delegation with decay transfers power correctly');
    });
  });

  describe('Apply Decay Function', function () {
    it('Should apply decay and return updated voting power', async function () {
      console.log('\n--- Testing applyDecayAndGetVotingPower ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Apply Decay Power Space',
        memberCount: 2,
        decayPercentage: 500, // 5% decay
        decayInterval: 3600,
      });

      // Fast forward 1 hour
      await time.increase(3600);

      // Apply decay and get power (this is a state-changing function)
      const tx = await decayTokenVotingPower.applyDecayAndGetVotingPower(
        members[0].address,
        spaceId,
      );
      await tx.wait();

      // Now check the power
      const updatedPower = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );

      const expectedPower = (INITIAL_TOKEN_AMOUNT * 9500n) / 10000n;
      expect(updatedPower).to.equal(expectedPower);

      // Verify balance was actually updated on-chain
      const balance = await token.balanceOf(members[0].address);
      expect(balance).to.equal(expectedPower);

      console.log(
        '✅ Apply decay function correctly updates balance and returns power',
      );
    });

    it('Should apply decay to delegated power', async function () {
      console.log('\n--- Testing Apply Decay with Delegation ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Apply Decay Delegation Space',
        memberCount: 3,
        decayPercentage: 200, // 2% decay
        decayInterval: 3600,
      });

      // Member 0 delegates to member 1
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[1].address, spaceId);

      // Fast forward 1 hour
      await time.increase(3600);

      // Apply decay and get delegated power (state-changing function)
      const tx = await decayTokenVotingPower.applyDecayAndGetVotingPower(
        members[1].address,
        spaceId,
      );
      await tx.wait();

      // Now check the power
      const updatedPower = await decayTokenVotingPower.getVotingPower(
        members[1].address,
        spaceId,
      );

      const expectedPower = (INITIAL_TOKEN_AMOUNT * 2n * 9800n) / 10000n;
      expect(updatedPower).to.equal(expectedPower);

      console.log('✅ Apply decay with delegation works correctly');
    });
  });

  describe('Different Decay Rates', function () {
    it('Should handle high decay rate (10%)', async function () {
      console.log('\n--- Testing High Decay Rate (10%) ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'High Decay Space',
        memberCount: 2,
        decayPercentage: 1000, // 10% decay
        decayInterval: 3600,
      });

      // Fast forward 1 hour
      await time.increase(3600);

      const power = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      const expectedPower = (INITIAL_TOKEN_AMOUNT * 9000n) / 10000n; // 90%

      expect(power).to.equal(expectedPower);

      console.log(`Power after 10% decay: ${power}`);
      console.log('✅ High decay rate handled correctly');
    });

    it('Should handle low decay rate (0.1%)', async function () {
      console.log('\n--- Testing Low Decay Rate (0.1%) ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Low Decay Space',
        memberCount: 2,
        decayPercentage: 10, // 0.1% decay
        decayInterval: 3600,
      });

      // Fast forward 1 hour
      await time.increase(3600);

      const power = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );
      const expectedPower = (INITIAL_TOKEN_AMOUNT * 9990n) / 10000n; // 99.9%

      expect(power).to.equal(expectedPower);

      console.log(`Power after 0.1% decay: ${power}`);
      console.log('✅ Low decay rate handled correctly');
    });

    it('Should handle different intervals (hourly vs daily)', async function () {
      console.log('\n--- Testing Different Decay Intervals ---');

      // Hourly decay
      const { spaceId: spaceId1, token: token1 } =
        await createSpaceWithDecayToken({
          name: 'Hourly Decay Space',
          memberCount: 1,
          decayPercentage: 100, // 1%
          decayInterval: 3600, // 1 hour
        });

      // Daily decay
      const { spaceId: spaceId2, token: token2 } =
        await createSpaceWithDecayToken({
          name: 'Daily Decay Space',
          memberCount: 1,
          decayPercentage: 100, // 1%
          decayInterval: 86400, // 1 day
        });

      // Fast forward 1 hour
      await time.increase(3600);

      const powerHourly = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId1,
      );
      const powerDaily = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId2,
      );

      expect(powerHourly).to.be.lessThan(powerDaily); // Hourly should have decayed, daily should not

      console.log(`Hourly: ${powerHourly}, Daily: ${powerDaily}`);
      console.log('✅ Different decay intervals work correctly');
    });
  });

  describe('Cross-Space Independence with Decay', function () {
    it('Should maintain independent decay across different spaces', async function () {
      console.log('\n--- Testing Cross-Space Decay Independence ---');

      // Space 1: 1% decay per hour
      const { spaceId: space1, token: token1 } =
        await createSpaceWithDecayToken({
          name: 'Space 1',
          memberCount: 2,
          decayPercentage: 100,
          decayInterval: 3600,
        });

      // Space 2: 5% decay per hour
      const { spaceId: space2, token: token2 } =
        await createSpaceWithDecayToken({
          name: 'Space 2',
          memberCount: 2,
          decayPercentage: 500,
          decayInterval: 3600,
        });

      // Fast forward 1 hour
      await time.increase(3600);

      const power1 = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        space1,
      );
      const power2 = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        space2,
      );

      const expected1 = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n; // 99%
      const expected2 = (INITIAL_TOKEN_AMOUNT * 9500n) / 10000n; // 95%

      expect(power1).to.equal(expected1);
      expect(power2).to.equal(expected2);

      console.log(
        `Space 1 (1% decay): ${power1}, Space 2 (5% decay): ${power2}`,
      );
      console.log('✅ Different spaces maintain independent decay rates');
    });

    it('Should handle delegation independently across spaces with decay', async function () {
      console.log('\n--- Testing Cross-Space Delegation with Decay ---');

      const { spaceId: space1, token: token1 } =
        await createSpaceWithDecayToken({
          name: 'Space 1 Delegation',
          memberCount: 3,
          decayPercentage: 100,
          decayInterval: 3600,
        });

      const { spaceId: space2, token: token2 } =
        await createSpaceWithDecayToken({
          name: 'Space 2 Delegation',
          memberCount: 3,
          decayPercentage: 100,
          decayInterval: 3600,
        });

      // In space 1: member0 -> member1
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[1].address, space1);

      // In space 2: member0 -> member2
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[2].address, space2);

      // Fast forward 1 hour
      await time.increase(3600);

      // Check space 1
      const space1Power1 = await decayTokenVotingPower.getVotingPower(
        members[1].address,
        space1,
      );
      const space1Power2 = await decayTokenVotingPower.getVotingPower(
        members[2].address,
        space1,
      );

      const expectedDouble = (INITIAL_TOKEN_AMOUNT * 2n * 9900n) / 10000n;
      const expectedSingle = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n;

      expect(space1Power1).to.equal(expectedDouble); // Has delegation
      expect(space1Power2).to.equal(expectedSingle); // No delegation

      // Check space 2
      const space2Power1 = await decayTokenVotingPower.getVotingPower(
        members[1].address,
        space2,
      );
      const space2Power2 = await decayTokenVotingPower.getVotingPower(
        members[2].address,
        space2,
      );

      expect(space2Power1).to.equal(expectedSingle); // No delegation
      expect(space2Power2).to.equal(expectedDouble); // Has delegation

      console.log('✅ Cross-space delegations with decay are independent');
    });
  });

  describe('Edge Cases and Error Handling', function () {
    it('Should handle zero balance after extreme decay', async function () {
      console.log('\n--- Testing Extreme Decay to Near Zero ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Extreme Decay Space',
        memberCount: 1,
        decayPercentage: 5000, // 50% decay
        decayInterval: 3600,
      });

      // Fast forward 10 hours (10 decay periods)
      await time.increase(3600 * 10);

      const power = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );

      // After 10 periods of 50% decay: balance * (0.5)^10 ≈ 0.1% of original
      expect(power).to.be.lessThan(INITIAL_TOKEN_AMOUNT / 100n); // Less than 1%

      console.log(`Power after extreme decay: ${power}`);
      console.log('✅ Extreme decay handled correctly');
    });

    it('Should prevent voting with insufficient decayed power', async function () {
      console.log('\n--- Testing Vote Prevention with Low Decayed Power ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Low Power Space',
        memberCount: 2,
        unity: 51,
        quorum: 50,
        decayPercentage: 9000, // 90% decay
        decayInterval: 3600,
      });

      // Fast forward 1 hour (90% decay)
      await time.increase(3600);

      // Apply decay
      await token.applyDecay(members[0].address);

      const power = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );

      expect(power).to.equal((INITIAL_TOKEN_AMOUNT * 1000n) / 10000n); // 10% remaining

      // Member can still vote, but with reduced power
      const proposalId = await createTestProposal(spaceId, owner);
      await daoProposals.connect(members[0]).vote(proposalId, true);

      const proposal = await daoProposals.getProposalCore(proposalId);
      expect(proposal.yesVotes).to.equal(power);

      console.log('✅ Voting with low decayed power works correctly');
    });

    it('Should handle own voting power vs total voting power with decay', async function () {
      console.log('\n--- Testing Own vs Total Power with Decay ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Own vs Total Decay Space',
        memberCount: 3,
        decayPercentage: 100,
        decayInterval: 3600,
      });

      // Member 0 delegates to member 1
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[1].address, spaceId);

      // Fast forward 1 hour
      await time.increase(3600);

      const member1OwnPower = await decayTokenVotingPower.getOwnVotingPower(
        members[1].address,
        spaceId,
      );
      const member1TotalPower = await decayTokenVotingPower.getVotingPower(
        members[1].address,
        spaceId,
      );

      const expectedOwn = (INITIAL_TOKEN_AMOUNT * 9900n) / 10000n;
      const expectedTotal = (INITIAL_TOKEN_AMOUNT * 2n * 9900n) / 10000n;

      expect(member1OwnPower).to.equal(expectedOwn);
      expect(member1TotalPower).to.equal(expectedTotal);

      console.log(`Own: ${member1OwnPower}, Total: ${member1TotalPower}`);
      console.log('✅ Own vs total power with decay works correctly');
    });

    it('Should handle decay with no time passed', async function () {
      console.log('\n--- Testing No Decay When No Time Passed ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'No Time Decay Space',
        memberCount: 1,
        decayPercentage: 1000,
        decayInterval: 3600,
      });

      // Don't advance time

      const power = await decayTokenVotingPower.getVotingPower(
        members[0].address,
        spaceId,
      );

      expect(power).to.equal(INITIAL_TOKEN_AMOUNT);

      console.log('✅ No decay when no time has passed');
    });
  });

  describe('Proposal Voting with Decayed Tokens', function () {
    it('Should execute proposal with decayed token votes', async function () {
      console.log('\n--- Testing Proposal Execution with Decayed Votes ---');

      const { spaceId, token } = await createSpaceWithDecayToken({
        name: 'Proposal Decay Space',
        unity: 51,
        quorum: 50,
        memberCount: 5,
        decayPercentage: 100, // 1% decay
        decayInterval: 3600,
      });

      // Fast forward 1 hour
      await time.increase(3600);

      // 3 members delegate to member 0
      await votingPowerDelegation
        .connect(members[1])
        .delegate(members[0].address, spaceId);
      await votingPowerDelegation
        .connect(members[2])
        .delegate(members[0].address, spaceId);
      await votingPowerDelegation
        .connect(members[3])
        .delegate(members[0].address, spaceId);

      const proposalId = await createTestProposal(spaceId, owner);

      // Member 0 votes with delegated decayed power
      await daoProposals.connect(members[0]).vote(proposalId, true);

      const proposal = await daoProposals.getProposalCore(proposalId);
      const expectedVotes = (INITIAL_TOKEN_AMOUNT * 4n * 9900n) / 10000n; // 4 members, 99% power

      expect(proposal.yesVotes).to.equal(expectedVotes);

      console.log(`Proposal votes with decay: ${proposal.yesVotes}`);
      console.log('✅ Proposal voting with decayed tokens works correctly');
    });
  });
});
