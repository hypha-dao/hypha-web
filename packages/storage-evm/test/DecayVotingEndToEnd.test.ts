import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * End-to-end tests for decaying-token voting power.
 *
 * These wire up the full governance stack (DAOSpaceFactory + DAOProposals +
 * VotingPowerDirectory + VoteDecayTokenVotingPower + DecayingTokenFactory) and
 * verify that casting a vote goes through the decay source (votingPowerSource
 * id 3), which calls `applyDecayAndGetVotingPower` -> `applyDecay` on the token.
 *
 * The assertions confirm that:
 *  - the recorded vote weight equals the *decayed* balance at vote time, and
 *  - the vote actually *materializes* the decay on-chain (balance burned),
 *  - both for direct votes and for delegated voting power.
 */
describe('Decay voting power — end to end', function () {
  const DECAY_INTERVAL = 3600; // 1 hour
  const DECAY_BP = 1000; // 10% per interval
  const INITIAL = 10000n;

  let daoSpaceFactory: any;
  let daoProposals: any;
  let decayTokenVotingPower: any;
  let decayingTokenFactory: any;
  let votingPowerDelegation: any;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];

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

    // Voting power sources — order matters: the decay source must be id 3,
    // because DAOProposals.vote() materializes decay only when the space's
    // votingPowerSource id == 3.
    const SpaceVotingPower = await ethers.getContractFactory(
      'SpaceVotingPowerImplementation',
    );
    const spaceVotingPower = await upgrades.deployProxy(
      SpaceVotingPower,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );
    await spaceVotingPower.setSpaceFactory(await daoSpaceFactory.getAddress());

    const TokenVotingPower = await ethers.getContractFactory(
      'TokenVotingPowerImplementation',
    );
    const tokenVotingPower = await upgrades.deployProxy(
      TokenVotingPower,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    const VoteDecayTokenVotingPower = await ethers.getContractFactory(
      'VoteDecayTokenVotingPowerImplementation',
    );
    const decayTokenVotingPower = await upgrades.deployProxy(
      VoteDecayTokenVotingPower,
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

    const DecayingTokenFactory = await ethers.getContractFactory(
      'DecayingTokenFactory',
    );
    const decayingTokenFactory = await upgrades.deployProxy(
      DecayingTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    const DecayingSpaceToken = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );
    const decayingTokenImpl = await DecayingSpaceToken.deploy();
    await decayingTokenFactory.setDecayingTokenImplementation(
      await decayingTokenImpl.getAddress(),
    );
    await decayingTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await decayingTokenFactory.setDecayVotingPowerContract(
      await decayTokenVotingPower.getAddress(),
    );

    await decayTokenVotingPower.setSpaceFactory(
      await daoSpaceFactory.getAddress(),
    );
    await decayTokenVotingPower.setDelegationContract(
      await votingPowerDelegation.getAddress(),
    );
    await decayTokenVotingPower.setDecayTokenFactory(
      await decayingTokenFactory.getAddress(),
    );

    // Register sources: 1 = space membership, 2 = token, 3 = decay token.
    await votingPowerDirectory.addVotingPowerSource(
      await spaceVotingPower.getAddress(),
    );
    await votingPowerDirectory.addVotingPowerSource(
      await tokenVotingPower.getAddress(),
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
      decayingTokenFactory,
      votingPowerDelegation,
      owner,
      members,
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    daoSpaceFactory = fixture.daoSpaceFactory;
    daoProposals = fixture.daoProposals;
    decayTokenVotingPower = fixture.decayTokenVotingPower;
    decayingTokenFactory = fixture.decayingTokenFactory;
    votingPowerDelegation = fixture.votingPowerDelegation;
    owner = fixture.owner;
    members = fixture.members;
  });

  /**
   * Creates a space wired to the decay voting source (id 3), deploys a decaying
   * token for it, registers the token, and mints INITIAL to the owner and the
   * first `memberCount` members.
   */
  async function createDecaySpace(memberCount: number) {
    await daoSpaceFactory.createSpace({
      unity: 51,
      quorum: 50,
      votingPowerSource: 3, // decay token voting power
      exitMethod: 1,
      joinMethod: 1,
      access: 0,
      discoverability: 0,
    });
    const spaceId = await daoSpaceFactory.spaceCounter();

    for (let i = 0; i < memberCount; i++) {
      await daoSpaceFactory.connect(members[i]).joinSpace(spaceId);
    }

    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    await owner.sendTransaction({
      to: executorAddress,
      value: ethers.parseEther('1'),
    });
    const executorSigner = await ethers.getImpersonatedSigner(executorAddress);

    const tx = await decayingTokenFactory
      .connect(executorSigner)
      .deployDecayingToken(
        spaceId,
        'Voice Token',
        'VOICE',
        0n, // maxSupply (unlimited)
        false, // transferable
        false, // fixedMaxSupply
        false, // autoMinting
        0n, // tokenPrice
        ethers.ZeroAddress, // priceCurrencyFeed
        false, // useTransferWhitelist
        false, // useReceiveWhitelist
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        DECAY_BP, // decayPercentage
        DECAY_INTERVAL, // decayInterval
        ethers.ZeroAddress, // paymentToken
        0n, // paymentTokenPricePerToken
        0n, // tokensForSale
        0, // purchaseEligibilityMode
        [], // initialPurchaseWhitelistSpaceIds
      );
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log: any) => {
        try {
          return decayingTokenFactory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === 'TokenDeployed');
    const tokenAddress = event.args[1];

    await decayTokenVotingPower
      .connect(executorSigner)
      .setSpaceToken(spaceId, tokenAddress);

    const token = await ethers.getContractAt(
      'DecayingSpaceToken',
      tokenAddress,
    );

    // Mint to owner and members.
    await token.connect(executorSigner).mint(owner.address, INITIAL);
    for (let i = 0; i < memberCount; i++) {
      await token.connect(executorSigner).mint(members[i].address, INITIAL);
    }

    return { spaceId, token, executorSigner };
  }

  async function createProposal(spaceId: bigint, proposer: SignerWithAddress) {
    const data = daoSpaceFactory.interface.encodeFunctionData(
      'getSpaceDetails',
      [spaceId],
    );
    await daoProposals.connect(proposer).createProposal({
      spaceId,
      duration: 86400 * 7,
      transactions: [
        { target: await daoSpaceFactory.getAddress(), value: 0, data },
      ],
    });
    return daoProposals.proposalCounter();
  }

  it('records decayed voting power and materializes the burn on vote', async function () {
    const { spaceId, token } = await createDecaySpace(1);

    const proposalId = await createProposal(spaceId, owner);

    // One full interval passes before the member votes.
    await time.increase(DECAY_INTERVAL);

    // Sanity: balance not yet materialized (no interaction since mint).
    expect(await token.totalSupply()).to.equal(INITIAL * 2n); // owner + member

    await daoProposals.connect(members[0]).vote(proposalId, true);

    const decayed = (INITIAL * 9000n) / 10000n; // 10% decay over one period
    const proposal = await daoProposals.getProposalCore(proposalId);

    // The recorded vote weight equals the decayed balance.
    expect(proposal.yesVotes).to.equal(decayed);
    // And the vote materialized the decay on-chain for the voter.
    expect(await token.balanceOf(members[0].address)).to.equal(decayed);
  });

  it('counts and materializes delegated decayed power on vote', async function () {
    const { spaceId, token } = await createDecaySpace(2);

    // member[0] delegates to member[1].
    await votingPowerDelegation
      .connect(members[0])
      .delegate(members[1].address, spaceId);

    const proposalId = await createProposal(spaceId, owner);

    await time.increase(DECAY_INTERVAL);

    await daoProposals.connect(members[1]).vote(proposalId, true);

    const decayed = (INITIAL * 9000n) / 10000n;
    const proposal = await daoProposals.getProposalCore(proposalId);

    // member[1]'s own decayed power + member[0]'s delegated decayed power.
    expect(proposal.yesVotes).to.equal(decayed * 2n);

    // Both the delegate's and the delegator's balances were materialized.
    expect(await token.balanceOf(members[1].address)).to.equal(decayed);
    expect(await token.balanceOf(members[0].address)).to.equal(decayed);
  });

  it('reflects compounded decay when voting after several intervals', async function () {
    const { spaceId, token } = await createDecaySpace(1);

    const proposalId = await createProposal(spaceId, owner);

    // Three intervals pass before voting.
    await time.increase(DECAY_INTERVAL * 3);

    await daoProposals.connect(members[0]).vote(proposalId, true);

    const decayed =
      (INITIAL * 9000n * 9000n * 9000n) / (10000n * 10000n * 10000n); // 0.9^3
    const proposal = await daoProposals.getProposalCore(proposalId);

    expect(proposal.yesVotes).to.be.closeTo(decayed, 1n);
    expect(await token.balanceOf(members[0].address)).to.be.closeTo(
      decayed,
      1n,
    );
  });

  it('updates the tally correctly when a member re-votes after more decay', async function () {
    const { spaceId, token } = await createDecaySpace(1);

    const proposalId = await createProposal(spaceId, owner);

    // First vote after one interval.
    await time.increase(DECAY_INTERVAL);
    await daoProposals.connect(members[0]).vote(proposalId, true);

    const decayedOnce = (INITIAL * 9000n) / 10000n;
    let proposal = await daoProposals.getProposalCore(proposalId);
    expect(proposal.yesVotes).to.equal(decayedOnce);

    // More decay, then the member switches their vote to NO.
    await time.increase(DECAY_INTERVAL);
    await daoProposals.connect(members[0]).vote(proposalId, false);

    const decayedTwice = (INITIAL * 9000n * 9000n) / (10000n * 10000n);
    proposal = await daoProposals.getProposalCore(proposalId);

    // Previous YES weight removed; NO now holds the further-decayed weight.
    expect(proposal.yesVotes).to.equal(0n);
    expect(proposal.noVotes).to.be.closeTo(decayedTwice, 1n);
    expect(await token.balanceOf(members[0].address)).to.be.closeTo(
      decayedTwice,
      1n,
    );
  });
});
