import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SpaceHelper } from './helpers/SpaceHelper';

describe('DAOSpaceFactoryImplementation - removeMember', function () {
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

    // Deploy a dummy proposalManager (TokenVotingPower used elsewhere in tests)
    const TokenVotingPower = await ethers.getContractFactory(
      'TokenVotingPowerImplementation',
    );
    const tokenVotingPower = await upgrades.deployProxy(
      TokenVotingPower,
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

    // Wire contracts
    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await tokenVotingPower.getAddress(),
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
      joinMethodDirectory,
      exitMethodDirectory,
      tokenVotingPower,
      spaceHelper,
    };
  }

  it('Owner can remove a member regardless of exit method', async function () {
    const { owner, other, daoSpaceFactory } = await loadFixture(deployFixture);

    // Create space with exit method 2 (no implementation registered)
    const spaceParams = {
      name: 'Owner Removal Space',
      description: 'Owner can remove',
      imageUrl: 'https://test.com/img.png',
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 2, // not method 1; exitcheck would fail for non-owner
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

    // other joins
    await daoSpaceFactory.connect(other).joinSpace(spaceId);
    expect(await daoSpaceFactory.isMember(spaceId, other.address)).to.equal(
      true,
    );

    // Owner removes 'other' (should bypass exit checks)
    await expect(
      daoSpaceFactory.connect(owner).removeMember(spaceId, other.address),
    )
      .to.emit(daoSpaceFactory, 'MemberRemoved')
      .withArgs(spaceId, other.address);

    expect(await daoSpaceFactory.isMember(spaceId, other.address)).to.equal(
      false,
    );
  });

  it('Executor can remove a member when exit method is 1', async function () {
    const { owner, other, daoSpaceFactory } = await loadFixture(deployFixture);

    // Create space with exit method 1 (executor-only)
    const spaceParams = {
      name: 'Executor Removal Space',
      description: 'Executor can remove',
      imageUrl: 'https://test.com/img.png',
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
    const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

    // other joins
    await daoSpaceFactory.connect(other).joinSpace(spaceId);
    expect(await daoSpaceFactory.isMember(spaceId, other.address)).to.equal(
      true,
    );

    // Get executor and impersonate
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    await ethers.provider.send('hardhat_impersonateAccount', [executorAddress]);
    const executorSigner = await ethers.getSigner(executorAddress);

    // Fund executor for tx gas
    await owner.sendTransaction({
      to: executorAddress,
      value: ethers.parseEther('1'),
    });

    // Executor removes member
    await expect(
      daoSpaceFactory
        .connect(executorSigner)
        .removeMember(spaceId, other.address),
    )
      .to.emit(daoSpaceFactory, 'MemberRemoved')
      .withArgs(spaceId, other.address);

    expect(await daoSpaceFactory.isMember(spaceId, other.address)).to.equal(
      false,
    );
  });

  it('Non-executor cannot remove when exit method is 1', async function () {
    const { daoSpaceFactory, other, voter1 } = await loadFixture(deployFixture);

    // Create space with exit method 1
    const spaceParams = {
      name: 'Unauthorized Removal Space',
      description: 'Should revert',
      imageUrl: 'https://test.com/img.png',
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
    const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

    // other joins
    await daoSpaceFactory.connect(other).joinSpace(spaceId);

    // voter1 tries to remove 'other' -> should revert with executor-only
    await expect(
      daoSpaceFactory.connect(voter1).removeMember(spaceId, other.address),
    ).to.be.revertedWith('Only executor can remove members');
  });

  it('Cannot remove the space creator', async function () {
    const { owner, daoSpaceFactory, voter1 } = await loadFixture(deployFixture);

    // Create space with exit method 1
    const spaceParams = {
      name: 'Creator Removal Guard',
      description: 'Cannot remove creator',
      imageUrl: 'https://test.com/img.png',
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
    const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

    // Owner (creator) exists as member; attempt removal should revert for any caller
    await expect(
      daoSpaceFactory.connect(owner).removeMember(spaceId, owner.address),
    ).to.be.revertedWith('Cannot remove space creator');

    // Also verify executor cannot remove creator
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    await ethers.provider.send('hardhat_impersonateAccount', [executorAddress]);
    const executorSigner = await ethers.getSigner(executorAddress);
    await owner.sendTransaction({
      to: executorAddress,
      value: ethers.parseEther('1'),
    });

    await expect(
      daoSpaceFactory
        .connect(executorSigner)
        .removeMember(spaceId, owner.address),
    ).to.be.revertedWith('Cannot remove space creator');
  });

  it('Non-owner cannot remove for exit method != 1 when exit criteria not met', async function () {
    const { daoSpaceFactory, voter1, other } = await loadFixture(deployFixture);

    // Create space with exit method 2 (no implementation registered => exitcheck false)
    const spaceParams = {
      name: 'Exit Criteria Space',
      description: 'Exit criteria must be met',
      imageUrl: 'https://test.com/img.png',
      unity: 51,
      quorum: 51,
      votingPowerSource: 1,
      exitMethod: 2,
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
    };

    await daoSpaceFactory.createSpace(spaceParams);
    const spaceId = (await daoSpaceFactory.spaceCounter()).toString();

    await daoSpaceFactory.connect(other).joinSpace(spaceId);

    // voter1 tries to remove other -> should fail due to exit criteria not met
    await expect(
      daoSpaceFactory.connect(voter1).removeMember(spaceId, other.address),
    ).to.be.revertedWith('Exit criteria not met');
  });
});
