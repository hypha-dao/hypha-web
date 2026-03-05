import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

describe('SpaceToken + Extensions Tests', function () {
  let spaceTokenFactory: Contract;
  let daoSpaceFactory: Contract;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let executorSigner: SignerWithAddress;
  let spaceId: bigint;

  const BASE_CONFIG = (overrides: any = {}) => ({
    name: overrides.name ?? 'Test Token',
    symbol: overrides.symbol ?? 'TST',
    executor: ethers.ZeroAddress,
    spaceId: 0n,
    spacesContract: ethers.ZeroAddress,
    maxSupply: overrides.maxSupply ?? 0n,
    transferable: overrides.transferable ?? true,
    fixedMaxSupply: overrides.fixedMaxSupply ?? false,
    autoMinting: overrides.autoMinting ?? false,
    tokenPrice: overrides.tokenPrice ?? 0n,
    priceCurrencyFeed: overrides.priceCurrencyFeed ?? ethers.ZeroAddress,
    useTransferWhitelist: overrides.useTransferWhitelist ?? false,
    useReceiveWhitelist: overrides.useReceiveWhitelist ?? false,
    initialTransferWhitelist: overrides.initialTransferWhitelist ?? [],
    initialReceiveWhitelist: overrides.initialReceiveWhitelist ?? [],
    ownershipRestricted: overrides.ownershipRestricted ?? false,
    escrowContract: overrides.escrowContract ?? ethers.ZeroAddress,
  });

  const FEATURE_CONFIG = (overrides: any = {}) => ({
    decayEnabled: overrides.decayEnabled ?? false,
    decayPercentage: overrides.decayPercentage ?? 0n,
    decayInterval: overrides.decayInterval ?? 0n,
    mutualCreditEnabled: overrides.mutualCreditEnabled ?? false,
    defaultCreditLimit: overrides.defaultCreditLimit ?? 0n,
    initialCreditWhitelistSpaceIds:
      overrides.initialCreditWhitelistSpaceIds ?? [],
    ownershipRestricted: overrides.ownershipRestricted ?? false,
    escrowContract: overrides.escrowContract ?? ethers.ZeroAddress,
  });

  async function deployAndSetupFixture() {
    const [owner, alice, bob, charlie] = await ethers.getSigners();

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

    const VotingPowerDirectory = await ethers.getContractFactory(
      'VotingPowerDirectoryImplementation',
    );
    const votingPowerDirectory = await upgrades.deployProxy(
      VotingPowerDirectory,
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
    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await votingPowerDirectory.getAddress(),
    );

    // Deploy DecayLib then DecayExtension implementation
    const DecayLib = await ethers.getContractFactory('DecayLib');
    const decayLib = await DecayLib.deploy();
    const DecayExtension = await ethers.getContractFactory('DecayExtension', {
      libraries: { DecayLib: await decayLib.getAddress() },
    });
    const decayExtImpl = await DecayExtension.deploy();

    // Deploy MutualCreditExtension implementation
    const MutualCreditExtension = await ethers.getContractFactory(
      'MutualCreditExtension',
    );
    const creditExtImpl = await MutualCreditExtension.deploy();

    // Deploy SpaceToken implementation (no library linking needed now!)
    const SpaceToken = await ethers.getContractFactory(
      'contracts/SpaceToken.sol:SpaceToken',
    );
    const spaceTokenImpl = await SpaceToken.deploy();

    // Deploy SpaceTokenFactory
    const SpaceTokenFactory = await ethers.getContractFactory(
      'SpaceTokenFactory',
    );
    const spaceTokenFactory = await upgrades.deployProxy(
      SpaceTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );
    await spaceTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await spaceTokenFactory.setSpaceTokenImplementation(
      await spaceTokenImpl.getAddress(),
    );
    await spaceTokenFactory.setDecayExtensionImplementation(
      await decayExtImpl.getAddress(),
    );
    await spaceTokenFactory.setMutualCreditExtensionImplementation(
      await creditExtImpl.getAddress(),
    );

    // Create a space
    await daoSpaceFactory.createSpace({
      unity: 50,
      quorum: 50,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 1,
      access: 0,
      discoverability: 0,
    });
    const spaceId = await daoSpaceFactory.spaceCounter();
    const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
    const executorAddress = spaceDetails.executor;

    await ethers.provider.send('hardhat_impersonateAccount', [executorAddress]);
    await ethers.provider.send('hardhat_setBalance', [
      executorAddress,
      '0x1000000000000000000',
    ]);
    const executorSigner = await ethers.getSigner(executorAddress);

    return {
      spaceTokenFactory,
      daoSpaceFactory,
      owner,
      alice,
      bob,
      charlie,
      executorSigner,
      spaceId,
    };
  }

  async function deploy(
    baseOverrides: any = {},
    featureOverrides: any = {},
  ): Promise<{ token: Contract; extensions: string[] }> {
    const tx = await spaceTokenFactory
      .connect(executorSigner)
      .deployToken(
        spaceId,
        BASE_CONFIG(baseOverrides),
        FEATURE_CONFIG(featureOverrides),
      );
    const receipt = await tx.wait();
    const ev = receipt?.logs
      .map((log: any) => {
        try {
          return spaceTokenFactory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e: any) => e && e.name === 'TokenDeployed');
    const token = await ethers.getContractAt(
      'contracts/SpaceToken.sol:SpaceToken',
      ev.args.tokenAddress,
    );
    const exts = await token.getExtensions();
    return { token, extensions: exts };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployAndSetupFixture);
    spaceTokenFactory = fixture.spaceTokenFactory;
    daoSpaceFactory = fixture.daoSpaceFactory;
    owner = fixture.owner;
    alice = fixture.alice;
    bob = fixture.bob;
    charlie = fixture.charlie;
    executorSigner = fixture.executorSigner;
    spaceId = fixture.spaceId;
  });

  // ==========================================================================
  // 1. Factory + Extension Deployment
  // ==========================================================================
  describe('1. Factory + Extension Deployment', function () {
    it('Should deploy a basic token with no extensions', async function () {
      const { token, extensions } = await deploy();
      expect(await token.name()).to.equal('Test Token');
      expect(extensions.length).to.equal(0);
      expect(await token.balanceOfModifier()).to.equal(ethers.ZeroAddress);
    });

    it('Should deploy a token with decay extension', async function () {
      const { token, extensions } = await deploy(
        {},
        { decayEnabled: true, decayPercentage: 100n, decayInterval: 3600n },
      );
      expect(extensions.length).to.equal(1);
      expect(await token.isExtension(extensions[0])).to.be.true;
      expect(await token.balanceOfModifier()).to.equal(extensions[0]);

      const decay = await ethers.getContractAt('DecayExtension', extensions[0]);
      expect(await decay.decayPercentage()).to.equal(100n);
      expect(await decay.decayRate()).to.equal(3600n);
      expect(await decay.token()).to.equal(await token.getAddress());
    });

    it('Should deploy a token with mutual credit extension', async function () {
      const { token, extensions } = await deploy(
        {},
        {
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('1000'),
        },
      );
      expect(extensions.length).to.equal(1);
      const credit = await ethers.getContractAt(
        'MutualCreditExtension',
        extensions[0],
      );
      expect(await credit.defaultCreditLimit()).to.equal(
        ethers.parseEther('1000'),
      );
      expect(await credit.token()).to.equal(await token.getAddress());
    });

    it('Should deploy a token with both extensions', async function () {
      const { token, extensions } = await deploy(
        {},
        {
          decayEnabled: true,
          decayPercentage: 100n,
          decayInterval: 3600n,
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('500'),
        },
      );
      expect(extensions.length).to.equal(2);
    });

    it('Should reject deployment from non-executor', async function () {
      await expect(
        spaceTokenFactory
          .connect(alice)
          .deployToken(spaceId, BASE_CONFIG(), FEATURE_CONFIG()),
      ).to.be.revertedWith('Only space executor can deploy tokens');
    });
  });

  // ==========================================================================
  // 2. Base Token
  // ==========================================================================
  describe('2. Base Token', function () {
    it('Should mint and transfer', async function () {
      const { token } = await deploy({ autoMinting: true });
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('100'));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
      await token.connect(alice).transfer(bob.address, ethers.parseEther('40'));
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('40'),
      );
    });

    it('Should enforce whitelists', async function () {
      const { token } = await deploy({
        useTransferWhitelist: true,
        useReceiveWhitelist: true,
      });
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('100'));
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('Sender not whitelisted to transfer');
    });

    it('Should support name/symbol/price changes', async function () {
      const { token } = await deploy({ tokenPrice: 1000000n });
      await token.connect(executorSigner).setTokenName('NewName');
      expect(await token.name()).to.equal('NewName');
      expect(await token.tokenPrice()).to.equal(1000000n);
    });
  });

  // ==========================================================================
  // 3. Decay Extension
  // ==========================================================================
  describe('3. Decay Extension', function () {
    let token: Contract;
    let decay: Contract;

    beforeEach(async function () {
      const result = await deploy(
        {},
        { decayEnabled: true, decayPercentage: 1000n, decayInterval: 3600n },
      );
      token = result.token;
      decay = await ethers.getContractAt(
        'DecayExtension',
        result.extensions[0],
      );
    });

    it('Should return decayed balanceOf', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('900'),
      );
    });

    it('Should materialize decay on transfer', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('100'));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('800'),
      );
    });

    it('Should support explicit applyDecay', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      await expect(decay.applyDecay(alice.address)).to.emit(
        decay,
        'DecayApplied',
      );
    });

    it('Should report getDecayedTotalSupply', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
      expect(await decay.getDecayedTotalSupply()).to.equal(
        ethers.parseEther('1000'),
      );
    });

    it('Should validate decay params on deploy', async function () {
      await expect(
        deploy(
          {},
          { decayEnabled: true, decayPercentage: 0n, decayInterval: 3600n },
        ),
      ).to.be.revertedWith('Invalid decay percentage');
    });
  });

  // ==========================================================================
  // 4. Mutual Credit Extension
  // ==========================================================================
  describe('4. Mutual Credit Extension', function () {
    let token: Contract;
    let credit: Contract;

    beforeEach(async function () {
      const result = await deploy(
        {},
        {
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('1000'),
        },
      );
      token = result.token;
      credit = await ethers.getContractAt(
        'MutualCreditExtension',
        result.extensions[0],
      );
      await credit
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await credit
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));
    });

    it('Should mint credit on deficit', async function () {
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await credit.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('500'),
      );
    });

    it('Should auto-repay credit on receive', async function () {
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      await token
        .connect(bob)
        .transfer(alice.address, ethers.parseEther('300'));
      expect(await credit.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('200'),
      );
    });

    it('Should enforce credit limits', async function () {
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('1500')),
      ).to.be.revertedWith('Insufficient credit');
    });

    it('Should report netBalanceOf', async function () {
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      expect(await credit.netBalanceOf(alice.address)).to.equal(
        ethers.parseEther('-500'),
      );
      expect(await credit.netBalanceOf(bob.address)).to.equal(
        ethers.parseEther('500'),
      );
    });

    it('Should forgive credit', async function () {
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      await credit
        .connect(executorSigner)
        .forgiveCredit(alice.address, ethers.parseEther('200'));
      expect(await credit.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('300'),
      );
    });

    it('Should manage credit whitelist spaces', async function () {
      await daoSpaceFactory.createSpace({
        unity: 50,
        quorum: 50,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        access: 0,
        discoverability: 0,
      });
      const secondSpaceId = await daoSpaceFactory.spaceCounter();

      await credit
        .connect(executorSigner)
        .batchAddCreditWhitelistSpaces([secondSpaceId]);
      expect(await credit.isCreditWhitelistedSpace(secondSpaceId)).to.be.true;

      await credit
        .connect(executorSigner)
        .batchRemoveCreditWhitelistSpaces([secondSpaceId]);
      expect(await credit.isCreditWhitelistedSpace(secondSpaceId)).to.be.false;
    });

    it('Should restrict admin to executor', async function () {
      await expect(
        credit
          .connect(alice)
          .setCreditLimit(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Only executor');
    });
  });

  // ==========================================================================
  // 5. Decay + Mutual Credit Combined
  // ==========================================================================
  describe('5. Decay + Mutual Credit Combined', function () {
    let token: Contract;
    let credit: Contract;

    beforeEach(async function () {
      const result = await deploy(
        {},
        {
          decayEnabled: true,
          decayPercentage: 1000n,
          decayInterval: 3600n,
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('1000'),
        },
      );
      token = result.token;
      // Credit extension is the second one (decay is first)
      credit = await ethers.getContractAt(
        'MutualCreditExtension',
        result.extensions[1],
      );
      await credit
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await credit
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));
    });

    it('Should decay then use credit for the shortfall', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      // Balance decayed to 900, transfer 950 → need 50 credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('950'));
      expect(await credit.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('50'),
      );
      expect(await token.balanceOf(alice.address)).to.equal(0);
    });

    it('Should maintain mutual credit invariant with decay', async function () {
      await credit
        .connect(executorSigner)
        .setCreditLimit(charlie.address, ethers.parseEther('1000'));
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      await ethers.provider.send('evm_increaseTime', [3600]);
      await ethers.provider.send('evm_mine', []);
      await token
        .connect(bob)
        .transfer(charlie.address, ethers.parseEther('500'));

      const totalDebt =
        (await credit.creditBalanceOf(alice.address)) +
        (await credit.creditBalanceOf(bob.address)) +
        (await credit.creditBalanceOf(charlie.address));
      expect(await token.totalSupply()).to.equal(totalDebt);
    });
  });

  // ==========================================================================
  // 6. Ownership Restrictions
  // ==========================================================================
  describe('6. Ownership Restrictions', function () {
    let token: Contract;

    beforeEach(async function () {
      const result = await deploy({}, { ownershipRestricted: true });
      token = result.token;
      await daoSpaceFactory.addMember(spaceId, alice.address);
    });

    it('Should only allow executor to transfer', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('100'));
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('Only executor can transfer tokens');
    });

    it('Should only mint to space members', async function () {
      await expect(
        token
          .connect(executorSigner)
          .mint(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Can only mint to space members or executor');
    });

    it('Should allow executor to transfer to members', async function () {
      await token
        .connect(executorSigner)
        .mint(executorSigner.address, ethers.parseEther('100'));
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('100'));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
    });
  });

  // ==========================================================================
  // 7. Extension Management
  // ==========================================================================
  describe('7. Extension Management', function () {
    it('Should allow executor to add/remove extensions post-deploy', async function () {
      const { token } = await deploy();
      expect((await token.getExtensions()).length).to.equal(0);

      // Deploy a standalone credit extension
      const MutualCreditExtension = await ethers.getContractFactory(
        'MutualCreditExtension',
      );
      const creditExt = await MutualCreditExtension.deploy();
      await creditExt.initialize(ethers.parseEther('500'), []);
      await creditExt.setToken(await token.getAddress());

      await token
        .connect(executorSigner)
        .addExtension(await creditExt.getAddress());
      expect(await token.isExtension(await creditExt.getAddress())).to.be.true;

      await token
        .connect(executorSigner)
        .removeExtension(await creditExt.getAddress());
      expect(await token.isExtension(await creditExt.getAddress())).to.be.false;
    });

    it('Should reject extension management from non-executor', async function () {
      const { token } = await deploy();
      await expect(
        token.connect(alice).addExtension(bob.address),
      ).to.be.revertedWith('Only executor');
    });
  });

  // ==========================================================================
  // 8. Interface Compliance (backward compat)
  // ==========================================================================
  describe('8. Interface Compliance', function () {
    it('Should expose decayPercentage/decayRate via extension', async function () {
      const { extensions } = await deploy(
        {},
        { decayEnabled: true, decayPercentage: 200n, decayInterval: 7200n },
      );
      const decay = await ethers.getContractAt('DecayExtension', extensions[0]);
      expect(await decay.decayPercentage()).to.equal(200n);
      expect(await decay.decayRate()).to.equal(7200n);
    });

    it('Should support burnFrom for vault compat', async function () {
      const { token } = await deploy();
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('100'));
      await token
        .connect(executorSigner)
        .burnFrom(alice.address, ethers.parseEther('50'));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('50'),
      );
    });

    it('Should expose tokenPrice for vault compat', async function () {
      const { token } = await deploy({ tokenPrice: 2000000n });
      expect(await token.tokenPrice()).to.equal(2000000n);
    });
  });

  // ==========================================================================
  // 9. TransferFrom with Credit
  // ==========================================================================
  describe('9. TransferFrom with Credit', function () {
    it('Should support credit via transferFrom', async function () {
      const result = await deploy(
        {},
        {
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('1000'),
        },
      );
      const credit = await ethers.getContractAt(
        'MutualCreditExtension',
        result.extensions[0],
      );
      await credit
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));

      await result.token
        .connect(alice)
        .approve(bob.address, ethers.parseEther('500'));
      await result.token
        .connect(bob)
        .transferFrom(alice.address, charlie.address, ethers.parseEther('500'));

      expect(await credit.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await result.token.balanceOf(charlie.address)).to.equal(
        ethers.parseEther('500'),
      );
    });
  });

  // ==========================================================================
  // 10. Edge Cases
  // ==========================================================================
  describe('10. Edge Cases', function () {
    it('Should deploy multiple tokens per space', async function () {
      await deploy({ name: 'Token A', symbol: 'TA' });
      await deploy(
        { name: 'Token B', symbol: 'TB' },
        { decayEnabled: true, decayPercentage: 100n, decayInterval: 3600n },
      );
      await deploy(
        { name: 'Token C', symbol: 'TC' },
        {
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('500'),
        },
      );
      const tokens = await spaceTokenFactory.getSpaceToken(spaceId);
      expect(tokens.length).to.equal(3);
    });

    it('Should handle zero-amount credit transfer', async function () {
      const result = await deploy(
        {},
        {
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('1000'),
        },
      );
      const credit = await ethers.getContractAt(
        'MutualCreditExtension',
        result.extensions[0],
      );
      await credit
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('100'));
      await result.token.connect(alice).transfer(bob.address, 0);
      expect(await credit.creditBalanceOf(alice.address)).to.equal(0);
    });

    it('Extensions cannot be called directly by non-token', async function () {
      const result = await deploy(
        {},
        {
          mutualCreditEnabled: true,
          defaultCreditLimit: ethers.parseEther('1000'),
        },
      );
      const credit = await ethers.getContractAt(
        'MutualCreditExtension',
        result.extensions[0],
      );
      await expect(
        credit.beforeTransfer(
          alice.address,
          bob.address,
          ethers.parseEther('100'),
        ),
      ).to.be.revertedWith('Only token');
    });
  });
});
