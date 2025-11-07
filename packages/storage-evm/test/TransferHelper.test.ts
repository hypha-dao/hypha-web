import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import {
  TransferHelper,
  RegularSpaceToken,
  DecayingSpaceToken,
  OwnershipSpaceToken,
  DAOSpaceFactoryImplementation,
  RegularTokenFactory,
  DecayingTokenFactory,
  OwnershipTokenFactory,
  JoinMethodDirectoryImplementation,
  ExitMethodDirectoryImplementation,
} from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('TransferHelper with Real Tokens', function () {
  let transferHelper: TransferHelper;
  let regularToken: RegularSpaceToken;
  let decayingToken: DecayingSpaceToken;
  let ownershipToken: OwnershipSpaceToken;

  let daoSpaceFactory: DAOSpaceFactoryImplementation;
  let regularTokenFactory: RegularTokenFactory;
  let decayingTokenFactory: DecayingTokenFactory;
  let ownershipTokenFactory: OwnershipTokenFactory;

  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let nonMember: SignerWithAddress;
  let executor: SignerWithAddress;
  let spaceId: bigint;

  const INITIAL_SUPPLY = ethers.parseEther('1000');
  const TRANSFER_AMOUNT = ethers.parseEther('100');

  beforeEach(async function () {
    [owner, user1, user2, user3, nonMember] = await ethers.getSigners();

    // Deploy TransferHelper
    const TransferHelperFactory = await ethers.getContractFactory(
      'TransferHelper',
    );
    transferHelper = await TransferHelperFactory.deploy();
    await transferHelper.waitForDeployment();

    // --- Deploy Factories ---
    const DAOSpaceFactory = await ethers.getContractFactory(
      'DAOSpaceFactoryImplementation',
    );
    daoSpaceFactory = (await upgrades.deployProxy(DAOSpaceFactory, [
      owner.address,
    ])) as unknown as DAOSpaceFactoryImplementation;

    // Deploy and configure Join/Exit methods
    const JoinMethodDirectory = await ethers.getContractFactory(
      'JoinMethodDirectoryImplementation',
    );
    const joinMethodDirectory = (await upgrades.deployProxy(
      JoinMethodDirectory,
      [owner.address],
    )) as unknown as JoinMethodDirectoryImplementation;
    const OpenJoin = await ethers.getContractFactory('OpenJoin');
    const openJoin = await OpenJoin.deploy();
    await joinMethodDirectory.addJoinMethod(1, await openJoin.getAddress());

    const ExitMethodDirectory = await ethers.getContractFactory(
      'ExitMethodDirectoryImplementation',
    );
    const exitMethodDirectory = (await upgrades.deployProxy(
      ExitMethodDirectory,
      [owner.address],
    )) as unknown as ExitMethodDirectoryImplementation;
    const NoExit = await ethers.getContractFactory('NoExit');
    const noExit = await NoExit.deploy();
    await exitMethodDirectory.addExitMethod(1, await noExit.getAddress());

    // Configure daoSpaceFactory with essential contracts
    await daoSpaceFactory.setContracts(
      await joinMethodDirectory.getAddress(),
      await exitMethodDirectory.getAddress(),
      ethers.ZeroAddress, // Mock proposals contract, not needed for this test
    );

    const RegularTokenFactory = await ethers.getContractFactory(
      'RegularTokenFactory',
    );
    regularTokenFactory = (await upgrades.deployProxy(RegularTokenFactory, [
      owner.address,
    ])) as unknown as RegularTokenFactory;

    const DecayingTokenFactory = await ethers.getContractFactory(
      'DecayingTokenFactory',
    );
    decayingTokenFactory = (await upgrades.deployProxy(DecayingTokenFactory, [
      owner.address,
    ])) as unknown as DecayingTokenFactory;

    const OwnershipTokenFactory = await ethers.getContractFactory(
      'OwnershipTokenFactory',
    );
    ownershipTokenFactory = (await upgrades.deployProxy(OwnershipTokenFactory, [
      owner.address,
    ])) as unknown as OwnershipTokenFactory;

    // --- Deploy Implementations ---
    const RegularSpaceTokenImpl = await (
      await ethers.getContractFactory('RegularSpaceToken')
    ).deploy();
    const DecayingSpaceTokenImpl = await (
      await ethers.getContractFactory('DecayingSpaceToken')
    ).deploy();
    const OwnershipSpaceTokenImpl = await (
      await ethers.getContractFactory('OwnershipSpaceToken')
    ).deploy();

    // --- Configure Factories ---
    await regularTokenFactory.setSpaceTokenImplementation(
      await RegularSpaceTokenImpl.getAddress(),
    );
    await decayingTokenFactory.setDecayingTokenImplementation(
      await DecayingSpaceTokenImpl.getAddress(),
    );
    await ownershipTokenFactory.setOwnershipTokenImplementation(
      await OwnershipSpaceTokenImpl.getAddress(),
    );
    await ownershipTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );

    // Link other factories to the space factory
    await regularTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );
    await decayingTokenFactory.setSpacesContract(
      await daoSpaceFactory.getAddress(),
    );

    // --- Create Space ---
    const spaceParams = {
      name: 'Test Space',
      description: 'A test space',
      imageUrl: '',
      unity: 60,
      quorum: 50,
      votingPowerSource: 1,
      exitMethod: 1, // Use valid exit method
      joinMethod: 1, // Use valid join method
      createToken: false,
      tokenName: '',
      tokenSymbol: '',
    };
    await daoSpaceFactory.createSpace(spaceParams);
    spaceId = await daoSpaceFactory.spaceCounter();

    // --- Get Executor and Add Members ---
    const spaceDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
    const executorAddress = spaceDetails.executor;
    await ethers.provider.send('hardhat_impersonateAccount', [executorAddress]);
    await ethers.provider.send('hardhat_setBalance', [
      executorAddress,
      '0x1000000000000000000',
    ]);
    executor = await ethers.getSigner(executorAddress);

    await daoSpaceFactory.connect(user1).joinSpace(spaceId);
    await daoSpaceFactory.connect(user2).joinSpace(spaceId);
    await daoSpaceFactory.connect(user3).joinSpace(spaceId);
    await daoSpaceFactory.connect(executor).joinSpace(spaceId); // Executor must be member for ownership token

    // --- Deploy Tokens ---
    const deployAndGetToken = async (
      factory: any,
      type: 'regular' | 'decaying' | 'ownership',
    ) => {
      let tx;
      const tokenName = `${type} Token`;
      const tokenSymbol = type.substring(0, 3).toUpperCase();

      if (type === 'decaying') {
        tx = await factory
          .connect(executor)
          .deployDecayingToken(
            spaceId,
            tokenName,
            tokenSymbol,
            0,
            true,
            true,
            100,
            3600,
          );
      } else if (type === 'ownership') {
        tx = await factory
          .connect(executor)
          .deployOwnershipToken(spaceId, tokenName, tokenSymbol, 0, true);
      } else {
        tx = await factory
          .connect(executor)
          .deployToken(spaceId, tokenName, tokenSymbol, 0, true, true);
      }

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
      return ethers.getContractAt(
        type === 'regular'
          ? 'RegularSpaceToken'
          : type === 'decaying'
          ? 'DecayingSpaceToken'
          : 'OwnershipSpaceToken',
        tokenAddress,
      );
    };

    regularToken = (await deployAndGetToken(
      regularTokenFactory,
      'regular',
    )) as RegularSpaceToken;
    decayingToken = (await deployAndGetToken(
      decayingTokenFactory,
      'decaying',
    )) as DecayingSpaceToken;
    ownershipToken = (await deployAndGetToken(
      ownershipTokenFactory,
      'ownership',
    )) as OwnershipSpaceToken;

    // --- Final Setup ---
    const transferHelperAddress = await transferHelper.getAddress();
    await regularToken
      .connect(executor)
      .setTransferHelper(transferHelperAddress);
    await decayingToken
      .connect(executor)
      .setTransferHelper(transferHelperAddress);
    await ownershipToken
      .connect(executor)
      .setTransferHelper(transferHelperAddress);

    await regularToken.connect(executor).mint(user1.address, INITIAL_SUPPLY);
    await decayingToken.connect(executor).mint(user1.address, INITIAL_SUPPLY);
    await ownershipToken.connect(executor).mint(user1.address, INITIAL_SUPPLY);
  });

  describe('Deployment & Setup', function () {
    it('Should set the correct owner for TransferHelper', async function () {
      expect(await transferHelper.owner()).to.equal(owner.address);
    });

    it('Should have whitelist requirement disabled by default', async function () {
      expect(await transferHelper.requireTokenWhitelist()).to.equal(false);
    });

    it('Should correctly deploy all token types', async function () {
      expect(await regularToken.name()).to.equal('regular Token');
      expect(await decayingToken.name()).to.equal('decaying Token');
      expect(await ownershipToken.name()).to.equal('ownership Token');
    });
  });

  describe('Transfers with RegularSpaceToken', function () {
    // Note: All tests in this suite succeed without calling regularToken.approve() first,
    // because the token's transferFrom is set to trust the TransferHelper.
    it('Should transfer tokens successfully without prior approval', async function () {
      // This works because TransferHelper calls the token's `transferFrom` function,
      // and the token is configured to bypass the allowance check for the helper.
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await regularToken.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      )
        .to.emit(transferHelper, 'TransferExecuted')
        .withArgs(
          await regularToken.getAddress(),
          user1.address,
          user2.address,
          TRANSFER_AMOUNT,
        );

      expect(await regularToken.balanceOf(user2.address)).to.equal(
        TRANSFER_AMOUNT,
      );
    });

    it("Should explicitly prevent a user from transferring another user's regular tokens", async function () {
      // user2 has no regular tokens. This test proves that user2 cannot initiate a transfer of user1's tokens.
      // The call will fail because TransferHelper executes `transferFrom(msg.sender, ...)` which means
      // it tries to move funds from user2, who has an insufficient balance.
      await expect(
        transferHelper
          .connect(user2) // user2 tries to send user1's funds
          .transferToken(
            await regularToken.getAddress(),
            user3.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.reverted; // Reverted due to insufficient balance on user2's account
    });
  });

  describe('Transfers with OwnershipSpaceToken', function () {
    // Note: All tests in this suite succeed without calling ownershipToken.approve() first.
    it('Should transfer ownership tokens successfully to another member', async function () {
      // TransferHelper calls `transferFrom`, which on OwnershipSpaceToken includes a check
      // to ensure the recipient is a member of the space.
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await ownershipToken.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.not.be.reverted;

      expect(await ownershipToken.balanceOf(user2.address)).to.equal(
        TRANSFER_AMOUNT,
      );
    });

    it("Should explicitly prevent a user from transferring another user's ownership tokens", async function () {
      // user2 has no ownership tokens. This test proves that user2 cannot initiate a transfer of user1's tokens.
      await expect(
        transferHelper
          .connect(user2)
          .transferToken(
            await ownershipToken.getAddress(),
            user3.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.reverted; // Reverted due to insufficient balance
    });

    it('Should FAIL to transfer ownership tokens to a non-member', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await ownershipToken.getAddress(),
            nonMember.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.revertedWith('Can only transfer to space members');
    });
  });

  describe('Transfers with DecayingSpaceToken', function () {
    // Note: All tests in this suite succeed without calling decayingToken.approve() first.
    it('Should transfer decaying tokens successfully', async function () {
      // TransferHelper calls the `transferFrom` function, which on DecayingSpaceToken
      // correctly applies any pending decay before executing the transfer.
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await decayingToken.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.not.be.reverted;

      expect(await decayingToken.balanceOf(user2.address)).to.equal(
        TRANSFER_AMOUNT,
      );
    });

    it("Should explicitly prevent a user from transferring another user's decaying tokens", async function () {
      // user2 has no decaying tokens. This test proves that user2 cannot initiate a transfer of user1's tokens.
      await expect(
        transferHelper
          .connect(user2)
          .transferToken(
            await decayingToken.getAddress(),
            user3.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.reverted; // Reverted due to insufficient balance
    });

    it('Should apply decay during a transfer', async function () {
      const balanceBefore = await decayingToken.balanceOf(user1.address);

      // Advance time by one decay interval (1 hour)
      await time.increase(3600);

      const balanceAfterDecay = await decayingToken.balanceOf(user1.address);
      expect(balanceAfterDecay).to.be.lessThan(balanceBefore);

      // Now transfer
      await transferHelper
        .connect(user1)
        .transferToken(
          await decayingToken.getAddress(),
          user2.address,
          TRANSFER_AMOUNT,
        );

      const finalSenderBalance = await decayingToken.balanceOf(user1.address);
      const expectedFinalBalance = balanceAfterDecay - TRANSFER_AMOUNT;

      // Check if the final balance reflects the decay that happened before transfer
      expect(finalSenderBalance).to.equal(expectedFinalBalance);
    });
  });

  describe('Token Whitelist Management', function () {
    it('Should allow owner to whitelist tokens', async function () {
      await expect(
        transferHelper
          .connect(owner)
          .setTokenWhitelist(await regularToken.getAddress(), true),
      )
        .to.emit(transferHelper, 'TokenWhitelisted')
        .withArgs(await regularToken.getAddress(), true);

      expect(
        await transferHelper.supportedTokens(await regularToken.getAddress()),
      ).to.equal(true);
    });

    it('Should fail if non-owner tries to whitelist', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .setTokenWhitelist(await regularToken.getAddress(), true),
      ).to.be.reverted;
    });

    it('Should enforce whitelist when enabled', async function () {
      await transferHelper.connect(owner).setWhitelistRequirement(true);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await regularToken.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.revertedWith('TransferHelper: token not whitelisted');

      await transferHelper
        .connect(owner)
        .setTokenWhitelist(await regularToken.getAddress(), true);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await regularToken.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.not.be.reverted;
    });
  });

  describe('Edge Cases & Security', function () {
    it('Should fail if TransferHelper is not set on the token contract', async function () {
      // Deploy a new token without setting the transfer helper
      const tx = await regularTokenFactory
        .connect(executor)
        .deployToken(spaceId, 'New Token', 'NT', 0, true, true);
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: any) => regularTokenFactory.interface.parseLog(log))
        .find((e: any) => e && e.name === 'TokenDeployed');
      const token3 = await ethers.getContractAt(
        'RegularSpaceToken',
        event.args.tokenAddress,
      );
      await token3.connect(executor).mint(user1.address, INITIAL_SUPPLY);

      // Attempting to transfer should fail without an approval because TransferHelper is not authorized
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token3.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.reverted; // Reverted by ERC20: insufficient allowance
    });

    it('Should reject non-contract addresses as tokens', async function () {
      await expect(
        transferHelper.connect(user1).transferToken(
          user3.address, // Regular address, not a contract
          user2.address,
          TRANSFER_AMOUNT,
        ),
      ).to.be.revertedWith('TransferHelper: not a contract');
    });
  });
});
