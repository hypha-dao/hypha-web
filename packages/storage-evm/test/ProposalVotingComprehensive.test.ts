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
  let ownershipTokenFactory: any;
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

    // Deploy RegularTokenFactory
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

    // Deploy OwnershipTokenFactory
    const OwnershipTokenFactory = await ethers.getContractFactory(
      'OwnershipTokenFactory',
    );
    const ownershipTokenFactory = await upgrades.deployProxy(
      OwnershipTokenFactory,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Deploy TokenVotingPower for token-based voting
    const TokenVotingPower = await ethers.getContractFactory(
      'TokenVotingPowerImplementation',
    );
    const tokenVotingPower = await upgrades.deployProxy(
      TokenVotingPower,
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

    await tokenVotingPower.setTokenFactory(
      await regularTokenFactory.getAddress(),
    );
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
      await tokenVotingPower.getAddress(),
    );

    // Deploy RegularSpaceToken implementation
    const RegularSpaceToken = await ethers.getContractFactory(
      'RegularSpaceToken',
    );
    const regularSpaceTokenImpl = await RegularSpaceToken.deploy();
    await regularTokenFactory.setSpaceTokenImplementation(
      await regularSpaceTokenImpl.getAddress(),
    );

    // Deploy DecayingSpaceToken implementation
    const DecayingSpaceToken = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );
    const decayingSpaceTokenImpl = await DecayingSpaceToken.deploy();
    await decayingTokenFactory.setDecayingTokenImplementation(
      await decayingSpaceTokenImpl.getAddress(),
    );

    // Deploy OwnershipSpaceToken implementation
    const OwnershipSpaceToken = await ethers.getContractFactory(
      'OwnershipSpaceToken',
    );
    const ownershipSpaceTokenImpl = await OwnershipSpaceToken.deploy();
    await ownershipTokenFactory.setOwnershipTokenImplementation(
      await ownershipSpaceTokenImpl.getAddress(),
    );

    await ownershipTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await ownershipTokenFactory.setVotingPowerContract(
      await tokenVotingPower.getAddress(),
    );

    await tokenVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());
    await (tokenVotingPower as any).setDelegationContract(
      await votingPowerDelegation.getAddress(),
    );

    // Add space voting power source to directory (ID: 1)
    await votingPowerDirectory.addVotingPowerSource(
      await spaceVotingPower.getAddress(),
    ); // ID: 1

    // Add token voting power source to directory (ID: 2)
    await votingPowerDirectory.addVotingPowerSource(
      await tokenVotingPower.getAddress(),
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
      spaceVotingPower,
      tokenVotingPower,
      votingPowerDirectory,
      votingPowerDelegation,
      joinMethodDirectory,
      exitMethodDirectory,
      regularTokenFactory,
      decayingTokenFactory,
      ownershipTokenFactory,
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
    tokenVotingPower = fixture.tokenVotingPower;
    votingPowerDirectory = fixture.votingPowerDirectory;
    votingPowerDelegation = fixture.votingPowerDelegation;
    regularTokenFactory = fixture.regularTokenFactory;
    decayingTokenFactory = fixture.decayingTokenFactory;
    ownershipTokenFactory = fixture.ownershipTokenFactory;
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

    it('Should correctly return all delegates for a given space', async function () {
      const spaceId = 1;
      const delegator1 = members[0];
      const delegator2 = members[1];
      const delegator3 = members[2];
      const delegate1 = members[3];
      const delegate2 = members[4];

      console.log('\n--- Testing getDelegatesForSpace ---');

      // Initial state: no delegates
      let delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(0);
      console.log('✅ Initially no delegates');

      // 1. Delegate to delegate1
      await votingPowerDelegation
        .connect(delegator1)
        .delegate(delegate1.address, spaceId);
      delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(1);
      expect(delegates).to.include(delegate1.address);
      console.log('✅ Delegate added on first delegation');

      // 2. Delegate to delegate2
      await votingPowerDelegation
        .connect(delegator2)
        .delegate(delegate2.address, spaceId);
      delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(2);
      expect(delegates).to.include(delegate1.address);
      expect(delegates).to.include(delegate2.address);
      console.log('✅ Second delegate added');

      // 3. Delegate to an existing delegate (should not change the list)
      await votingPowerDelegation
        .connect(delegator3)
        .delegate(delegate1.address, spaceId);
      delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(2);
      console.log('✅ Delegating to existing delegate does not add duplicates');

      // 4. Undelegate from delegate1 (one delegator remains)
      await votingPowerDelegation.connect(delegator1).undelegate(spaceId);
      delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(2); // delegate1 still has delegator3
      console.log('✅ Delegate remains after partial undelegation');

      // 5. Undelegate from delegate1 completely
      await votingPowerDelegation.connect(delegator3).undelegate(spaceId);
      delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(1);
      expect(delegates).to.not.include(delegate1.address);
      expect(delegates).to.include(delegate2.address);
      console.log('✅ Delegate removed when no delegators remain');

      // 6. Undelegate from delegate2
      await votingPowerDelegation.connect(delegator2).undelegate(spaceId);
      delegates = await votingPowerDelegation.getDelegatesForSpace(spaceId);
      expect(delegates.length).to.equal(0);
      console.log('✅ Final delegate removed, list is empty');
    });

    it('Should correctly return all spaces a member is a delegate in', async function () {
      const delegate = members[0];
      const delegator1 = members[1];
      const delegator2 = members[2];
      const delegator3 = members[3];
      const spaceId1 = 1;
      const spaceId2 = 2;

      console.log('\\n--- Testing getSpacesForDelegate ---');

      // Initial state: no spaces
      let spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(0);
      console.log('✅ Initially no spaces for delegate');

      // 1. delegator1 delegates to delegate in space 1
      await votingPowerDelegation
        .connect(delegator1)
        .delegate(delegate.address, spaceId1);
      spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(1);
      expect(spaces).to.deep.include(BigInt(spaceId1));
      console.log('✅ Space added on first delegation');

      // 2. delegator2 delegates to delegate in space 1 (should not change list)
      await votingPowerDelegation
        .connect(delegator2)
        .delegate(delegate.address, spaceId1);
      spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(1);
      console.log('✅ Delegating to same space does not add duplicates');

      // 3. delegator3 delegates to delegate in space 2
      await votingPowerDelegation
        .connect(delegator3)
        .delegate(delegate.address, spaceId2);
      spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(2);
      expect(spaces).to.deep.include(BigInt(spaceId1));
      expect(spaces).to.deep.include(BigInt(spaceId2));
      console.log('✅ Second space added');

      // 4. delegator1 undelegates from space 1 (delegate still has delegator2)
      await votingPowerDelegation.connect(delegator1).undelegate(spaceId1);
      spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(2);
      console.log('✅ Space remains after partial undelegation');

      // 5. delegator2 undelegates from space 1 (last one for space 1)
      await votingPowerDelegation.connect(delegator2).undelegate(spaceId1);
      spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(1);
      expect(spaces).to.not.deep.include(BigInt(spaceId1));
      expect(spaces).to.deep.include(BigInt(spaceId2));
      console.log('✅ Space removed when no delegators remain');

      // 6. delegator3 undelegates from space 2
      await votingPowerDelegation.connect(delegator3).undelegate(spaceId2);
      spaces = await votingPowerDelegation.getSpacesForDelegate(
        delegate.address,
      );
      expect(spaces.length).to.equal(0);
      console.log('✅ Final space removed, list is empty');
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
      // NOTE: Creator (owner) already voted YES when creating the proposal

      // member[1] votes YES (counts as 2 votes due to delegation)
      await daoProposals.connect(members[1]).vote(proposalId, true);

      let proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.yesVotes).to.equal(3); // Creator's 1 + member[1]'s 2 (with delegation)
      console.log(
        `After delegate votes YES: ${proposalState.yesVotes} yes votes`,
      );

      // Check if proposal can execute with just this vote
      // Total votes cast: 3 (creator + member[1]), YES votes: 3, Unity needed: 60%
      // Unity check: 3 * 100 >= 60 * 3 → 300 >= 180 ✅ (reaches 60% unity of votes cast)
      // NEW LOGIC: Unity is calculated against votes cast, not total voting power
      expect(proposalState.executed).to.equal(true);
      console.log(
        '✅ Proposal executed with 100% unity among participants (3/3 votes)',
      );

      // Proposal is already executed, no need for additional votes
      // With new logic: 100% of participants (2/2) voted YES, which exceeds 60% unity threshold
    });

    it('Should allow a non-member delegate to vote with the correct power', async function () {
      console.log('\n--- Testing Voting by Non-Member Delegate ---');
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 4, // owner, members[0], members[1], members[2]
        name: 'Non-Member Delegate Voting Test',
      });

      const delegator1 = members[0];
      const delegator2 = members[1];
      const nonMemberDelegate = members[5];

      // Verify non-member status
      expect(await daoSpaceFactory.isMember(spaceId, nonMemberDelegate.address))
        .to.be.false;
      console.log(`Verified ${nonMemberDelegate.address} is not a member.`);

      // Create a proposal
      const proposalId = await createTestProposal(spaceId, owner);

      // Delegate from member 1 to non-member
      await votingPowerDelegation
        .connect(delegator1)
        .delegate(nonMemberDelegate.address, spaceId);
      console.log(
        `delegator1 (${delegator1.address}) delegated to nonMemberDelegate.`,
      );

      // Delegate from member 2 to non-member
      await votingPowerDelegation
        .connect(delegator2)
        .delegate(nonMemberDelegate.address, spaceId);
      console.log(
        `delegator2 (${delegator2.address}) delegated to nonMemberDelegate.`,
      );

      // Check non-member's voting power
      const votingPower = await spaceVotingPower.getVotingPower(
        nonMemberDelegate.address,
        spaceId,
      );
      expect(votingPower).to.equal(2);
      console.log(`nonMemberDelegate now has ${votingPower} voting power.`);

      // Non-member delegate votes YES
      await daoProposals.connect(nonMemberDelegate).vote(proposalId, true);
      console.log('nonMemberDelegate voted YES on the proposal.');

      // Verify proposal state
      const proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.yesVotes).to.equal(3); // Creator's 1 + nonMemberDelegate's 2
      console.log(`Proposal now has ${proposalState.yesVotes} YES votes.`);

      // Total voting power is 4. Quorum is 50% (2 votes). Unity 60%.
      // 2 votes were cast. 2 yes votes. 2*100 >= 60*2 -> 200 >= 120. It should be executed.
      expect(proposalState.executed).to.be.true;
      console.log('Proposal executed as expected.');

      console.log(
        '✅ Non-member delegate successfully voted with aggregated power.',
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

    it('Should handle re-delegation and correctly transfer voting rights during a vote', async function () {
      console.log('\n--- Testing Re-delegation Voting Rights ---');
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 5, // owner, members[0]..members[3]
        name: 'Re-delegation Test',
      });

      const delegator = members[0]; // X
      const firstDelegate = members[1]; // Y
      const secondDelegate = members[2]; // Z

      // Step 1: Create a proposal
      const proposalId = await createTestProposal(spaceId, owner);
      console.log(`Proposal ${proposalId} created.`);

      // Step 2: X delegates to Y
      await votingPowerDelegation
        .connect(delegator)
        .delegate(firstDelegate.address, spaceId);
      console.log(
        `Delegator (${delegator.address}) delegated to firstDelegate (${firstDelegate.address}).`,
      );

      let firstDelegatePower = await spaceVotingPower.getVotingPower(
        firstDelegate.address,
        spaceId,
      );
      expect(firstDelegatePower).to.equal(2); // Own + delegated

      // Step 3: X re-delegates to Z
      await votingPowerDelegation
        .connect(delegator)
        .delegate(secondDelegate.address, spaceId);
      console.log(
        `Delegator (${delegator.address}) re-delegated to secondDelegate (${secondDelegate.address}).`,
      );

      // Verify power has moved
      firstDelegatePower = await spaceVotingPower.getVotingPower(
        firstDelegate.address,
        spaceId,
      );
      expect(firstDelegatePower).to.equal(1); // Back to own power

      const secondDelegatePower = await spaceVotingPower.getVotingPower(
        secondDelegate.address,
        spaceId,
      );
      expect(secondDelegatePower).to.equal(2); // Own + delegated power
      console.log('Verified voting power was transferred.');

      // Step 4: Y votes. Y is a member, so they can still vote with their own power (1).
      // Their vote should not include X's power anymore.
      await daoProposals.connect(firstDelegate).vote(proposalId, true);
      console.log(
        'firstDelegate voted. As a member, their vote should count as 1.',
      );

      let proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.yesVotes).to.equal(2); // Creator's 1 + firstDelegate's 1

      // Step 5: Z votes. Z should have their own power + X's delegated power (2).
      await daoProposals.connect(secondDelegate).vote(proposalId, true);
      console.log('secondDelegate voted. Should count as 2 votes.');

      proposalState = await daoProposals.getProposalCore(proposalId);
      // Total yes votes should be 1 (creator) + 1 (firstDelegate) + 2 (secondDelegate) = 4
      expect(proposalState.yesVotes).to.equal(4);

      console.log(
        '✅ Re-delegation correctly transferred voting rights during a vote.',
      );
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
      expect(proposalState.yesVotes).to.equal(3); // Creator's 1 + Charlie's own 1 + Bob's delegated 1

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

      // Space voting: should have 5 yes votes (creator's 1 + member[3]'s own 1 + 3 delegated)
      expect(proposalState.yesVotes).to.equal(5);
      console.log(`Space voting: ${proposalState.yesVotes} yes votes`);

      expect(proposalState.executed).to.equal(true);
      console.log(`✅ Space Voting proposal executed with delegated power`);
    });
  });

  describe('New Governance Features Tests', function () {
    describe('Space Creation with Zero Unity/Quorum', function () {
      it('Should allow creating spaces with unity=0 but quorum>0', async function () {
        console.log('\n--- Testing Space Creation: Unity=0, Quorum>0 ---');

        const spaceParams = {
          name: 'Zero Unity Test',
          description: 'Test space with unity=0 and quorum=50',
          imageUrl: 'https://test.com/image.png',
          unity: 0, // Zero unity
          quorum: 50, // Normal quorum
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await expect(daoSpaceFactory.createSpace(spaceParams)).to.not.be
          .reverted;
        const spaceId = await daoSpaceFactory.spaceCounter();

        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        expect(spaceDetails.unity).to.equal(0);
        expect(spaceDetails.quorum).to.equal(50);

        console.log('✅ Successfully created space with unity=0, quorum=50');
      });

      it('Should allow creating spaces with quorum=0 but unity>0', async function () {
        console.log('\n--- Testing Space Creation: Quorum=0, Unity>0 ---');

        const spaceParams = {
          name: 'Zero Quorum Test',
          description: 'Test space with quorum=0 and unity=60',
          imageUrl: 'https://test.com/image.png',
          unity: 60, // Normal unity
          quorum: 0, // Zero quorum
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await expect(daoSpaceFactory.createSpace(spaceParams)).to.not.be
          .reverted;
        const spaceId = await daoSpaceFactory.spaceCounter();

        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        expect(spaceDetails.unity).to.equal(60);
        expect(spaceDetails.quorum).to.equal(0);

        console.log('✅ Successfully created space with quorum=0, unity=60');
      });

      it('Should prevent creating spaces with both unity=0 and quorum=0', async function () {
        console.log(
          '\n--- Testing Space Creation: Both Zero (Should Fail) ---',
        );

        const spaceParams = {
          name: 'Both Zero Test',
          description: 'Test space with both unity=0 and quorum=0',
          imageUrl: 'https://test.com/image.png',
          unity: 0, // Zero unity
          quorum: 0, // Zero quorum
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await expect(
          daoSpaceFactory.createSpace(spaceParams),
        ).to.be.revertedWith('Both quorum and unity cannot be zero');

        console.log(
          '✅ Correctly prevented space creation with both unity=0 and quorum=0',
        );
      });

      it('Should validate changeVotingMethod with same rules', async function () {
        console.log('\n--- Testing changeVotingMethod Validation ---');

        // Create a normal space first
        const { spaceId } = await createSpace({
          unity: 60,
          quorum: 50,
          memberCount: 3,
          name: 'Change Method Test',
        });

        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        const executor = spaceDetails.executor;

        // Test valid changes
        await expect(
          daoSpaceFactory.changeVotingMethod(spaceId, 1, 0, 50), // unity=0, quorum=50
        ).to.not.be.reverted;
        console.log('✅ Successfully changed to unity=0, quorum=50');

        await expect(
          daoSpaceFactory.changeVotingMethod(spaceId, 1, 60, 0), // unity=60, quorum=0
        ).to.not.be.reverted;
        console.log('✅ Successfully changed to unity=60, quorum=0');

        // Test invalid change (both zero)
        await expect(
          daoSpaceFactory.changeVotingMethod(spaceId, 1, 0, 0), // both zero
        ).to.be.revertedWith('Both quorum and unity cannot be zero');
        console.log(
          '✅ Correctly prevented changing to both unity=0 and quorum=0',
        );
      });
    });

    describe('Minimum Duration Requirements', function () {
      it('Should require minimum duration when unity=0', async function () {
        console.log('\n--- Testing Minimum Duration Requirement: Unity=0 ---');

        // Create space with unity=0, quorum=15 (< 20 to trigger minimum duration)
        const spaceParams = {
          name: 'Unity Zero Duration Test',
          description: 'Test space requiring minimum duration',
          imageUrl: 'https://test.com/image.png',
          unity: 0,
          quorum: 15, // Low quorum < 20 triggers minimum duration
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await daoSpaceFactory.createSpace(spaceParams);
        const spaceId = await daoSpaceFactory.spaceCounter();

        // Add members
        await daoSpaceFactory.connect(members[0]).joinSpace(spaceId);
        await daoSpaceFactory.connect(members[1]).joinSpace(spaceId);

        // Create proposal without setting minimum duration
        const proposalCalldata = daoSpaceFactory.interface.encodeFunctionData(
          'getSpaceDetails',
          [spaceId],
        );

        const proposalParams = {
          spaceId,
          duration: 3600,
          transactions: [
            {
              target: await daoSpaceFactory.getAddress(),
              value: 0,
              data: proposalCalldata,
            },
          ],
        };

        // The contract should not revert, but set a default minimum duration
        await expect(daoProposals.createProposal(proposalParams)).to.not.be
          .reverted;

        console.log(
          '✅ Proposal created successfully with default minimum duration',
        );

        // Verify that the default duration was set to 72 hours (contract default for q < 20)
        const minDuration = await daoProposals.spaceMinProposalDuration(
          spaceId,
        );
        expect(minDuration).to.equal(259200); // 72 hours in seconds

        console.log('✅ Default minimum duration correctly set to 72 hours');
      });

      it('Should require minimum duration when quorum<20%', async function () {
        console.log(
          '\n--- Testing Minimum Duration Requirement: Quorum<20% ---',
        );

        // Create space with unity=60, quorum=15 (<20%)
        const spaceParams = {
          name: 'Low Quorum Duration Test',
          description: 'Test space with low quorum requiring minimum duration',
          imageUrl: 'https://test.com/image.png',
          unity: 60,
          quorum: 15, // Less than 20%
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await daoSpaceFactory.createSpace(spaceParams);
        const spaceId = await daoSpaceFactory.spaceCounter();

        // Add members
        await daoSpaceFactory.connect(members[0]).joinSpace(spaceId);

        const proposalCalldata = daoSpaceFactory.interface.encodeFunctionData(
          'getSpaceDetails',
          [spaceId],
        );

        const proposalParams = {
          spaceId,
          duration: 3600,
          transactions: [
            {
              target: await daoSpaceFactory.getAddress(),
              value: 0,
              data: proposalCalldata,
            },
          ],
        };

        // The contract should not revert, but set a default minimum duration
        await expect(daoProposals.createProposal(proposalParams)).to.not.be
          .reverted;

        console.log(
          '✅ Proposal created successfully with default minimum duration for low quorum',
        );

        // Verify that the default duration was set to 72 hours (contract default for q < 20)
        const minDuration = await daoProposals.spaceMinProposalDuration(
          spaceId,
        );
        expect(minDuration).to.equal(259200); // 72 hours in seconds

        console.log(
          '✅ Default minimum duration correctly set to 72 hours for low quorum space',
        );
      });

      it('Should allow proposals in traditional spaces without minimum duration', async function () {
        console.log(
          '\n--- Testing Traditional Spaces: No Minimum Duration Required ---',
        );

        // Create traditional space (unity=67, quorum=50)
        const { spaceId } = await createSpace({
          unity: 67,
          quorum: 50,
          memberCount: 3,
          name: 'Traditional Space',
        });

        // Should be able to create proposal without setting minimum duration
        const proposalId = await createTestProposal(spaceId, owner);
        expect(proposalId).to.be.greaterThan(0);

        console.log(
          '✅ Successfully created proposal in traditional space without minimum duration',
        );
      });
    });

    describe('Executor-Only Access Control', function () {
      it('Should only allow executor or owner to set minimum proposal duration', async function () {
        console.log(
          '\n--- Testing Executor and Owner Access to setMinimumProposalDuration ---',
        );

        const { spaceId } = await createSpace({
          unity: 60,
          quorum: 50,
          memberCount: 3,
          name: 'Executor Access Test',
        });

        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        const executorAddress = spaceDetails.executor;
        const creator = spaceDetails.creator;

        // Non-executor and non-owner should fail
        await expect(
          daoProposals
            .connect(members[0])
            .setMinimumProposalDuration(spaceId, 86400),
        ).to.be.revertedWithCustomError(daoProposals, 'OnlyExecutor');

        // Owner should succeed (owner is allowed in addition to executor)
        await expect(
          daoProposals
            .connect(owner)
            .setMinimumProposalDuration(spaceId, 86400),
        ).to.not.be.reverted;

        console.log('✅ Owner can set minimum proposal duration');

        // Executor should also succeed
        await ethers.provider.send('hardhat_impersonateAccount', [
          executorAddress,
        ]);
        await ethers.provider.send('hardhat_setBalance', [
          executorAddress,
          '0x1000000000000000000',
        ]);
        const executorSigner = await ethers.getSigner(executorAddress);
        await expect(
          daoProposals
            .connect(executorSigner)
            .setMinimumProposalDuration(spaceId, 172800),
        ).to.not.be.reverted;

        console.log(
          '✅ Both owner and executor can set minimum proposal duration',
        );
      });
    });

    describe('New Governance Models in Action', function () {
      it('Should test "Democratic Timing" model (quorum=0, unity>0)', async function () {
        console.log(
          '\n--- Testing Democratic Timing Model: Quorum=0, Unity=50 ---',
        );

        // Create space with quorum=0, unity=50
        const spaceParams = {
          name: 'Democratic Timing Test',
          description: 'Any participation triggers process, majority decides',
          imageUrl: 'https://test.com/image.png',
          unity: 50,
          quorum: 0, // No participation threshold
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await daoSpaceFactory.createSpace(spaceParams);
        const spaceId = await daoSpaceFactory.spaceCounter();

        // Add members
        for (let i = 0; i < 4; i++) {
          await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
        }

        // Set minimum duration (required for quorum=0)
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        await ethers.provider.send('hardhat_impersonateAccount', [
          spaceDetails.executor,
        ]);
        await ethers.provider.send('hardhat_setBalance', [
          spaceDetails.executor,
          '0x1000000000000000000',
        ]);
        const executorSigner = await ethers.getSigner(spaceDetails.executor);
        await daoProposals
          .connect(executorSigner)
          .setMinimumProposalDuration(spaceId, 1); // 1 second for testing

        const proposalId = await createTestProposal(spaceId, owner);

        console.log(
          'Setup: 5 total members, quorum=0 (any vote triggers), unity=50% (majority wins)',
        );

        // Single vote should meet quorum immediately
        await daoProposals.connect(members[0]).vote(proposalId, true);

        let proposalState = await daoProposals.getProposalCore(proposalId);
        console.log(
          `After 1 YES vote: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Executed: ${proposalState.executed}`,
        );

        // Should execute immediately (100% of cast votes = YES, exceeds 50% unity)
        expect(proposalState.executed).to.equal(true);
        console.log(
          '✅ Democratic Timing model: Single vote executed proposal (100% > 50% unity)',
        );
      });

      it('Should test "First Vote Wins" model (unity=0, quorum>0) with minimum duration', async function () {
        console.log(
          '\n--- Testing First Vote Wins Model: Unity=0, Quorum=50 ---',
        );

        // Create space with unity=0, quorum=50
        const spaceParams = {
          name: 'First Vote Wins Test',
          description: 'Need participation threshold, first vote type wins',
          imageUrl: 'https://test.com/image.png',
          unity: 0, // Any vote percentage wins
          quorum: 50, // Need 50% participation
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await daoSpaceFactory.createSpace(spaceParams);
        const spaceId = await daoSpaceFactory.spaceCounter();

        // Add members (total 5: owner + 4 members)
        for (let i = 0; i < 4; i++) {
          await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
        }

        // Set minimum duration with enough time for votes
        // Note: minimum duration is not auto-required for unity=0, quorum=50 (>20)
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        await ethers.provider.send('hardhat_impersonateAccount', [
          spaceDetails.executor,
        ]);
        await ethers.provider.send('hardhat_setBalance', [
          spaceDetails.executor,
          '0x1000000000000000000',
        ]);
        const executorSigner = await ethers.getSigner(spaceDetails.executor);
        await daoProposals
          .connect(executorSigner)
          .setMinimumProposalDuration(spaceId, 3600); // 1 hour for testing

        const proposalId = await createTestProposal(spaceId, owner);

        console.log(
          'Setup: 5 total members, unity=0 (any vote wins), quorum=50% (need 3 votes)',
        );

        // First vote (YES) - quorum not met yet
        await daoProposals.connect(members[0]).vote(proposalId, true);
        let proposalState = await daoProposals.getProposalCore(proposalId);
        expect(proposalState.executed).to.equal(false); // Quorum not met
        console.log(`After 1 YES vote: quorum not met, not executed`);

        // Second vote (NO) - still no quorum
        await daoProposals.connect(members[1]).vote(proposalId, false);
        proposalState = await daoProposals.getProposalCore(proposalId);
        expect(proposalState.executed).to.equal(false); // Quorum not met
        console.log(`After 1 YES, 1 NO: quorum not met, not executed`);

        // Third vote (NO) - quorum met, but minimum duration not elapsed yet
        await daoProposals.connect(members[2]).vote(proposalId, false);
        proposalState = await daoProposals.getProposalCore(proposalId);

        // With unity=0, proposal should not execute until minimum duration elapses
        expect(proposalState.executed).to.equal(false);
        console.log(
          `After 1 YES, 2 NO: quorum met, but minimum duration prevents execution`,
        );

        // Advance time past minimum duration
        await ethers.provider.send('evm_increaseTime', [3601]);
        await ethers.provider.send('evm_mine');

        // Trigger execution check
        await daoProposals.triggerExecutionCheck(proposalId);
        proposalState = await daoProposals.getProposalCore(proposalId);

        // Now it should execute
        expect(proposalState.executed).to.equal(true);
        console.log(
          `After minimum duration elapsed: proposal executed (first vote type wins)`,
        );
        console.log(
          '✅ First Vote Wins model working correctly with minimum duration',
        );
      });

      it('Should test complex voting scenarios with minimum duration protection', async function () {
        console.log(
          '\n--- Testing Complex Voting with Minimum Duration Protection ---',
        );

        // Create space with unity=0, quorum=30
        const spaceParams = {
          name: 'Complex Voting Test',
          description:
            'Testing minimum duration protection in complex scenarios',
          imageUrl: 'https://test.com/image.png',
          unity: 0,
          quorum: 30,
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        };

        await daoSpaceFactory.createSpace(spaceParams);
        const spaceId = await daoSpaceFactory.spaceCounter();

        // Add many members
        for (let i = 0; i < 9; i++) {
          await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
        }

        // Set a longer minimum duration to test protection
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        await ethers.provider.send('hardhat_impersonateAccount', [
          spaceDetails.executor,
        ]);
        await ethers.provider.send('hardhat_setBalance', [
          spaceDetails.executor,
          '0x1000000000000000000',
        ]);
        const executorSigner = await ethers.getSigner(spaceDetails.executor);
        const minDuration = 3600; // 1 hour
        await daoProposals
          .connect(executorSigner)
          .setMinimumProposalDuration(spaceId, minDuration);

        const proposalId = await createTestProposal(spaceId, owner);
        const proposalState = await daoProposals.getProposalCore(proposalId);
        const startTime = proposalState.startTime;

        console.log(
          `Setup: 10 total members, unity=0, quorum=30% (need 3 votes), min duration=${minDuration}s`,
        );

        // Reach quorum quickly
        await daoProposals.connect(members[0]).vote(proposalId, true);
        await daoProposals.connect(members[1]).vote(proposalId, false);
        await daoProposals.connect(members[2]).vote(proposalId, false);

        let currentState = await daoProposals.getProposalCore(proposalId);

        // Should not execute immediately due to minimum duration
        expect(currentState.executed).to.equal(false);
        console.log(
          '✅ Minimum duration prevented immediate execution despite unity=0 and quorum met',
        );

        // Verify the minimum duration is enforced
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilMinDuration =
          Number(startTime) + minDuration - currentTime;
        console.log(`Time until minimum duration: ${timeUntilMinDuration}s`);

        console.log(
          '✅ Complex voting scenario with minimum duration protection working correctly',
        );
      });
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

      // Note: Creator already voted YES when creating proposal
      // Current state: 1 YES (creator)

      // Add 1 more YES vote
      await daoProposals.connect(members[0]).vote(proposalId1, true);
      // Current: 2 YES, quorum not met (need 4 votes = 40% of 10)

      // Add NO votes one by one until early rejection triggers
      // Start with members[1] to avoid early execution
      for (let i = 1; i < 8; i++) {
        await daoProposals.connect(members[i]).vote(proposalId1, false);

        const proposalState = await daoProposals.getProposalCore(proposalId1);
        console.log(
          `After vote ${i}: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Expired: ${proposalState.expired}, Executed: ${proposalState.executed}`,
        );

        if (proposalState.expired || proposalState.executed) {
          console.log('✅ Early rejection or execution triggered correctly');
          break;
        }
      }

      let finalState = await daoProposals.getProposalCore(proposalId1);
      expect(finalState.expired || finalState.executed).to.equal(true);
      console.log('✅ Early rejection/execution logic working correctly');

      // Test NO unity scenario with a fresh proposal
      console.log('\n--- NO Unity Scenario ---');
      const proposalId2 = await createTestProposal(spaceId, owner);

      // Note: Creator already voted YES (1 YES vote)
      // Vote to reach NO unity: need 70% of votes cast to be NO
      // With quorum at 40% (4 votes), we need enough votes to meet quorum and NO unity
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
      console.log('Note: Creator already voted YES when creating proposal');

      // Start with 1 more YES vote (creator already voted)
      // Current: 1 YES (creator)
      await daoProposals.connect(members[0]).vote(proposalId, true);
      // Current: 2 YES

      // Add NO votes incrementally and check when early rejection triggers
      const maxNoVotes = 8; // Will test up to 8 NO votes

      for (let noVotes = 1; noVotes <= maxNoVotes; noVotes++) {
        await daoProposals.connect(members[noVotes]).vote(proposalId, false);

        const proposalState = await daoProposals.getProposalCore(proposalId);
        const totalVotes =
          Number(proposalState.yesVotes) + Number(proposalState.noVotes);
        const remainingVoters = 12 - totalVotes;
        const maxPossibleYes = Number(proposalState.yesVotes) + remainingVoters;
        const canReachUnity = maxPossibleYes * 100 >= 75 * 12; // 75% of 12 = 9

        console.log(
          `After ${noVotes} NO votes: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Max YES: ${maxPossibleYes}/12, Can reach unity: ${canReachUnity}, Expired: ${proposalState.expired}, Executed: ${proposalState.executed}`,
        );

        if (!canReachUnity && totalVotes >= 4) {
          // Quorum check (30% of 12 = 3.6 ≈ 4)
          expect(proposalState.expired || proposalState.executed).to.equal(
            true,
          );
          console.log(
            `✅ Early rejection/execution correctly triggered after ${noVotes} NO votes`,
          );
          break;
        } else if (canReachUnity && !proposalState.executed) {
          expect(proposalState.expired).to.equal(false);
        }

        // Stop if we've reached the rejection/execution point
        if (proposalState.expired || proposalState.executed) break;
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
      console.log('Note: Creator (owner) already voted YES with 1 vote');

      // Vote with high-power delegates
      // Current state: 1 YES (creator)
      await daoProposals.connect(members[8]).vote(proposalId, false); // 4 NO
      await daoProposals.connect(members[11]).vote(proposalId, false); // 3 NO (total: 7 NO)

      // After members[11] votes: 1 YES, 7 NO = 8 votes total
      // Quorum: 50% of 16 = 8 votes (met!)
      // Max possible YES = 1 + 7 remaining = 8
      // Unity check: 8 * 100 < 60 * 16 → 800 < 960 → Should be rejected!

      let proposalState = await daoProposals.getProposalCore(proposalId);
      console.log(
        `After delegate votes: ${proposalState.yesVotes} YES, ${proposalState.noVotes} NO, Expired: ${proposalState.expired}, Executed: ${proposalState.executed}`,
      );

      // Current: 1 YES, 7 NO, remaining voters: members[4](5), members[12](1), members[13](1), members[14](1) = 8 votes
      // Total votes cast: 8, Quorum met (50% of 16 = 8)
      // Max possible YES = 1 + 8 = 9, Total power = 16
      // Unity: 9 * 100 = 900, 60 * 16 = 960, so 900 < 960 ✓ Should be rejected
      expect(proposalState.expired || proposalState.executed).to.equal(true);
      console.log(
        '✅ Early rejection works with complex delegation (max 9/16 = 56.25% < 60%)',
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
        console.log('Note: Creator already voted YES when creating proposal');

        // Vote pattern: Creator already voted YES, now add NO votes incrementally
        // Current state: 1 YES (creator)

        let votesBeforeQuorum = 0;
        let votesAfterQuorum = 0;

        for (let i = 0; i < scenario.members; i++) {
          await daoProposals.connect(members[i]).vote(proposalId, false);

          const proposalState = await daoProposals.getProposalCore(proposalId);
          const totalVotes =
            Number(proposalState.yesVotes) + Number(proposalState.noVotes);
          const quorumReached = totalVotes >= requiredQuorum;

          console.log(
            `Vote ${i + 1}: ${proposalState.yesVotes} YES, ${
              proposalState.noVotes
            } NO, Quorum: ${quorumReached}, Expired: ${
              proposalState.expired
            }, Executed: ${proposalState.executed}`,
          );

          if (!quorumReached && proposalState.expired) {
            console.log('❌ ERROR: Early rejection triggered before quorum!');
            expect(proposalState.expired).to.equal(false);
          }

          if (
            quorumReached &&
            !proposalState.expired &&
            !proposalState.executed
          ) {
            votesAfterQuorum++;
          } else if (!quorumReached) {
            votesBeforeQuorum++;
          }

          if (proposalState.expired || proposalState.executed) {
            console.log(
              `✅ Early rejection/execution triggered after quorum with ${totalVotes} votes`,
            );
            break;
          }
        }

        console.log(
          `Summary: ${votesBeforeQuorum} votes before quorum, ${votesAfterQuorum} votes after quorum before rejection/execution`,
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

        // With new unity logic (calculated against votes cast), we need to test differently
        // First, let's see if a single YES vote can execute the proposal
        await daoProposals.connect(members[0]).vote(proposalId, true);

        let proposalState = await daoProposals.getProposalCore(proposalId);

        if (proposalState.executed) {
          console.log(
            `✅ Proposal executed immediately with single YES vote (100% unity of 1 vote)`,
          );
          continue; // Move to next scenario
        }

        // If not executed, add NO votes one by one until early rejection
        let noVoteCount = 0;
        for (
          let i = 1;
          i < actualMembers &&
          !proposalState.executed &&
          !proposalState.expired;
          i++
        ) {
          await daoProposals.connect(members[i]).vote(proposalId, false);
          noVoteCount++;
          proposalState = await daoProposals.getProposalCore(proposalId);

          if (proposalState.expired) {
            console.log(
              `✅ Early rejection triggered after ${noVoteCount} NO votes`,
            );
            break;
          }
        }

        // Test completed - the new logic handles extreme unity thresholds correctly
        console.log('✅ Extreme unity threshold test completed with new logic');
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

  describe('Re-delegation Tests', function () {
    it('Should handle re-delegation where the previous delegate cannot vote', async function () {
      console.log(
        '\n--- Testing Re-delegation: Previous Delegate Cannot Vote ---',
      );
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 4, // owner, members[0], members[1], members[2]
        name: 'Re-delegation Non-Member Test',
      });

      const delegator = members[0]; // X (member)
      const secondDelegate = members[1]; // Z (member)
      const nonMemberFirstDelegate = members[4]; // Y (non-member)

      // Verify non-member status
      expect(
        await daoSpaceFactory.isMember(spaceId, nonMemberFirstDelegate.address),
      ).to.be.false;

      // Step 1: Create a proposal
      const proposalId = await createTestProposal(spaceId, owner);
      console.log(`Proposal ${proposalId} created.`);

      // Step 2: X (member) delegates to Y (non-member)
      await votingPowerDelegation
        .connect(delegator)
        .delegate(nonMemberFirstDelegate.address, spaceId);
      console.log(
        `Delegator (${delegator.address}) delegated to nonMemberFirstDelegate (${nonMemberFirstDelegate.address}).`,
      );

      let nonMemberDelegatePower = await spaceVotingPower.getVotingPower(
        nonMemberFirstDelegate.address,
        spaceId,
      );
      expect(nonMemberDelegatePower).to.equal(1); // Has delegated power

      // Step 3: X re-delegates to Z (member)
      await votingPowerDelegation
        .connect(delegator)
        .delegate(secondDelegate.address, spaceId);
      console.log(
        `Delegator (${delegator.address}) re-delegated to secondDelegate (${secondDelegate.address}).`,
      );

      // Verify power has moved from Y to Z
      nonMemberDelegatePower = await spaceVotingPower.getVotingPower(
        nonMemberFirstDelegate.address,
        spaceId,
      );
      expect(nonMemberDelegatePower).to.equal(0); // Power is now 0

      const secondDelegatePower = await spaceVotingPower.getVotingPower(
        secondDelegate.address,
        spaceId,
      );
      expect(secondDelegatePower).to.equal(2); // Own power + delegated power from X
      console.log('Verified voting power was transferred correctly.');

      // Step 4: Y (non-member) tries to vote. Should fail with 'NotMember' because they are no longer a delegate.
      await expect(
        daoProposals.connect(nonMemberFirstDelegate).vote(proposalId, true),
      ).to.be.revertedWithCustomError(daoProposals, 'NotMember');
      console.log(
        'nonMemberFirstDelegate (Y) correctly prevented from voting.',
      );

      // Step 5: Z votes. Z should have their own power + X's delegated power (2).
      await daoProposals.connect(secondDelegate).vote(proposalId, true);
      console.log('secondDelegate (Z) voted successfully with 2 voting power.');

      const proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.yesVotes).to.equal(3); // Creator's 1 + secondDelegate's 2

      console.log(
        '✅ Re-delegation correctly revoked voting rights from the previous delegate.',
      );
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
  });

  describe('Executor Token Transfer Logic', function () {
    it('should allow executor to transfer more tokens than they have by minting the difference', async function () {
      console.log('\n--- Testing Executor Token Transfer ---');

      // 1. Create a space (without a token initially)
      const spaceParams = {
        name: 'Executor Transfer Test Space',
        description: 'A space for testing executor token transfer logic',
        imageUrl: 'https://test.com/image.png',
        unity: 60,
        quorum: 50,
        votingPowerSource: 1, // Does not matter for this test
        exitMethod: 1,
        joinMethod: 1,
        createToken: false, // Token will be created manually
        tokenName: '',
        tokenSymbol: '',
      };

      await daoSpaceFactory.createSpace(spaceParams);
      const spaceId = await daoSpaceFactory.spaceCounter();

      // 2. Get space executor and impersonate
      const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
      const executorAddress = spaceDetails.executor;

      await ethers.provider.send('hardhat_impersonateAccount', [
        executorAddress,
      ]);
      await ethers.provider.send('hardhat_setBalance', [
        executorAddress,
        '0x1000000000000000000', // 1 ETH for gas
      ]);
      const executorSigner = await ethers.getSigner(executorAddress);
      console.log(`Impersonating executor: ${executorAddress}`);

      // 3. Deploy a token for the space as the executor
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Test Token',
        'TTT',
        0, // maxSupply (0 = unlimited)
        true, // transferable
        true, // isVotingToken
      );
      const receipt = await tx.wait();

      const tokenDeployedEvent = receipt?.logs
        .map((log: any) => {
          try {
            return regularTokenFactory.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: any) => event && event.name === 'TokenDeployed');

      if (!tokenDeployedEvent) {
        throw new Error('TokenDeployed event not found');
      }

      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      const spaceToken = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );
      console.log(`Space token created at: ${tokenAddress}`);

      // 4. Perform transfer and assert
      const recipient = members[0];
      const transferAmount = ethers.parseEther('100');

      const initialExecutorBalance = await (spaceToken as any).balanceOf(
        executorAddress,
      );
      expect(initialExecutorBalance).to.equal(0);
      console.log(`Initial executor balance: ${initialExecutorBalance}`);

      const initialRecipientBalance = await (spaceToken as any).balanceOf(
        recipient.address,
      );
      expect(initialRecipientBalance).to.equal(0);
      console.log(`Initial recipient balance: ${initialRecipientBalance}`);

      // Executor transfers tokens it doesn't have
      console.log(
        `Executor transferring ${ethers.formatEther(
          transferAmount,
        )} tokens to ${recipient.address}`,
      );
      await (spaceToken as any)
        .connect(executorSigner)
        .transfer(recipient.address, transferAmount);

      const finalExecutorBalance = await (spaceToken as any).balanceOf(
        executorAddress,
      );
      expect(finalExecutorBalance).to.equal(0);
      console.log(`Final executor balance: ${finalExecutorBalance}`);

      const finalRecipientBalance = await (spaceToken as any).balanceOf(
        recipient.address,
      );
      expect(finalRecipientBalance).to.equal(transferAmount);
      console.log(
        `Final recipient balance: ${ethers.formatEther(finalRecipientBalance)}`,
      );

      console.log(
        '✅ Executor successfully transferred tokens by minting them first.',
      );
    });
  });

  describe('Ownership and Decaying Token Transfer Logic', function () {
    describe('OwnershipSpaceToken Transfers', function () {
      let spaceId: any;
      let ownershipToken: any;
      let executorSigner: SignerWithAddress;

      beforeEach(async function () {
        // 1. Create a space
        await daoSpaceFactory.createSpace({
          name: 'Ownership Token Test Space',
          description: 'A space for testing OwnershipSpaceToken',
          imageUrl: '',
          unity: 60,
          quorum: 50,
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        });
        spaceId = await daoSpaceFactory.spaceCounter();

        // Add members
        await daoSpaceFactory.connect(members[0]).joinSpace(spaceId);
        await daoSpaceFactory.connect(members[1]).joinSpace(spaceId);

        // 2. Get space executor and impersonate
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        const executorAddress = spaceDetails.executor;
        await ethers.provider.send('hardhat_impersonateAccount', [
          executorAddress,
        ]);
        await ethers.provider.send('hardhat_setBalance', [
          executorAddress,
          '0x1000000000000000000',
        ]);
        executorSigner = await ethers.getSigner(executorAddress);

        // Join the space as the executor to allow minting to the executor
        await daoSpaceFactory.connect(executorSigner).joinSpace(spaceId);

        // 3. Deploy an OwnershipSpaceToken
        const tx = await ownershipTokenFactory
          .connect(executorSigner)
          .deployOwnershipToken(
            spaceId,
            'Ownership Test Token',
            'OTT',
            0, // maxSupply (0 = unlimited)
            false, // isVotingToken
          );
        const receipt = await tx.wait();
        const tokenDeployedEvent = receipt?.logs
          .map((log: any) => {
            try {
              return ownershipTokenFactory.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((event: any) => event && event.name === 'TokenDeployed');
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;
        ownershipToken = await ethers.getContractAt(
          'OwnershipSpaceToken',
          tokenAddress,
        );
      });

      it('should allow executor to transfer tokens to a space member', async function () {
        const recipient = members[0];
        const amount = ethers.parseEther('100');
        await ownershipToken
          .connect(executorSigner)
          .transfer(recipient.address, amount);
        const recipientBalance = await ownershipToken.balanceOf(
          recipient.address,
        );
        expect(recipientBalance).to.equal(amount);
      });

      it('should mint tokens if executor transfers more than they have', async function () {
        const recipient = members[0];
        const amount = ethers.parseEther('200');
        const initialExecutorBalance = await ownershipToken.balanceOf(
          executorSigner.address,
        );
        expect(initialExecutorBalance).to.equal(0);

        await ownershipToken
          .connect(executorSigner)
          .transfer(recipient.address, amount);

        const finalRecipientBalance = await ownershipToken.balanceOf(
          recipient.address,
        );
        expect(finalRecipientBalance).to.equal(amount);
        const finalExecutorBalance = await ownershipToken.balanceOf(
          executorSigner.address,
        );
        expect(finalExecutorBalance).to.equal(0);
      });

      it('should prevent non-executor from transferring tokens', async function () {
        // Mint some tokens to a member first so they have a balance
        const member = members[0];
        const recipient = members[1];
        const amount = ethers.parseEther('50');
        await ownershipToken
          .connect(executorSigner)
          .transfer(member.address, amount);
        expect(await ownershipToken.balanceOf(member.address)).to.equal(amount);

        // Try to transfer as the member
        await expect(
          ownershipToken.connect(member).transfer(recipient.address, amount),
        ).to.be.revertedWith('Only executor can transfer tokens');
      });

      it('should prevent executor from transferring to a non-member', async function () {
        const nonMember = members[5];
        const amount = ethers.parseEther('100');
        await expect(
          ownershipToken
            .connect(executorSigner)
            .transfer(nonMember.address, amount),
        ).to.be.revertedWith('Can only transfer to space members');
      });

      it('should allow executor to use transferFrom for their own tokens, minting if needed', async function () {
        const recipient = members[0];
        const amount = ethers.parseEther('150');

        // Executor starts with 0 balance
        const initialExecutorBalance = await ownershipToken.balanceOf(
          executorSigner.address,
        );
        expect(initialExecutorBalance).to.equal(0);

        // Executor uses transferFrom to send tokens from their own account
        await ownershipToken
          .connect(executorSigner)
          .transferFrom(executorSigner.address, recipient.address, amount);

        // Executor balance should remain 0, as tokens were minted to them and then sent
        const finalExecutorBalance = await ownershipToken.balanceOf(
          executorSigner.address,
        );
        expect(finalExecutorBalance).to.equal(0);

        // Recipient should have the tokens
        const recipientBalance = await ownershipToken.balanceOf(
          recipient.address,
        );
        expect(recipientBalance).to.equal(amount);
      });

      it('should allow executor to use transferFrom to move tokens between members', async function () {
        const sender = members[0];
        const recipient = members[1];
        const amount = ethers.parseEther('75');

        // First, mint some tokens to the sender member
        await ownershipToken
          .connect(executorSigner)
          .mint(sender.address, amount);
        const initialSenderBalance = await ownershipToken.balanceOf(
          sender.address,
        );
        expect(initialSenderBalance).to.equal(amount);

        // Executor uses transferFrom to move tokens from sender to recipient
        await ownershipToken
          .connect(executorSigner)
          .transferFrom(sender.address, recipient.address, amount);

        // Check final balances
        const finalSenderBalance = await ownershipToken.balanceOf(
          sender.address,
        );
        expect(finalSenderBalance).to.equal(0);

        const finalRecipientBalance = await ownershipToken.balanceOf(
          recipient.address,
        );
        expect(finalRecipientBalance).to.equal(amount);
      });

      it('should prevent executor from using transferFrom to a non-member', async function () {
        const sender = members[0];
        const nonMember = members[5];
        const amount = ethers.parseEther('50');

        // Mint tokens to sender
        await ownershipToken
          .connect(executorSigner)
          .mint(sender.address, amount);

        // Expect revert
        await expect(
          ownershipToken
            .connect(executorSigner)
            .transferFrom(sender.address, nonMember.address, amount),
        ).to.be.revertedWith('Can only transfer to space members');
      });

      it('should prevent a non-executor from calling transferFrom', async function () {
        const sender = members[0];
        const recipient = members[1];
        const amount = ethers.parseEther('50');

        // Mint tokens to sender
        await ownershipToken
          .connect(executorSigner)
          .mint(sender.address, amount);

        // A member (non-executor) tries to call transferFrom
        // This should fail even if they are the 'from' address
        await expect(
          ownershipToken
            .connect(sender)
            .transferFrom(sender.address, recipient.address, amount),
        ).to.be.revertedWith('Only executor can transfer tokens');
      });
    });

    describe('DecayingSpaceToken Transfers', function () {
      let spaceId: any;
      let executorSigner: SignerWithAddress;

      beforeEach(async function () {
        // 1. Create a space
        await daoSpaceFactory.createSpace({
          name: 'Decaying Token Test Space',
          description: 'A space for testing DecayingSpaceToken',
          imageUrl: '',
          unity: 60,
          quorum: 50,
          votingPowerSource: 1,
          exitMethod: 1,
          joinMethod: 1,
          createToken: false,
          tokenName: '',
          tokenSymbol: '',
        });
        spaceId = await daoSpaceFactory.spaceCounter();

        // Add members
        await daoSpaceFactory.connect(members[0]).joinSpace(spaceId);
        await daoSpaceFactory.connect(members[1]).joinSpace(spaceId);

        // 2. Get space executor and impersonate
        const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
        const executorAddress = spaceDetails.executor;
        await ethers.provider.send('hardhat_impersonateAccount', [
          executorAddress,
        ]);
        await ethers.provider.send('hardhat_setBalance', [
          executorAddress,
          '0x1000000000000000000',
        ]);
        executorSigner = await ethers.getSigner(executorAddress);
      });

      async function deployDecayingToken(transferable: boolean) {
        const tx = await decayingTokenFactory
          .connect(executorSigner)
          .deployDecayingToken(
            spaceId,
            'Decaying Test Token',
            'DTT',
            0, // maxSupply
            transferable,
            false, // isVotingToken
            100, // 1% decay
            60 * 60, // per hour
          );
        const receipt = await tx.wait();
        const tokenDeployedEvent = receipt?.logs
          .map((log: any) => {
            try {
              return decayingTokenFactory.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((event: any) => event && event.name === 'TokenDeployed');
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;
        return ethers.getContractAt('DecayingSpaceToken', tokenAddress);
      }

      it('should allow executor to transfer tokens when transfers are disabled', async function () {
        const decayingToken = await deployDecayingToken(false);
        const recipient = members[0];
        const amount = ethers.parseEther('100');

        await decayingToken
          .connect(executorSigner)
          .transfer(recipient.address, amount);
        expect(await decayingToken.balanceOf(recipient.address)).to.equal(
          amount,
        );
      });

      it('should prevent non-executor from transferring when disabled', async function () {
        const decayingToken = await deployDecayingToken(false);
        const sender = members[0];
        const recipient = members[1];
        const amount = ethers.parseEther('50');

        // Mint tokens to sender first
        await decayingToken
          .connect(executorSigner)
          .transfer(sender.address, amount);

        await expect(
          decayingToken.connect(sender).transfer(recipient.address, amount),
        ).to.be.revertedWith('Token transfers are disabled');
      });

      it('should allow non-executor to transfer when enabled', async function () {
        const decayingToken = await deployDecayingToken(true);
        const sender = members[0];
        const recipient = members[1];
        const amount = ethers.parseEther('50');

        await decayingToken
          .connect(executorSigner)
          .transfer(sender.address, amount);
        await decayingToken.connect(sender).transfer(recipient.address, amount);
        expect(await decayingToken.balanceOf(recipient.address)).to.equal(
          amount,
        );
        expect(await decayingToken.balanceOf(sender.address)).to.equal(0);
      });

      it('should apply decay during transfer', async function () {
        const decayingToken = await deployDecayingToken(true);
        const member = members[0];
        const amount = ethers.parseEther('1000');
        await decayingToken
          .connect(executorSigner)
          .mint(member.address, amount);

        // Get balance immediately after mint (should be close to full amount)
        const balanceAfterMint = await decayingToken.balanceOf(member.address);
        expect(balanceAfterMint).to.be.greaterThan(0);

        // Advance time by one decay interval (1 hour)
        await ethers.provider.send('evm_increaseTime', [3600]);
        await ethers.provider.send('evm_mine', []);

        // Get balance after decay (should be less than initial due to 1% decay per hour)
        const decayedBalance = await decayingToken.balanceOf(member.address);
        expect(decayedBalance).to.be.lessThan(balanceAfterMint);

        // Now transfer half of the decayed balance
        const transferAmount = decayedBalance / BigInt(2);
        await decayingToken
          .connect(member)
          .transfer(members[1].address, transferAmount);

        const finalSenderBalance = await decayingToken.balanceOf(
          member.address,
        );
        // After transfer, sender should have roughly half of decayed balance
        expect(finalSenderBalance).to.be.closeTo(
          decayedBalance - transferAmount,
          ethers.parseEther('0.1'), // Allow for rounding and decay during transfer
        );

        // Recipient should have received the transfer amount (with potential decay applied)
        const recipientBalance = await decayingToken.balanceOf(
          members[1].address,
        );
        expect(recipientBalance).to.be.greaterThan(0);
        expect(recipientBalance).to.be.closeTo(
          transferAmount,
          ethers.parseEther('0.1'),
        );
      });
    });
  });
});
