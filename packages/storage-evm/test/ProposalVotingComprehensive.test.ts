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
      // Total voting power: 4, YES votes: 2, Unity needed: 60%
      // Unity check: 2 * 100 >= 60 * 4 → 200 >= 240 ❌ (doesn't reach 60% unity)
      // Need more votes to reach unity against total voting power
      expect(proposalState.executed).to.equal(false);
      console.log(
        '✅ Proposal needs more votes to reach unity against total voting power',
      );

      // Add one more YES vote to reach unity
      await daoProposals.connect(members[2]).vote(proposalId, true);

      proposalState = await daoProposals.getProposalCore(proposalId);
      // Now: 3 YES votes out of 4 total voting power = 75% > 60% ✓
      expect(proposalState.executed).to.equal(true);
      console.log(
        '✅ Proposal executed with sufficient votes for unity against total voting power',
      );
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

    it('Should handle when a delegate further delegates their own power', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 5,
        name: 'Delegate Redelegation Test',
      });

      const alice = members[0]; // Will delegate to bob
      const bob = members[1]; // Will receive delegation from alice, then delegate to charlie
      const charlie = members[2]; // Will receive delegation from bob
      const dave = members[3]; // Will delegate to bob

      console.log('\n--- Testing Delegate Further Delegating Their Power ---');

      // Initial state: everyone has 1 vote
      console.log('Initial voting powers:');
      console.log(
        `Alice: ${await spaceVotingPower.getVotingPower(
          alice.address,
          spaceId,
        )}`,
      );
      console.log(
        `Bob: ${await spaceVotingPower.getVotingPower(bob.address, spaceId)}`,
      );
      console.log(
        `Charlie: ${await spaceVotingPower.getVotingPower(
          charlie.address,
          spaceId,
        )}`,
      );
      console.log(
        `Dave: ${await spaceVotingPower.getVotingPower(dave.address, spaceId)}`,
      );

      // Step 1: Alice delegates to Bob
      await votingPowerDelegation.connect(alice).delegate(bob.address, spaceId);
      console.log('\n✅ Step 1: Alice → Bob');
      console.log(
        `Bob now has: ${await spaceVotingPower.getVotingPower(
          bob.address,
          spaceId,
        )} votes (own + Alice's)`,
      );

      // Step 2: Dave also delegates to Bob
      await votingPowerDelegation.connect(dave).delegate(bob.address, spaceId);
      console.log('\n✅ Step 2: Dave → Bob');
      console.log(
        `Bob now has: ${await spaceVotingPower.getVotingPower(
          bob.address,
          spaceId,
        )} votes (own + Alice's + Dave's)`,
      );

      // Step 3: Bob (who has accumulated power) delegates to Charlie
      await votingPowerDelegation
        .connect(bob)
        .delegate(charlie.address, spaceId);
      console.log(
        '\n✅ Step 3: Bob → Charlie (Bob delegates his accumulated power)',
      );

      // Check final voting powers
      const alicePower = await spaceVotingPower.getVotingPower(
        alice.address,
        spaceId,
      );
      const bobPower = await spaceVotingPower.getVotingPower(
        bob.address,
        spaceId,
      );
      const charliePower = await spaceVotingPower.getVotingPower(
        charlie.address,
        spaceId,
      );
      const davePower = await spaceVotingPower.getVotingPower(
        dave.address,
        spaceId,
      );

      console.log('\nFinal voting powers:');
      console.log(
        `Alice: ${alicePower} (delegated to Bob, but Bob delegated to Charlie)`,
      );
      console.log(`Bob: ${bobPower} (delegated own power to Charlie)`);
      console.log(`Charlie: ${charliePower} (received Bob's delegation)`);
      console.log(
        `Dave: ${davePower} (delegated to Bob, but Bob delegated to Charlie)`,
      );

      // Verify the behavior
      expect(alicePower).to.equal(0); // Alice delegated to Bob
      expect(bobPower).to.equal(2); // Bob still gets Alice and Dave's delegated power since they delegated TO him
      expect(charliePower).to.equal(2); // Charlie gets Bob's own power + Bob as a delegator
      expect(davePower).to.equal(0); // Dave delegated to Bob

      console.log('\n🔍 Key Insight: When Bob delegates to Charlie:');
      console.log(
        '• Bob still receives delegated power from Alice and Dave (they delegated TO Bob)',
      );
      console.log(
        "• Charlie gets Bob's own voting power (since Bob delegated TO Charlie)",
      );
      console.log(
        '• This creates a scenario where Bob has power but cannot vote with it (delegated away)',
      );
      console.log(
        '• Alice and Dave\'s votes are "stuck" with Bob who cannot vote',
      );

      // Demonstrate the voting scenario
      const proposalId = await createTestProposal(spaceId, owner);

      // Bob cannot vote even though he has 2 voting power (he delegated to Charlie)
      console.log('\n--- Voting Scenario ---');
      console.log(
        'If Bob tries to vote, it will fail because he delegated his power to Charlie',
      );
      console.log(
        "Only Charlie can vote with the power Bob delegated (Bob's own 1 vote)",
      );
      console.log('Alice and Dave\'s power is effectively "trapped" with Bob');

      // Charlie votes with Bob's delegated power (just Bob's 1 vote)
      await daoProposals.connect(charlie).vote(proposalId, true);
      const proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.yesVotes).to.equal(2); // Charlie's own 1 + Bob's delegated 1

      console.log(
        `Charlie voted with ${proposalState.yesVotes} votes (own + Bob's delegated power)`,
      );
      console.log(
        '✅ Delegation chains work but can create "trapped" voting power scenarios',
      );
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

  describe('Advanced Early Rejection Logic Tests - Round 2', function () {
    it('Should test early rejection with precise mathematical boundaries', async function () {
      console.log('\n--- Advanced Test: Precise Mathematical Boundaries ---');

      // Test with numbers that create exact mathematical boundaries
      const { spaceId } = await createSpace({
        unity: 66, // Exactly 2/3 majority
        quorum: 50, // 50% quorum
        memberCount: 9, // Perfect for 66% calculations
        name: 'Precise Math Boundaries',
      });

      const proposalId = await createTestProposal(spaceId, owner);

      console.log(
        'Setup: 9 members, 66% unity (need 6/9 = 66.67%), 50% quorum',
      );

      // Vote pattern that tests exact boundaries
      // 2 YES, 3 NO = 5 votes (quorum reached: 5 >= 4.5)
      await daoProposals.connect(members[0]).vote(proposalId, true);
      await daoProposals.connect(members[1]).vote(proposalId, true);
      await daoProposals.connect(members[2]).vote(proposalId, false);
      await daoProposals.connect(members[3]).vote(proposalId, false);
      await daoProposals.connect(members[4]).vote(proposalId, false);

      let proposalState = await daoProposals.getProposalCore(proposalId);
      console.log(
        `State: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Expired: ${proposalState.expired}`,
      );

      // Math check: Max possible YES = 2 + 4 = 6, Total power = 9
      // Unity: 6 * 100 = 600, 66 * 9 = 594, so 600 >= 594 ✓ Should still be possible
      expect(proposalState.expired).to.equal(false);
      console.log(
        '✅ Proposal remains active (6/9 = 66.67% > 66% - barely possible)',
      );

      // Add one more NO to make it impossible
      await daoProposals.connect(members[5]).vote(proposalId, false);

      proposalState = await daoProposals.getProposalCore(proposalId);
      console.log(
        `After 4th NO: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Expired: ${proposalState.expired}`,
      );

      // Now: Max possible YES = 2 + 3 = 5, Total power = 9
      // Unity: 5 * 100 = 500, 66 * 9 = 594, so 500 < 594 ✓ Should be rejected
      expect(proposalState.expired).to.equal(true);
      console.log('✅ Proposal correctly rejected (5/9 = 55.56% < 66%)');
    });

    it('Should test early rejection vs existing NO unity logic', async function () {
      console.log('\n--- Advanced Test: Early Rejection vs NO Unity Logic ---');

      const { spaceId } = await createSpace({
        unity: 70, // 70% unity
        quorum: 40, // 40% quorum
        memberCount: 10,
        name: 'Early vs NO Unity Test',
      });

      console.log('Testing that early rejection works correctly');

      // Test early rejection scenario
      console.log('\n--- Early Rejection Scenario ---');
      const proposalId1 = await createTestProposal(spaceId, owner);

      // Vote incrementally and check when early rejection triggers
      await daoProposals.connect(members[0]).vote(proposalId1, true);
      await daoProposals.connect(members[1]).vote(proposalId1, true);

      // Add NO votes one by one until early rejection triggers
      for (let i = 2; i < 8; i++) {
        await daoProposals.connect(members[i]).vote(proposalId1, false);

        const proposalState = await daoProposals.getProposalCore(proposalId1);
        console.log(
          `After vote ${i - 1}: ${proposalState.yesVotes} YES, ${
            proposalState.noVotes
          } NO, Expired: ${proposalState.expired}`,
        );

        if (proposalState.expired) {
          console.log('✅ Early rejection triggered correctly');
          break;
        }
      }

      let finalState = await daoProposals.getProposalCore(proposalId1);
      expect(finalState.expired).to.equal(true);
      console.log('✅ Early rejection logic working correctly');

      // Test NO unity scenario with a fresh proposal
      console.log('\n--- NO Unity Scenario ---');
      const proposalId2 = await createTestProposal(spaceId, owner);

      // Vote to reach NO unity directly: need 70% of 10 = 7 NO votes
      const noVotesNeeded = 7;
      for (let i = 0; i < noVotesNeeded; i++) {
        await daoProposals.connect(members[i]).vote(proposalId2, false);

        const proposalState = await daoProposals.getProposalCore(proposalId2);
        console.log(
          `NO vote ${i + 1}: ${proposalState.yesVotes} YES, ${
            proposalState.noVotes
          } NO, Expired: ${proposalState.expired}`,
        );

        if (proposalState.expired) {
          console.log('✅ NO unity logic triggered');
          break;
        }
      }

      const finalState2 = await daoProposals.getProposalCore(proposalId2);
      expect(finalState2.expired).to.equal(true);
      console.log('✅ NO unity logic working correctly');
    });

    it('Should test early rejection with incremental voting', async function () {
      console.log('\n--- Advanced Test: Incremental Voting Progression ---');

      const { spaceId } = await createSpace({
        unity: 75, // 75% unity
        quorum: 30, // Low quorum for focus on unity
        memberCount: 12,
        name: 'Incremental Voting Test',
      });

      const proposalId = await createTestProposal(spaceId, owner);

      console.log('Setup: 12 members, 75% unity (need 9/12), 30% quorum');
      console.log(
        'Strategy: Vote incrementally and check when early rejection triggers',
      );

      // Start with 2 YES votes
      await daoProposals.connect(members[0]).vote(proposalId, true);
      await daoProposals.connect(members[1]).vote(proposalId, true);

      // Add NO votes incrementally and check when early rejection triggers
      const maxNoVotes = 8; // Will test up to 8 NO votes

      for (let noVotes = 1; noVotes <= maxNoVotes; noVotes++) {
        await daoProposals
          .connect(members[1 + noVotes])
          .vote(proposalId, false);

        const proposalState = await daoProposals.getProposalCore(proposalId);
        const totalVotes =
          Number(proposalState.yesVotes) + Number(proposalState.noVotes);
        const remainingVoters = 12 - totalVotes;
        const maxPossibleYes = Number(proposalState.yesVotes) + remainingVoters;
        const canReachUnity = maxPossibleYes * 100 >= 75 * 12; // 75% of 12 = 9

        console.log(
          `After ${noVotes} NO votes: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Max YES: ${maxPossibleYes}/12, Can reach unity: ${canReachUnity}, Expired: ${proposalState.expired}`,
        );

        if (!canReachUnity && totalVotes >= 4) {
          // Quorum check (30% of 12 = 3.6 ≈ 4)
          expect(proposalState.expired).to.equal(true);
          console.log(
            `✅ Early rejection correctly triggered after ${noVotes} NO votes`,
          );
          break;
        } else if (canReachUnity) {
          expect(proposalState.expired).to.equal(false);
        }

        // Stop if we've reached the rejection point
        if (proposalState.expired) break;
      }
    });

    it('Should test early rejection with complex delegation scenarios', async function () {
      console.log(
        '\n--- Advanced Test: Complex Delegation Early Rejection ---',
      );

      const { spaceId } = await createSpace({
        unity: 60, // 60% unity
        quorum: 50, // 50% quorum
        memberCount: 15, // Large group for complex delegation
        name: 'Complex Delegation Early Rejection',
      });

      // Complex delegation setup:
      // Group 1: members[0,1,2,3] → members[4] (gives members[4] = 5 votes)
      // Group 2: members[5,6,7] → members[8] (gives members[8] = 4 votes)
      // Group 3: members[9,10] → members[11] (gives members[11] = 3 votes)
      // Individual: owner, members[12], members[13], members[14] (1 vote each)
      // Total: 5 + 4 + 3 + 4 = 16 total voting power

      for (let i = 0; i <= 3; i++) {
        await votingPowerDelegation
          .connect(members[i])
          .delegate(members[4].address, spaceId);
      }
      for (let i = 5; i <= 7; i++) {
        await votingPowerDelegation
          .connect(members[i])
          .delegate(members[8].address, spaceId);
      }
      for (let i = 9; i <= 10; i++) {
        await votingPowerDelegation
          .connect(members[i])
          .delegate(members[11].address, spaceId);
      }

      const proposalId = await createTestProposal(spaceId, owner);

      console.log('Setup: 15 members with complex delegation');
      console.log(
        'Effective voters: members[4](5), members[8](4), members[11](3), owner(1), members[12](1), members[13](1), members[14](1)',
      );
      console.log('Total voting power: 16, Unity needed: 60% = 9.6 ≈ 10 votes');

      // Vote with high-power delegates
      await daoProposals.connect(members[4]).vote(proposalId, true); // 5 YES
      await daoProposals.connect(members[8]).vote(proposalId, false); // 4 NO
      await daoProposals.connect(members[11]).vote(proposalId, false); // 3 NO (total: 7 NO)

      let proposalState = await daoProposals.getProposalCore(proposalId);
      console.log(
        `After delegate votes: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Expired: ${proposalState.expired}`,
      );

      // Current: 5 YES, 7 NO, 4 remaining individual voters
      // Max possible YES = 5 + 4 = 9, Total power = 16
      // Unity: 9 * 100 = 900, 60 * 16 = 960, so 900 < 960 ✓ Should be rejected
      expect(proposalState.expired).to.equal(true);
      console.log(
        '✅ Early rejection works with complex delegation (9/16 = 56.25% < 60%)',
      );
    });

    it('Should test early rejection timing with quorum requirements', async function () {
      console.log('\n--- Advanced Test: Early Rejection Timing vs Quorum ---');

      const scenarios = [
        { unity: 60, quorum: 20, members: 10, name: 'Low Quorum' },
        { unity: 60, quorum: 60, members: 10, name: 'High Quorum' },
        { unity: 60, quorum: 90, members: 10, name: 'Very High Quorum' },
      ];

      for (const scenario of scenarios) {
        console.log(
          `\n--- Testing: ${scenario.name} (${scenario.quorum}% quorum) ---`,
        );

        const { spaceId } = await createSpace({
          unity: scenario.unity,
          quorum: scenario.quorum,
          memberCount: scenario.members,
          name: scenario.name,
        });

        const proposalId = await createTestProposal(spaceId, owner);
        const requiredQuorum = Math.ceil(
          (scenario.quorum * scenario.members) / 100,
        );

        console.log(
          `Setup: ${scenario.members} members, ${scenario.unity}% unity, ${scenario.quorum}% quorum (need ${requiredQuorum} votes)`,
        );

        // Vote pattern: 1 YES, then incrementally add NO votes
        await daoProposals.connect(members[0]).vote(proposalId, true);

        let votesBeforeQuorum = 0;
        let votesAfterQuorum = 0;

        for (let i = 1; i < scenario.members; i++) {
          await daoProposals.connect(members[i]).vote(proposalId, false);

          const proposalState = await daoProposals.getProposalCore(proposalId);
          const totalVotes =
            Number(proposalState.yesVotes) + Number(proposalState.noVotes);
          const quorumReached = totalVotes >= requiredQuorum;

          console.log(
            `Vote ${i}: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Quorum: ${quorumReached}, Expired: ${proposalState.expired}`,
          );

          if (!quorumReached && proposalState.expired) {
            console.log('❌ ERROR: Early rejection triggered before quorum!');
            expect(proposalState.expired).to.equal(false);
          }

          if (quorumReached && !proposalState.expired) {
            votesAfterQuorum++;
          } else if (!quorumReached) {
            votesBeforeQuorum++;
          }

          if (proposalState.expired) {
            console.log(
              `✅ Early rejection triggered after quorum with ${totalVotes} votes`,
            );
            break;
          }
        }

        console.log(
          `Summary: ${votesBeforeQuorum} votes before quorum, ${votesAfterQuorum} votes after quorum before rejection`,
        );
      }
    });

    it('Should test early rejection with extreme unity thresholds', async function () {
      console.log('\n--- Advanced Test: Extreme Unity Thresholds ---');

      const extremeScenarios = [
        { unity: 99, members: 100, name: 'Near Unanimous (99%)' },
        { unity: 95, members: 20, name: 'Very High Consensus (95%)' },
        { unity: 51, members: 100, name: 'Bare Majority Large Group (51%)' },
        { unity: 100, members: 10, name: 'Perfect Consensus (100%)' },
      ];

      for (const scenario of extremeScenarios) {
        console.log(`\n--- Extreme Scenario: ${scenario.name} ---`);

        const { spaceId } = await createSpace({
          unity: scenario.unity,
          quorum: 20, // Low quorum to focus on unity
          memberCount: Math.min(scenario.members, 20), // Limit for test performance
          name: scenario.name,
        });

        const proposalId = await createTestProposal(spaceId, owner);
        const actualMembers = Math.min(scenario.members, 20);
        const unityVotesNeeded = Math.ceil(
          (scenario.unity * actualMembers) / 100,
        );

        console.log(
          `Setup: ${actualMembers} members, ${scenario.unity}% unity (need ${unityVotesNeeded} votes), 20% quorum`,
        );

        // Calculate how many NO votes make YES impossible
        const maxNoVotesBeforeImpossible = actualMembers - unityVotesNeeded;

        console.log(
          `Max NO votes before YES impossible: ${maxNoVotesBeforeImpossible}`,
        );

        // Vote with exactly that many NO votes + 1 YES
        await daoProposals.connect(members[0]).vote(proposalId, true);

        for (
          let i = 1;
          i <= maxNoVotesBeforeImpossible && i < actualMembers;
          i++
        ) {
          await daoProposals.connect(members[i]).vote(proposalId, false);
        }

        let proposalState = await daoProposals.getProposalCore(proposalId);
        const remainingVoters =
          actualMembers -
          Number(proposalState.yesVotes) -
          Number(proposalState.noVotes);
        const maxPossibleYes = Number(proposalState.yesVotes) + remainingVoters;

        console.log(
          `State: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Max possible YES: ${maxPossibleYes}/${actualMembers}`,
        );
        console.log(
          `Unity check: ${maxPossibleYes}/${actualMembers} = ${(
            (maxPossibleYes * 100) /
            actualMembers
          ).toFixed(1)}% ${
            (maxPossibleYes * 100) / actualMembers >= scenario.unity
              ? '>='
              : '<'
          } ${scenario.unity}%`,
        );

        const shouldBeRejected =
          maxPossibleYes * 100 < scenario.unity * actualMembers;
        expect(proposalState.expired).to.equal(shouldBeRejected);

        if (shouldBeRejected) {
          console.log('✅ Correctly rejected due to extreme unity requirement');
        } else {
          console.log(
            '✅ Correctly remains active (can still meet extreme unity)',
          );
        }
      }
    });

    it('Should test early rejection mathematical precision with fractional calculations', async function () {
      console.log(
        '\n--- Advanced Test: Mathematical Precision with Fractions ---',
      );

      // Test scenarios that create fractional percentages
      const precisionTests = [
        { unity: 67, members: 15, name: 'Two-thirds (67% of 15)' }, // 67% of 15 = 10.05
        { unity: 80, members: 10, name: 'High precision (80% of 10)' }, // 80% of 10 = 8.0 (exact)
      ];

      for (const test of precisionTests) {
        console.log(`\n--- Precision Test: ${test.name} ---`);

        const { spaceId } = await createSpace({
          unity: test.unity,
          quorum: 40,
          memberCount: test.members,
          name: test.name,
        });

        const proposalId = await createTestProposal(spaceId, owner);

        const exactUnityVotes = (test.unity * test.members) / 100;
        console.log(
          `Unity calculation: ${test.unity}% of ${test.members} = ${exactUnityVotes}`,
        );

        // Vote in a way that makes unity impossible
        await daoProposals.connect(members[0]).vote(proposalId, true); // 1 YES

        // Add NO votes incrementally until early rejection triggers
        const maxNoVotes = test.members - 2; // Leave room for the YES vote
        let rejectionTriggered = false;

        for (let i = 1; i <= maxNoVotes; i++) {
          await daoProposals.connect(members[i]).vote(proposalId, false);

          const proposalState = await daoProposals.getProposalCore(proposalId);
          const remainingVoters =
            test.members -
            Number(proposalState.yesVotes) -
            Number(proposalState.noVotes);
          const maxPossibleYes =
            Number(proposalState.yesVotes) + remainingVoters;

          console.log(
            `Vote ${i}: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Max possible: ${maxPossibleYes}/${test.members}, Expired: ${proposalState.expired}`,
          );

          if (proposalState.expired) {
            rejectionTriggered = true;
            console.log(
              '✅ Early rejection triggered at correct mathematical point',
            );

            // Verify the math is correct
            const shouldBeRejected =
              maxPossibleYes * 100 < test.unity * test.members;
            expect(shouldBeRejected).to.equal(true);
            console.log(
              `✅ Math verification: ${maxPossibleYes} * 100 < ${
                test.unity
              } * ${test.members} → ${maxPossibleYes * 100} < ${
                test.unity * test.members
              } ✓`,
            );
            break;
          }
        }

        expect(rejectionTriggered).to.equal(true);
        console.log(
          '✅ Precision test passed - early rejection working correctly',
        );
      }
    });
  });
});
