import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

describe('Token Configuration Tests', function () {
  let regularTokenFactory: Contract;
  let decayingTokenFactory: Contract;
  let ownershipTokenFactory: Contract;
  let daoSpaceFactory: Contract;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let executorSigner: SignerWithAddress;
  let spaceId: bigint;

  async function deployAndSetupFixture() {
    const [owner, alice, bob, charlie, ...others] = await ethers.getSigners();

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

    // Set contracts in DAOSpaceFactory
    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      await votingPowerDirectory.getAddress(),
    );

    // Deploy RegularTokenFactory
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
    const regularSpaceTokenImpl = await RegularSpaceToken.deploy();
    await regularTokenFactory.setSpaceTokenImplementation(
      await regularSpaceTokenImpl.getAddress(),
    );

    // Deploy DecayingTokenFactory
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
    const decayingSpaceTokenImpl = await DecayingSpaceToken.deploy();
    await decayingTokenFactory.setDecayingTokenImplementation(
      await decayingSpaceTokenImpl.getAddress(),
    );

    // Deploy OwnershipTokenFactory
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
    const ownershipSpaceTokenImpl = await OwnershipSpaceToken.deploy();
    await ownershipTokenFactory.setOwnershipTokenImplementation(
      await ownershipSpaceTokenImpl.getAddress(),
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
      regularTokenFactory,
      decayingTokenFactory,
      ownershipTokenFactory,
      daoSpaceFactory,
      owner,
      alice,
      bob,
      charlie,
      executorSigner,
      spaceId,
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployAndSetupFixture);
    regularTokenFactory = fixture.regularTokenFactory;
    decayingTokenFactory = fixture.decayingTokenFactory;
    ownershipTokenFactory = fixture.ownershipTokenFactory;
    daoSpaceFactory = fixture.daoSpaceFactory;
    owner = fixture.owner;
    alice = fixture.alice;
    bob = fixture.bob;
    charlie = fixture.charlie;
    executorSigner = fixture.executorSigner;
    spaceId = fixture.spaceId;
  });

  describe('1. Fixed vs Adjustable Max Supply', function () {
    it('Should allow updating max supply when fixedMaxSupply is false', async function () {
      // Deploy token with adjustable max supply
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Adjustable Token',
        'ADJ',
        ethers.parseEther('1000'), // initial max supply
        true, // transferable
        false, // fixedMaxSupply = false (adjustable)
        true, // autoMinting
        0, // tokenPrice
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false, // useTransferWhitelist
        false, // useReceiveWhitelist
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0, // defaultCreditLimit
        [], // initialCreditWhitelistSpaceIds
        ethers.ZeroAddress, // paymentToken
        0, // paymentTokenPricePerToken
        0, // tokensForSale
        0, // purchaseEligibilityMode (space only)
        [], // initialPurchaseWhitelistSpaceIds
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Check initial max supply
      expect(await token.maxSupply()).to.equal(ethers.parseEther('1000'));
      expect(await token.fixedMaxSupply()).to.be.false;

      // Update max supply
      await expect(
        token.connect(executorSigner).setMaxSupply(ethers.parseEther('2000')),
      )
        .to.emit(token, 'MaxSupplyUpdated')
        .withArgs(ethers.parseEther('1000'), ethers.parseEther('2000'));

      expect(await token.maxSupply()).to.equal(ethers.parseEther('2000'));
    });

    it('Should NOT allow updating max supply when fixedMaxSupply is true', async function () {
      // Deploy token with fixed max supply
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Fixed Token',
        'FIX',
        ethers.parseEther('1000'),
        true,
        true, // fixedMaxSupply = true
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      expect(await token.fixedMaxSupply()).to.be.true;

      // Try to update max supply - should fail
      await expect(
        token.connect(executorSigner).setMaxSupply(ethers.parseEther('2000')),
      ).to.be.revertedWith('supply fixed');
    });

    it('Should reject max supply update below current total supply', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Test Token',
        'TST',
        ethers.parseEther('1000'),
        true,
        false, // adjustable
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Mint some tokens
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('500'));

      // Try to set max supply below total supply - should fail
      await expect(
        token.connect(executorSigner).setMaxSupply(ethers.parseEther('400')),
      ).to.be.revertedWith('supply < total');
    });
  });

  describe('2. Auto-Minting Control', function () {
    it('Should auto-mint when autoMinting is true and executor transfers', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Auto Token',
        'AUTO',
        ethers.parseEther('10000'),
        true,
        false,
        true, // autoMinting = true
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Executor has no balance
      expect(await token.balanceOf(executorSigner.address)).to.equal(0);

      // Transfer should auto-mint
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('100'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
    });

    it('Should NOT auto-mint when autoMinting is false', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Manual Token',
        'MAN',
        ethers.parseEther('10000'),
        true,
        false,
        false, // autoMinting = false
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Executor has no balance
      expect(await token.balanceOf(executorSigner.address)).to.equal(0);

      // Transfer should fail without minting first
      await expect(
        token
          .connect(executorSigner)
          .transfer(alice.address, ethers.parseEther('100')),
      ).to.be.reverted;

      // Must mint explicitly first
      await token
        .connect(executorSigner)
        .mint(executorSigner.address, ethers.parseEther('100'));

      // Now transfer should work
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('100'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('100'),
      );
    });

    it('Should allow toggling autoMinting after deployment', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Toggle Token',
        'TOG',
        ethers.parseEther('10000'),
        true,
        false,
        true, // start with autoMinting = true
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      expect(await token.autoMinting()).to.be.true;

      // Disable autoMinting
      await expect(token.connect(executorSigner).setAutoMinting(false))
        .to.emit(token, 'AutoMintingUpdated')
        .withArgs(false);

      expect(await token.autoMinting()).to.be.false;

      // Re-enable autoMinting
      await expect(token.connect(executorSigner).setAutoMinting(true))
        .to.emit(token, 'AutoMintingUpdated')
        .withArgs(true);

      expect(await token.autoMinting()).to.be.true;
    });
  });

  describe('3. Transfer & Receive Whitelists', function () {
    let token: Contract;

    beforeEach(async function () {
      // Deploy token with whitelists enabled
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Whitelist Token',
        'WHL',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        true, // useTransferWhitelist = true
        true, // useReceiveWhitelist = true
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);

      // Mint tokens to alice
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
    });

    it('Should initialize executor as whitelisted', async function () {
      expect(await token.canTransfer(executorSigner.address)).to.be.true;
      expect(await token.canReceive(executorSigner.address)).to.be.true;
    });

    it('Should enforce transfer whitelist', async function () {
      // Alice is not whitelisted, cannot transfer
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!send whitelist');

      // Whitelist alice for transfer
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);

      expect(await token.canTransfer(alice.address)).to.be.true;

      // Bob is not whitelisted to receive
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!recv whitelist');
    });

    it('Should enforce receive whitelist', async function () {
      // Whitelist alice to transfer
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);

      // Bob not whitelisted to receive
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!recv whitelist');

      // Whitelist bob to receive
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist([bob.address], [true]);

      // Now transfer should work
      await token.connect(alice).transfer(bob.address, ethers.parseEther('10'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('10'),
      );
    });

    it('Should support batch whitelist updates', async function () {
      // Batch whitelist multiple addresses
      await expect(
        token
          .connect(executorSigner)
          .batchSetTransferWhitelist(
            [alice.address, bob.address, charlie.address],
            [true, true, true],
          ),
      )
        .to.emit(token, 'TransferWhitelistUpdated')
        .withArgs(alice.address, true)
        .and.to.emit(token, 'TransferWhitelistUpdated')
        .withArgs(bob.address, true)
        .and.to.emit(token, 'TransferWhitelistUpdated')
        .withArgs(charlie.address, true);

      expect(await token.canTransfer(alice.address)).to.be.true;
      expect(await token.canTransfer(bob.address)).to.be.true;
      expect(await token.canTransfer(charlie.address)).to.be.true;

      // Batch whitelist for receive
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist(
          [alice.address, bob.address, charlie.address],
          [true, true, true],
        );

      // Alice can now transfer to bob
      await token
        .connect(alice)
        .transfer(bob.address, ethers.parseEther('100'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('100'),
      );
    });

    it('Should allow disabling whitelist enforcement', async function () {
      // Currently whitelists are enforced
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!send whitelist');

      // Disable transfer whitelist
      await expect(token.connect(executorSigner).setUseTransferWhitelist(false))
        .to.emit(token, 'UseTransferWhitelistUpdated')
        .withArgs(false);

      // Disable receive whitelist
      await expect(token.connect(executorSigner).setUseReceiveWhitelist(false))
        .to.emit(token, 'UseReceiveWhitelistUpdated')
        .withArgs(false);

      // Now anyone can transfer
      await token.connect(alice).transfer(bob.address, ethers.parseEther('10'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('10'),
      );
    });

    it('Should reject batch updates with mismatched array lengths', async function () {
      await expect(
        token
          .connect(executorSigner)
          .batchSetTransferWhitelist([alice.address, bob.address], [true]), // Mismatched lengths
      ).to.be.revertedWith('length mismatch');
    });

    it('Should only allow executor to update whitelists', async function () {
      await expect(
        token.connect(alice).batchSetTransferWhitelist([bob.address], [true]),
      ).to.be.revertedWith('!executor');

      await expect(
        token.connect(bob).batchSetReceiveWhitelist([charlie.address], [true]),
      ).to.be.revertedWith('!executor');
    });
  });

  describe('3b. canAccountTransfer & canAccountReceive View Functions', function () {
    describe('When whitelists are disabled', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'No Whitelist Token',
            'NWL',
            ethers.parseEther('10000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress,
            false, // useTransferWhitelist = false
            false, // useReceiveWhitelist = false
            [],
            [],
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
      });

      it('canAccountTransfer should return true for executor', async function () {
        expect(await token.canAccountTransfer(executorSigner.address)).to.be
          .true;
      });

      it('canAccountTransfer should return true for non-whitelisted account when enforcement is off', async function () {
        expect(await token.canAccountTransfer(alice.address)).to.be.true;
        expect(await token.canAccountTransfer(bob.address)).to.be.true;
      });

      it('canAccountReceive should return true for executor', async function () {
        expect(await token.canAccountReceive(executorSigner.address)).to.be
          .true;
      });

      it('canAccountReceive should return true for non-whitelisted account when enforcement is off', async function () {
        expect(await token.canAccountReceive(alice.address)).to.be.true;
        expect(await token.canAccountReceive(bob.address)).to.be.true;
      });
    });

    describe('When whitelists are enabled', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Whitelist Token',
            'WL',
            ethers.parseEther('10000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress,
            true, // useTransferWhitelist = true
            true, // useReceiveWhitelist = true
            [],
            [],
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
      });

      it('canAccountTransfer should return true for executor', async function () {
        expect(await token.canAccountTransfer(executorSigner.address)).to.be
          .true;
      });

      it('canAccountTransfer should return false for non-whitelisted account when enforcement is on', async function () {
        expect(await token.canAccountTransfer(alice.address)).to.be.false;
        expect(await token.canAccountTransfer(bob.address)).to.be.false;
      });

      it('canAccountTransfer should return true for directly whitelisted account', async function () {
        await token
          .connect(executorSigner)
          .batchSetTransferWhitelist([alice.address], [true]);

        expect(await token.canAccountTransfer(alice.address)).to.be.true;
        expect(await token.canAccountTransfer(bob.address)).to.be.false;
      });

      it('canAccountReceive should return true for executor', async function () {
        expect(await token.canAccountReceive(executorSigner.address)).to.be
          .true;
      });

      it('canAccountReceive should return false for non-whitelisted account when enforcement is on', async function () {
        expect(await token.canAccountReceive(alice.address)).to.be.false;
        expect(await token.canAccountReceive(bob.address)).to.be.false;
      });

      it('canAccountReceive should return true for directly whitelisted account', async function () {
        await token
          .connect(executorSigner)
          .batchSetReceiveWhitelist([bob.address], [true]);

        expect(await token.canAccountReceive(bob.address)).to.be.true;
        expect(await token.canAccountReceive(charlie.address)).to.be.false;
      });
    });

    describe('Toggling enforcement flags', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Toggle Whitelist Token',
            'TWL',
            ethers.parseEther('10000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress,
            true, // useTransferWhitelist = true
            true, // useReceiveWhitelist = true
            [],
            [],
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
      });

      it('canAccountTransfer should change from false to true when enforcement is disabled', async function () {
        // With enforcement on, non-whitelisted account returns false
        expect(await token.canAccountTransfer(alice.address)).to.be.false;

        // Disable transfer whitelist enforcement
        await token.connect(executorSigner).setUseTransferWhitelist(false);

        // Now should return true
        expect(await token.canAccountTransfer(alice.address)).to.be.true;
      });

      it('canAccountReceive should change from false to true when enforcement is disabled', async function () {
        // With enforcement on, non-whitelisted account returns false
        expect(await token.canAccountReceive(bob.address)).to.be.false;

        // Disable receive whitelist enforcement
        await token.connect(executorSigner).setUseReceiveWhitelist(false);

        // Now should return true
        expect(await token.canAccountReceive(bob.address)).to.be.true;
      });

      it('canAccountTransfer should change from true to false when enforcement is re-enabled', async function () {
        // Disable enforcement
        await token.connect(executorSigner).setUseTransferWhitelist(false);
        expect(await token.canAccountTransfer(alice.address)).to.be.true;

        // Re-enable enforcement
        await token.connect(executorSigner).setUseTransferWhitelist(true);
        expect(await token.canAccountTransfer(alice.address)).to.be.false;
      });

      it('canAccountReceive should change from true to false when enforcement is re-enabled', async function () {
        // Disable enforcement
        await token.connect(executorSigner).setUseReceiveWhitelist(false);
        expect(await token.canAccountReceive(bob.address)).to.be.true;

        // Re-enable enforcement
        await token.connect(executorSigner).setUseReceiveWhitelist(true);
        expect(await token.canAccountReceive(bob.address)).to.be.false;
      });
    });
  });

  describe('4. USD Pricing', function () {
    it('Should set initial price in USD', async function () {
      const priceInUSD = 5000000n; // $5.00 (6 decimals)

      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Price Token',
        'PRC',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        priceInUSD,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      expect(await token.priceInUSD()).to.equal(priceInUSD);
    });

    it('Should allow updating price in USD', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Price Token',
        'PRC',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        1000000n, // $1.00
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      const oldPrice = 1000000n;
      const newPrice = 2500000n; // $2.50

      await expect(token.connect(executorSigner).setPriceInUSD(newPrice))
        .to.emit(token, 'PriceInUSDUpdated')
        .withArgs(oldPrice, newPrice);

      expect(await token.priceInUSD()).to.equal(newPrice);
    });

    it('Should only allow executor to update price', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Price Token',
        'PRC',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        1000000n,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      await expect(
        token.connect(alice).setPriceInUSD(5000000n),
      ).to.be.revertedWith('!executor');
    });
  });

  describe('5. Transferability Configuration', function () {
    it('Should allow toggling transferability after deployment', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Toggle Token',
        'TOG',
        ethers.parseEther('10000'),
        false, // Start non-transferable
        false,
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Mint tokens to alice
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('100'));

      expect(await token.transferable()).to.be.false;

      // Alice cannot transfer
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!transferable');

      // Enable transferability
      await expect(token.connect(executorSigner).setTransferable(true))
        .to.emit(token, 'TransferableUpdated')
        .withArgs(true);

      expect(await token.transferable()).to.be.true;

      // Now alice can transfer
      await token.connect(alice).transfer(bob.address, ethers.parseEther('10'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('10'),
      );
    });
  });

  describe('6. Token Burning', function () {
    let token: Contract;

    beforeEach(async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Burn Token',
        'BRN',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);

      // Mint tokens to alice and bob
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
      await token
        .connect(executorSigner)
        .mint(bob.address, ethers.parseEther('500'));
    });

    it('Should allow executor to burn from any address without approval', async function () {
      const burnAmount = ethers.parseEther('100');
      const initialBalance = await token.balanceOf(alice.address);

      // Executor burns alice's tokens without approval
      await expect(
        token.connect(executorSigner).burnFrom(alice.address, burnAmount),
      )
        .to.emit(token, 'TokensBurned')
        .withArgs(executorSigner.address, alice.address, burnAmount);

      expect(await token.balanceOf(alice.address)).to.equal(
        initialBalance - burnAmount,
      );
    });

    it('Should require approval for non-executor to burn', async function () {
      const burnAmount = ethers.parseEther('50');

      // Bob tries to burn alice's tokens without approval - should fail
      await expect(token.connect(bob).burnFrom(alice.address, burnAmount)).to.be
        .reverted;

      // Alice approves bob
      await token.connect(alice).approve(bob.address, burnAmount);

      // Now bob can burn alice's tokens
      await expect(token.connect(bob).burnFrom(alice.address, burnAmount))
        .to.emit(token, 'TokensBurned')
        .withArgs(bob.address, alice.address, burnAmount);

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('950'),
      );
    });

    it('Should allow users to burn their own tokens', async function () {
      const burnAmount = ethers.parseEther('200');
      const initialBalance = await token.balanceOf(alice.address);

      // Alice burns her own tokens using burn()
      await token.connect(alice).burn(burnAmount);

      expect(await token.balanceOf(alice.address)).to.equal(
        initialBalance - burnAmount,
      );
    });
  });

  describe('7. Decaying Token Configuration', function () {
    it('Should deploy decaying token with all new configurations', async function () {
      const priceInUSD = 3000000n; // $3.00
      const purchaseModeCustomSpaces = 1;
      const initialPurchaseWhitelist = [spaceId];

      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Decaying Config Token',
          'DCT',
          ethers.parseEther('5000'),
          true,
          true, // fixedMaxSupply
          false, // autoMinting = false
          priceInUSD,
          ethers.ZeroAddress, // priceCurrencyFeed (USD)
          true, // useTransferWhitelist
          false, // useReceiveWhitelist
          [], // initialTransferWhitelist
          [], // initialReceiveWhitelist
          [], // initialTransferWhitelistSpaceIds
          [], // initialReceiveWhitelistSpaceIds
          100, // 1% decay
          3600, // 1 hour
          ethers.ZeroAddress, // paymentToken (sale disabled)
          0, // paymentTokenPricePerToken
          0, // tokensForSale
          purchaseModeCustomSpaces,
          initialPurchaseWhitelist,
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

      const token = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // Verify all configurations
      expect(await token.maxSupply()).to.equal(ethers.parseEther('5000'));
      expect(await token.fixedMaxSupply()).to.be.true;
      expect(await token.autoMinting()).to.be.false;
      expect(await token.priceInUSD()).to.equal(priceInUSD);
      expect(await token.useTransferWhitelist()).to.be.true;
      expect(await token.useReceiveWhitelist()).to.be.false;
      expect(await token.decayPercentage()).to.equal(100);
      expect(await token.decayRate()).to.equal(3600);
      expect(await token.purchaseEligibilityMode()).to.equal(
        purchaseModeCustomSpaces,
      );
      expect(await token.getPurchaseWhitelistedSpaces()).to.deep.equal(
        initialPurchaseWhitelist,
      );
    });

    describe('Decay parameter updates', function () {
      async function deployDecayingTokenForConfigTests() {
        const tx = await decayingTokenFactory
          .connect(executorSigner)
          .deployDecayingToken(
            spaceId,
            'Decaying Config Update Token',
            'DCUT',
            ethers.parseEther('5000'),
            true,
            true,
            false,
            0,
            ethers.ZeroAddress,
            false,
            false,
            [],
            [],
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            100, // 1%
            3600, // 1 hour
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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

      it('Should allow executor to update decay percentage and interval', async function () {
        const token = await deployDecayingTokenForConfigTests();

        await expect(token.connect(executorSigner).setDecayPercentage(250))
          .to.emit(token, 'DecayPercentageUpdated')
          .withArgs(100, 250);

        await expect(token.connect(executorSigner).setDecayInterval(7200))
          .to.emit(token, 'DecayIntervalUpdated')
          .withArgs(3600, 7200);

        expect(await token.decayPercentage()).to.equal(250);
        expect(await token.decayRate()).to.equal(7200);
      });

      it('Should reject decay parameter updates from non-executor', async function () {
        const token = await deployDecayingTokenForConfigTests();

        await expect(
          token.connect(alice).setDecayPercentage(250),
        ).to.be.revertedWith('!executor');
        await expect(
          token.connect(alice).setDecayInterval(7200),
        ).to.be.revertedWith('!executor');
      });

      it('Should validate new decay parameters', async function () {
        const token = await deployDecayingTokenForConfigTests();

        await expect(
          token.connect(executorSigner).setDecayPercentage(10001),
        ).to.be.revertedWith('decay% > 100');
        await expect(
          token.connect(executorSigner).setDecayInterval(0),
        ).to.be.revertedWith('!decay interval');
      });
    });
  });

  describe('8. Ownership Token Configuration', function () {
    it('Should deploy ownership token with all new configurations', async function () {
      const priceInUSD = 10000000n; // $10.00
      const purchaseModeAllSpaces = 2;

      const tx = await ownershipTokenFactory
        .connect(executorSigner)
        .deployOwnershipToken(
          spaceId,
          'Ownership Config Token',
          'OCT',
          ethers.parseEther('100'),
          false, // adjustable max supply
          true, // autoMinting
          priceInUSD,
          ethers.ZeroAddress, // priceCurrencyFeed (USD)
          false, // useTransferWhitelist
          true, // useReceiveWhitelist
          [], // initialTransferWhitelist
          [], // initialReceiveWhitelist
          [], // initialTransferWhitelistSpaceIds
          [], // initialReceiveWhitelistSpaceIds
          ethers.ZeroAddress, // paymentToken (sale disabled)
          0, // paymentTokenPricePerToken
          0, // tokensForSale
          purchaseModeAllSpaces,
          [], // initialPurchaseWhitelistSpaceIds
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

      const token = await ethers.getContractAt(
        'OwnershipSpaceToken',
        tokenAddress,
      );

      // Verify configurations
      expect(await token.maxSupply()).to.equal(ethers.parseEther('100'));
      expect(await token.fixedMaxSupply()).to.be.false;
      expect(await token.autoMinting()).to.be.true;
      expect(await token.priceInUSD()).to.equal(priceInUSD);
      expect(await token.transferable()).to.be.true; // Always true for ownership tokens
      expect(await token.useTransferWhitelist()).to.be.false;
      expect(await token.useReceiveWhitelist()).to.be.true;
      expect(await token.purchaseEligibilityMode()).to.equal(
        purchaseModeAllSpaces,
      );
    });
  });

  describe('9. Token Minting', function () {
    describe('Regular Token Minting', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Mint Test Token',
            'MINT',
            ethers.parseEther('10000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
      });

      it('Should allow executor to mint tokens', async function () {
        const mintAmount = ethers.parseEther('100');

        await token.connect(executorSigner).mint(alice.address, mintAmount);

        expect(await token.balanceOf(alice.address)).to.equal(mintAmount);
        expect(await token.totalSupply()).to.equal(mintAmount);
      });

      it('Should not allow non-executor to mint tokens', async function () {
        const mintAmount = ethers.parseEther('100');

        await expect(
          token.connect(alice).mint(bob.address, mintAmount),
        ).to.be.revertedWith('!executor');
      });

      it('Should respect max supply when minting', async function () {
        const overMintAmount = ethers.parseEther('10001');

        await expect(
          token.connect(executorSigner).mint(alice.address, overMintAmount),
        ).to.be.revertedWith('supply exceeded');
      });

      it('Should allow minting up to max supply', async function () {
        const maxSupply = ethers.parseEther('10000');

        await token.connect(executorSigner).mint(alice.address, maxSupply);

        expect(await token.balanceOf(alice.address)).to.equal(maxSupply);
        expect(await token.totalSupply()).to.equal(maxSupply);
      });

      it('Should allow unlimited minting when max supply is 0', async function () {
        // Deploy token with unlimited supply
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Unlimited Token',
            'UNLTD',
            0, // max supply = 0 (unlimited)
            true,
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        const unlimitedToken = await ethers.getContractAt(
          'RegularSpaceToken',
          tokenAddress,
        );

        // Mint very large amount
        const largeAmount = ethers.parseEther('1000000');
        await unlimitedToken
          .connect(executorSigner)
          .mint(alice.address, largeAmount);

        expect(await unlimitedToken.balanceOf(alice.address)).to.equal(
          largeAmount,
        );
      });

      it('Should allow minting to multiple addresses', async function () {
        const mintAmount = ethers.parseEther('100');

        await token.connect(executorSigner).mint(alice.address, mintAmount);
        await token.connect(executorSigner).mint(bob.address, mintAmount);
        await token.connect(executorSigner).mint(charlie.address, mintAmount);

        expect(await token.balanceOf(alice.address)).to.equal(mintAmount);
        expect(await token.balanceOf(bob.address)).to.equal(mintAmount);
        expect(await token.balanceOf(charlie.address)).to.equal(mintAmount);
        expect(await token.totalSupply()).to.equal(mintAmount * 3n);
      });

      it('Should allow direct minting regardless of autoMinting setting', async function () {
        // Deploy token with autoMinting = false
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'No Auto Mint Token',
            'NOAUTO',
            ethers.parseEther('10000'),
            true,
            false,
            false, // autoMinting = false
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        const noAutoToken = await ethers.getContractAt(
          'RegularSpaceToken',
          tokenAddress,
        );

        // Direct minting should work even with autoMinting = false
        const mintAmount = ethers.parseEther('500');
        await noAutoToken
          .connect(executorSigner)
          .mint(alice.address, mintAmount);

        expect(await noAutoToken.balanceOf(alice.address)).to.equal(mintAmount);
        expect(await noAutoToken.autoMinting()).to.be.false;

        // But transfer without balance should fail
        await expect(
          noAutoToken
            .connect(executorSigner)
            .transfer(bob.address, ethers.parseEther('100')),
        ).to.be.reverted;

        // After minting to executor, transfer should work
        await noAutoToken
          .connect(executorSigner)
          .mint(executorSigner.address, ethers.parseEther('100'));
        await noAutoToken
          .connect(executorSigner)
          .transfer(bob.address, ethers.parseEther('100'));

        expect(await noAutoToken.balanceOf(bob.address)).to.equal(
          ethers.parseEther('100'),
        );
      });
    });

    describe('Decaying Token Minting', function () {
      let decayingToken: Contract;

      beforeEach(async function () {
        const tx = await decayingTokenFactory
          .connect(executorSigner)
          .deployDecayingToken(
            spaceId,
            'Decaying Mint Token',
            'DMINT',
            ethers.parseEther('5000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            100, // 1% decay
            3600, // 1 hour
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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

        decayingToken = await ethers.getContractAt(
          'DecayingSpaceToken',
          tokenAddress,
        );
      });

      it('Should allow executor to mint decaying tokens', async function () {
        const mintAmount = ethers.parseEther('200');

        await decayingToken
          .connect(executorSigner)
          .mint(alice.address, mintAmount);

        expect(await decayingToken.balanceOf(alice.address)).to.equal(
          mintAmount,
        );
        expect(await decayingToken.totalSupply()).to.equal(mintAmount);
      });

      it('Should set lastApplied timestamp when minting to new address', async function () {
        const mintAmount = ethers.parseEther('100');

        // Get current block timestamp
        const blockBefore = await ethers.provider.getBlock('latest');
        const timestampBefore = blockBefore!.timestamp;

        await decayingToken
          .connect(executorSigner)
          .mint(alice.address, mintAmount);

        const lastApplied = await decayingToken.lastApplied(alice.address);
        expect(lastApplied).to.be.gt(timestampBefore);
      });

      it('Should respect max supply for decaying tokens', async function () {
        const overMintAmount = ethers.parseEther('5001');

        await expect(
          decayingToken
            .connect(executorSigner)
            .mint(alice.address, overMintAmount),
        ).to.be.revertedWith('supply exceeded');
      });

      it('Should not allow non-executor to mint decaying tokens', async function () {
        const mintAmount = ethers.parseEther('100');

        await expect(
          decayingToken.connect(bob).mint(alice.address, mintAmount),
        ).to.be.revertedWith('!executor');
      });

      it('Should apply decay before minting to existing holders', async function () {
        const initialMint = ethers.parseEther('1000');
        const secondMint = ethers.parseEther('500');

        // First mint
        await decayingToken
          .connect(executorSigner)
          .mint(alice.address, initialMint);

        // Time travel forward
        await ethers.provider.send('evm_increaseTime', [3600]); // 1 hour
        await ethers.provider.send('evm_mine', []);

        // Second mint should apply decay first
        await decayingToken
          .connect(executorSigner)
          .mint(alice.address, secondMint);

        const balance = await decayingToken.balanceOf(alice.address);
        // Balance should be less than initial + second due to decay
        expect(balance).to.be.lt(initialMint + secondMint);
      });
    });

    describe('Ownership Token Minting', function () {
      let ownershipToken: Contract;

      beforeEach(async function () {
        const tx = await ownershipTokenFactory
          .connect(executorSigner)
          .deployOwnershipToken(
            spaceId,
            'Ownership Mint Token',
            'OMINT',
            ethers.parseEther('100'),
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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

        // Join space so alice and bob become members
        await daoSpaceFactory.connect(alice).joinSpace(spaceId);
        await daoSpaceFactory.connect(bob).joinSpace(spaceId);
      });

      it('Should allow executor to mint to space members', async function () {
        const mintAmount = ethers.parseEther('10');

        await ownershipToken
          .connect(executorSigner)
          .mint(alice.address, mintAmount);

        expect(await ownershipToken.balanceOf(alice.address)).to.equal(
          mintAmount,
        );
      });

      it('Should allow minting to executor', async function () {
        const mintAmount = ethers.parseEther('10');

        await ownershipToken
          .connect(executorSigner)
          .mint(executorSigner.address, mintAmount);

        expect(await ownershipToken.balanceOf(executorSigner.address)).to.equal(
          mintAmount,
        );
      });

      it('Should not allow minting to non-members', async function () {
        const mintAmount = ethers.parseEther('10');

        // Charlie is not a space member
        await expect(
          ownershipToken
            .connect(executorSigner)
            .mint(charlie.address, mintAmount),
        ).to.be.revertedWith('!member/executor');
      });

      it('Should not allow non-executor to mint ownership tokens', async function () {
        const mintAmount = ethers.parseEther('10');

        await expect(
          ownershipToken.connect(alice).mint(bob.address, mintAmount),
        ).to.be.revertedWith('!executor');
      });

      it('Should respect max supply for ownership tokens', async function () {
        const overMintAmount = ethers.parseEther('101');

        await expect(
          ownershipToken
            .connect(executorSigner)
            .mint(alice.address, overMintAmount),
        ).to.be.revertedWith('supply exceeded');
      });

      it('Should allow minting to multiple space members', async function () {
        const mintAmount = ethers.parseEther('5');

        await ownershipToken
          .connect(executorSigner)
          .mint(alice.address, mintAmount);
        await ownershipToken
          .connect(executorSigner)
          .mint(bob.address, mintAmount);

        expect(await ownershipToken.balanceOf(alice.address)).to.equal(
          mintAmount,
        );
        expect(await ownershipToken.balanceOf(bob.address)).to.equal(
          mintAmount,
        );
        expect(await ownershipToken.totalSupply()).to.equal(mintAmount * 2n);
      });
    });
  });

  describe('10. Access Control', function () {
    let token: Contract;

    beforeEach(async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Access Token',
        'ACC',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        1000000n,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
    });

    it('Should restrict setMaxSupply to executor only', async function () {
      await expect(
        token.connect(alice).setMaxSupply(ethers.parseEther('20000')),
      ).to.be.revertedWith('!executor');
    });

    it('Should restrict setTransferable to executor only', async function () {
      await expect(
        token.connect(bob).setTransferable(false),
      ).to.be.revertedWith('!executor');
    });

    it('Should restrict setAutoMinting to executor only', async function () {
      await expect(
        token.connect(charlie).setAutoMinting(false),
      ).to.be.revertedWith('!executor/owner');
    });

    it('Should restrict whitelist updates to executor only', async function () {
      await expect(
        token.connect(alice).setUseTransferWhitelist(true),
      ).to.be.revertedWith('!executor');

      await expect(
        token.connect(bob).setUseReceiveWhitelist(true),
      ).to.be.revertedWith('!executor');
    });
  });

  describe('11. Token Archive Functionality', function () {
    describe('Regular Token Archive', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Archive Test Token',
            'ARCH',
            ethers.parseEther('10000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);

        // Mint some tokens to alice for transfer tests
        await token
          .connect(executorSigner)
          .mint(alice.address, ethers.parseEther('1000'));
      });

      it('Should start as not archived by default', async function () {
        expect(await token.archived()).to.be.false;
      });

      it('Should allow executor to archive token', async function () {
        await expect(token.connect(executorSigner).setArchived(true))
          .to.emit(token, 'ArchivedStatusUpdated')
          .withArgs(true);

        expect(await token.archived()).to.be.true;
      });

      it('Should allow executor to unarchive token', async function () {
        // First archive
        await token.connect(executorSigner).setArchived(true);
        expect(await token.archived()).to.be.true;

        // Then unarchive
        await expect(token.connect(executorSigner).setArchived(false))
          .to.emit(token, 'ArchivedStatusUpdated')
          .withArgs(false);

        expect(await token.archived()).to.be.false;
      });

      it('Should not allow non-executor to archive token', async function () {
        await expect(token.connect(alice).setArchived(true)).to.be.revertedWith(
          '!executor',
        );
      });

      it('Should not allow non-executor to unarchive token', async function () {
        // Archive first
        await token.connect(executorSigner).setArchived(true);

        // Try to unarchive as non-executor
        await expect(token.connect(bob).setArchived(false)).to.be.revertedWith(
          '!executor',
        );
      });

      it('Should prevent minting when archived', async function () {
        // Archive the token
        await token.connect(executorSigner).setArchived(true);

        // Try to mint - should fail
        await expect(
          token
            .connect(executorSigner)
            .mint(bob.address, ethers.parseEther('100')),
        ).to.be.revertedWith('archived');
      });

      it('Should allow minting after unarchiving', async function () {
        // Archive then unarchive
        await token.connect(executorSigner).setArchived(true);
        await token.connect(executorSigner).setArchived(false);

        // Minting should work now
        await token
          .connect(executorSigner)
          .mint(bob.address, ethers.parseEther('100'));

        expect(await token.balanceOf(bob.address)).to.equal(
          ethers.parseEther('100'),
        );
      });

      it('Should prevent transfers when archived', async function () {
        // Archive the token
        await token.connect(executorSigner).setArchived(true);

        // Try to transfer - should fail
        await expect(
          token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
        ).to.be.revertedWith('archived');
      });

      it('Should prevent executor transfers when archived', async function () {
        // Archive the token
        await token.connect(executorSigner).setArchived(true);

        // Even executor cannot transfer when archived
        await expect(
          token
            .connect(executorSigner)
            .transfer(bob.address, ethers.parseEther('10')),
        ).to.be.revertedWith('archived');
      });

      it('Should prevent transferFrom when archived', async function () {
        // Approve bob to spend alice's tokens
        await token
          .connect(alice)
          .approve(bob.address, ethers.parseEther('100'));

        // Archive the token
        await token.connect(executorSigner).setArchived(true);

        // Try transferFrom - should fail
        await expect(
          token
            .connect(bob)
            .transferFrom(
              alice.address,
              charlie.address,
              ethers.parseEther('10'),
            ),
        ).to.be.revertedWith('archived');
      });

      it('Should allow transfers after unarchiving', async function () {
        // Archive then unarchive
        await token.connect(executorSigner).setArchived(true);
        await token.connect(executorSigner).setArchived(false);

        // Transfers should work now
        await token
          .connect(alice)
          .transfer(bob.address, ethers.parseEther('50'));

        expect(await token.balanceOf(bob.address)).to.equal(
          ethers.parseEther('50'),
        );
      });

      it('Should allow reading balances when archived', async function () {
        // Archive the token
        await token.connect(executorSigner).setArchived(true);

        // Reading balances should still work
        expect(await token.balanceOf(alice.address)).to.equal(
          ethers.parseEther('1000'),
        );
        expect(await token.totalSupply()).to.equal(ethers.parseEther('1000'));
      });

      it('Should allow toggling archive status multiple times', async function () {
        // Archive
        await token.connect(executorSigner).setArchived(true);
        expect(await token.archived()).to.be.true;

        // Unarchive
        await token.connect(executorSigner).setArchived(false);
        expect(await token.archived()).to.be.false;

        // Archive again
        await token.connect(executorSigner).setArchived(true);
        expect(await token.archived()).to.be.true;

        // Unarchive again
        await token.connect(executorSigner).setArchived(false);
        expect(await token.archived()).to.be.false;
      });
    });

    describe('Decaying Token Archive', function () {
      let decayingToken: Contract;

      beforeEach(async function () {
        const tx = await decayingTokenFactory
          .connect(executorSigner)
          .deployDecayingToken(
            spaceId,
            'Decaying Archive Token',
            'DARCH',
            ethers.parseEther('5000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            100, // 1% decay
            3600, // 1 hour
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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

        decayingToken = await ethers.getContractAt(
          'DecayingSpaceToken',
          tokenAddress,
        );

        // Mint some tokens to alice
        await decayingToken
          .connect(executorSigner)
          .mint(alice.address, ethers.parseEther('500'));
      });

      it('Should prevent minting decaying tokens when archived', async function () {
        await decayingToken.connect(executorSigner).setArchived(true);

        await expect(
          decayingToken
            .connect(executorSigner)
            .mint(bob.address, ethers.parseEther('100')),
        ).to.be.revertedWith('archived');
      });

      it('Should prevent decaying token transfers when archived', async function () {
        await decayingToken.connect(executorSigner).setArchived(true);

        await expect(
          decayingToken
            .connect(alice)
            .transfer(bob.address, ethers.parseEther('10')),
        ).to.be.revertedWith('archived');
      });

      it('Should allow decaying token operations after unarchiving', async function () {
        // Archive and unarchive
        await decayingToken.connect(executorSigner).setArchived(true);
        await decayingToken.connect(executorSigner).setArchived(false);

        // Operations should work
        await decayingToken
          .connect(executorSigner)
          .mint(bob.address, ethers.parseEther('100'));
        await decayingToken
          .connect(alice)
          .transfer(bob.address, ethers.parseEther('50'));

        expect(await decayingToken.balanceOf(bob.address)).to.be.gt(
          ethers.parseEther('100'),
        );
      });

      it('Should NOT apply decay when archived', async function () {
        // Apply decay first to get a baseline
        await decayingToken.applyDecay(alice.address);
        const balanceBeforeArchive = await decayingToken.balanceOf(
          alice.address,
        );

        // Archive token
        await decayingToken.connect(executorSigner).setArchived(true);

        // Time travel
        await ethers.provider.send('evm_increaseTime', [3600]);
        await ethers.provider.send('evm_mine', []);

        // Balance should remain the same while archived (no decay applied)
        const balanceWhileArchived = await decayingToken.balanceOf(
          alice.address,
        );
        expect(balanceWhileArchived).to.equal(balanceBeforeArchive);

        // Calling applyDecay while archived should update timestamp but not burn tokens
        await decayingToken.applyDecay(alice.address);
        const balanceAfterApply = await decayingToken.balanceOf(alice.address);
        expect(balanceAfterApply).to.equal(balanceBeforeArchive);
      });

      it('Should not accumulate decay during archived period', async function () {
        const initialBalance = await decayingToken.balanceOf(alice.address);

        // Time travel 1 hour and apply decay
        await ethers.provider.send('evm_increaseTime', [3600]);
        await ethers.provider.send('evm_mine', []);

        // Apply decay to burn the tokens for the 1 hour that passed
        await decayingToken.applyDecay(alice.address);
        const balanceAfterFirstDecay = await decayingToken.balanceOf(
          alice.address,
        );

        // Should have decayed by ~1%
        expect(balanceAfterFirstDecay).to.be.lt(initialBalance);

        // Now archive the token
        await decayingToken.connect(executorSigner).setArchived(true);

        // Time travel 10 hours while archived
        await ethers.provider.send('evm_increaseTime', [36000]);
        await ethers.provider.send('evm_mine', []);

        // Balance should still be the same (no decay during archived period)
        const balanceWhileArchived = await decayingToken.balanceOf(
          alice.address,
        );
        expect(balanceWhileArchived).to.equal(balanceAfterFirstDecay);

        // Unarchive - this will automatically update lastApplied timestamps for all holders
        await decayingToken.connect(executorSigner).setArchived(false);

        // Immediately after unarchiving, balance should still be the same
        // because lastApplied was updated to current time during unarchive
        const balanceAfterUnarchive = await decayingToken.balanceOf(
          alice.address,
        );
        expect(balanceAfterUnarchive).to.equal(balanceAfterFirstDecay);

        // Time travel 1 more hour after unarchiving
        await ethers.provider.send('evm_increaseTime', [3600]);
        await ethers.provider.send('evm_mine', []);

        // Now decay should apply for only the 1 hour after unarchiving, not the 10 hours during archive
        const balanceAfterUnarchiveDecay = await decayingToken.balanceOf(
          alice.address,
        );
        expect(balanceAfterUnarchiveDecay).to.be.lt(balanceAfterUnarchive);
        // Should have decayed by approximately 1% for 1 period
        expect(balanceAfterUnarchiveDecay).to.be.gt(
          (balanceAfterFirstDecay * 98n) / 100n,
        );
      });
    });

    describe('Ownership Token Archive', function () {
      let ownershipToken: Contract;

      beforeEach(async function () {
        const tx = await ownershipTokenFactory
          .connect(executorSigner)
          .deployOwnershipToken(
            spaceId,
            'Ownership Archive Token',
            'OARCH',
            ethers.parseEther('100'),
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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

        // Join space so alice becomes a member
        await daoSpaceFactory.connect(alice).joinSpace(spaceId);
        await daoSpaceFactory.connect(bob).joinSpace(spaceId);

        // Mint tokens to alice
        await ownershipToken
          .connect(executorSigner)
          .mint(alice.address, ethers.parseEther('10'));
      });

      it('Should prevent minting ownership tokens when archived', async function () {
        await ownershipToken.connect(executorSigner).setArchived(true);

        await expect(
          ownershipToken
            .connect(executorSigner)
            .mint(bob.address, ethers.parseEther('5')),
        ).to.be.revertedWith('archived');
      });

      it('Should prevent ownership token transfers when archived', async function () {
        await ownershipToken.connect(executorSigner).setArchived(true);

        await expect(
          ownershipToken
            .connect(executorSigner)
            .transfer(bob.address, ethers.parseEther('5')),
        ).to.be.revertedWith('archived');
      });

      it('Should prevent transferToEscrow when archived', async function () {
        await ownershipToken.connect(executorSigner).setArchived(true);

        await expect(
          ownershipToken
            .connect(alice)
            .transferToEscrow(1, ethers.parseEther('1')),
        ).to.be.revertedWith('archived');
      });

      it('Should allow ownership token operations after unarchiving', async function () {
        // Archive and unarchive
        await ownershipToken.connect(executorSigner).setArchived(true);
        await ownershipToken.connect(executorSigner).setArchived(false);

        // Operations should work
        await ownershipToken
          .connect(executorSigner)
          .mint(bob.address, ethers.parseEther('5'));

        // Executor transfers to alice (with auto-minting enabled)
        await ownershipToken
          .connect(executorSigner)
          .transfer(alice.address, ethers.parseEther('3'));

        // Alice: 10 (initial) + 3 (from executor) = 13
        expect(await ownershipToken.balanceOf(alice.address)).to.equal(
          ethers.parseEther('13'),
        );
        // Bob: 5 (minted)
        expect(await ownershipToken.balanceOf(bob.address)).to.equal(
          ethers.parseEther('5'),
        );
      });
    });

    describe('Archive with Auto-Minting', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Auto Mint Archive Token',
            'AMART',
            ethers.parseEther('10000'),
            true,
            false,
            true, // autoMinting enabled
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            false,
            false,
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
      });

      it('Should prevent auto-mint transfers when archived', async function () {
        await token.connect(executorSigner).setArchived(true);

        // Even with auto-minting enabled, archived tokens cannot transfer
        await expect(
          token
            .connect(executorSigner)
            .transfer(alice.address, ethers.parseEther('100')),
        ).to.be.revertedWith('archived');
      });

      it('Should allow auto-mint transfers after unarchiving', async function () {
        // Archive and unarchive
        await token.connect(executorSigner).setArchived(true);
        await token.connect(executorSigner).setArchived(false);

        // Auto-mint transfer should work
        await token
          .connect(executorSigner)
          .transfer(alice.address, ethers.parseEther('100'));

        expect(await token.balanceOf(alice.address)).to.equal(
          ethers.parseEther('100'),
        );
      });
    });

    describe('Archive with Whitelists', function () {
      let token: Contract;

      beforeEach(async function () {
        const tx = await regularTokenFactory
          .connect(executorSigner)
          .deployToken(
            spaceId,
            'Whitelist Archive Token',
            'WHART',
            ethers.parseEther('10000'),
            true,
            false,
            true,
            0,
            ethers.ZeroAddress, // priceCurrencyFeed (USD)
            true, // useTransferWhitelist
            true, // useReceiveWhitelist
            [], // initialTransferWhitelist
            [], // initialReceiveWhitelist
            [], // initialTransferWhitelistSpaceIds
            [], // initialReceiveWhitelistSpaceIds
            0,
            [],
            ethers.ZeroAddress,
            0,
            0,
            0,
            [],
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
        const tokenAddress = tokenDeployedEvent.args.tokenAddress;

        token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);

        // Setup whitelists
        await token
          .connect(executorSigner)
          .batchSetTransferWhitelist([alice.address], [true]);
        await token
          .connect(executorSigner)
          .batchSetReceiveWhitelist([bob.address], [true]);

        // Mint tokens to alice
        await token
          .connect(executorSigner)
          .mint(alice.address, ethers.parseEther('100'));
      });

      it('Should prevent whitelisted transfers when archived', async function () {
        await token.connect(executorSigner).setArchived(true);

        // Even though alice is whitelisted, archived prevents transfer
        await expect(
          token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
        ).to.be.revertedWith('archived');
      });

      it('Should allow updating whitelists when archived', async function () {
        await token.connect(executorSigner).setArchived(true);

        // Whitelist updates should still work
        await expect(
          token
            .connect(executorSigner)
            .batchSetTransferWhitelist([charlie.address], [true]),
        )
          .to.emit(token, 'TransferWhitelistUpdated')
          .withArgs(charlie.address, true);

        expect(await token.canTransfer(charlie.address)).to.be.true;
      });
    });
  });

  describe('12. Complex Scenarios', function () {
    it('Should handle soulbound-like token configuration', async function () {
      // Deploy non-transferable token with receive whitelist
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Soulbound Token',
        'SBT',
        ethers.parseEther('1000'),
        false, // non-transferable
        true, // fixed supply
        true, // autoMinting
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        true, // only whitelisted can receive
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Whitelist alice to receive
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist([alice.address], [true]);

      // Executor can transfer to whitelisted alice
      await token
        .connect(executorSigner)
        .transfer(alice.address, ethers.parseEther('10'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('10'),
      );

      // Alice cannot transfer to anyone (soulbound)
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('5')),
      ).to.be.revertedWith('!transferable');

      // Executor cannot transfer to non-whitelisted bob
      await expect(
        token
          .connect(executorSigner)
          .transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!recv whitelist');
    });

    it('Should handle KYC token with both whitelists', async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'KYC Token',
        'KYC',
        ethers.parseEther('10000'),
        true, // transferable
        false,
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        true, // only whitelisted can send
        true, // only whitelisted can receive
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const token = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Give alice some tokens
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('100'));

      // Alice cannot transfer (not whitelisted)
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('!send whitelist');

      // Whitelist alice and bob
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address, bob.address], [true, true]);
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist([alice.address, bob.address], [true, true]);

      // Now both can transfer freely
      await token.connect(alice).transfer(bob.address, ethers.parseEther('10'));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('10'),
      );

      // Bob can transfer back to alice
      await token.connect(bob).transfer(alice.address, ethers.parseEther('5'));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('95'),
      );
    });
  });

  describe('13. Space-Based Whitelisting', function () {
    /**
     * NOTE: RegularSpaceToken and DecayingSpaceToken have a hardcoded spacesContract address
     * (0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9) for production use.
     *
     * In local tests, this address doesn't point to the deployed DAOSpaceFactory,
     * so space membership checks will fail. These tests focus on:
     * 1. Management functions (add/remove space IDs from whitelists)
     * 2. Access control (only executor can manage)
     * 3. View functions
     *
     * The actual membership-based transfer/receive logic works in production
     * where the hardcoded address points to the real DAOSpaceFactory.
     */
    let token: Contract;
    let secondSpaceId: bigint;

    beforeEach(async function () {
      // Create a second space for testing
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

      // Deploy token with whitelists enabled
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Space Whitelist Token',
        'SWT',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        true, // useTransferWhitelist
        true, // useReceiveWhitelist
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);

      // Mint tokens to alice (she needs to be individually whitelisted for receive first)
      await token
        .connect(executorSigner)
        .batchSetReceiveWhitelist([alice.address], [true]);
      await token
        .connect(executorSigner)
        .mint(alice.address, ethers.parseEther('1000'));
    });

    describe('Space Whitelist Management', function () {
      it('Should add spaces to transfer whitelist', async function () {
        // Add space to transfer whitelist
        await expect(
          token
            .connect(executorSigner)
            .batchAddTransferWhitelistSpaces([secondSpaceId]),
        )
          .to.emit(token, 'TransferWhitelistSpaceAdded')
          .withArgs(secondSpaceId);

        // Verify it's in the list
        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(1);
        expect(transferSpaces[0]).to.equal(secondSpaceId);
        expect(await token.isTransferWhitelistedSpace(secondSpaceId)).to.be
          .true;
      });

      it('Should add spaces to receive whitelist', async function () {
        // Add space to receive whitelist
        await expect(
          token
            .connect(executorSigner)
            .batchAddReceiveWhitelistSpaces([secondSpaceId]),
        )
          .to.emit(token, 'ReceiveWhitelistSpaceAdded')
          .withArgs(secondSpaceId);

        // Verify it's in the list
        const receiveSpaces = await token.getReceiveWhitelistedSpaces();
        expect(receiveSpaces.length).to.equal(1);
        expect(receiveSpaces[0]).to.equal(secondSpaceId);
        expect(await token.isReceiveWhitelistedSpace(secondSpaceId)).to.be.true;
      });

      it('Should remove spaces from transfer whitelist', async function () {
        // Add space first
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);
        expect(await token.isTransferWhitelistedSpace(secondSpaceId)).to.be
          .true;

        // Remove space
        await expect(
          token
            .connect(executorSigner)
            .batchRemoveTransferWhitelistSpaces([secondSpaceId]),
        )
          .to.emit(token, 'TransferWhitelistSpaceRemoved')
          .withArgs(secondSpaceId);

        // Verify it's removed
        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(0);
        expect(await token.isTransferWhitelistedSpace(secondSpaceId)).to.be
          .false;
      });

      it('Should remove spaces from receive whitelist', async function () {
        // Add space first
        await token
          .connect(executorSigner)
          .batchAddReceiveWhitelistSpaces([secondSpaceId]);
        expect(await token.isReceiveWhitelistedSpace(secondSpaceId)).to.be.true;

        // Remove space
        await expect(
          token
            .connect(executorSigner)
            .batchRemoveReceiveWhitelistSpaces([secondSpaceId]),
        )
          .to.emit(token, 'ReceiveWhitelistSpaceRemoved')
          .withArgs(secondSpaceId);

        // Verify it's removed
        const receiveSpaces = await token.getReceiveWhitelistedSpaces();
        expect(receiveSpaces.length).to.equal(0);
        expect(await token.isReceiveWhitelistedSpace(secondSpaceId)).to.be
          .false;
      });
    });

    describe('Multiple Spaces Management', function () {
      let thirdSpaceId: bigint;

      beforeEach(async function () {
        // Create a third space
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
      });

      it('Should add multiple spaces in one batch', async function () {
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId, thirdSpaceId]);

        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(2);
        expect(transferSpaces).to.include(secondSpaceId);
        expect(transferSpaces).to.include(thirdSpaceId);
      });

      it('Should remove multiple spaces in one batch', async function () {
        // Add spaces
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId, thirdSpaceId]);

        // Remove both
        await token
          .connect(executorSigner)
          .batchRemoveTransferWhitelistSpaces([secondSpaceId, thirdSpaceId]);

        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(0);
      });

      it('Should remove one space while keeping others', async function () {
        // Add both spaces
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId, thirdSpaceId]);

        // Remove only secondSpaceId
        await token
          .connect(executorSigner)
          .batchRemoveTransferWhitelistSpaces([secondSpaceId]);

        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(1);
        expect(transferSpaces[0]).to.equal(thirdSpaceId);
        expect(await token.isTransferWhitelistedSpace(secondSpaceId)).to.be
          .false;
        expect(await token.isTransferWhitelistedSpace(thirdSpaceId)).to.be.true;
      });
    });

    describe('Edge Cases', function () {
      it('Should skip adding space that is already whitelisted', async function () {
        // Add space
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);

        // Add same space again - should not emit event or duplicate
        const tx = await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);
        const receipt = await tx.wait();

        // Should not emit TransferWhitelistSpaceAdded for already added space
        const events = receipt?.logs
          .map((log: any) => {
            try {
              return token.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .filter(
            (event: any) =>
              event && event.name === 'TransferWhitelistSpaceAdded',
          );
        expect(events.length).to.equal(0);

        // Verify only one entry in array
        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(1);
      });

      it('Should skip removing space that is not in whitelist', async function () {
        // Try to remove space that was never added
        const tx = await token
          .connect(executorSigner)
          .batchRemoveTransferWhitelistSpaces([secondSpaceId]);
        const receipt = await tx.wait();

        // Should not emit event
        const events = receipt?.logs
          .map((log: any) => {
            try {
              return token.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .filter(
            (event: any) =>
              event && event.name === 'TransferWhitelistSpaceRemoved',
          );
        expect(events.length).to.equal(0);
      });

      it('Should handle batch operations with mixed valid/invalid spaces', async function () {
        // Add one space first
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);

        // Try to add multiple including the already-added one
        const newSpaceId = 999n; // Some arbitrary space ID
        const tx = await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId, newSpaceId]);
        const receipt = await tx.wait();

        // Should only emit for the new space
        const events = receipt?.logs
          .map((log: any) => {
            try {
              return token.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .filter(
            (event: any) =>
              event && event.name === 'TransferWhitelistSpaceAdded',
          );
        expect(events.length).to.equal(1);
        expect(events[0].args.spaceId).to.equal(newSpaceId);

        // Verify both are in the list
        const transferSpaces = await token.getTransferWhitelistedSpaces();
        expect(transferSpaces.length).to.equal(2);
      });
    });

    describe('Access Control', function () {
      it('Should only allow executor to add spaces to transfer whitelist', async function () {
        await expect(
          token.connect(alice).batchAddTransferWhitelistSpaces([secondSpaceId]),
        ).to.be.revertedWith('!executor');
      });

      it('Should only allow executor to remove spaces from transfer whitelist', async function () {
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);

        await expect(
          token
            .connect(bob)
            .batchRemoveTransferWhitelistSpaces([secondSpaceId]),
        ).to.be.revertedWith('!executor');
      });

      it('Should only allow executor to add spaces to receive whitelist', async function () {
        await expect(
          token
            .connect(charlie)
            .batchAddReceiveWhitelistSpaces([secondSpaceId]),
        ).to.be.revertedWith('!executor');
      });

      it('Should only allow executor to remove spaces from receive whitelist', async function () {
        await token
          .connect(executorSigner)
          .batchAddReceiveWhitelistSpaces([secondSpaceId]);

        await expect(
          token
            .connect(alice)
            .batchRemoveReceiveWhitelistSpaces([secondSpaceId]),
        ).to.be.revertedWith('!executor');
      });
    });

    describe('View Functions', function () {
      it('Should return correct whitelisted spaces', async function () {
        // Initially empty
        expect((await token.getTransferWhitelistedSpaces()).length).to.equal(0);
        expect((await token.getReceiveWhitelistedSpaces()).length).to.equal(0);

        // Add spaces
        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);
        await token
          .connect(executorSigner)
          .batchAddReceiveWhitelistSpaces([secondSpaceId]);

        const transferSpaces = await token.getTransferWhitelistedSpaces();
        const receiveSpaces = await token.getReceiveWhitelistedSpaces();

        expect(transferSpaces.length).to.equal(1);
        expect(receiveSpaces.length).to.equal(1);
        expect(transferSpaces[0]).to.equal(secondSpaceId);
        expect(receiveSpaces[0]).to.equal(secondSpaceId);
      });

      it('Should correctly check if space is whitelisted', async function () {
        expect(await token.isTransferWhitelistedSpace(secondSpaceId)).to.be
          .false;
        expect(await token.isReceiveWhitelistedSpace(secondSpaceId)).to.be
          .false;

        await token
          .connect(executorSigner)
          .batchAddTransferWhitelistSpaces([secondSpaceId]);
        await token
          .connect(executorSigner)
          .batchAddReceiveWhitelistSpaces([secondSpaceId]);

        expect(await token.isTransferWhitelistedSpace(secondSpaceId)).to.be
          .true;
        expect(await token.isReceiveWhitelistedSpace(secondSpaceId)).to.be.true;
      });
    });
  });

  describe('14. Price with Currency Feed', function () {
    let token: Contract;

    beforeEach(async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Currency Token',
        'CUR',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        1000000n, // $1.00
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
    });

    it('Should initialize with USD (zero address) as default currency feed', async function () {
      expect(await token.priceCurrencyFeed()).to.equal(ethers.ZeroAddress);
      expect(await token.tokenPrice()).to.equal(1000000n);
      expect(await token.priceInUSD()).to.equal(1000000n);
    });

    it('Should allow executor to set price with a currency feed', async function () {
      const newPrice = 2000000n; // 2.00 in new currency
      // Use a non-zero address to simulate a Chainlink feed
      const fakeCurrencyFeed = alice.address;

      await expect(
        token
          .connect(executorSigner)
          .setPriceWithCurrency(newPrice, fakeCurrencyFeed),
      )
        .to.emit(token, 'PriceInUSDUpdated')
        .withArgs(1000000n, newPrice)
        .and.to.emit(token, 'PriceCurrencyUpdated')
        .withArgs(newPrice, fakeCurrencyFeed);

      expect(await token.tokenPrice()).to.equal(newPrice);
      expect(await token.priceInUSD()).to.equal(newPrice);
      expect(await token.priceCurrencyFeed()).to.equal(fakeCurrencyFeed);
    });

    it('Should allow switching back to USD (zero address)', async function () {
      const fakeCurrencyFeed = alice.address;

      // Set to non-USD currency
      await token
        .connect(executorSigner)
        .setPriceWithCurrency(2000000n, fakeCurrencyFeed);
      expect(await token.priceCurrencyFeed()).to.equal(fakeCurrencyFeed);

      // Switch back to USD
      await token
        .connect(executorSigner)
        .setPriceWithCurrency(5000000n, ethers.ZeroAddress);

      expect(await token.tokenPrice()).to.equal(5000000n);
      expect(await token.priceInUSD()).to.equal(5000000n);
      expect(await token.priceCurrencyFeed()).to.equal(ethers.ZeroAddress);
    });

    it('Should only allow executor to set price with currency', async function () {
      await expect(
        token.connect(alice).setPriceWithCurrency(2000000n, alice.address),
      ).to.be.revertedWith('!executor');
    });

    it('Should keep tokenPrice and priceInUSD in sync', async function () {
      const newPrice = 3500000n;
      const fakeCurrencyFeed = bob.address;

      await token
        .connect(executorSigner)
        .setPriceWithCurrency(newPrice, fakeCurrencyFeed);

      expect(await token.tokenPrice()).to.equal(newPrice);
      expect(await token.priceInUSD()).to.equal(newPrice);

      // Also test setPriceInUSD keeps them in sync
      const anotherPrice = 7000000n;
      await token.connect(executorSigner).setPriceInUSD(anotherPrice);

      expect(await token.tokenPrice()).to.equal(anotherPrice);
      expect(await token.priceInUSD()).to.equal(anotherPrice);
    });

    it('Should deploy token with non-USD currency feed', async function () {
      const fakeCurrencyFeed = charlie.address;
      const cadPrice = 1500000n; // 1.50 CAD

      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'CAD Token',
        'CAD',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        cadPrice,
        fakeCurrencyFeed, // non-zero currency feed
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      const cadToken = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      expect(await cadToken.tokenPrice()).to.equal(cadPrice);
      expect(await cadToken.priceInUSD()).to.equal(cadPrice);
      expect(await cadToken.priceCurrencyFeed()).to.equal(fakeCurrencyFeed);
    });
  });

  describe('15. Token Name and Symbol Change', function () {
    let token: Contract;

    beforeEach(async function () {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Original Name',
        'ORIG',
        ethers.parseEther('10000'),
        true,
        false,
        true,
        0,
        ethers.ZeroAddress, // priceCurrencyFeed (USD)
        false,
        false,
        [], // initialTransferWhitelist
        [], // initialReceiveWhitelist
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;

      token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
    });

    it('Should return initial name and symbol', async function () {
      expect(await token.name()).to.equal('Original Name');
      expect(await token.symbol()).to.equal('ORIG');
    });

    it('Should allow executor to change token name', async function () {
      await expect(token.connect(executorSigner).setTokenName('Updated Name'))
        .to.emit(token, 'TokenNameUpdated')
        .withArgs('Original Name', 'Updated Name');

      expect(await token.name()).to.equal('Updated Name');
    });

    it('Should allow executor to change token symbol', async function () {
      await expect(token.connect(executorSigner).setTokenSymbol('UPD'))
        .to.emit(token, 'TokenSymbolUpdated')
        .withArgs('ORIG', 'UPD');

      expect(await token.symbol()).to.equal('UPD');
    });

    it('Should allow changing name and symbol multiple times', async function () {
      await token.connect(executorSigner).setTokenName('Name V2');
      expect(await token.name()).to.equal('Name V2');

      await token.connect(executorSigner).setTokenName('Name V3');
      expect(await token.name()).to.equal('Name V3');

      await token.connect(executorSigner).setTokenSymbol('V2');
      expect(await token.symbol()).to.equal('V2');

      await token.connect(executorSigner).setTokenSymbol('V3');
      expect(await token.symbol()).to.equal('V3');
    });

    it('Should not allow non-executor to change name', async function () {
      await expect(
        token.connect(alice).setTokenName('Hacked Name'),
      ).to.be.revertedWith('!executor');
    });

    it('Should not allow non-executor to change symbol', async function () {
      await expect(
        token.connect(bob).setTokenSymbol('HACK'),
      ).to.be.revertedWith('!executor');
    });

    it('Should not allow setting empty name', async function () {
      await expect(
        token.connect(executorSigner).setTokenName(''),
      ).to.be.revertedWith('empty name');
    });

    it('Should not allow setting empty symbol', async function () {
      await expect(
        token.connect(executorSigner).setTokenSymbol(''),
      ).to.be.revertedWith('empty symbol');
    });

    it('Should emit correct old values in events after multiple changes', async function () {
      await token.connect(executorSigner).setTokenName('Second Name');

      await expect(token.connect(executorSigner).setTokenName('Third Name'))
        .to.emit(token, 'TokenNameUpdated')
        .withArgs('Second Name', 'Third Name');

      await token.connect(executorSigner).setTokenSymbol('SYM2');

      await expect(token.connect(executorSigner).setTokenSymbol('SYM3'))
        .to.emit(token, 'TokenSymbolUpdated')
        .withArgs('SYM2', 'SYM3');
    });

    it('Should work for decaying tokens as well', async function () {
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'Decay Original',
          'DORIG',
          ethers.parseEther('5000'),
          true,
          false,
          true,
          0,
          ethers.ZeroAddress, // priceCurrencyFeed (USD)
          false,
          false,
          [], // initialTransferWhitelist
          [], // initialReceiveWhitelist
          [], // initialTransferWhitelistSpaceIds
          [], // initialReceiveWhitelistSpaceIds
          100, // 1% decay
          3600, // 1 hour
          ethers.ZeroAddress,
          0,
          0,
          0,
          [],
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

      const decayingToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      expect(await decayingToken.name()).to.equal('Decay Original');
      expect(await decayingToken.symbol()).to.equal('DORIG');

      await decayingToken.connect(executorSigner).setTokenName('Decay Updated');
      await decayingToken.connect(executorSigner).setTokenSymbol('DUPD');

      expect(await decayingToken.name()).to.equal('Decay Updated');
      expect(await decayingToken.symbol()).to.equal('DUPD');
    });

    it('Should work for ownership tokens as well', async function () {
      const tx = await ownershipTokenFactory
        .connect(executorSigner)
        .deployOwnershipToken(
          spaceId,
          'Ownership Original',
          'OORIG',
          ethers.parseEther('100'),
          false,
          true,
          0,
          ethers.ZeroAddress, // priceCurrencyFeed (USD)
          false,
          false,
          [], // initialTransferWhitelist
          [], // initialReceiveWhitelist
          [], // initialTransferWhitelistSpaceIds
          [], // initialReceiveWhitelistSpaceIds
          ethers.ZeroAddress,
          0,
          0,
          0,
          [],
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

      const ownershipToken = await ethers.getContractAt(
        'OwnershipSpaceToken',
        tokenAddress,
      );

      expect(await ownershipToken.name()).to.equal('Ownership Original');
      expect(await ownershipToken.symbol()).to.equal('OORIG');

      await ownershipToken
        .connect(executorSigner)
        .setTokenName('Ownership Updated');
      await ownershipToken.connect(executorSigner).setTokenSymbol('OUPD');

      expect(await ownershipToken.name()).to.equal('Ownership Updated');
      expect(await ownershipToken.symbol()).to.equal('OUPD');
    });
  });

  describe('16. Mutual Credit', function () {
    const CREDIT_SPACES_CONTRACT = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

    async function setupMockCreditMembership(
      whitelistedSpaceIds: bigint[] = [spaceId],
      memberAddresses: string[] = [alice.address, bob.address],
    ) {
      const MockDAOSpaceFactory = await ethers.getContractFactory(
        'MockDAOSpaceFactory',
      );
      const mock = await MockDAOSpaceFactory.deploy();
      const mockCode = await ethers.provider.getCode(await mock.getAddress());
      await ethers.provider.send('hardhat_setCode', [
        CREDIT_SPACES_CONTRACT,
        mockCode,
      ]);

      const creditSpacesFactory = await ethers.getContractAt(
        'MockDAOSpaceFactory',
        CREDIT_SPACES_CONTRACT,
      );

      for (const sid of whitelistedSpaceIds) {
        await creditSpacesFactory.setExecutor(sid, executorSigner.address);
        for (const memberAddress of memberAddresses) {
          await creditSpacesFactory.setMember(sid, memberAddress, true);
        }
      }
    }

    async function deployRegularWithMutualCredit({
      tokenName = 'Credit Token',
      tokenSymbol = 'CRED',
      defaultCreditLimit = ethers.parseEther('100'),
      initialCreditWhitelistSpaceIds = [spaceId],
    }: {
      tokenName?: string;
      tokenSymbol?: string;
      defaultCreditLimit?: bigint;
      initialCreditWhitelistSpaceIds?: bigint[];
    } = {}) {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        tokenName,
        tokenSymbol,
        ethers.parseEther('1000000'),
        true,
        false,
        true,
        0,
        ethers.ZeroAddress,
        false,
        false,
        [],
        [],
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        defaultCreditLimit,
        initialCreditWhitelistSpaceIds,
        ethers.ZeroAddress,
        0,
        0,
        0,
        [],
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      return await ethers.getContractAt('RegularSpaceToken', tokenAddress);
    }

    it('Should initialize mutual credit config from deployToken', async function () {
      await setupMockCreditMembership();
      const creditLimit = ethers.parseEther('75');
      const token = await deployRegularWithMutualCredit({
        defaultCreditLimit: creditLimit,
        initialCreditWhitelistSpaceIds: [spaceId],
      });

      expect(await token.defaultCreditLimit()).to.equal(creditLimit);
      expect(await token.creditLimitOf(alice.address)).to.equal(creditLimit);
      expect(await token.creditLimitOf(charlie.address)).to.equal(0);
      expect(await token.getCreditWhitelistedSpaces()).to.deep.equal([spaceId]);
    });

    it('Should use credit when sender balance is insufficient', async function () {
      await setupMockCreditMembership();
      const token = await deployRegularWithMutualCredit();
      const amount = ethers.parseEther('40');

      await expect(token.connect(alice).transfer(bob.address, amount))
        .to.emit(token, 'CreditUsed')
        .withArgs(alice.address, amount, amount);

      expect(await token.creditBalanceOf(alice.address)).to.equal(amount);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
      expect(await token.netBalanceOf(alice.address)).to.equal(-amount);
    });

    it('Should enforce credit limit when transfer exceeds available credit', async function () {
      await setupMockCreditMembership();
      const limit = ethers.parseEther('10');
      const token = await deployRegularWithMutualCredit({
        defaultCreditLimit: limit,
      });

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('11')),
      ).to.be.revertedWith('!credit');
    });

    it('Should auto-repay debt when debtor receives tokens', async function () {
      await setupMockCreditMembership();
      const token = await deployRegularWithMutualCredit();

      await token.connect(alice).transfer(bob.address, ethers.parseEther('50'));
      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('50'),
      );

      await expect(
        token.connect(bob).transfer(alice.address, ethers.parseEther('20')),
      )
        .to.emit(token, 'CreditRepaid')
        .withArgs(
          alice.address,
          ethers.parseEther('20'),
          ethers.parseEther('30'),
        );

      expect(await token.creditBalanceOf(alice.address)).to.equal(
        ethers.parseEther('30'),
      );
      // Alice receives 20 then immediately burns 20 to repay debt.
      expect(await token.balanceOf(alice.address)).to.equal(0);
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('30'),
      );
    });

    it('Should support credit admin functions and enforce access control', async function () {
      await setupMockCreditMembership();
      const token = await deployRegularWithMutualCredit({
        defaultCreditLimit: 0n,
        initialCreditWhitelistSpaceIds: [],
      });

      await expect(token.connect(executorSigner).setDefaultCreditLimit(123n))
        .to.emit(token, 'DefaultCreditLimitUpdated')
        .withArgs(0n, 123n);
      expect(await token.defaultCreditLimit()).to.equal(123n);

      await expect(
        token.connect(executorSigner).batchAddCreditWhitelistSpaces([spaceId]),
      )
        .to.emit(token, 'CreditWhitelistSpaceAdded')
        .withArgs(spaceId);
      expect(await token.creditLimitOf(alice.address)).to.equal(123n);

      await expect(
        token
          .connect(executorSigner)
          .batchRemoveCreditWhitelistSpaces([spaceId]),
      )
        .to.emit(token, 'CreditWhitelistSpaceRemoved')
        .withArgs(spaceId);
      expect(await token.creditLimitOf(alice.address)).to.equal(0);

      await expect(
        token.connect(alice).setDefaultCreditLimit(1),
      ).to.be.revertedWith('!executor');
      await expect(
        token.connect(bob).batchAddCreditWhitelistSpaces([spaceId]),
      ).to.be.revertedWith('!executor');
      await expect(
        token.connect(charlie).batchRemoveCreditWhitelistSpaces([spaceId]),
      ).to.be.revertedWith('!executor');
    });

    it('Should grant mutual credit to address-whitelisted accounts without space membership', async function () {
      const limit = ethers.parseEther('50');
      const token = await deployRegularWithMutualCredit({
        defaultCreditLimit: limit,
        initialCreditWhitelistSpaceIds: [],
      });

      expect(await token.creditLimitOf(charlie.address)).to.equal(0);

      await expect(
        token
          .connect(executorSigner)
          .batchSetCreditWhitelistAddresses([charlie.address], [true]),
      )
        .to.emit(token, 'CreditWhitelistAddressUpdated')
        .withArgs(charlie.address, true);

      expect(await token.isCreditWhitelistedAddress(charlie.address)).to.be
        .true;
      expect(await token.creditLimitOf(charlie.address)).to.equal(limit);

      await expect(
        token.connect(charlie).transfer(bob.address, ethers.parseEther('10')),
      )
        .to.emit(token, 'CreditUsed')
        .withArgs(
          charlie.address,
          ethers.parseEther('10'),
          ethers.parseEther('10'),
        );

      await expect(
        token
          .connect(executorSigner)
          .batchSetCreditWhitelistAddresses([charlie.address], [false]),
      )
        .to.emit(token, 'CreditWhitelistAddressUpdated')
        .withArgs(charlie.address, false);

      expect(await token.creditLimitOf(charlie.address)).to.equal(0);
      await expect(
        token.connect(charlie).transfer(bob.address, ethers.parseEther('1')),
      ).to.be.revertedWith('!credit');
    });

    it('Should reject batchSetCreditWhitelistAddresses from unrelated accounts', async function () {
      const token = await deployRegularWithMutualCredit({
        initialCreditWhitelistSpaceIds: [],
      });
      await expect(
        token
          .connect(alice)
          .batchSetCreditWhitelistAddresses([bob.address], [true]),
      ).to.be.revertedWith('!executor/owner');
    });

    it('Should allow Ownable owner to batchSetCreditWhitelistAddresses', async function () {
      const TOKEN_OWNER = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';
      const limit = ethers.parseEther('30');
      const token = await deployRegularWithMutualCredit({
        defaultCreditLimit: limit,
        initialCreditWhitelistSpaceIds: [],
      });

      await ethers.provider.send('hardhat_impersonateAccount', [TOKEN_OWNER]);
      await ethers.provider.send('hardhat_setBalance', [
        TOKEN_OWNER,
        '0x1000000000000000000',
      ]);
      const ownerSigner = await ethers.getSigner(TOKEN_OWNER);

      await expect(
        token
          .connect(ownerSigner)
          .batchSetCreditWhitelistAddresses([charlie.address], [true]),
      )
        .to.emit(token, 'CreditWhitelistAddressUpdated')
        .withArgs(charlie.address, true);

      expect(await token.creditLimitOf(charlie.address)).to.equal(limit);

      await ethers.provider.send('hardhat_stopImpersonatingAccount', [
        TOKEN_OWNER,
      ]);
    });
  });

  describe('17. Token Purchase', function () {
    const PURCHASE_SPACES_CONTRACT =
      '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

    async function setupMockPurchaseMembership(
      entries: { sid: bigint; members: string[] }[],
    ) {
      const MockDAOSpaceFactory = await ethers.getContractFactory(
        'MockDAOSpaceFactory',
      );
      const mock = await MockDAOSpaceFactory.deploy();
      const mockCode = await ethers.provider.getCode(await mock.getAddress());
      await ethers.provider.send('hardhat_setCode', [
        PURCHASE_SPACES_CONTRACT,
        mockCode,
      ]);

      const spaces = await ethers.getContractAt(
        'MockDAOSpaceFactory',
        PURCHASE_SPACES_CONTRACT,
      );

      for (const entry of entries) {
        await spaces.setExecutor(entry.sid, executorSigner.address);
        for (const memberAddress of entry.members) {
          await spaces.setMember(entry.sid, memberAddress, true);
        }
      }
    }

    async function deploySaleToken({
      useReceiveWhitelist = false,
      paymentTokenAddress = ethers.ZeroAddress,
      paymentTokenPricePerToken = 0n,
      tokensForSale = 0n,
      purchaseEligibilityMode = 0,
      initialPurchaseWhitelistSpaceIds = [] as bigint[],
    }: {
      useReceiveWhitelist?: boolean;
      paymentTokenAddress?: string;
      paymentTokenPricePerToken?: bigint;
      tokensForSale?: bigint;
      purchaseEligibilityMode?: number;
      initialPurchaseWhitelistSpaceIds?: bigint[];
    } = {}) {
      const tx = await regularTokenFactory.connect(executorSigner).deployToken(
        spaceId,
        'Sale Token',
        'SALE',
        ethers.parseEther('1000000'),
        true,
        false,
        true,
        0,
        ethers.ZeroAddress,
        false,
        useReceiveWhitelist,
        [],
        [],
        [], // initialTransferWhitelistSpaceIds
        [], // initialReceiveWhitelistSpaceIds
        0,
        [],
        paymentTokenAddress,
        paymentTokenPricePerToken,
        tokensForSale,
        purchaseEligibilityMode,
        initialPurchaseWhitelistSpaceIds,
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
      const tokenAddress = tokenDeployedEvent.args.tokenAddress;
      return await ethers.getContractAt('RegularSpaceToken', tokenAddress);
    }

    async function deployPaymentToken() {
      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const paymentToken = await MockERC20.deploy('Mock USDC', 'mUSDC', 6);
      return paymentToken;
    }

    it('Should initialize sale config at deployment and expose sale details getter', async function () {
      await setupMockPurchaseMembership([
        { sid: spaceId, members: [alice.address, bob.address] },
      ]);
      const paymentToken = await deployPaymentToken();
      const salePrice = 2_500_000n; // 2.5 payment tokens per 1 token
      const saleCap = ethers.parseEther('100');
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: salePrice,
        tokensForSale: saleCap,
      });

      const sale = await token.getTokenSaleDetails();
      expect(sale.salePaymentToken).to.equal(await paymentToken.getAddress());
      expect(sale.salePricePerToken).to.equal(salePrice);
      expect(sale.tokensLeftToSell).to.equal(saleCap);
    });

    it('Should let executor configure and reconfigure sale later', async function () {
      await setupMockPurchaseMembership([
        { sid: spaceId, members: [alice.address, bob.address] },
      ]);
      const paymentTokenA = await deployPaymentToken();
      const paymentTokenB = await deployPaymentToken();
      const token = await deploySaleToken();

      await expect(
        token
          .connect(executorSigner)
          .configureTokenSale(
            await paymentTokenA.getAddress(),
            1_000_000n,
            ethers.parseEther('200'),
          ),
      )
        .to.emit(token, 'TokenSaleConfigured')
        .withArgs(
          await paymentTokenA.getAddress(),
          1_000_000n,
          ethers.parseEther('200'),
        );

      await token
        .connect(executorSigner)
        .configureTokenSale(
          await paymentTokenB.getAddress(),
          2_000_000n,
          ethers.parseEther('500'),
        );

      const sale = await token.getTokenSaleDetails();
      expect(sale.salePaymentToken).to.equal(await paymentTokenB.getAddress());
      expect(sale.salePricePerToken).to.equal(2_000_000n);
      expect(sale.tokensLeftToSell).to.equal(ethers.parseEther('500'));
    });

    it('Should route payment token to treasury and mint purchased tokens', async function () {
      await setupMockPurchaseMembership([
        { sid: spaceId, members: [alice.address, bob.address] },
      ]);
      const paymentToken = await deployPaymentToken();
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: 2_000_000n,
        tokensForSale: ethers.parseEther('100'),
      });

      const buyAmount = ethers.parseEther('3');
      const expectedPayment = 6_000_000n; // 3 * 2.0 with 6 decimals

      await paymentToken.mint(alice.address, expectedPayment);
      await paymentToken
        .connect(alice)
        .approve(await token.getAddress(), expectedPayment);

      await expect(token.connect(alice).buyTokens(buyAmount))
        .to.emit(token, 'TokensPurchased')
        .withArgs(
          alice.address,
          buyAmount,
          expectedPayment,
          executorSigner.address,
        );

      expect(await paymentToken.balanceOf(executorSigner.address)).to.equal(
        expectedPayment,
      );
      expect(await token.balanceOf(alice.address)).to.equal(buyAmount);
      expect(await token.tokensSold()).to.equal(buyAmount);

      const sale = await token.getTokenSaleDetails();
      expect(sale.tokensLeftToSell).to.equal(ethers.parseEther('97'));
    });

    it('Should require buyer approval before purchase', async function () {
      await setupMockPurchaseMembership([
        { sid: spaceId, members: [alice.address, bob.address] },
      ]);
      const paymentToken = await deployPaymentToken();
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: 1_000_000n,
        tokensForSale: ethers.parseEther('100'),
      });

      await paymentToken.mint(alice.address, 10_000_000n);

      await expect(token.connect(alice).buyTokens(ethers.parseEther('1'))).to.be
        .reverted;
    });

    it('Should enforce sale cap and prevent overselling', async function () {
      await setupMockPurchaseMembership([
        { sid: spaceId, members: [alice.address, bob.address] },
      ]);
      const paymentToken = await deployPaymentToken();
      const cap = ethers.parseEther('5');
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: 1_000_000n,
        tokensForSale: cap,
      });

      await paymentToken.mint(alice.address, 10_000_000n);
      await paymentToken
        .connect(alice)
        .approve(await token.getAddress(), 10_000_000n);

      await token.connect(alice).buyTokens(ethers.parseEther('5'));
      await expect(
        token.connect(alice).buyTokens(ethers.parseEther('1')),
      ).to.be.revertedWith('sale cap');
    });

    it('Should default to issuer-space-only purchases', async function () {
      await setupMockPurchaseMembership([
        { sid: spaceId, members: [alice.address] },
      ]);

      const paymentToken = await deployPaymentToken();
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: 1_000_000n,
        tokensForSale: ethers.parseEther('100'),
      });

      await paymentToken.mint(alice.address, 10_000_000n);
      await paymentToken.mint(charlie.address, 10_000_000n);
      await paymentToken
        .connect(alice)
        .approve(await token.getAddress(), 10_000_000n);
      await paymentToken
        .connect(charlie)
        .approve(await token.getAddress(), 10_000_000n);

      await token.connect(alice).buyTokens(ethers.parseEther('1'));
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther('1'),
      );

      await expect(
        token.connect(charlie).buyTokens(ethers.parseEther('1')),
      ).to.be.revertedWith('!eligible');
    });

    it('Should allow custom-space purchase whitelist mode', async function () {
      const customSpaceId = 777n;
      await setupMockPurchaseMembership([
        { sid: customSpaceId, members: [bob.address] },
      ]);

      const paymentToken = await deployPaymentToken();
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: 1_000_000n,
        tokensForSale: ethers.parseEther('100'),
        purchaseEligibilityMode: 1, // custom spaces
        initialPurchaseWhitelistSpaceIds: [customSpaceId],
      });

      await paymentToken.mint(bob.address, 10_000_000n);
      await paymentToken
        .connect(bob)
        .approve(await token.getAddress(), 10_000_000n);
      await token.connect(bob).buyTokens(ethers.parseEther('1'));
      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseEther('1'),
      );

      await token.connect(executorSigner).setPurchaseEligibilityMode(1);
      await expect(
        token.connect(alice).buyTokens(ethers.parseEther('1')),
      ).to.be.revertedWith('!eligible');
    });

    it('Should allow all-spaces purchase mode and runtime reconfiguration', async function () {
      const anotherSpaceId = 888n;
      await setupMockPurchaseMembership([
        { sid: anotherSpaceId, members: [charlie.address] },
      ]);

      const paymentToken = await deployPaymentToken();
      const token = await deploySaleToken({
        paymentTokenAddress: await paymentToken.getAddress(),
        paymentTokenPricePerToken: 1_000_000n,
        tokensForSale: ethers.parseEther('100'),
      });

      await paymentToken.mint(charlie.address, 10_000_000n);
      await paymentToken
        .connect(charlie)
        .approve(await token.getAddress(), 10_000_000n);

      // Default mode is issuer-space-only, so Charlie (not in issuer space) cannot buy.
      await expect(
        token.connect(charlie).buyTokens(ethers.parseEther('1')),
      ).to.be.revertedWith('!eligible');

      await expect(token.connect(executorSigner).setPurchaseEligibilityMode(2))
        .to.emit(token, 'PurchaseEligibilityModeUpdated')
        .withArgs(2);

      await token.connect(charlie).buyTokens(ethers.parseEther('1'));
      expect(await token.balanceOf(charlie.address)).to.equal(
        ethers.parseEther('1'),
      );

      // Reconfigure to custom spaces and allow Charlie by adding anotherSpaceId.
      await token.connect(executorSigner).setPurchaseEligibilityMode(1);
      await token
        .connect(executorSigner)
        .batchAddPurchaseWhitelistSpaces([anotherSpaceId]);
      expect(await token.getPurchaseWhitelistedSpaces()).to.deep.equal([
        anotherSpaceId,
      ]);
    });

    it('Should only allow executor to configure sale', async function () {
      const paymentToken = await deployPaymentToken();
      const token = await deploySaleToken();

      await expect(
        token
          .connect(alice)
          .configureTokenSale(
            await paymentToken.getAddress(),
            1_000_000n,
            ethers.parseEther('10'),
          ),
      ).to.be.revertedWith('!executor');
    });
  });
});
