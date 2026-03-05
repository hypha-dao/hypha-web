import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

describe('Mutual Credit Token Tests', function () {
  let mutualCreditTokenFactory: Contract;
  let daoSpaceFactory: Contract;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let dave: SignerWithAddress;
  let executorSigner: SignerWithAddress;
  let spaceId: bigint;

  async function deployAndSetupFixture() {
    const [owner, alice, bob, charlie, dave, ...others] =
      await ethers.getSigners();

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

    // Deploy VotingPowerDirectory
    const VotingPowerDirectory = await ethers.getContractFactory(
      'VotingPowerDirectoryImplementation',
    );
    const votingPowerDirectory = await upgrades.deployProxy(
      VotingPowerDirectory,
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

    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await votingPowerDirectory.getAddress(),
    );

    // Deploy MutualCreditTokenFactory
    const MutualCreditTokenFactory = await ethers.getContractFactory(
      'MutualCreditTokenFactory',
    );
    const mutualCreditTokenFactory = await upgrades.deployProxy(
      MutualCreditTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );
    await mutualCreditTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );

    const MutualCreditSpaceToken = await ethers.getContractFactory(
      'MutualCreditSpaceToken',
    );
    const mutualCreditSpaceTokenImpl = await MutualCreditSpaceToken.deploy();
    await mutualCreditTokenFactory.setMutualCreditTokenImplementation(
      await mutualCreditSpaceTokenImpl.getAddress(),
    );

    // Create a space and get its executor
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
      mutualCreditTokenFactory,
      daoSpaceFactory,
      owner,
      alice,
      bob,
      charlie,
      dave,
      executorSigner,
      spaceId,
    };
  }

  /**
   * Helper: deploy a mutual credit token through the factory and return
   * the token contract instance attached to MutualCreditSpaceToken ABI.
   */
  async function deployMutualCreditToken(
    factory: Contract,
    executor: SignerWithAddress,
    sid: bigint,
    overrides: {
      name?: string;
      symbol?: string;
      maxSupply?: bigint;
      transferable?: boolean;
      fixedMaxSupply?: boolean;
      autoMinting?: boolean;
      tokenPrice?: bigint;
      priceCurrencyFeed?: string;
      useTransferWhitelist?: boolean;
      useReceiveWhitelist?: boolean;
      initialTransferWhitelist?: string[];
      initialReceiveWhitelist?: string[];
      defaultCreditLimit?: bigint;
      initialCreditWhitelistSpaceIds?: bigint[];
    } = {},
  ): Promise<Contract> {
    const tx = await factory.connect(executor).deployMutualCreditToken(
      sid,
      overrides.name ?? 'Mutual Credit',
      overrides.symbol ?? 'MC',
      overrides.maxSupply ?? 0n, // unlimited
      overrides.transferable ?? true,
      overrides.fixedMaxSupply ?? false,
      overrides.autoMinting ?? false,
      overrides.tokenPrice ?? 0n,
      overrides.priceCurrencyFeed ?? ethers.ZeroAddress,
      overrides.useTransferWhitelist ?? false,
      overrides.useReceiveWhitelist ?? false,
      overrides.initialTransferWhitelist ?? [],
      overrides.initialReceiveWhitelist ?? [],
      overrides.defaultCreditLimit ?? ethers.parseEther('1000'),
      overrides.initialCreditWhitelistSpaceIds ?? [],
    );

    const receipt = await tx.wait();
    const tokenDeployedEvent = receipt?.logs
      .map((log: any) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event: any) => event && event.name === 'TokenDeployed');
    const tokenAddress = tokenDeployedEvent.args.tokenAddress;

    return ethers.getContractAt('MutualCreditSpaceToken', tokenAddress);
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployAndSetupFixture);
    mutualCreditTokenFactory = fixture.mutualCreditTokenFactory;
    daoSpaceFactory = fixture.daoSpaceFactory;
    owner = fixture.owner;
    alice = fixture.alice;
    bob = fixture.bob;
    charlie = fixture.charlie;
    dave = fixture.dave;
    executorSigner = fixture.executorSigner;
    spaceId = fixture.spaceId;
  });

  // ==========================================================================
  // 1. Factory Deployment
  // ==========================================================================
  describe('1. Factory Deployment', function () {
    it('Should deploy a mutual credit token via the factory', async function () {
      const token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      expect(await token.name()).to.equal('Mutual Credit');
      expect(await token.symbol()).to.equal('MC');
      expect(await token.executor()).to.equal(executorSigner.address);
      expect(await token.spaceId()).to.equal(spaceId);
      expect(await token.defaultCreditLimit()).to.equal(
        ethers.parseEther('1000'),
      );
    });

    it('Should register the token in factory storage', async function () {
      const token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );
      const tokenAddress = await token.getAddress();

      expect(
        await mutualCreditTokenFactory.isTokenDeployedByFactory(tokenAddress),
      ).to.be.true;

      const tokens = await mutualCreditTokenFactory.getSpaceToken(spaceId);
      expect(tokens.length).to.equal(1);
      expect(tokens[0]).to.equal(tokenAddress);
    });

    it('Should emit TokenDeployed and MutualCreditTokenParameters events', async function () {
      const tx = await mutualCreditTokenFactory
        .connect(executorSigner)
        .deployMutualCreditToken(
          spaceId,
          'MC Token',
          'MCT',
          0,
          true,
          false,
          false,
          0,
          ethers.ZeroAddress,
          false,
          false,
          [],
          [],
          ethers.parseEther('500'),
          [],
        );

      await expect(tx).to.emit(mutualCreditTokenFactory, 'TokenDeployed');
      await expect(tx).to.emit(
        mutualCreditTokenFactory,
        'MutualCreditTokenParameters',
      );
    });

    it('Should reject deployment from non-executor', async function () {
      await expect(
        mutualCreditTokenFactory
          .connect(alice)
          .deployMutualCreditToken(
            spaceId,
            'Bad Token',
            'BAD',
            0,
            true,
            false,
            false,
            0,
            ethers.ZeroAddress,
            false,
            false,
            [],
            [],
            ethers.parseEther('1000'),
            [],
          ),
      ).to.be.revertedWith('Only space executor can deploy tokens');
    });

    it('Should deploy multiple tokens per space', async function () {
      await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        {
          name: 'Token A',
          symbol: 'TA',
        },
      );
      await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        {
          name: 'Token B',
          symbol: 'TB',
        },
      );

      const tokens = await mutualCreditTokenFactory.getSpaceToken(spaceId);
      expect(tokens.length).to.equal(2);
    });
  });

  // ==========================================================================
  // 2. Initialization
  // ==========================================================================
  describe('2. Initialization', function () {
    it('Should initialize all RegularSpaceToken base fields', async function () {
      const token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        {
          maxSupply: ethers.parseEther('50000'),
          transferable: true,
          fixedMaxSupply: true,
          autoMinting: true,
          tokenPrice: 2000000n, // $2.00
        },
      );

      expect(await token.maxSupply()).to.equal(ethers.parseEther('50000'));
      expect(await token.transferable()).to.be.true;
      expect(await token.fixedMaxSupply()).to.be.true;
      expect(await token.autoMinting()).to.be.true;
      expect(await token.tokenPrice()).to.equal(2000000n);
    });

    it('Should initialize credit whitelist spaces from constructor', async function () {
      // Create a second space
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

      const token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        { initialCreditWhitelistSpaceIds: [secondSpaceId] },
      );

      expect(await token.isCreditWhitelistedSpace(secondSpaceId)).to.be.true;
      const spaces = await token.getCreditWhitelistedSpaces();
      expect(spaces.length).to.equal(1);
      expect(spaces[0]).to.equal(secondSpaceId);
    });

    it('Should have zero credit balances initially', async function () {
      const token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      expect(await token.creditBalanceOf(alice.address)).to.equal(0);
      expect(await token.creditBalanceOf(bob.address)).to.equal(0);
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  // ==========================================================================
  // 3. Credit Limit Management
  // ==========================================================================
  describe('3. Credit Limit Management', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );
    });

    it('Should set custom credit limit for an address', async function () {
      await expect(
        token
          .connect(executorSigner)
          .setCreditLimit(alice.address, ethers.parseEther('500')),
      )
        .to.emit(token, 'CreditLimitSet')
        .withArgs(alice.address, ethers.parseEther('500'));

      expect(await token.creditLimitOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.hasCustomCreditLimit(alice.address)).to.be.true;
    });

    it('Should remove custom credit limit', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('500'));

      await expect(
        token.connect(executorSigner).removeCreditLimit(alice.address),
      )
        .to.emit(token, 'CreditLimitRemoved')
        .withArgs(alice.address);

      expect(await token.hasCustomCreditLimit(alice.address)).to.be.false;
      // Without custom limit and no space membership, limit is 0
      expect(await token.creditLimitOf(alice.address)).to.equal(0);
    });

    it('Should update the default credit limit', async function () {
      await expect(
        token
          .connect(executorSigner)
          .setDefaultCreditLimit(ethers.parseEther('2000')),
      )
        .to.emit(token, 'DefaultCreditLimitUpdated')
        .withArgs(ethers.parseEther('1000'), ethers.parseEther('2000'));

      expect(await token.defaultCreditLimit()).to.equal(
        ethers.parseEther('2000'),
      );
    });

    it('Should prioritize custom limit over default', async function () {
      // Default is 1000
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('777'));

      expect(await token.creditLimitOf(alice.address)).to.equal(
        ethers.parseEther('777'),
      );
    });

    it('Should allow setting custom credit limit to zero (explicitly denying credit)', async function () {
      await token.connect(executorSigner).setCreditLimit(alice.address, 0);

      expect(await token.hasCustomCreditLimit(alice.address)).to.be.true;
      expect(await token.creditLimitOf(alice.address)).to.equal(0);
    });

    it('Should only allow executor to set credit limits', async function () {
      await expect(
        token
          .connect(alice)
          .setCreditLimit(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Only executor can set credit limits');
    });

    it('Should only allow executor to remove credit limits', async function () {
      await expect(
        token.connect(alice).removeCreditLimit(bob.address),
      ).to.be.revertedWith('Only executor can remove credit limits');
    });

    it('Should only allow executor to update default credit limit', async function () {
      await expect(
        token.connect(alice).setDefaultCreditLimit(ethers.parseEther('999')),
      ).to.be.revertedWith('Only executor can update default credit limit');
    });
  });

  // ==========================================================================
  // 4. Credit Whitelist Space Management
  // ==========================================================================
  describe('4. Credit Whitelist Space Management', function () {
    /**
     * NOTE: MutualCreditSpaceToken inherits the hardcoded spacesContract address
     * from RegularSpaceToken. In local tests this address doesn't point to our
     * deployed DAOSpaceFactory, so space membership checks won't work.
     * These tests focus on management functions and access control.
     */
    let token: Contract;
    let secondSpaceId: bigint;
    let thirdSpaceId: bigint;

    beforeEach(async function () {
      // Create additional spaces for testing
      await daoSpaceFactory.createSpace({
        unity: 50,
        quorum: 50,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        access: 0,
        discoverability: 0,
      });
      secondSpaceId = await daoSpaceFactory.spaceCounter();

      await daoSpaceFactory.createSpace({
        unity: 50,
        quorum: 50,
        votingPowerSource: 1,
        exitMethod: 1,
        joinMethod: 1,
        access: 0,
        discoverability: 0,
      });
      thirdSpaceId = await daoSpaceFactory.spaceCounter();

      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );
    });

    it('Should add spaces to credit whitelist', async function () {
      await expect(
        token
          .connect(executorSigner)
          .batchAddCreditWhitelistSpaces([secondSpaceId]),
      )
        .to.emit(token, 'CreditWhitelistSpaceAdded')
        .withArgs(secondSpaceId);

      expect(await token.isCreditWhitelistedSpace(secondSpaceId)).to.be.true;
      const spaces = await token.getCreditWhitelistedSpaces();
      expect(spaces.length).to.equal(1);
      expect(spaces[0]).to.equal(secondSpaceId);
    });

    it('Should add multiple spaces', async function () {
      await token
        .connect(executorSigner)
        .batchAddCreditWhitelistSpaces([secondSpaceId, thirdSpaceId]);

      expect(await token.isCreditWhitelistedSpace(secondSpaceId)).to.be.true;
      expect(await token.isCreditWhitelistedSpace(thirdSpaceId)).to.be.true;
      const spaces = await token.getCreditWhitelistedSpaces();
      expect(spaces.length).to.equal(2);
    });

    it('Should not duplicate when adding the same space twice', async function () {
      await token
        .connect(executorSigner)
        .batchAddCreditWhitelistSpaces([secondSpaceId]);

      const tx = await token
        .connect(executorSigner)
        .batchAddCreditWhitelistSpaces([secondSpaceId]);
      const receipt = await tx.wait();

      // No event emitted for duplicate
      const events = receipt?.logs
        .map((log: any) => {
          try {
            return token.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter(
          (event: any) => event && event.name === 'CreditWhitelistSpaceAdded',
        );
      expect(events.length).to.equal(0);

      const spaces = await token.getCreditWhitelistedSpaces();
      expect(spaces.length).to.equal(1);
    });

    it('Should remove spaces from credit whitelist', async function () {
      await token
        .connect(executorSigner)
        .batchAddCreditWhitelistSpaces([secondSpaceId, thirdSpaceId]);

      await expect(
        token
          .connect(executorSigner)
          .batchRemoveCreditWhitelistSpaces([secondSpaceId]),
      )
        .to.emit(token, 'CreditWhitelistSpaceRemoved')
        .withArgs(secondSpaceId);

      expect(await token.isCreditWhitelistedSpace(secondSpaceId)).to.be.false;
      expect(await token.isCreditWhitelistedSpace(thirdSpaceId)).to.be.true;
      const spaces = await token.getCreditWhitelistedSpaces();
      expect(spaces.length).to.equal(1);
    });

    it('Should handle removing a non-whitelisted space gracefully', async function () {
      const tx = await token
        .connect(executorSigner)
        .batchRemoveCreditWhitelistSpaces([secondSpaceId]);
      const receipt = await tx.wait();

      const events = receipt?.logs
        .map((log: any) => {
          try {
            return token.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter(
          (event: any) => event && event.name === 'CreditWhitelistSpaceRemoved',
        );
      expect(events.length).to.equal(0);
    });

    it('Should only allow executor to manage credit whitelist spaces', async function () {
      await expect(
        token.connect(alice).batchAddCreditWhitelistSpaces([secondSpaceId]),
      ).to.be.revertedWith('Only executor can update credit whitelist');

      await expect(
        token.connect(alice).batchRemoveCreditWhitelistSpaces([secondSpaceId]),
      ).to.be.revertedWith('Only executor can update credit whitelist');
    });
  });

  // ==========================================================================
  // 5. Basic Credit Mechanics — transfer creates credit debt
  // ==========================================================================
  describe('5. Basic Credit Mechanics', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      // Give alice and bob custom credit limits
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));
    });

    it('Should mint credit tokens when sender has insufficient balance', async function () {
      // Alice has 0 balance, 1000 credit limit
      expect(await token.balanceOf(alice.address)).to.equal(0);

      // Alice transfers 500 to bob using credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Alice should have 0 balance and 500 credit debt
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );

      // Bob should have 500 balance and 0 credit debt
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.creditBalanceOf(bob.address)).to.equal(0);
    });

    it('Should emit CreditUsed event', async function () {
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('300')),
      )
        .to.emit(token, 'CreditUsed')
        .withArgs(
          alice.address,
          ethers.parseEther('300'),
          ethers.parseEther('300'),
        );
    });

    it('Should use partial credit when sender has some balance', async function () {
      // Executor mints 200 to alice
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('200'));

      // Alice transfers 500 to bob (200 from balance + 300 from credit)
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('300'),
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('500'),
      );
    });

    it('Should not use credit when sender has sufficient balance', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.creditBalanceOf(alice.address)).to.equal(0);
    });

    it('Should track totalSupply as total outstanding credit', async function () {
      // No credit used yet
      expect(await token.totalSupply()).to.equal(0);

      // Alice uses 500 credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // totalSupply should be 500 (the credit-minted tokens that bob holds)
      expect(await token.totalSupply()).to.equal(ethers.parseEther('500'));

      // Bob uses 300 credit to send to charlie
      await token
        .connect(executorSigner)
        .setCreditLimit(charlie.address, ethers.parseEther('1000'));
      await token
        .connect(bob)
        .transfer(charlie.address, ethers.parseEther('800'));

      // Bob used 300 from credit (had 500, sent 800)
      // totalSupply = 500 (Alice's credit) + 300 (Bob's credit) = 800
      expect(await token.totalSupply()).to.equal(ethers.parseEther('800'));
    });

    it('Should work with transferFrom', async function () {
      // Alice approves bob to spend on her behalf
      await token.connect(alice).approve(bob.address, ethers.parseEther('500'));

      // Bob calls transferFrom using Alice's credit
      await token
        .connect(bob)
        .transferFrom(alice.address, charlie.address, ethers.parseEther('500'));

      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.balanceOf(charlie.address)).to.equal(
        ethers.parseEther('500'),
      );
    });
  });

  // ==========================================================================
  // 6. Credit Repayment — auto-repay when receiving tokens
  // ==========================================================================
  describe('6. Credit Repayment', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));
    });

    it('Should auto-repay credit when receiving tokens', async function () {
      // Alice goes into 500 debt
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );

      // Bob sends 300 back to alice → auto-repays 300 of her debt
      await token
        .connect(bob)
        .transfer(alice.address, ethers.parseEther('300'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('200'),
      );
      // 300 tokens were burned on repayment, so alice still has 0 balance
      expect(await token.balanceOf(alice.address)).to.equal(0);
    });

    it('Should emit CreditRepaid event', async function () {
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      await expect(
        token.connect(bob).transfer(alice.address, ethers.parseEther('300')),
      )
        .to.emit(token, 'CreditRepaid')
        .withArgs(
          alice.address,
          ethers.parseEther('300'),
          ethers.parseEther('200'), // remaining debt
        );
    });

    it('Should fully repay credit and leave excess as balance', async function () {
      // Alice uses 200 credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('200'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('200'),
      );

      // Bob sends 500 to alice → 200 repays debt, 300 becomes balance
      await token
        .connect(bob)
        .transfer(alice.address, ethers.parseEther('500'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('300'),
      );
    });

    it('Should reduce totalSupply when credit is repaid', async function () {
      // Alice uses 500 credit → totalSupply = 500
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      expect(await token.totalSupply()).to.equal(ethers.parseEther('500'));

      // Bob sends 500 back → all credit repaid → totalSupply = 0
      await token
        .connect(bob)
        .transfer(alice.address, ethers.parseEther('500'));
      expect(await token.totalSupply()).to.equal(0);
    });

    it('Should handle cross-repayment: both parties use credit then repay each other', async function () {
      // Alice sends 400 to bob via credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('400'));

      // Bob sends 300 to alice via credit (bob has 400 balance + 300 credit = 700 available)
      // Actually bob has 400 balance, so sending 300 doesn't use credit
      await token
        .connect(bob)
        .transfer(alice.address, ethers.parseEther('300'));

      // Alice received 300 which repaid her 400 debt → 100 debt remaining, 0 balance
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
      expect(await token.balanceOf(alice.address)).to.equal(0);

      // Bob had 400, sent 300 → 100 balance, no credit used
      expect(await token.creditBalanceOf(bob.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('100'),
      );

      // totalSupply should equal alice's remaining credit debt
      expect(await token.totalSupply()).to.equal(ethers.parseEther('100'));
    });
  });

  // ==========================================================================
  // 7. Credit Limit Enforcement
  // ==========================================================================
  describe('7. Credit Limit Enforcement', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );
    });

    it('Should revert when transfer exceeds credit limit', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('100'));

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('200')),
      ).to.be.revertedWith('Insufficient credit');
    });

    it('Should revert when cumulative credit usage exceeds limit', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('500'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('500'));

      // First transfer: 300 credit used
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('300'));

      // Second transfer: would need 300 more, but only 200 credit left
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('300')),
      ).to.be.revertedWith('Insufficient credit');
    });

    it('Should allow transfer up to exact credit limit', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('500'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.creditLimitLeftOf(alice.address)).to.equal(0);
    });

    it('Should revert for accounts with no credit limit', async function () {
      // charlie has no custom limit and no space-based eligibility → limit = 0
      await expect(
        token.connect(charlie).transfer(alice.address, ethers.parseEther('1')),
      ).to.be.revertedWith('Insufficient credit');
    });

    it('Should regain credit capacity after repayment', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('500'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('500'));

      // Alice uses all 500 credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
      expect(await token.creditLimitLeftOf(alice.address)).to.equal(0);

      // Bob repays 200
      await token
        .connect(bob)
        .transfer(alice.address, ethers.parseEther('200'));
      expect(await token.creditLimitLeftOf(alice.address)).to.equal(
        ethers.parseEther('200'),
      );

      // Alice can now use 200 more credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('200'));
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
    });
  });

  // ==========================================================================
  // 8. View Functions — creditLimitOf, creditLimitLeftOf, netBalanceOf
  // ==========================================================================
  describe('8. View Functions', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
    });

    it('creditLimitOf should return custom limit when set', async function () {
      expect(await token.creditLimitOf(alice.address)).to.equal(
        ethers.parseEther('1000'),
      );
    });

    it('creditLimitOf should return 0 for unwhitelisted accounts', async function () {
      expect(await token.creditLimitOf(charlie.address)).to.equal(0);
    });

    it('creditLimitLeftOf should return remaining credit', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('400'));

      expect(await token.creditLimitLeftOf(alice.address)).to.equal(
        ethers.parseEther('600'),
      );
    });

    it('creditLimitLeftOf should return 0 when fully used', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('1000'));

      expect(await token.creditLimitLeftOf(alice.address)).to.equal(0);
    });

    it('netBalanceOf should be negative when in debt', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      const netAlice = await token.netBalanceOf(alice.address);
      expect(netAlice).to.equal(ethers.parseEther('-500'));
    });

    it('netBalanceOf should be positive for net creditors', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      const netBob = await token.netBalanceOf(bob.address);
      expect(netBob).to.equal(ethers.parseEther('500'));
    });

    it('netBalanceOf should be zero for uninvolved accounts', async function () {
      expect(await token.netBalanceOf(charlie.address)).to.equal(0);
    });

    it('netBalanceOf sum across all participants should be zero (conservation)', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      const netAlice = await token.netBalanceOf(alice.address);
      const netBob = await token.netBalanceOf(bob.address);
      expect(netAlice + netBob).to.equal(0);
    });
  });

  // ==========================================================================
  // 9. Credit Forgiveness
  // ==========================================================================
  describe('9. Credit Forgiveness', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));

      // Alice goes into 500 debt
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));
    });

    it('Should forgive partial credit', async function () {
      await expect(
        token
          .connect(executorSigner)
          .forgiveCredit(alice.address, ethers.parseEther('200')),
      )
        .to.emit(token, 'CreditForgiven')
        .withArgs(
          alice.address,
          ethers.parseEther('200'),
          ethers.parseEther('300'),
        );

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('300'),
      );
    });

    it('Should forgive full credit', async function () {
      await token
        .connect(executorSigner)
        .forgiveCredit(alice.address, ethers.parseEther('500'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(0);
    });

    it('Should revert when forgiving more than outstanding debt', async function () {
      await expect(
        token
          .connect(executorSigner)
          .forgiveCredit(alice.address, ethers.parseEther('600')),
      ).to.be.revertedWith('Amount exceeds credit balance');
    });

    it('Should only allow executor to forgive credit', async function () {
      await expect(
        token
          .connect(alice)
          .forgiveCredit(alice.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Only executor can forgive credit');
    });

    it('Should not affect totalSupply (tokens remain in circulation)', async function () {
      const supplyBefore = await token.totalSupply();
      await token
        .connect(executorSigner)
        .forgiveCredit(alice.address, ethers.parseEther('200'));
      const supplyAfter = await token.totalSupply();

      // totalSupply doesn't change from forgiveness — the tokens bob holds remain
      expect(supplyAfter).to.equal(supplyBefore);
    });
  });

  // ==========================================================================
  // 10. Integration with Transfer/Receive Whitelists
  // ==========================================================================
  describe('10. Integration with Transfer/Receive Whitelists', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        {
          useTransferWhitelist: true,
          useReceiveWhitelist: true,
        },
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));
    });

    it('Should block credit transfer when sender not on transfer whitelist', async function () {
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Sender not whitelisted to transfer');
    });

    it('Should block credit transfer when receiver not on receive whitelist', async function () {
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Recipient not whitelisted to receive');
    });

    it('Should allow credit transfer when both parties are whitelisted', async function () {
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist([bob.address], [true]);

      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('100'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('100'),
      );
    });

    it('Should allow executor to bypass sender whitelist (receiver must still be whitelisted)', async function () {
      // Executor is always allowed to send, but receiver whitelist still applies
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist([alice.address], [true]);
      await token
        .connect(executorSigner)
        .mint(executorSigner.address, ethers.parseEther('100'));
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('100'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );

      // Executor can always receive without being on the receive whitelist
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);
      await token
        .connect(alice)
        .transfer(executorSigner.address, ethers.parseEther('50'));

      expect(await token.balanceOf(executorSigner.address)).to.equal(
        ethers.parseEther('50'),
      );
    });
  });

  // ==========================================================================
  // 11. Executor Auto-Minting with Credit
  // ==========================================================================
  describe('11. Executor Auto-Minting with Credit', function () {
    it('Should use auto-minting for executor (not credit)', async function () {
      const token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        { autoMinting: true },
      );

      // Executor transfers with no balance → auto-mint, no credit used
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('500'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.creditBalanceOf(executorSigner.address)).to.equal(0);
    });
  });

  // ==========================================================================
  // 12. Transferability and Archive Checks
  // ==========================================================================
  describe('12. Transferability and Archive Checks', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        { transferable: false },
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
    });

    it('Should block credit transfers when not transferable', async function () {
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Token transfers are disabled');
    });

    it('Should allow executor to transfer even when not transferable', async function () {
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

    it('Should block transfers when archived', async function () {
      await token.connect(executorSigner).setTransferable(true);
      await token.connect(executorSigner).setArchived(true);

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('100')),
      ).to.be.revertedWith('Token is archived');
    });
  });

  // ==========================================================================
  // 13. Edge Cases
  // ==========================================================================
  describe('13. Edge Cases', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('1000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('1000'));
    });

    it('Should handle zero-amount transfer with credit', async function () {
      await token.connect(alice).transfer(bob.address, 0);

      expect(await token.creditBalanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(0);
    });

    it('Should handle self-transfer with credit debt', async function () {
      // Alice goes into 500 debt
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Bob has 500, sends to himself → afterCreditTransfer is no-op (no debt)
      await token.connect(bob).transfer(bob.address, ethers.parseEther('100'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.creditBalanceOf(bob.address)).to.equal(0);
    });

    it('Should allow reducing credit limit below current debt (prevents further credit use)', async function () {
      // Alice uses 500 credit
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Reduce her limit to 200 (below current 500 debt)
      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('200'));

      // She still owes 500, but can't use any more credit
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
      expect(await token.creditLimitLeftOf(alice.address)).to.equal(0);

      // Further credit transfer should fail
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('1')),
      ).to.be.revertedWith('Insufficient credit');
    });

    it('Should handle multiple sequential credit operations correctly', async function () {
      await token
        .connect(executorSigner)
        .setCreditLimit(charlie.address, ethers.parseEther('1000'));

      // Round 1: Alice → Bob (500 credit)
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Round 2: Bob → Charlie (800 total: 500 balance + 300 credit)
      await token
        .connect(bob)
        .transfer(charlie.address, ethers.parseEther('800'));

      // Round 3: Charlie → Alice (600 from balance; alice repays 600 but only has 500 debt → repays 500, keeps 100)
      await token
        .connect(charlie)
        .transfer(alice.address, ethers.parseEther('600'));

      expect(await token.creditBalanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
      expect(await token.creditBalanceOf(bob.address)).to.equal(
        ethers.parseEther('300'),
      );
      expect(await token.balanceOf(charlie.address)).to.equal(
        ethers.parseEther('200'),
      );

      // totalSupply = bob's debt (300) = charlie's balance (200) + alice's balance (100)
      expect(await token.totalSupply()).to.equal(ethers.parseEther('300'));
    });

    it('Should handle burnFrom by executor without affecting credit balance', async function () {
      // Alice uses 500 credit → bob has 500
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Executor burns 200 from bob
      await token
        .connect(executorSigner)
        .burnFrom(bob.address, ethers.parseEther('200'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('300'),
      );
      // Alice's debt is unaffected
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
    });

    it('Should handle executor mint to someone with credit debt (auto-repays)', async function () {
      // Alice goes into 500 debt
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Executor mints 300 directly to alice via mint()
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('300'));

      // Direct mint doesn't trigger _afterCreditTransfer (mint bypasses our overrides)
      // Alice should have 300 balance and 500 debt
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('300'),
      );
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('500'),
      );
    });

    it('Should handle executor transfer to someone with credit debt (triggers repayment)', async function () {
      // Alice goes into 500 debt
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      // Executor mints and transfers 300 to alice (triggers _afterCreditTransfer)
      await token
        .connect(executorSigner)
        .mint(executorSigner.address, ethers.parseEther('300'));
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('300'));

      // 300 repaid from 500 debt → 200 remaining, 0 balance
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('200'),
      );
      expect(await token.balanceOf(alice.address)).to.equal(0);
    });
  });

  // ==========================================================================
  // 14. Mutual Credit Invariant — totalSupply always equals sum of credit debts
  // ==========================================================================
  describe('14. Mutual Credit Invariant', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
      );

      await token
        .connect(executorSigner)
        .setCreditLimit(alice.address, ethers.parseEther('2000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(bob.address, ethers.parseEther('2000'));
      await token
        .connect(executorSigner)
        .setCreditLimit(charlie.address, ethers.parseEther('2000'));
    });

    it('Invariant holds through a series of credit transactions', async function () {
      // Step 1: Alice → Bob (500 credit)
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('500'));

      let totalDebt =
        (await token.creditBalanceOf(alice.address)) +
        (await token.creditBalanceOf(bob.address)) +
        (await token.creditBalanceOf(charlie.address));
      expect(await token.totalSupply()).to.equal(totalDebt);

      // Step 2: Bob → Charlie (300, from balance)
      await token
        .connect(bob)
        .transfer(charlie.address, ethers.parseEther('300'));

      totalDebt =
        (await token.creditBalanceOf(alice.address)) +
        (await token.creditBalanceOf(bob.address)) +
        (await token.creditBalanceOf(charlie.address));
      expect(await token.totalSupply()).to.equal(totalDebt);

      // Step 3: Charlie → Alice (400 from balance → 300 from balance + 100 repays alice)
      await token
        .connect(charlie)
        .transfer(alice.address, ethers.parseEther('300'));

      totalDebt =
        (await token.creditBalanceOf(alice.address)) +
        (await token.creditBalanceOf(bob.address)) +
        (await token.creditBalanceOf(charlie.address));
      expect(await token.totalSupply()).to.equal(totalDebt);

      // Step 4: Bob uses credit → Bob (200 balance) sends 500 to charlie
      await token
        .connect(bob)
        .transfer(charlie.address, ethers.parseEther('500'));

      totalDebt =
        (await token.creditBalanceOf(alice.address)) +
        (await token.creditBalanceOf(bob.address)) +
        (await token.creditBalanceOf(charlie.address));
      expect(await token.totalSupply()).to.equal(totalDebt);

      // Step 5: Charlie → Alice (repays all her debt + some extra)
      await token
        .connect(charlie)
        .transfer(alice.address, ethers.parseEther('500'));

      totalDebt =
        (await token.creditBalanceOf(alice.address)) +
        (await token.creditBalanceOf(bob.address)) +
        (await token.creditBalanceOf(charlie.address));
      expect(await token.totalSupply()).to.equal(totalDebt);
    });
  });

  // ==========================================================================
  // 15. Inherited RegularSpaceToken Functionality
  // ==========================================================================
  describe('15. Inherited RegularSpaceToken Functionality', function () {
    let token: Contract;

    beforeEach(async function () {
      token = await deployMutualCreditToken(
        mutualCreditTokenFactory,
        executorSigner,
        spaceId,
        {
          maxSupply: ethers.parseEther('50000'),
          tokenPrice: 1000000n, // $1.00
        },
      );
    });

    it('Should allow executor to mint tokens', async function () {
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('100'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
    });

    it('Should enforce maxSupply on executor mints', async function () {
      await expect(
        token
          .connect(executorSigner)
          .mint(alice.address, ethers.parseEther('60000')),
      ).to.be.reverted;
    });

    it('Should allow setting token name and symbol', async function () {
      await token.connect(executorSigner).setTokenName('Renamed Credit');
      await token.connect(executorSigner).setTokenSymbol('RMC');

      expect(await token.name()).to.equal('Renamed Credit');
      expect(await token.symbol()).to.equal('RMC');
    });

    it('Should report token price', async function () {
      expect(await token.tokenPrice()).to.equal(1000000n);
    });

    it('Should allow executor to update price', async function () {
      await token.connect(executorSigner).setPriceInUSD(2000000n);

      expect(await token.tokenPrice()).to.equal(2000000n);
    });
  });
});
