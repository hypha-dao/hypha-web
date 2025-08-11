import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SpaceHelper } from './helpers/SpaceHelper';

describe('DAOSpaceFactoryImplementation - Invite System', function () {
  async function deployFixture() {
    const [owner, voter1, voter2, other] = await ethers.getSigners();

    // Deploy JoinMethodDirectory with OpenJoin (method 1)
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

    // Deploy ExitMethodDirectory with NoExit as method 1
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

    // Deploy VotingPowerDirectory for DAOProposals
    const VotingPowerDirectory = await ethers.getContractFactory(
      'VotingPowerDirectoryImplementation',
    );
    const votingPowerDirectory = await upgrades.deployProxy(
      VotingPowerDirectory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy SpaceVotingPower as voting power source 1
    const SpaceVotingPower = await ethers.getContractFactory(
      'SpaceVotingPowerImplementation',
    );
    const spaceVotingPower = await upgrades.deployProxy(
      SpaceVotingPower,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Add voting power source to directory
    await votingPowerDirectory.addVotingPowerSource(
      await spaceVotingPower.getAddress(),
    );

    // Deploy DAOProposals contract for proposal management
    const DAOProposals = await ethers.getContractFactory(
      'DAOProposalsImplementation',
    );
    const daoProposals = await upgrades.deployProxy(
      DAOProposals,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy the main DAOSpaceFactory contract
    const DAOSpaceFactory = await ethers.getContractFactory(
      'DAOSpaceFactoryImplementation',
    );
    const daoSpaceFactory = await upgrades.deployProxy(
      DAOSpaceFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Set space factory on the voting power contract
    await spaceVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());

    // Wire contracts
    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await daoProposals.getAddress(),
    );

    // Set factory in proposals contract
    await daoProposals.setContracts(
      await daoSpaceFactory.getAddress(),
      await votingPowerDirectory.getAddress(),
    );

    // Let directories know about factory
    await joinMethodDirectory.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );
    await exitMethodDirectory.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );

    const spaceHelper = new SpaceHelper(daoSpaceFactory as any);

    return {
      owner,
      voter1,
      voter2,
      other,
      daoSpaceFactory,
      daoProposals,
      joinMethodDirectory,
      exitMethodDirectory,
      votingPowerDirectory,
      spaceVotingPower,
      spaceHelper,
    };
  }

  async function createInviteSpace() {
    const fixture = await loadFixture(deployFixture);
    const { owner, daoSpaceFactory } = fixture;

    // Create space with join method 2 (proposal-based invites)
    const spaceParams = {
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 2, // Proposal-based joining
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = await daoSpaceFactory.spaceCounter();

    return {
      ...fixture,
      spaceId,
    };
  }

  it('Should allow first-time invite proposal creation', async function () {
    const { voter1, daoSpaceFactory, daoProposals, spaceId } =
      await loadFixture(createInviteSpace);

    // Check initial state - no active invite
    const inviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as [bigint, boolean];
    const lastInviteTime = inviteInfo[0];
    const hasActiveProposal = inviteInfo[1];
    expect(lastInviteTime).to.equal(0);
    expect(hasActiveProposal).to.equal(false);

    // Create invite proposal
    await expect(daoSpaceFactory.connect(voter1).joinSpace(spaceId)).to.not.be
      .reverted;

    // Check that invite proposal was created
    const newInviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as [bigint, boolean];
    const newLastInviteTime = newInviteInfo[0];
    const newHasActiveProposal = newInviteInfo[1];
    expect(newLastInviteTime).to.be.greaterThan(0);
    expect(newHasActiveProposal).to.equal(true);

    // Verify proposal was created
    const proposalCounter = await daoProposals.proposalCounter();
    expect(proposalCounter).to.equal(1);
  });

  it('Should prevent creating multiple active invites within 24 hours', async function () {
    const { voter1, daoSpaceFactory, spaceId } = await loadFixture(
      createInviteSpace,
    );

    // Create first invite proposal
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId);
    const inviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as [bigint, boolean];
    const hasActiveProposal = inviteInfo[1];
    expect(hasActiveProposal).to.equal(true);

    // Try to create second invite proposal immediately - should fail
    await expect(
      daoSpaceFactory.connect(voter1).joinSpace(spaceId),
    ).to.be.revertedWith(
      'Active invite proposal exists or must wait 24h between invites',
    );
  });

  it('Should allow creating new invite after 24 hours even with active proposal', async function () {
    const { voter1, daoSpaceFactory, daoProposals, spaceId } =
      await loadFixture(createInviteSpace);

    // Create first invite proposal
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId);

    // Verify first proposal exists
    const firstInviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as [bigint, boolean];
    const firstInviteTime = firstInviteInfo[0];
    const firstHasActive = firstInviteInfo[1];
    expect(firstHasActive).to.equal(true);
    const firstProposalCounter = await daoProposals.proposalCounter();
    expect(firstProposalCounter).to.equal(1);

    // Fast forward time by 24 hours + 1 second
    await time.increase(24 * 60 * 60 + 1);

    // Should be able to create another invite even with active proposal
    await expect(daoSpaceFactory.connect(voter1).joinSpace(spaceId)).to.not.be
      .reverted;

    // Verify second proposal was created
    const secondProposalCounter = await daoProposals.proposalCounter();
    expect(secondProposalCounter).to.equal(2);

    // Check updated invite info
    const secondInviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as [bigint, boolean];
    const secondInviteTime = secondInviteInfo[0];
    const secondHasActive = secondInviteInfo[1];
    expect(secondInviteTime).to.be.greaterThan(firstInviteTime);
    expect(secondHasActive).to.equal(true); // Still has active proposal (the new one)
  });

  it('Should enforce 24-hour cooldown between invites', async function () {
    const { voter1, daoSpaceFactory, spaceId } = await loadFixture(
      createInviteSpace,
    );

    // Create first invite proposal
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId);

    // Fast forward time by 23 hours (not enough)
    await time.increase(23 * 60 * 60);

    // Try to create another invite - should fail due to 24h cooldown
    await expect(
      daoSpaceFactory.connect(voter1).joinSpace(spaceId),
    ).to.be.revertedWith(
      'Active invite proposal exists or must wait 24h between invites',
    );

    // Fast forward to exactly 24 hours
    await time.increase(60 * 60); // Add the remaining 1 hour

    // Now should be able to create new invite
    await expect(daoSpaceFactory.connect(voter1).joinSpace(spaceId)).to.not.be
      .reverted;
  });

  it('Should track invite timestamps correctly', async function () {
    const { voter1, daoSpaceFactory, spaceId } = await loadFixture(
      createInviteSpace,
    );

    const beforeTime = await time.latest();

    // Create invite proposal
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId);

    const afterTime = await time.latest();

    // Check that timestamp was recorded
    const lastInviteTime = await daoSpaceFactory.memberLastInviteTime(
      spaceId,
      voter1.address,
    );
    expect(lastInviteTime).to.be.greaterThanOrEqual(beforeTime);
    expect(lastInviteTime).to.be.lessThanOrEqual(afterTime);
  });

  it('Should allow different members to create invites simultaneously', async function () {
    const { voter1, voter2, daoSpaceFactory, spaceId } = await loadFixture(
      createInviteSpace,
    );

    // Both members create invite proposals
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId);
    await daoSpaceFactory.connect(voter2).joinSpace(spaceId);

    // Both should have active invites
    const voter1InviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as unknown as [bigint, boolean];
    const voter2InviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter2.address,
    )) as unknown as [bigint, boolean];

    expect(voter1InviteInfo[1]).to.equal(true); // hasActiveProposal
    expect(voter2InviteInfo[1]).to.equal(true); // hasActiveProposal

    // Different proposal IDs should be assigned
    const proposal1 = await daoSpaceFactory.memberActiveInviteProposal(
      spaceId,
      voter1.address,
    );
    const proposal2 = await daoSpaceFactory.memberActiveInviteProposal(
      spaceId,
      voter2.address,
    );
    expect(proposal1).to.not.equal(proposal2);
  });

  it('Should prevent members who are already in the space from creating invites', async function () {
    const { owner, daoSpaceFactory, spaceId } = await loadFixture(
      createInviteSpace,
    );

    // Owner is already a member (creator)
    expect(await daoSpaceFactory.isMember(spaceId, owner.address)).to.equal(
      true,
    );

    // Owner should not be able to create invite
    await expect(
      daoSpaceFactory.connect(owner).joinSpace(spaceId),
    ).to.be.revertedWith('member');
  });

  it('Should work correctly with regular join methods', async function () {
    const { voter1, daoSpaceFactory } = await loadFixture(deployFixture);

    // Create space with join method 1 (open join)
    const spaceParams = {
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 1, // Open join
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = await daoSpaceFactory.spaceCounter();

    // Should join immediately without creating proposal
    await expect(daoSpaceFactory.connect(voter1).joinSpace(spaceId))
      .to.emit(daoSpaceFactory, 'MemberJoined')
      .withArgs(spaceId, voter1.address);

    // Verify member was added
    expect(await daoSpaceFactory.isMember(spaceId, voter1.address)).to.equal(
      true,
    );

    // No invite should be tracked for open join
    const inviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId,
      voter1.address,
    )) as unknown as [bigint, boolean];
    expect(inviteInfo[0]).to.equal(0); // lastInviteTime should be 0
    expect(inviteInfo[1]).to.equal(false); // hasActiveProposal should be false
  });

  it('Should handle invite proposals across different spaces independently', async function () {
    const { voter1, daoSpaceFactory } = await loadFixture(deployFixture);

    // Create two spaces with invite system
    const spaceParams = {
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 2,
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId1 = await daoSpaceFactory.spaceCounter();

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId2 = await daoSpaceFactory.spaceCounter();

    // Create invites in both spaces
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId1);
    await daoSpaceFactory.connect(voter1).joinSpace(spaceId2);

    // Both spaces should have active invites
    const space1InviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId1,
      voter1.address,
    )) as unknown as [bigint, boolean];
    const space2InviteInfo = (await daoSpaceFactory.getInviteInfo(
      spaceId2,
      voter1.address,
    )) as unknown as [bigint, boolean];

    expect(space1InviteInfo[1]).to.equal(true); // hasActiveProposal
    expect(space2InviteInfo[1]).to.equal(true); // hasActiveProposal

    // Different proposal IDs
    const proposal1 = await daoSpaceFactory.memberActiveInviteProposal(
      spaceId1,
      voter1.address,
    );
    const proposal2 = await daoSpaceFactory.memberActiveInviteProposal(
      spaceId2,
      voter1.address,
    );
    expect(proposal1).to.not.equal(proposal2);
  });

  it('Should require proposal manager to be set for invite system', async function () {
    const { voter1, daoSpaceFactory } = await loadFixture(deployFixture);

    // Create space with invite system but no proposal manager
    const spaceParams = {
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 2,
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = await daoSpaceFactory.spaceCounter();

    // Clear the proposal manager
    await daoSpaceFactory.setContracts(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
    );

    // Should fail when trying to create invite without proposal manager
    await expect(
      daoSpaceFactory.connect(voter1).joinSpace(spaceId),
    ).to.be.revertedWith('Proposal manager not st');
  });
});
