import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Proposal Unanimous Early Execution', function () {
  let daoSpaceFactory: any;
  let daoProposals: any;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];

  const SEVENTY_TWO_HOURS = 72 * 60 * 60;

  async function deployFixture() {
    const signers = await ethers.getSigners();
    const [owner, ...members] = signers;

    const VotingPowerDelegation = await ethers.getContractFactory(
      'VotingPowerDelegationImplementation',
    );
    const votingPowerDelegation = await upgrades.deployProxy(
      VotingPowerDelegation,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    const DAOSpaceFactory = await ethers.getContractFactory(
      'DAOSpaceFactoryImplementation',
    );
    const daoSpaceFactory = await upgrades.deployProxy(
      DAOSpaceFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

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

    const DAOProposals = await ethers.getContractFactory(
      'DAOProposalsImplementation',
    );
    const daoProposals = await upgrades.deployProxy(
      DAOProposals,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    const SpaceVotingPower = await ethers.getContractFactory(
      'SpaceVotingPowerImplementation',
    );
    const spaceVotingPower = await upgrades.deployProxy(
      SpaceVotingPower,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    const VotingPowerDirectory = await ethers.getContractFactory(
      'VotingPowerDirectoryImplementation',
    );
    const votingPowerDirectory = await upgrades.deployProxy(
      VotingPowerDirectory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    await spaceVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());
    await (spaceVotingPower as any).setDelegationContract(
      await votingPowerDelegation.getAddress(),
    );

    // Space membership voting power source (ID: 1)
    await votingPowerDirectory.addVotingPowerSource(
      await spaceVotingPower.getAddress(),
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

    return { daoSpaceFactory, daoProposals, owner, members };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    daoSpaceFactory = fixture.daoSpaceFactory;
    daoProposals = fixture.daoProposals;
    owner = fixture.owner;
    members = fixture.members;
  });

  // Creates a space with 1-member-1-vote governance. Quorum below 20 forces
  // the default 72h minimum proposal duration inside createProposal.
  async function createSpace(params: {
    unity: number;
    quorum: number;
    memberCount: number;
  }) {
    const { unity, quorum, memberCount } = params;

    await daoSpaceFactory.createSpace({
      unity,
      quorum,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 1,
      access: 0,
      discoverability: 0,
    });
    const spaceId = await daoSpaceFactory.spaceCounter();

    for (let i = 0; i < memberCount - 1; i++) {
      await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
    }

    const spaceMembers = await daoSpaceFactory.getSpaceMembers(spaceId);
    expect(spaceMembers.length).to.equal(memberCount);

    return spaceId;
  }

  async function createTestProposal(
    proposer: SignerWithAddress,
    spaceId: bigint,
  ) {
    const calldata = daoSpaceFactory.interface.encodeFunctionData(
      'getSpaceDetails',
      [spaceId],
    );
    await daoProposals.connect(proposer).createProposal({
      spaceId,
      duration: 3600,
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

  async function getProposalState(proposalId: bigint) {
    const core = await daoProposals.getProposalCore(proposalId);
    return { executed: core[3] as boolean, expired: core[4] as boolean };
  }

  it('executes immediately when all voting power votes yes (unanimous)', async function () {
    const spaceId = await createSpace({
      unity: 51,
      quorum: 10,
      memberCount: 3,
    });
    const proposalId = await createTestProposal(owner, spaceId);

    await daoProposals.connect(owner).vote(proposalId, true);
    await daoProposals.connect(members[0]).vote(proposalId, true);

    // 2 of 3 voted — quorum and unity are met but participation is not full,
    // so the proposal must still wait out the minimum duration
    let state = await getProposalState(proposalId);
    expect(state.executed).to.equal(false);
    expect(state.expired).to.equal(false);

    // Final voter completes 100% unanimous participation — executes instantly
    await expect(
      daoProposals.connect(members[1]).vote(proposalId, true),
    ).to.emit(daoProposals, 'ProposalExecuted');

    state = await getProposalState(proposalId);
    expect(state.executed).to.equal(true);
  });

  it('does not execute early when quorum/unity are met without full participation', async function () {
    const spaceId = await createSpace({
      unity: 51,
      quorum: 10,
      memberCount: 5,
    });
    const proposalId = await createTestProposal(owner, spaceId);

    // 3 of 5 vote yes: 60% participation > 10% quorum, 100% yes > 51% unity
    await daoProposals.connect(owner).vote(proposalId, true);
    await daoProposals.connect(members[0]).vote(proposalId, true);
    await daoProposals.connect(members[1]).vote(proposalId, true);

    const state = await getProposalState(proposalId);
    expect(state.executed).to.equal(false);
    expect(state.expired).to.equal(false);
  });

  it('does not bypass the minimum duration for contested full participation', async function () {
    const spaceId = await createSpace({
      unity: 51,
      quorum: 10,
      memberCount: 3,
    });
    const proposalId = await createTestProposal(owner, spaceId);

    // Full participation but contested: 2 yes, 1 no
    await daoProposals.connect(owner).vote(proposalId, true);
    await daoProposals.connect(members[0]).vote(proposalId, false);
    await daoProposals.connect(members[1]).vote(proposalId, true);

    // Outcome is decided (66% yes > 51% unity) but the reconsideration
    // window must still apply because the vote was not unanimous
    let state = await getProposalState(proposalId);
    expect(state.executed).to.equal(false);
    expect(state.expired).to.equal(false);

    // After the minimum duration the proposal resolves normally
    await time.increase(SEVENTY_TWO_HOURS + 1);
    await daoProposals.connect(owner).triggerExecutionCheck(proposalId);

    state = await getProposalState(proposalId);
    expect(state.executed).to.equal(true);
  });

  it('executes when a dissenting voter flips to yes, making the vote unanimous', async function () {
    const spaceId = await createSpace({
      unity: 51,
      quorum: 10,
      memberCount: 3,
    });
    const proposalId = await createTestProposal(owner, spaceId);

    await daoProposals.connect(owner).vote(proposalId, true);
    await daoProposals.connect(members[0]).vote(proposalId, false);
    await daoProposals.connect(members[1]).vote(proposalId, true);

    let state = await getProposalState(proposalId);
    expect(state.executed).to.equal(false);

    // The no-voter changes their vote to yes — now unanimous, executes instantly
    await expect(
      daoProposals.connect(members[0]).vote(proposalId, true),
    ).to.emit(daoProposals, 'ProposalExecuted');

    state = await getProposalState(proposalId);
    expect(state.executed).to.equal(true);
  });

  it('rejects (not executes) full unanimous-no participation only after the minimum duration', async function () {
    const spaceId = await createSpace({
      unity: 51,
      quorum: 10,
      memberCount: 3,
    });
    const proposalId = await createTestProposal(owner, spaceId);

    await daoProposals.connect(owner).vote(proposalId, false);
    await daoProposals.connect(members[0]).vote(proposalId, false);
    await daoProposals.connect(members[1]).vote(proposalId, false);

    // Unanimous NO must not fast-track — voters keep the window to reconsider
    let state = await getProposalState(proposalId);
    expect(state.executed).to.equal(false);
    expect(state.expired).to.equal(false);

    await time.increase(SEVENTY_TWO_HOURS + 1);
    await daoProposals.connect(owner).triggerExecutionCheck(proposalId);

    state = await getProposalState(proposalId);
    expect(state.executed).to.equal(false);
    expect(state.expired).to.equal(true);
  });

  it('keeps immediate execution for spaces without a minimum duration (quorum >= 20)', async function () {
    const spaceId = await createSpace({
      unity: 51,
      quorum: 50,
      memberCount: 3,
    });
    const proposalId = await createTestProposal(owner, spaceId);

    await daoProposals.connect(owner).vote(proposalId, true);

    // No forced min duration: quorum (66% >= 50%) + unity (100% >= 51%)
    // already execute on the second vote, as before this change
    await expect(
      daoProposals.connect(members[0]).vote(proposalId, true),
    ).to.emit(daoProposals, 'ProposalExecuted');

    const state = await getProposalState(proposalId);
    expect(state.executed).to.equal(true);
  });
});
