import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Comprehensive Proposal Creation and Voting Tests', function () {
  let daoSpaceFactory: any;
  let daoProposals: any;
  let spaceVotingPower: any;
  let votingPowerDirectory: any;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];

  // Fixture for basic DAO setup with proposal functionality
  async function deployProposalFixture() {
    const signers = await ethers.getSigners();
    const [owner, ...members] = signers;

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

    // Configure all contracts
    await spaceVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());
    await votingPowerDirectory.addVotingPowerSource(
      await spaceVotingPower.getAddress(),
    );
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
      joinMethodDirectory,
      exitMethodDirectory,
      owner,
      members,
    };
  }

  // Helper function to create a space with specific parameters
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
      votingPowerSource: 1, // Space membership voting (1 member 1 vote)
      exitMethod: 1,
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = await daoSpaceFactory.spaceCounter();

    // Add additional members to reach the desired member count
    // (owner is already a member, so we need memberCount - 1 additional members)
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
    // Create a simple proposal that calls getSpaceDetails (harmless function call)
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

  // Helper function to vote on proposal with multiple members
  async function voteOnProposal(
    proposalId: number,
    voters: { member: SignerWithAddress; support: boolean }[],
  ) {
    for (const { member, support } of voters) {
      await daoProposals.connect(member).vote(proposalId, support);
    }
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployProposalFixture);
    daoSpaceFactory = fixture.daoSpaceFactory;
    daoProposals = fixture.daoProposals;
    spaceVotingPower = fixture.spaceVotingPower;
    votingPowerDirectory = fixture.votingPowerDirectory;
    owner = fixture.owner;
    members = fixture.members;
  });

  describe('Space Creation with Different Member Counts', function () {
    it('Should create spaces with 2, 3, 5, and 10 members', async function () {
      const memberCounts = [2, 3, 5, 10];

      for (const count of memberCounts) {
        const { spaceId, spaceMembers } = await createSpace({
          unity: 60,
          quorum: 50,
          memberCount: count,
          name: `${count}-Member Space`,
        });

        console.log(
          `✅ Created space ${spaceId} with ${spaceMembers.length} members`,
        );
        expect(spaceMembers.length).to.equal(count);

        // Verify voting power
        const totalVotingPower = await spaceVotingPower.getTotalVotingPower(
          spaceId,
        );
        expect(totalVotingPower).to.equal(count);
      }
    });
  });

  describe('Proposal Creation and Basic Functionality', function () {
    it('Should create proposals and track them correctly', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 3,
      });

      // Create proposal
      const proposalId = await createTestProposal(spaceId, owner);

      // Verify proposal details
      const proposalCore = await daoProposals.getProposalCore(proposalId);
      expect(proposalCore.spaceId).to.equal(spaceId);
      expect(proposalCore.creator).to.equal(owner.address);
      expect(proposalCore.executed).to.equal(false);
      expect(proposalCore.expired).to.equal(false);
      expect(proposalCore.yesVotes).to.equal(0);
      expect(proposalCore.noVotes).to.equal(0);
      expect(proposalCore.totalVotingPowerAtSnapshot).to.equal(3);

      console.log(
        `✅ Created proposal ${proposalId} with proper initial state`,
      );
    });

    it('Should prevent non-members from creating proposals', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 2,
      });

      // Try to create proposal with non-member
      const nonMember = members[5]; // This member wasn't added to the space

      await expect(createTestProposal(spaceId, nonMember)).to.be.revertedWith(
        'Not a space member',
      );

      console.log('✅ Non-members correctly prevented from creating proposals');
    });
  });

  describe('Voting with Different Quorum Settings', function () {
    const quorumTests = [
      {
        quorum: 25,
        memberCount: 4,
        description: '25% quorum (1 of 4 members)',
      },
      {
        quorum: 50,
        memberCount: 4,
        description: '50% quorum (2 of 4 members)',
      },
      {
        quorum: 75,
        memberCount: 4,
        description: '75% quorum (3 of 4 members)',
      },
      {
        quorum: 100,
        memberCount: 4,
        description: '100% quorum (4 of 4 members)',
      },
    ];

    quorumTests.forEach(({ quorum, memberCount, description }) => {
      it(`Should handle ${description}`, async function () {
        const { spaceId } = await createSpace({
          unity: 60,
          quorum,
          memberCount,
        });

        const proposalId = await createTestProposal(spaceId, owner);

        // Calculate required quorum votes (using ceiling division)
        const requiredQuorum = Math.ceil((quorum * memberCount) / 100);

        console.log(`\n--- Testing ${description} ---`);
        console.log(`Required quorum: ${requiredQuorum} votes`);
        console.log(`Total voting power: ${memberCount}`);

        // Test with insufficient quorum (1 vote less than required)
        if (requiredQuorum > 1) {
          // Vote with requiredQuorum - 1 members
          const insufficientVoters = Array.from(
            { length: requiredQuorum - 1 },
            (_, i) => ({
              member: i === 0 ? owner : members[i - 1],
              support: true,
            }),
          );

          await voteOnProposal(proposalId, insufficientVoters);

          const proposalAfterInsufficientVotes =
            await daoProposals.getProposalCore(proposalId);
          expect(proposalAfterInsufficientVotes.executed).to.equal(false);

          console.log(
            `✅ Proposal correctly NOT executed with ${insufficientVoters.length} votes (insufficient quorum)`,
          );
        }

        // Add one more vote to meet quorum and unity
        const finalVoterIndex = requiredQuorum - 1;
        const finalVoter =
          finalVoterIndex === 0 ? owner : members[finalVoterIndex - 1];
        await daoProposals.connect(finalVoter).vote(proposalId, true);

        const finalProposal = await daoProposals.getProposalCore(proposalId);
        const totalVotesCast =
          Number(finalProposal.yesVotes) + Number(finalProposal.noVotes);

        console.log(`Final votes cast: ${totalVotesCast}`);
        console.log(`Quorum reached: ${totalVotesCast >= requiredQuorum}`);
        console.log(
          `Unity reached: ${
            (Number(finalProposal.yesVotes) * 100) / totalVotesCast >= 60
          }`,
        );

        // Should be executed if both quorum and unity are met
        if (
          totalVotesCast >= requiredQuorum &&
          (Number(finalProposal.yesVotes) * 100) / totalVotesCast >= 60
        ) {
          expect(finalProposal.executed).to.equal(true);
          console.log(
            `✅ Proposal correctly executed with sufficient quorum and unity`,
          );
        } else {
          expect(finalProposal.executed).to.equal(false);
          console.log(
            `✅ Proposal correctly NOT executed (quorum or unity not met)`,
          );
        }
      });
    });
  });

  describe('Voting with Different Unity Settings', function () {
    const unityTests = [
      { unity: 51, description: 'Simple majority (51%)' },
      { unity: 60, description: 'Supermajority (60%)' },
      { unity: 75, description: 'Strong majority (75%)' },
      { unity: 90, description: 'Near consensus (90%)' },
    ];

    unityTests.forEach(({ unity, description }) => {
      it(`Should handle ${description} unity requirement`, async function () {
        const memberCount = 5;
        const { spaceId } = await createSpace({
          unity,
          quorum: 60, // 60% quorum = 3 of 5 members
          memberCount,
        });

        console.log(`\n--- Testing ${description} ---`);

        // Test scenario where quorum is met but unity is not
        const proposalId = await createTestProposal(spaceId, owner);

        // Vote with 3 members (meets 60% quorum)
        // Test different yes/no combinations
        await daoProposals.connect(owner).vote(proposalId, true); // 1 yes
        await daoProposals.connect(members[0]).vote(proposalId, true); // 2 yes
        await daoProposals.connect(members[1]).vote(proposalId, false); // 1 no

        let proposalState = await daoProposals.getProposalCore(proposalId);
        let yesVotes = Number(proposalState.yesVotes);
        let noVotes = Number(proposalState.noVotes);
        let totalVotesCast = yesVotes + noVotes;
        let currentUnity = (yesVotes * 100) / totalVotesCast;

        console.log(`After 3 votes: ${yesVotes} yes, ${noVotes} no`);
        console.log(`Current unity: ${currentUnity.toFixed(1)}%`);
        console.log(`Required unity: ${unity}%`);

        if (currentUnity >= unity) {
          expect(proposalState.executed).to.equal(true);
          console.log(`✅ Proposal executed (unity threshold met)`);
        } else {
          expect(proposalState.executed).to.equal(false);
          console.log(`✅ Proposal not executed (unity threshold not met)`);

          // Add more yes votes to reach unity threshold
          const additionalYesVotesNeeded = Math.ceil(
            (unity * totalVotesCast) / 100 - yesVotes,
          );
          console.log(
            `Additional yes votes needed: ${additionalYesVotesNeeded}`,
          );

          if (additionalYesVotesNeeded > 0 && members.length > 2) {
            // Add one more yes vote
            await daoProposals.connect(members[2]).vote(proposalId, true);

            proposalState = await daoProposals.getProposalCore(proposalId);
            yesVotes = Number(proposalState.yesVotes);
            noVotes = Number(proposalState.noVotes);
            totalVotesCast = yesVotes + noVotes;
            currentUnity = (yesVotes * 100) / totalVotesCast;

            console.log(
              `After additional vote: ${yesVotes} yes, ${noVotes} no`,
            );
            console.log(`Updated unity: ${currentUnity.toFixed(1)}%`);

            if (currentUnity >= unity) {
              expect(proposalState.executed).to.equal(true);
              console.log(
                `✅ Proposal executed after reaching unity threshold`,
              );
            }
          }
        }
      });
    });
  });

  describe('Complex Voting Scenarios', function () {
    it('Should handle edge case: exactly meeting quorum and unity thresholds', async function () {
      // Test with 10 members, 51% quorum (6 votes), 60% unity
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 51,
        memberCount: 10,
      });

      const proposalId = await createTestProposal(spaceId, owner);

      // Cast exactly 6 votes (51% of 10 = 5.1, rounded up to 6)
      // With 4 yes votes and 2 no votes (66.7% unity, which exceeds 60%)
      const voters = [
        { member: owner, support: true },
        { member: members[0], support: true },
        { member: members[1], support: true },
        { member: members[2], support: true },
        { member: members[3], support: false },
        { member: members[4], support: false },
      ];

      await voteOnProposal(proposalId, voters);

      const proposalState = await daoProposals.getProposalCore(proposalId);
      const yesVotes = Number(proposalState.yesVotes);
      const noVotes = Number(proposalState.noVotes);
      const totalVotesCast = yesVotes + noVotes;
      const unity = (yesVotes * 100) / totalVotesCast;

      console.log(`\n--- Edge Case Test ---`);
      console.log(`Total members: 10`);
      console.log(
        `Votes cast: ${totalVotesCast} (${yesVotes} yes, ${noVotes} no)`,
      );
      console.log(`Unity: ${unity.toFixed(1)}%`);
      console.log(`Required quorum: 51% (6 votes)`);
      console.log(`Required unity: 60%`);

      expect(totalVotesCast).to.equal(6);
      expect(unity).to.be.greaterThanOrEqual(60);
      expect(proposalState.executed).to.equal(true);

      console.log(
        `✅ Proposal correctly executed when exactly meeting both thresholds`,
      );
    });

    it('Should handle proposal rejection through NO votes', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 4,
      });

      const proposalId = await createTestProposal(spaceId, owner);

      // Vote with enough participation for quorum but majority NO votes
      // With 60% unity threshold, the proposal will be rejected when NO votes >= 60%
      await daoProposals.connect(owner).vote(proposalId, false); // NO
      await daoProposals.connect(members[0]).vote(proposalId, false); // NO

      // Check state after 2 NO votes (100% NO, exceeds 60% unity threshold)
      let proposalState = await daoProposals.getProposalCore(proposalId);
      let yesVotes = Number(proposalState.yesVotes);
      let noVotes = Number(proposalState.noVotes);
      let totalVotesCast = yesVotes + noVotes;

      console.log(`\n--- Rejection Test ---`);
      console.log(`After 2 votes: ${yesVotes} yes, ${noVotes} no`);
      console.log(`NO vote percentage: ${(noVotes * 100) / totalVotesCast}%`);

      // The proposal should be automatically rejected due to NO votes exceeding unity threshold
      expect(totalVotesCast).to.equal(2); // Quorum met (50% of 4 = 2)
      expect(noVotes).to.equal(2);
      expect(proposalState.executed).to.equal(false);
      expect(proposalState.expired).to.equal(true); // Should be marked as expired/rejected

      // Try to vote on expired proposal (should fail)
      await expect(
        daoProposals.connect(members[1]).vote(proposalId, false),
      ).to.be.revertedWith('Proposal has expired');

      console.log(`✅ Proposal correctly rejected due to majority NO votes`);
      console.log(
        `✅ Additional voting on rejected proposal correctly prevented`,
      );
    });

    it('Should prevent double voting', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 3,
      });

      const proposalId = await createTestProposal(spaceId, owner);

      // First vote
      await daoProposals.connect(owner).vote(proposalId, true);

      // Attempt second vote from same member
      await expect(
        daoProposals.connect(owner).vote(proposalId, false),
      ).to.be.revertedWith('Already voted');

      console.log(`✅ Double voting correctly prevented`);
    });

    it('Should prevent voting by non-members', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 2,
      });

      const proposalId = await createTestProposal(spaceId, owner);
      const nonMember = members[5]; // Not added to space

      await expect(
        daoProposals.connect(nonMember).vote(proposalId, true),
      ).to.be.revertedWith('Not a space member');

      console.log(`✅ Non-member voting correctly prevented`);
    });
  });

  describe('Specific Configuration Tests', function () {
    it('Should handle 20% unity, 80% quorum with 3 members (requires all 3 to vote, only 1 YES needed)', async function () {
      const { spaceId } = await createSpace({
        unity: 20, // Only 20% of votes cast need to be YES
        quorum: 80, // 80% of members must participate (3 of 3 members)
        memberCount: 3,
        name: 'Low Unity High Quorum Test',
      });

      const proposalId = await createTestProposal(spaceId, owner);

      console.log(`\n--- 20% Unity, 80% Quorum Test ---`);
      console.log(`3 members, need 3 votes for quorum (80% of 3 = 3)`);
      console.log(`Unity = YES votes / total votes cast (only 20% needed)`);

      // Test with insufficient quorum (only 1 vote)
      await daoProposals.connect(owner).vote(proposalId, true);

      let proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.executed).to.equal(false);
      console.log(
        `✅ 1 vote: Unity = 1/1 = 100% (exceeds 20%), but quorum not met (1 < 3)`,
      );

      // Test with insufficient quorum (only 2 votes)
      await daoProposals.connect(members[0]).vote(proposalId, false);

      proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.executed).to.equal(false);
      console.log(
        `✅ 2 votes: Unity = 1/2 = 50% (exceeds 20%), but quorum not met (2 < 3)`,
      );

      // Test with sufficient quorum (3 votes) and sufficient unity
      await daoProposals.connect(members[1]).vote(proposalId, false);

      proposalState = await daoProposals.getProposalCore(proposalId);
      const yesVotes = Number(proposalState.yesVotes);
      const noVotes = Number(proposalState.noVotes);
      const totalVotesCast = yesVotes + noVotes;
      const actualUnity = (yesVotes * 100) / totalVotesCast;

      console.log(
        `Final result: ${yesVotes} yes, ${noVotes} no (${totalVotesCast} total)`,
      );
      console.log(
        `Unity: ${yesVotes}/${totalVotesCast} = ${actualUnity.toFixed(
          1,
        )}% (required: 20%)`,
      );
      console.log(
        `Quorum: ${totalVotesCast}/3 = ${((totalVotesCast * 100) / 3).toFixed(
          1,
        )}% (required: 80%)`,
      );

      expect(totalVotesCast).to.equal(3);
      expect(actualUnity).to.be.greaterThanOrEqual(20);
      expect(proposalState.executed).to.equal(true);

      console.log(
        `✅ Proposal executed: quorum met (3/3) and unity met (33.3% > 20%)`,
      );
    });

    it('Should handle 20% quorum, 80% unity with 3 members (1 YES vote executes immediately)', async function () {
      const { spaceId } = await createSpace({
        unity: 80, // 80% of votes cast need to be YES
        quorum: 20, // Only 20% of members must participate (1 of 3 members)
        memberCount: 3,
        name: 'High Unity Low Quorum Test',
      });

      const proposalId = await createTestProposal(spaceId, owner);

      console.log(`\n--- 80% Unity, 20% Quorum Test ---`);
      console.log(`3 members, need 1 vote for quorum (20% of 3 = 1)`);
      console.log(`Unity = YES votes / total votes cast (80% needed)`);

      // Test with 1 YES vote (meets both quorum and unity)
      await daoProposals.connect(owner).vote(proposalId, true);

      const proposalState = await daoProposals.getProposalCore(proposalId);
      const yesVotes = Number(proposalState.yesVotes);
      const noVotes = Number(proposalState.noVotes);
      const totalVotesCast = yesVotes + noVotes;
      const actualUnity = (yesVotes * 100) / totalVotesCast;

      console.log(
        `Result: ${yesVotes} yes, ${noVotes} no (${totalVotesCast} total)`,
      );
      console.log(
        `Unity: ${yesVotes}/${totalVotesCast} = ${actualUnity.toFixed(
          1,
        )}% (required: 80%)`,
      );
      console.log(
        `Quorum: ${totalVotesCast}/3 = ${((totalVotesCast * 100) / 3).toFixed(
          1,
        )}% (required: 20%)`,
      );

      expect(totalVotesCast).to.equal(1);
      expect(actualUnity).to.equal(100); // 1 YES vote out of 1 total = 100%
      expect(proposalState.executed).to.equal(true);

      console.log(
        `✅ Proposal executed immediately: quorum met (1/3) and unity met (100% > 80%)`,
      );
    });

    it('Should demonstrate unity calculation with mixed YES/NO votes', async function () {
      const { spaceId } = await createSpace({
        unity: 60, // 60% of votes cast need to be YES
        quorum: 40, // 40% of members must participate (2 of 5 members)
        memberCount: 5,
        name: 'Unity Demonstration Test',
      });

      const proposalId = await createTestProposal(spaceId, owner);

      console.log(`\n--- Unity Calculation Demonstration ---`);
      console.log(`5 members, need 2 votes for quorum (40% of 5 = 2)`);
      console.log(`Unity = YES votes / total votes cast (60% needed)`);

      // Vote 1: YES (100% unity)
      await daoProposals.connect(owner).vote(proposalId, true);
      let proposalState = await daoProposals.getProposalCore(proposalId);
      let yesVotes = Number(proposalState.yesVotes);
      let totalVotesCast = yesVotes + Number(proposalState.noVotes);
      console.log(
        `After vote 1: ${yesVotes}/${totalVotesCast} = ${(
          (yesVotes / totalVotesCast) *
          100
        ).toFixed(1)}% unity`,
      );

      // Vote 2: NO (50% unity, below 60% threshold)
      await daoProposals.connect(members[0]).vote(proposalId, false);
      proposalState = await daoProposals.getProposalCore(proposalId);
      yesVotes = Number(proposalState.yesVotes);
      totalVotesCast = yesVotes + Number(proposalState.noVotes);
      console.log(
        `After vote 2: ${yesVotes}/${totalVotesCast} = ${(
          (yesVotes / totalVotesCast) *
          100
        ).toFixed(1)}% unity (< 60%, not executed)`,
      );
      expect(proposalState.executed).to.equal(false);

      // Vote 3: YES (66.7% unity, above 60% threshold)
      await daoProposals.connect(members[1]).vote(proposalId, true);
      proposalState = await daoProposals.getProposalCore(proposalId);
      yesVotes = Number(proposalState.yesVotes);
      totalVotesCast = yesVotes + Number(proposalState.noVotes);
      const finalUnity = (yesVotes / totalVotesCast) * 100;
      console.log(
        `After vote 3: ${yesVotes}/${totalVotesCast} = ${finalUnity.toFixed(
          1,
        )}% unity (> 60%, executed!)`,
      );

      expect(totalVotesCast).to.equal(3);
      expect(finalUnity).to.be.greaterThanOrEqual(60);
      expect(proposalState.executed).to.equal(true);

      console.log(
        `✅ Unity calculation works correctly: executes when YES% exceeds threshold`,
      );
    });
  });

  describe('Stress Tests with Different Member Counts', function () {
    const stressTests = [
      {
        memberCount: 2,
        unity: 51,
        quorum: 51,
        scenario: 'Small group consensus',
      },
      {
        memberCount: 5,
        unity: 60,
        quorum: 40,
        scenario: 'Medium group with low quorum',
      },
      {
        memberCount: 10,
        unity: 75,
        quorum: 60,
        scenario: 'Large group with high requirements',
      },
      {
        memberCount: 15,
        unity: 51,
        quorum: 67,
        scenario: 'Very large group with high quorum',
      },
    ];

    stressTests.forEach(({ memberCount, unity, quorum, scenario }) => {
      it(`Should handle ${scenario} (${memberCount} members, ${unity}% unity, ${quorum}% quorum)`, async function () {
        const { spaceId } = await createSpace({
          unity,
          quorum,
          memberCount,
          name: scenario,
        });

        console.log(`\n--- ${scenario} ---`);
        console.log(
          `Members: ${memberCount}, Unity: ${unity}%, Quorum: ${quorum}%`,
        );

        const proposalId = await createTestProposal(spaceId, owner);

        // Calculate requirements
        const requiredQuorum = Math.ceil((quorum * memberCount) / 100);
        const minimumYesForUnity = Math.ceil((unity * requiredQuorum) / 100);

        console.log(`Required quorum: ${requiredQuorum} votes`);
        console.log(
          `Minimum YES votes for ${unity}% unity: ${minimumYesForUnity}`,
        );

        // Vote with exact minimum to pass
        const voters = [];

        // Add YES voters
        for (let i = 0; i < minimumYesForUnity; i++) {
          const voter = i === 0 ? owner : members[i - 1];
          voters.push({ member: voter, support: true });
        }

        // Add NO voters to reach quorum
        for (let i = minimumYesForUnity; i < requiredQuorum; i++) {
          const voter = i === 0 ? owner : members[i - 1];
          voters.push({ member: voter, support: false });
        }

        await voteOnProposal(proposalId, voters);

        const proposalState = await daoProposals.getProposalCore(proposalId);
        const yesVotes = Number(proposalState.yesVotes);
        const noVotes = Number(proposalState.noVotes);
        const totalVotesCast = yesVotes + noVotes;
        const actualUnity = (yesVotes * 100) / totalVotesCast;

        console.log(`Final result: ${yesVotes} yes, ${noVotes} no`);
        console.log(`Actual unity: ${actualUnity.toFixed(1)}%`);
        console.log(`Executed: ${proposalState.executed}`);

        expect(totalVotesCast).to.equal(requiredQuorum);

        if (actualUnity >= unity) {
          expect(proposalState.executed).to.equal(true);
          console.log(`✅ Proposal passed as expected`);
        } else {
          expect(proposalState.executed).to.equal(false);
          console.log(`✅ Proposal failed as expected (unity not met)`);
        }
      });
    });
  });

  describe('Proposal Expiration', function () {
    it('Should handle proposal expiration correctly', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 3,
      });

      // Create proposal with very short duration
      const proposalCalldata = daoSpaceFactory.interface.encodeFunctionData(
        'getSpaceDetails',
        [spaceId],
      );

      const proposalParams = {
        spaceId,
        duration: 1, // 1 second duration
        transactions: [
          {
            target: await daoSpaceFactory.getAddress(),
            value: 0,
            data: proposalCalldata,
          },
        ],
      };

      await daoProposals.connect(owner).createProposal(proposalParams);
      const proposalId = await daoProposals.proposalCounter();

      // Wait for proposal to expire
      await ethers.provider.send('evm_increaseTime', [2]);
      await ethers.provider.send('evm_mine', []);

      // Check expiration
      await daoProposals.checkProposalExpiration(proposalId);

      const proposalState = await daoProposals.getProposalCore(proposalId);
      expect(proposalState.expired).to.equal(true);
      expect(proposalState.executed).to.equal(false);

      // Try to vote on expired proposal
      await expect(
        daoProposals.connect(owner).vote(proposalId, true),
      ).to.be.revertedWith('Proposal has expired');

      console.log(`✅ Proposal expiration handled correctly`);
    });
  });

  describe('Comprehensive Scenario Testing', function () {
    it('Should handle multiple concurrent proposals in the same space', async function () {
      const { spaceId } = await createSpace({
        unity: 60,
        quorum: 50,
        memberCount: 5,
      });

      // Create 3 concurrent proposals
      const proposal1Id = await createTestProposal(spaceId, owner);
      const proposal2Id = await createTestProposal(spaceId, members[0]);
      const proposal3Id = await createTestProposal(spaceId, members[1]);

      console.log(`\n--- Multiple Proposals Test ---`);
      console.log(
        `Created proposals: ${proposal1Id}, ${proposal2Id}, ${proposal3Id}`,
      );

      // Vote differently on each proposal
      // Proposal 1: Pass (3 yes, 0 no)
      await daoProposals.connect(owner).vote(proposal1Id, true);
      await daoProposals.connect(members[0]).vote(proposal1Id, true);
      await daoProposals.connect(members[1]).vote(proposal1Id, true);

      // Proposal 2: Fail (1 yes, 2 no)
      await daoProposals.connect(owner).vote(proposal2Id, true);
      await daoProposals.connect(members[0]).vote(proposal2Id, false);
      await daoProposals.connect(members[1]).vote(proposal2Id, false);

      // Proposal 3: Don't reach quorum (only 1 vote)
      await daoProposals.connect(owner).vote(proposal3Id, true);

      // Check results
      const proposal1State = await daoProposals.getProposalCore(proposal1Id);
      const proposal2State = await daoProposals.getProposalCore(proposal2Id);
      const proposal3State = await daoProposals.getProposalCore(proposal3Id);

      expect(proposal1State.executed).to.equal(true);
      expect(proposal2State.executed).to.equal(false);
      expect(proposal2State.expired).to.equal(true); // Rejected due to majority NO
      expect(proposal3State.executed).to.equal(false);
      expect(proposal3State.expired).to.equal(false); // Still active, just low participation

      console.log(`✅ Multiple proposals handled correctly`);
      console.log(`   Proposal 1: Executed (unanimous)`);
      console.log(`   Proposal 2: Rejected (majority NO)`);
      console.log(`   Proposal 3: Pending (insufficient quorum)`);
    });
  });
});
