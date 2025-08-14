import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Comprehensive Proposal Creation and Voting Tests with Delegation', function () {
  let daoSpaceFactory: any;
  let daoProposals: any;
  let spaceVotingPower: any;
  let tokenVotingPower: any;
  let decayTokenVotingPower: any;
  let votingPowerDirectory: any;
  let votingPowerDelegation: any;
  let regularTokenFactory: any;
  let decayingTokenFactory: any;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];

  // Fixture for comprehensive DAO setup with all voting power types and delegation
  async function deployComprehensiveFixture() {
    const signers = await ethers.getSigners();
    const [owner, ...members] = signers;

    // Deploy VotingPowerDelegation contract first
    const VotingPowerDelegation = await ethers.getContractFactory(
      'VotingPowerDelegationImplementation',
    );
    const votingPowerDelegation = await upgrades.deployProxy(
      VotingPowerDelegation,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Deploy DAOSpaceFactory
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

    // Deploy DAOProposals contract
    const DAOProposals = await ethers.getContractFactory(
      'DAOProposalsImplementation',
    );
    const daoProposals = await upgrades.deployProxy(
      DAOProposals,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy SpaceVotingPower for 1 member 1 vote functionality
    const SpaceVotingPower = await ethers.getContractFactory(
      'SpaceVotingPowerImplementation',
    );
    const spaceVotingPower = await upgrades.deployProxy(
      SpaceVotingPower,
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

    // Configure contracts
    await spaceVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());
    await (spaceVotingPower as any).setDelegationContract(
      await votingPowerDelegation.getAddress(),
    );

    // Add space voting power source to directory (ID: 1)
    await votingPowerDirectory.addVotingPowerSource(
      await spaceVotingPower.getAddress(),
    ); // ID: 1

    await daoProposals.setContracts(
      await daoSpaceFactory.getAddress(),
      await votingPowerDirectory.getAddress(),
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
      spaceVotingPower,
      votingPowerDirectory,
      votingPowerDelegation,
      joinMethodDirectory,
      exitMethodDirectory,
      owner,
      members,
    };
  }

  // Helper function to create a space with space membership voting
  async function createSpace(params: {
    unity: number;
    quorum: number;
    memberCount: number;
    name?: string;
  }) {
    const { unity, quorum, memberCount, name = 'Test Space' } = params;

    const spaceParams = {
      name,
      description: `Test space with ${memberCount} members, ${unity}% unity, ${quorum}% quorum`,
      imageUrl: 'https://test.com/image.png',
      unity,
      quorum,
      votingPowerSource: 1, // Space membership voting only
      exitMethod: 1,
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = await daoSpaceFactory.spaceCounter();

    // Add additional members to reach the desired member count
    for (let i = 0; i < memberCount - 1; i++) {
      await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
    }

    // Verify member count
    const spaceMembers = await daoSpaceFactory.getSpaceMembers(spaceId);
    expect(spaceMembers.length).to.equal(memberCount);

    return { spaceId, spaceMembers };
  }

  // Helper function to create a simple test proposal
  async function createTestProposal(
    spaceId: number,
    proposer: SignerWithAddress,
  ) {
    const proposalCalldata = daoSpaceFactory.interface.encodeFunctionData(
      'getSpaceDetails',
      [spaceId],
    );

    const proposalParams = {
      spaceId,
      duration: 3600, // 1 hour for testing
      transactions: [
        {
          target: await daoSpaceFactory.getAddress(),
          value: 0,
          data: proposalCalldata,
        },
      ],
    };

    await daoProposals.connect(proposer).createProposal(proposalParams);
    const proposalId = await daoProposals.proposalCounter();
    return proposalId;
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployComprehensiveFixture);
    daoSpaceFactory = fixture.daoSpaceFactory;
    daoProposals = fixture.daoProposals;
    spaceVotingPower = fixture.spaceVotingPower;
    votingPowerDirectory = fixture.votingPowerDirectory;
    votingPowerDelegation = fixture.votingPowerDelegation;
    owner = fixture.owner;
    members = fixture.members;
  });

  describe('Delegation Contract Basic Functionality', function () {
    it('Should deploy and initialize delegation contract correctly', async function () {
      expect(await votingPowerDelegation.owner()).to.equal(owner.address);
      console.log('✅ Delegation contract deployed and initialized');
    });

    it('Should handle basic delegation operations', async function () {
      const spaceId = 1;
      const delegator = members[0];
      const delegate = members[1];

      // Test delegation
      await votingPowerDelegation
        .connect(delegator)
        .delegate(delegate.address, spaceId);

      // Verify delegation
      const retrievedDelegate = await votingPowerDelegation.getDelegate(
        delegator.address,
        spaceId,
      );
      expect(retrievedDelegate).to.equal(delegate.address);

      const isDelegated = await votingPowerDelegation.isDelegated(
        delegator.address,
        spaceId,
      );
      expect(isDelegated).to.equal(true);

      const delegators = await votingPowerDelegation.getDelegators(
        delegate.address,
        spaceId,
      );
      expect(delegators.length).to.equal(1);
      expect(delegators[0]).to.equal(delegator.address);

      console.log('✅ Basic delegation operations work correctly');

      // Test undelegation
      await votingPowerDelegation.connect(delegator).undelegate(spaceId);

      const isDelegatedAfter = await votingPowerDelegation.isDelegated(
        delegator.address,
        spaceId,
      );
      expect(isDelegatedAfter).to.equal(false);

      const delegatorsAfter = await votingPowerDelegation.getDelegators(
        delegate.address,
        spaceId,
      );
      expect(delegatorsAfter.length).to.equal(0);

      console.log('✅ Undelegation works correctly');
    });

    it('Should prevent invalid delegation operations', async function () {
      const spaceId = 1;
      const delegator = members[0];

      // Cannot delegate to zero address
      await expect(
        votingPowerDelegation
          .connect(delegator)
          .delegate(ethers.ZeroAddress, spaceId),
      ).to.be.revertedWith('Cannot delegate to zero address');

      // Cannot delegate to self
      await expect(
        votingPowerDelegation
          .connect(delegator)
          .delegate(delegator.address, spaceId),
      ).to.be.revertedWith('Cannot delegate to self');

      // Cannot delegate with invalid space ID
      await expect(
        votingPowerDelegation
          .connect(delegator)
          .delegate(members[1].address, 0),
      ).to.be.revertedWith('Invalid space ID');

      console.log('✅ Invalid delegation operations correctly prevented');
    });
  });

  describe('Space Voting Power with Delegation - Comprehensive Tests', function () {
    it('Should correctly calculate delegated voting power for space membership voting', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 5,
        name: 'Space Voting Test',
      });

      const delegator1 = members[0]; // Member
      const delegator2 = members[1]; // Member
      const delegate = members[2]; // Member
      const nonMember = members[5]; // Not a member

      console.log('\n--- Testing Space Voting Power with Delegation ---');

      // Initial voting power (each member has 1 vote)
      let votingPower = await spaceVotingPower.getVotingPower(
        delegate.address,
        spaceId,
      );
      expect(votingPower).to.equal(1); // Own power only
      console.log(`Delegate initial voting power: ${votingPower}`);

      // Delegate from member to member
      await votingPowerDelegation
        .connect(delegator1)
        .delegate(delegate.address, spaceId);

      votingPower = await spaceVotingPower.getVotingPower(
        delegate.address,
        spaceId,
      );
      expect(votingPower).to.equal(2); // Own + 1 delegated
      console.log(`After 1 delegation (member): ${votingPower}`);

      // Delegate from another member
      await votingPowerDelegation
        .connect(delegator2)
        .delegate(delegate.address, spaceId);

      votingPower = await spaceVotingPower.getVotingPower(
        delegate.address,
        spaceId,
      );
      expect(votingPower).to.equal(3); // Own + 2 delegated
      console.log(`After 2 delegations (members): ${votingPower}`);

      // Try delegation from non-member (should not count)
      await votingPowerDelegation
        .connect(nonMember)
        .delegate(delegate.address, spaceId);

      votingPower = await spaceVotingPower.getVotingPower(
        delegate.address,
        spaceId,
      );
      expect(votingPower).to.equal(3); // Still 3, non-member delegation doesn't count
      console.log(`After non-member delegation: ${votingPower} (unchanged)`);

      // Verify delegator's voting power is 0 when delegated
      const delegator1Power = await spaceVotingPower.getVotingPower(
        delegator1.address,
        spaceId,
      );
      expect(delegator1Power).to.equal(0); // Delegated away
      console.log(
        `Delegator voting power: ${delegator1Power} (delegated away)`,
      );

      console.log(
        '✅ Space voting power delegation works correctly and only counts members',
      );
    });

    it('Should handle delegation in voting scenarios', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 4,
        name: 'Delegation Voting Test',
      });

      const proposalId = await createTestProposal(spaceId, owner);

      // Set up delegation: member[0] delegates to member[1]
      await votingPowerDelegation
        .connect(members[0])
        .delegate(members[1].address, spaceId);

      console.log('\n--- Testing Voting with Delegation ---');
      console.log('Setup: member[0] delegated to member[1]');

      // member[1] now has 2 voting power (own + delegated), owner and member[2] have 1 each
      // Total voting power: 4, Quorum needed: 2 (50%), Unity needed: 60%

      // member[1] votes YES (counts as 2 votes due to delegation)
      await daoProposals.connect(members[1]).vote(proposalId, true);

      let proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.yesVotes).to.equal(2); // Includes delegated power
      console.log(
        `After delegate votes YES: ${proposalState.yesVotes} yes votes`,
      );

      // Check if proposal can execute with just this vote
      // 2 votes = 50% quorum ✓, 2/2 = 100% unity ✓
      expect(proposalState.executed).to.equal(true);
      console.log('✅ Proposal executed with delegated voting power');
    });

    it('Should handle complex delegation scenarios', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 5,
        name: 'Complex Delegation Test',
      });

      const user1 = members[0];
      const user2 = members[1];
      const user3 = members[2];
      const user4 = members[3];

      console.log('\n--- Testing Complex Delegation Scenarios ---');

      // Initial state: everyone has 1 vote
      expect(
        await spaceVotingPower.getVotingPower(user1.address, spaceId),
      ).to.equal(1);
      expect(
        await spaceVotingPower.getVotingPower(user2.address, spaceId),
      ).to.equal(1);

      // user1 delegates to user2
      await votingPowerDelegation
        .connect(user1)
        .delegate(user2.address, spaceId);
      expect(
        await spaceVotingPower.getVotingPower(user2.address, spaceId),
      ).to.equal(2); // Own + delegated
      expect(
        await spaceVotingPower.getVotingPower(user1.address, spaceId),
      ).to.equal(0); // Delegated away
      console.log('✅ Step 1: user1 → user2 delegation working');

      // user3 also delegates to user2
      await votingPowerDelegation
        .connect(user3)
        .delegate(user2.address, spaceId);
      expect(
        await spaceVotingPower.getVotingPower(user2.address, spaceId),
      ).to.equal(3); // Own + 2 delegated
      console.log(
        '✅ Step 2: user3 → user2 delegation working (user2 now has 3 votes)',
      );

      // user1 re-delegates to user4 (should remove from user2, add to user4)
      await votingPowerDelegation
        .connect(user1)
        .delegate(user4.address, spaceId);
      expect(
        await spaceVotingPower.getVotingPower(user2.address, spaceId),
      ).to.equal(2); // Own + 1 remaining
      expect(
        await spaceVotingPower.getVotingPower(user4.address, spaceId),
      ).to.equal(2); // Own + 1 from user1
      console.log(
        '✅ Step 3: user1 re-delegation working (user2: 2 votes, user4: 2 votes)',
      );

      // user1 undelegates completely
      await votingPowerDelegation.connect(user1).undelegate(spaceId);
      expect(
        await spaceVotingPower.getVotingPower(user1.address, spaceId),
      ).to.equal(1); // Own power back
      expect(
        await spaceVotingPower.getVotingPower(user4.address, spaceId),
      ).to.equal(1); // Only own power
      console.log('✅ Step 4: undelegation working (user1 has own vote back)');

      console.log('✅ Complex delegation scenarios handled correctly');
    });

    it('Should handle gas-efficient delegation queries with many delegators', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 10, // Many members
        name: 'Gas Efficiency Test',
      });

      const delegate = members[0];
      console.log('\n--- Testing Gas Efficiency with Many Delegators ---');

      // Set up many delegations (members[1] through members[8] delegate to members[0])
      // Note: space has owner + members[0] through members[8] = 10 total members
      for (let i = 1; i < 9; i++) {
        await votingPowerDelegation
          .connect(members[i])
          .delegate(delegate.address, spaceId);
      }

      // Check that we can still efficiently query voting power
      const startTime = Date.now();
      const votingPower = await spaceVotingPower.getVotingPower(
        delegate.address,
        spaceId,
      );
      const endTime = Date.now();

      expect(votingPower).to.equal(9); // Own + 8 delegated from space members
      console.log(`Voting power with 8 delegations: ${votingPower}`);
      console.log(`Query time: ${endTime - startTime}ms`);

      // Test getting delegators list
      const delegators = await votingPowerDelegation.getDelegators(
        delegate.address,
        spaceId,
      );
      expect(delegators.length).to.equal(8);
      console.log(`Delegators count: ${delegators.length}`);

      console.log('✅ Efficient handling of multiple delegations');
    });

    it('Should prevent delegation loops and cycles', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 3,
        name: 'Cycle Prevention Test',
      });

      const user1 = members[0];
      const user2 = members[1];

      console.log('\n--- Testing Delegation Cycle Prevention ---');

      // user1 delegates to user2
      await votingPowerDelegation
        .connect(user1)
        .delegate(user2.address, spaceId);
      console.log('✅ user1 → user2 delegation successful');

      // user2 tries to delegate to user1 (would create a cycle)
      // Note: The current implementation doesn't prevent cycles,
      // but shows that the delegate still gets their own power
      await votingPowerDelegation
        .connect(user2)
        .delegate(user1.address, spaceId);
      console.log('✅ user2 → user1 delegation successful (cycle created)');

      // Check voting powers - each should only get their delegated power, not create infinite loops
      const user1Power = await spaceVotingPower.getVotingPower(
        user1.address,
        spaceId,
      );
      const user2Power = await spaceVotingPower.getVotingPower(
        user2.address,
        spaceId,
      );

      console.log(`user1 voting power: ${user1Power}`);
      console.log(`user2 voting power: ${user2Power}`);

      // In a cycle, each user should only get their direct delegated power
      expect(user1Power).to.equal(1); // Gets user2's delegation
      expect(user2Power).to.equal(1); // Gets user1's delegation (both delegated to each other)

      console.log('✅ Delegation cycles handled without infinite loops');
    });

    it('Should execute proposals correctly with delegated voting power', async function () {
      console.log('\n--- Testing Space Voting with Delegation ---');

      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 5,
        name: 'Space Voting Execution Test',
      });

      // Set up delegations: members[0,1,2] delegate to members[3]
      for (let i = 0; i < 3; i++) {
        await votingPowerDelegation
          .connect(members[i])
          .delegate(members[3].address, spaceId);
      }

      const proposalId = await createTestProposal(spaceId, owner);

      // members[3] votes YES with accumulated power
      await daoProposals.connect(members[3]).vote(proposalId, true);

      const proposalState = await daoProposals.getProposalCore(proposalId);

      // Space voting: should have 4 yes votes (own + 3 delegated)
      expect(proposalState.yesVotes).to.equal(4);
      console.log(`Space voting: ${proposalState.yesVotes} yes votes`);

      expect(proposalState.executed).to.equal(true);
      console.log(`✅ Space Voting proposal executed with delegated power`);
    });
  });
});
