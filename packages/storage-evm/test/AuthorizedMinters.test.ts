import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  Contract,
  ContractTransactionResponse,
  Log,
  LogDescription,
} from 'ethers';

/**
 * Tests for the "authorized minter" feature shared by RegularSpaceToken and its
 * descendants (DecayingSpaceToken, OwnershipSpaceToken). Authorized minters are
 * arbitrary addresses ("public keys") that, in addition to the executor/owner,
 * may mint, burnFrom and batchSetCreditWhitelistAddresses on a token. They can
 * be provided at creation time (via the factory deploy*WithMinters functions)
 * and updated later (via batchSetAuthorizedMinters).
 */
describe('Authorized Minters', function () {
  let regularTokenFactory: Contract;
  let decayingTokenFactory: Contract;
  let ownershipTokenFactory: Contract;
  let daoSpaceFactory: Contract;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress; // space member
  let minter: SignerWithAddress; // authorized minter ("public key")
  let outsider: SignerWithAddress; // non-member, non-minter
  let recipient: SignerWithAddress;
  let executorSigner: SignerWithAddress;
  let spaceId: bigint;

  const ZERO = ethers.ZeroAddress;

  async function deployAndSetupFixture() {
    const [owner, alice, minter, outsider, recipient] =
      await ethers.getSigners();

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

    // Factories + implementations
    const RegularTokenFactory = await ethers.getContractFactory(
      'RegularTokenFactory',
    );
    const regularTokenFactory = await upgrades.deployProxy(
      RegularTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );
    await regularTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    const RegularSpaceToken = await ethers.getContractFactory(
      'RegularSpaceToken',
    );
    await regularTokenFactory.setSpaceTokenImplementation(
      await (await RegularSpaceToken.deploy()).getAddress(),
    );

    const DecayingTokenFactory = await ethers.getContractFactory(
      'DecayingTokenFactory',
    );
    const decayingTokenFactory = await upgrades.deployProxy(
      DecayingTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );
    await decayingTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    const DecayingSpaceToken = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );
    await decayingTokenFactory.setDecayingTokenImplementation(
      await (await DecayingSpaceToken.deploy()).getAddress(),
    );

    const OwnershipTokenFactory = await ethers.getContractFactory(
      'OwnershipTokenFactory',
    );
    const ownershipTokenFactory = await upgrades.deployProxy(
      OwnershipTokenFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );
    await ownershipTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    const OwnershipSpaceToken = await ethers.getContractFactory(
      'OwnershipSpaceToken',
    );
    await ownershipTokenFactory.setOwnershipTokenImplementation(
      await (await OwnershipSpaceToken.deploy()).getAddress(),
    );

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

    // alice joins the space (open join) so she is a member
    await daoSpaceFactory.connect(alice).joinSpace(spaceId);

    const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
    const executorAddress = spaceDetails.executor;
    await ethers.provider.send('hardhat_impersonateAccount', [executorAddress]);
    await ethers.provider.send('hardhat_setBalance', [
      executorAddress,
      '0x1000000000000000000',
    ]);
    const executorSigner = await ethers.getSigner(executorAddress);

    return {
      regularTokenFactory,
      decayingTokenFactory,
      ownershipTokenFactory,
      daoSpaceFactory,
      owner,
      alice,
      minter,
      outsider,
      recipient,
      executorSigner,
      spaceId,
    };
  }

  beforeEach(async function () {
    const f = await loadFixture(deployAndSetupFixture);
    regularTokenFactory = f.regularTokenFactory;
    decayingTokenFactory = f.decayingTokenFactory;
    ownershipTokenFactory = f.ownershipTokenFactory;
    daoSpaceFactory = f.daoSpaceFactory;
    owner = f.owner;
    alice = f.alice;
    minter = f.minter;
    outsider = f.outsider;
    recipient = f.recipient;
    executorSigner = f.executorSigner;
    spaceId = f.spaceId;
  });

  async function tokenFromTx(
    tx: ContractTransactionResponse,
    factory: Contract,
    abi: string,
  ): Promise<Contract> {
    const receipt = await tx.wait();
    const ev = receipt?.logs
      .map((log: Log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(
        (e): e is LogDescription => e !== null && e.name === 'TokenDeployed',
      );
    if (!ev) throw new Error('TokenDeployed event not found');
    return ethers.getContractAt(abi, ev.args.tokenAddress);
  }

  type RegularParamsOverrides = Partial<ReturnType<typeof regularParams>>;

  // Regular DeployParams struct, field order must match the contract.
  function regularParams(overrides: RegularParamsOverrides = {}) {
    return {
      spaceId,
      name: 'Authorized Token',
      symbol: 'AUTH',
      maxSupply: 0n,
      transferable: true,
      fixedMaxSupply: false,
      autoMinting: false,
      tokenPrice: 0n,
      priceCurrencyFeed: ZERO,
      useTransferWhitelist: false,
      useReceiveWhitelist: false,
      initialTransferWhitelist: [],
      initialReceiveWhitelist: [],
      initialTransferWhitelistSpaceIds: [],
      initialReceiveWhitelistSpaceIds: [],
      defaultCreditLimit: 0n,
      initialCreditWhitelistSpaceIds: [],
      paymentToken: ZERO,
      paymentTokenPricePerToken: 0n,
      tokensForSale: 0n,
      purchaseEligibilityMode: 0,
      initialPurchaseWhitelistSpaceIds: [],
      initialAuthorizedMinters: [],
      ...overrides,
    };
  }

  describe('RegularSpaceToken', function () {
    it('grants mint/burn/credit rights to an authorized minter set at creation', async function () {
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployTokenWithMinters(
          regularParams({ initialAuthorizedMinters: [minter.address] }),
        );
      const token = await tokenFromTx(
        tx,
        regularTokenFactory,
        'RegularSpaceToken',
      );

      expect(await token.isAuthorizedMinter(minter.address)).to.be.true;
      expect(await token.isAuthorizedMinter(outsider.address)).to.be.false;

      // Authorized minter can mint
      await token
        .connect(minter)
        .mint(recipient.address, ethers.parseEther('100'));
      expect(await token.balanceOf(recipient.address)).to.equal(
        ethers.parseEther('100'),
      );

      // Executor can still mint
      await token
        .connect(executorSigner)
        .mint(recipient.address, ethers.parseEther('1'));
      expect(await token.balanceOf(recipient.address)).to.equal(
        ethers.parseEther('101'),
      );

      // Non-authorized address cannot mint
      await expect(
        token.connect(outsider).mint(recipient.address, 1n),
      ).to.be.revertedWith('!executor');

      // Authorized minter can burnFrom without approval
      await token
        .connect(minter)
        .burnFrom(recipient.address, ethers.parseEther('50'));
      expect(await token.balanceOf(recipient.address)).to.equal(
        ethers.parseEther('51'),
      );

      // Authorized minter can manage the mutual-credit address whitelist
      await expect(
        token
          .connect(minter)
          .batchSetCreditWhitelistAddresses([outsider.address], [true]),
      )
        .to.emit(token, 'CreditWhitelistAddressUpdated')
        .withArgs(outsider.address, true);
      expect(await token.isCreditWhitelistedAddress(outsider.address)).to.be
        .true;
    });

    it('supports multiple authorized minters at creation', async function () {
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployTokenWithMinters(
          regularParams({
            initialAuthorizedMinters: [minter.address, outsider.address],
          }),
        );
      const token = await tokenFromTx(
        tx,
        regularTokenFactory,
        'RegularSpaceToken',
      );
      expect(await token.isAuthorizedMinter(minter.address)).to.be.true;
      expect(await token.isAuthorizedMinter(outsider.address)).to.be.true;
    });

    it('lets executor add and revoke authorized minters after creation', async function () {
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(
          spaceId,
          'Authorized Token',
          'AUTH',
          0n,
          true,
          false,
          false,
          0n,
          ZERO,
          false,
          false,
          [],
          [],
          [],
          [],
          0n,
          [],
          ZERO,
          0n,
          0n,
          0,
          [],
        );
      const token = await tokenFromTx(
        tx,
        regularTokenFactory,
        'RegularSpaceToken',
      );

      // No minters configured at creation
      expect(await token.isAuthorizedMinter(minter.address)).to.be.false;
      await expect(
        token.connect(minter).mint(recipient.address, 1n),
      ).to.be.revertedWith('!executor');

      // Executor grants minter rights (modification)
      await expect(
        token
          .connect(executorSigner)
          .batchSetAuthorizedMinters([minter.address], [true]),
      )
        .to.emit(token, 'AuthorizedMinterUpdated')
        .withArgs(minter.address, true);
      expect(await token.isAuthorizedMinter(minter.address)).to.be.true;

      await token
        .connect(minter)
        .mint(recipient.address, ethers.parseEther('5'));
      expect(await token.balanceOf(recipient.address)).to.equal(
        ethers.parseEther('5'),
      );

      // Executor revokes minter rights
      await token
        .connect(executorSigner)
        .batchSetAuthorizedMinters([minter.address], [false]);
      expect(await token.isAuthorizedMinter(minter.address)).to.be.false;
      await expect(
        token.connect(minter).mint(recipient.address, 1n),
      ).to.be.revertedWith('!executor');
    });

    it('rejects batchSetAuthorizedMinters from non-executor/owner and length mismatch', async function () {
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployTokenWithMinters(regularParams());
      const token = await tokenFromTx(
        tx,
        regularTokenFactory,
        'RegularSpaceToken',
      );

      await expect(
        token
          .connect(outsider)
          .batchSetAuthorizedMinters([minter.address], [true]),
      ).to.be.revertedWith('!executor/owner');

      await expect(
        token
          .connect(executorSigner)
          .batchSetAuthorizedMinters([minter.address], [true, false]),
      ).to.be.revertedWith('length mismatch');
    });
  });

  describe('DecayingSpaceToken', function () {
    type DecayingParamsOverrides = Partial<ReturnType<typeof decayingParams>>;
    function decayingParams(overrides: DecayingParamsOverrides = {}) {
      return {
        spaceId,
        name: 'Decaying Auth',
        symbol: 'DAUTH',
        maxSupply: 0n,
        transferable: true,
        fixedMaxSupply: false,
        autoMinting: false,
        tokenPrice: 0n,
        priceCurrencyFeed: ZERO,
        useTransferWhitelist: false,
        useReceiveWhitelist: false,
        initialTransferWhitelist: [],
        initialReceiveWhitelist: [],
        initialTransferWhitelistSpaceIds: [],
        initialReceiveWhitelistSpaceIds: [],
        decayPercentage: 100,
        decayInterval: 3600,
        paymentToken: ZERO,
        paymentTokenPricePerToken: 0n,
        tokensForSale: 0n,
        purchaseEligibilityMode: 0,
        initialPurchaseWhitelistSpaceIds: [],
        initialAuthorizedMinters: [],
        ...overrides,
      };
    }

    it('lets an authorized minter set at creation mint', async function () {
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingTokenWithMinters(
          decayingParams({ initialAuthorizedMinters: [minter.address] }),
        );
      const token = await tokenFromTx(
        tx,
        decayingTokenFactory,
        'DecayingSpaceToken',
      );

      expect(await token.isAuthorizedMinter(minter.address)).to.be.true;
      await token
        .connect(minter)
        .mint(recipient.address, ethers.parseEther('10'));
      expect(await token.balanceOf(recipient.address)).to.equal(
        ethers.parseEther('10'),
      );

      await expect(
        token.connect(outsider).mint(recipient.address, 1n),
      ).to.be.revertedWith('!executor');
    });
  });

  describe('OwnershipSpaceToken', function () {
    type OwnershipParamsOverrides = Partial<ReturnType<typeof ownershipParams>>;
    function ownershipParams(overrides: OwnershipParamsOverrides = {}) {
      return {
        spaceId,
        name: 'Ownership Auth',
        symbol: 'OAUTH',
        maxSupply: 0n,
        fixedMaxSupply: false,
        autoMinting: false,
        tokenPrice: 0n,
        priceCurrencyFeed: ZERO,
        useTransferWhitelist: false,
        useReceiveWhitelist: false,
        initialTransferWhitelist: [],
        initialReceiveWhitelist: [],
        initialTransferWhitelistSpaceIds: [],
        initialReceiveWhitelistSpaceIds: [],
        paymentToken: ZERO,
        paymentTokenPricePerToken: 0n,
        tokensForSale: 0n,
        purchaseEligibilityMode: 0,
        initialPurchaseWhitelistSpaceIds: [],
        initialAuthorizedMinters: [],
        ...overrides,
      };
    }

    it('authorized minter can mint to non-members; executor restricted to members', async function () {
      const tx = await ownershipTokenFactory
        .connect(executorSigner)
        .deployOwnershipTokenWithMinters(
          ownershipParams({ initialAuthorizedMinters: [minter.address] }),
        );
      const token = await tokenFromTx(
        tx,
        ownershipTokenFactory,
        'OwnershipSpaceToken',
      );

      expect(await token.isAuthorizedMinter(minter.address)).to.be.true;

      // Executor can mint to a member (alice)
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1'));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('1'),
      );

      // Executor cannot mint to a non-member
      await expect(
        token.connect(executorSigner).mint(outsider.address, 1n),
      ).to.be.revertedWith('!member/executor');

      // Authorized minter can mint to a non-member (member check bypassed)
      await token
        .connect(minter)
        .mint(outsider.address, ethers.parseEther('2'));
      expect(await token.balanceOf(outsider.address)).to.equal(
        ethers.parseEther('2'),
      );

      await expect(
        token.connect(recipient).mint(alice.address, 1n),
      ).to.be.revertedWith('!executor');
    });
  });
});
