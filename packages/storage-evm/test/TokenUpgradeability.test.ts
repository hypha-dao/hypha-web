import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Contract } from 'ethers';

describe('Token Contract Upgradeability Tests', function () {
  let regularTokenFactory: Contract;
  let decayingTokenFactory: Contract;
  let daoSpaceFactory: Contract;
  let owner: SignerWithAddress;
  let members: SignerWithAddress[];
  let executorSigner: SignerWithAddress;
  let spaceId: bigint;

  async function deployAndSetupFixture() {
    const [owner, ...members] = await ethers.getSigners();

    const DAOSpaceFactory = await ethers.getContractFactory(
      'DAOSpaceFactoryImplementation',
    );
    const daoSpaceFactory = await upgrades.deployProxy(
      DAOSpaceFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

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

    // Deploy V1 implementations
    const SpaceTokenV1 = await ethers.getContractFactory(
      'contracts/RegularSpaceToken.sol:SpaceToken',
    );
    const spaceTokenV1Impl = await SpaceTokenV1.deploy();
    await regularTokenFactory.setSpaceTokenImplementation(
      await spaceTokenV1Impl.getAddress(),
    );

    const DecayingSpaceTokenV1 = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );
    const decayingSpaceTokenV1Impl = await DecayingSpaceTokenV1.deploy();
    await decayingTokenFactory.setDecayingTokenImplementation(
      await decayingSpaceTokenV1Impl.getAddress(),
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
      daoSpaceFactory,
      owner,
      members,
      executorSigner,
      spaceId,
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployAndSetupFixture);
    regularTokenFactory = fixture.regularTokenFactory;
    decayingTokenFactory = fixture.decayingTokenFactory;
    daoSpaceFactory = fixture.daoSpaceFactory;
    owner = fixture.owner;
    members = fixture.members;
    executorSigner = fixture.executorSigner;
    spaceId = fixture.spaceId;
  });

  describe('Regular SpaceToken Upgradeability', function () {
    it('Should deploy a V1 token, upgrade to V2, preserve state, and add new functionality', async function () {
      // 1. Deploy V1 Token Proxy
      const tx = await regularTokenFactory
        .connect(executorSigner)
        .deployToken(spaceId, 'My Regular Token', 'MRT', 0, true, false);
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

      let spaceToken = await ethers.getContractAt(
        'contracts/RegularSpaceToken.sol:SpaceToken',
        tokenAddress,
      );

      // 2. Interact with V1 (change state)
      const mintAmount = ethers.parseEther('100');
      await spaceToken
        .connect(executorSigner)
        .mint(members[0].address, mintAmount);
      expect(await spaceToken.balanceOf(members[0].address)).to.equal(
        mintAmount,
      );

      // 3. Deploy V2 Implementation
      const SpaceTokenV2 = await ethers.getContractFactory(
        'contracts/SpaceTokenV2.sol:SpaceTokenV2',
      );

      // 4. Import the proxy and then upgrade it
      await upgrades.forceImport(await spaceToken.getAddress(), SpaceTokenV1, {
        kind: 'uups',
      });
      const upgradedSpaceToken = await upgrades.upgradeProxy(
        await spaceToken.getAddress(),
        SpaceTokenV2,
      );
      await upgradedSpaceToken.initializeV2(42);

      // 5. Verify state preservation and new functionality
      expect(await upgradedSpaceToken.balanceOf(members[0].address)).to.equal(
        mintAmount,
      );
      expect(await upgradedSpaceToken.version()).to.equal('V2');
      expect(await upgradedSpaceToken.extraFeature()).to.equal(42);
    });
  });

  describe('Decaying SpaceToken Upgradeability', function () {
    it('Should deploy a V1 decaying token, upgrade to V2, preserve state, and add new functionality', async function () {
      // 1. Deploy V1 Decaying Token Proxy
      const tx = await decayingTokenFactory
        .connect(executorSigner)
        .deployDecayingToken(
          spaceId,
          'My Decaying Token',
          'MDT',
          0,
          true,
          false,
          100, // 1%
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

      let decayingToken = await ethers.getContractAt(
        'DecayingSpaceToken',
        tokenAddress,
      );

      // 2. Interact with V1 (change state)
      const mintAmount = ethers.parseEther('500');
      await decayingToken
        .connect(executorSigner)
        .mint(members[1].address, mintAmount);
      expect(await decayingToken.balanceOf(members[1].address)).to.equal(
        mintAmount,
      );
      expect(await decayingToken.decayPercentage()).to.equal(100);

      // 3. Deploy V2 Implementation
      const DecayingSpaceTokenV2 = await ethers.getContractFactory(
        'contracts/DecayingSpaceTokenV2.sol:DecayingSpaceTokenV2',
      );
      const DecayingSpaceTokenV1 = await ethers.getContractFactory(
        'DecayingSpaceToken',
      );

      // 4. Import the proxy and then upgrade it
      await upgrades.forceImport(
        await decayingToken.getAddress(),
        DecayingSpaceTokenV1,
        { kind: 'uups' },
      );
      const upgradedDecayingToken = await upgrades.upgradeProxy(
        await decayingToken.getAddress(),
        DecayingSpaceTokenV2,
      );
      await upgradedDecayingToken.initializeV2(99);

      // 5. Verify state preservation and new functionality
      expect(
        await upgradedDecayingToken.balanceOf(members[1].address),
      ).to.equal(mintAmount);
      expect(await upgradedDecayingToken.decayPercentage()).to.equal(100);
      expect(await upgradedDecayingToken.version()).to.equal('V2');
      expect(await upgradedDecayingToken.extraFeature()).to.equal(99);
    });
  });
});
