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
      name: 'Test Space',
      description: 'A space for testing',
      imageUrl: '',
      unity: 50,
      quorum: 50,
      votingPowerSource: 1,
      exitMethod: 1,
      joinMethod: 1,
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
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
        0, // priceInUSD
        false, // useTransferWhitelist
        false, // useReceiveWhitelist
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
        false,
        false,
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
      ).to.be.revertedWith('Max supply is fixed and cannot be changed');
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
        false,
        false,
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
      ).to.be.revertedWith(
        'New max supply must be greater than current total supply',
      );
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
        false,
        false,
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
        false,
        false,
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
        false,
        false,
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
        true, // useTransferWhitelist = true
        true, // useReceiveWhitelist = true
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
      ).to.be.revertedWith('Sender not whitelisted to transfer');

      // Whitelist alice for transfer
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);

      expect(await token.canTransfer(alice.address)).to.be.true;

      // Bob is not whitelisted to receive
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('Recipient not whitelisted to receive');
    });

    it('Should enforce receive whitelist', async function () {
      // Whitelist alice to transfer
      await token
        .connect(executorSigner)
        .batchSetTransferWhitelist([alice.address], [true]);

      // Bob not whitelisted to receive
      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('Recipient not whitelisted to receive');

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
      ).to.be.revertedWith('Sender not whitelisted to transfer');

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
      ).to.be.revertedWith('Array lengths must match');
    });

    it('Should only allow executor to update whitelists', async function () {
      await expect(
        token.connect(alice).batchSetTransferWhitelist([bob.address], [true]),
      ).to.be.revertedWith('Only executor can update whitelist');

      await expect(
        token.connect(bob).batchSetReceiveWhitelist([charlie.address], [true]),
      ).to.be.revertedWith('Only executor can update whitelist');
    });
  });

  describe('4. USD Pricing', function () {
    it('Should set initial price in USD', async function () {
      const priceInUSD = 5000000n; // $5.00 (6 decimals)

      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(
          spaceId,
          'Price Token',
          'PRC',
          ethers.parseEther('10000'),
          true,
          false,
          true,
          priceInUSD,
          false,
          false,
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
        false,
        false,
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
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(
          spaceId,
          'Price Token',
          'PRC',
          ethers.parseEther('10000'),
          true,
          false,
          true,
          1000000n,
          false,
          false,
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
      ).to.be.revertedWith('Only executor can update price');
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
        false,
        false,
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
      ).to.be.revertedWith('Token transfers are disabled');

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
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(
          spaceId,
          'Burn Token',
          'BRN',
          ethers.parseEther('10000'),
          true,
          false,
          true,
          0,
          false,
          false,
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
          true, // useTransferWhitelist
          false, // useReceiveWhitelist
          100, // 1% decay
          3600, // 1 hour
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
    });
  });

  describe('8. Ownership Token Configuration', function () {
    it('Should deploy ownership token with all new configurations', async function () {
      const priceInUSD = 10000000n; // $10.00

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
          false, // useTransferWhitelist
          true, // useReceiveWhitelist
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
            false,
            false,
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
        ).to.be.revertedWith('Only executor can mint');
      });

      it('Should respect max supply when minting', async function () {
        const overMintAmount = ethers.parseEther('10001');

        await expect(
          token.connect(executorSigner).mint(alice.address, overMintAmount),
        ).to.be.revertedWith('Mint max supply problemchik blet');
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
            false,
            false,
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
            false,
            false,
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
            false,
            false,
            100, // 1% decay
            3600, // 1 hour
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
        ).to.be.revertedWith('Mint max supply problemchik blet');
      });

      it('Should not allow non-executor to mint decaying tokens', async function () {
        const mintAmount = ethers.parseEther('100');

        await expect(
          decayingToken.connect(bob).mint(alice.address, mintAmount),
        ).to.be.revertedWith('Only executor can mint');
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
            false,
            false,
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
        ).to.be.revertedWith('Can only mint to space members or executor');
      });

      it('Should not allow non-executor to mint ownership tokens', async function () {
        const mintAmount = ethers.parseEther('10');

        await expect(
          ownershipToken.connect(alice).mint(bob.address, mintAmount),
        ).to.be.revertedWith('Only executor can mint');
      });

      it('Should respect max supply for ownership tokens', async function () {
        const overMintAmount = ethers.parseEther('101');

        await expect(
          ownershipToken
            .connect(executorSigner)
            .mint(alice.address, overMintAmount),
        ).to.be.revertedWith('Mint max supply problemchik blet');
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
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(
          spaceId,
          'Access Token',
          'ACC',
          ethers.parseEther('10000'),
          true,
          false,
          true,
          1000000n,
          false,
          false,
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
      ).to.be.revertedWith('Only executor can update max supply');
    });

    it('Should restrict setTransferable to executor only', async function () {
      await expect(
        token.connect(bob).setTransferable(false),
      ).to.be.revertedWith('Only executor can update transferable');
    });

    it('Should restrict setAutoMinting to executor only', async function () {
      await expect(
        token.connect(charlie).setAutoMinting(false),
      ).to.be.revertedWith('Only executor or owner can update auto-minting');
    });

    it('Should restrict whitelist updates to executor only', async function () {
      await expect(
        token.connect(alice).setUseTransferWhitelist(true),
      ).to.be.revertedWith('Only executor can update whitelist settings');

      await expect(
        token.connect(bob).setUseReceiveWhitelist(true),
      ).to.be.revertedWith('Only executor can update whitelist settings');
    });
  });

  describe('11. Complex Scenarios', function () {
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
        false,
        true, // only whitelisted can receive
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
      ).to.be.revertedWith('Token transfers are disabled');

      // Executor cannot transfer to non-whitelisted bob
      await expect(
        token
          .connect(executorSigner)
          .transfer(bob.address, ethers.parseEther('10')),
      ).to.be.revertedWith('Recipient not whitelisted to receive');
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
        true, // only whitelisted can send
        true, // only whitelisted can receive
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
      ).to.be.revertedWith('Sender not whitelisted to transfer');

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
});
