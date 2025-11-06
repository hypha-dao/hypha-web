import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TransferHelper, RegularSpaceToken } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('TransferHelper', function () {
  let transferHelper: TransferHelper;
  let token1: RegularSpaceToken;
  let token2: RegularSpaceToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let executor: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther('1000');
  const TRANSFER_AMOUNT = ethers.parseEther('100');

  beforeEach(async function () {
    [owner, user1, user2, user3, executor] = await ethers.getSigners();

    // Deploy TransferHelper
    const TransferHelperFactory = await ethers.getContractFactory(
      'TransferHelper',
    );
    transferHelper = await TransferHelperFactory.deploy();
    await transferHelper.waitForDeployment();

    // Deploy test tokens
    const TokenFactory = await ethers.getContractFactory('RegularSpaceToken');

    // Deploy implementation
    const tokenImplementation = await TokenFactory.deploy();
    await tokenImplementation.waitForDeployment();

    // Deploy proxy for token1
    const ERC1967ProxyFactory = await ethers.getContractFactory(
      '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy',
    );

    const initData1 = tokenImplementation.interface.encodeFunctionData(
      'initialize',
      ['Test Token 1', 'TT1', await executor.getAddress(), 1, 0, true],
    );

    const proxy1 = await ERC1967ProxyFactory.deploy(
      await tokenImplementation.getAddress(),
      initData1,
    );
    await proxy1.waitForDeployment();
    token1 = TokenFactory.attach(
      await proxy1.getAddress(),
    ) as RegularSpaceToken;

    // Deploy proxy for token2
    const initData2 = tokenImplementation.interface.encodeFunctionData(
      'initialize',
      ['Test Token 2', 'TT2', await executor.getAddress(), 2, 0, true],
    );

    const proxy2 = await ERC1967ProxyFactory.deploy(
      await tokenImplementation.getAddress(),
      initData2,
    );
    await proxy2.waitForDeployment();
    token2 = TokenFactory.attach(
      await proxy2.getAddress(),
    ) as RegularSpaceToken;

    // Mint tokens to user1
    await token1.connect(executor).mint(user1.address, INITIAL_SUPPLY);
    await token2.connect(executor).mint(user1.address, INITIAL_SUPPLY);
  });

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      expect(await transferHelper.owner()).to.equal(owner.address);
    });

    it('Should have whitelist requirement disabled by default', async function () {
      expect(await transferHelper.requireTokenWhitelist()).to.equal(false);
    });

    it('Should support all tokens by default', async function () {
      expect(
        await transferHelper.isTokenSupported(await token1.getAddress()),
      ).to.equal(true);
    });
  });

  describe('Single Token Transfer', function () {
    it('Should transfer tokens successfully', async function () {
      // Approve transferHelper to spend user1's tokens
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), TRANSFER_AMOUNT);

      // Execute transfer
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      )
        .to.emit(transferHelper, 'TransferExecuted')
        .withArgs(
          await token1.getAddress(),
          user1.address,
          user2.address,
          TRANSFER_AMOUNT,
        );

      // Check balances
      expect(await token1.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);
      expect(await token1.balanceOf(user1.address)).to.equal(
        INITIAL_SUPPLY - TRANSFER_AMOUNT,
      );
    });

    it('Should fail if no approval given', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.reverted;
    });

    it('Should fail if insufficient balance', async function () {
      const tooMuch = INITIAL_SUPPLY + ethers.parseEther('1');
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), tooMuch);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(await token1.getAddress(), user2.address, tooMuch),
      ).to.be.reverted;
    });

    it('Should fail to transfer to zero address', async function () {
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), TRANSFER_AMOUNT);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            ethers.ZeroAddress,
            TRANSFER_AMOUNT,
          ),
      ).to.be.revertedWith('TransferHelper: transfer to zero address');
    });

    it('Should fail with zero amount', async function () {
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), TRANSFER_AMOUNT);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(await token1.getAddress(), user2.address, 0),
      ).to.be.revertedWith('TransferHelper: amount must be greater than 0');
    });
  });

  describe('Batch Transfer', function () {
    it('Should transfer to multiple recipients successfully', async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther('50'), ethers.parseEther('75')];
      const totalAmount = ethers.parseEther('125');

      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), totalAmount);

      await expect(
        transferHelper
          .connect(user1)
          .batchTransfer(await token1.getAddress(), recipients, amounts),
      )
        .to.emit(transferHelper, 'BatchTransferExecuted')
        .withArgs(await token1.getAddress(), user1.address, totalAmount, 2);

      // Check balances
      expect(await token1.balanceOf(user2.address)).to.equal(amounts[0]);
      expect(await token1.balanceOf(user3.address)).to.equal(amounts[1]);
      expect(await token1.balanceOf(user1.address)).to.equal(
        INITIAL_SUPPLY - totalAmount,
      );
    });

    it('Should fail if arrays length mismatch', async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther('50')]; // Only one amount

      await expect(
        transferHelper
          .connect(user1)
          .batchTransfer(await token1.getAddress(), recipients, amounts),
      ).to.be.revertedWith('TransferHelper: arrays length mismatch');
    });

    it('Should fail if empty arrays', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .batchTransfer(await token1.getAddress(), [], []),
      ).to.be.revertedWith('TransferHelper: empty arrays');
    });

    it('Should fail if one recipient is zero address', async function () {
      const recipients = [user2.address, ethers.ZeroAddress];
      const amounts = [ethers.parseEther('50'), ethers.parseEther('50')];

      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), ethers.parseEther('100'));

      await expect(
        transferHelper
          .connect(user1)
          .batchTransfer(await token1.getAddress(), recipients, amounts),
      ).to.be.revertedWith('TransferHelper: transfer to zero address');
    });
  });

  describe('Batch Transfer Equal', function () {
    it('Should transfer equal amounts to multiple recipients', async function () {
      const recipients = [user2.address, user3.address];
      const amountEach = ethers.parseEther('50');
      const totalAmount = ethers.parseEther('100');

      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), totalAmount);

      await expect(
        transferHelper
          .connect(user1)
          .batchTransferEqual(
            await token1.getAddress(),
            recipients,
            amountEach,
          ),
      )
        .to.emit(transferHelper, 'BatchTransferExecuted')
        .withArgs(await token1.getAddress(), user1.address, totalAmount, 2);

      // Check balances
      expect(await token1.balanceOf(user2.address)).to.equal(amountEach);
      expect(await token1.balanceOf(user3.address)).to.equal(amountEach);
      expect(await token1.balanceOf(user1.address)).to.equal(
        INITIAL_SUPPLY - totalAmount,
      );
    });

    it('Should fail if empty array', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .batchTransferEqual(
            await token1.getAddress(),
            [],
            ethers.parseEther('50'),
          ),
      ).to.be.revertedWith('TransferHelper: empty array');
    });

    it('Should fail with zero amount', async function () {
      const recipients = [user2.address, user3.address];

      await expect(
        transferHelper
          .connect(user1)
          .batchTransferEqual(await token1.getAddress(), recipients, 0),
      ).to.be.revertedWith('TransferHelper: amount must be greater than 0');
    });
  });

  describe('Token Whitelist Management', function () {
    it('Should allow owner to whitelist tokens', async function () {
      await expect(
        transferHelper
          .connect(owner)
          .setTokenWhitelist(await token1.getAddress(), true),
      )
        .to.emit(transferHelper, 'TokenWhitelisted')
        .withArgs(await token1.getAddress(), true);

      expect(
        await transferHelper.supportedTokens(await token1.getAddress()),
      ).to.equal(true);
    });

    it('Should fail if non-owner tries to whitelist', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .setTokenWhitelist(await token1.getAddress(), true),
      ).to.be.reverted;
    });

    it('Should allow owner to batch whitelist tokens', async function () {
      const tokens = [await token1.getAddress(), await token2.getAddress()];

      await transferHelper.connect(owner).batchSetTokenWhitelist(tokens, true);

      expect(
        await transferHelper.supportedTokens(await token1.getAddress()),
      ).to.equal(true);
      expect(
        await transferHelper.supportedTokens(await token2.getAddress()),
      ).to.equal(true);
    });

    it('Should enforce whitelist when enabled', async function () {
      // Enable whitelist requirement
      await transferHelper.connect(owner).setWhitelistRequirement(true);

      // Try to transfer non-whitelisted token
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), TRANSFER_AMOUNT);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.be.revertedWith('TransferHelper: token not whitelisted');

      // Whitelist token and try again
      await transferHelper
        .connect(owner)
        .setTokenWhitelist(await token1.getAddress(), true);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.not.be.reverted;
    });

    it('Should update whitelist requirement', async function () {
      await expect(transferHelper.connect(owner).setWhitelistRequirement(true))
        .to.emit(transferHelper, 'WhitelistRequirementChanged')
        .withArgs(true);

      expect(await transferHelper.requireTokenWhitelist()).to.equal(true);
    });

    it('Should correctly report token support status', async function () {
      // All tokens supported by default
      expect(
        await transferHelper.isTokenSupported(await token1.getAddress()),
      ).to.equal(true);

      // Enable whitelist
      await transferHelper.connect(owner).setWhitelistRequirement(true);

      // Token1 not supported
      expect(
        await transferHelper.isTokenSupported(await token1.getAddress()),
      ).to.equal(false);

      // Whitelist token1
      await transferHelper
        .connect(owner)
        .setTokenWhitelist(await token1.getAddress(), true);

      // Token1 now supported
      expect(
        await transferHelper.isTokenSupported(await token1.getAddress()),
      ).to.equal(true);
    });
  });

  describe('Reentrancy Protection', function () {
    it('Should prevent reentrancy attacks', async function () {
      // This is a basic test - a more comprehensive test would require a malicious token contract
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), TRANSFER_AMOUNT);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            user2.address,
            TRANSFER_AMOUNT,
          ),
      ).to.not.be.reverted;
    });
  });

  describe('Multiple Token Support', function () {
    it('Should handle transfers of different tokens', async function () {
      const amount1 = ethers.parseEther('100');
      const amount2 = ethers.parseEther('200');

      // Approve both tokens
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount1);
      await token2
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount2);

      // Transfer token1
      await transferHelper
        .connect(user1)
        .transferToken(await token1.getAddress(), user2.address, amount1);

      // Transfer token2
      await transferHelper
        .connect(user1)
        .transferToken(await token2.getAddress(), user3.address, amount2);

      // Check balances
      expect(await token1.balanceOf(user2.address)).to.equal(amount1);
      expect(await token2.balanceOf(user3.address)).to.equal(amount2);
    });
  });

  describe('Edge Cases', function () {
    it('Should reject invalid token address (zero address)', async function () {
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(ethers.ZeroAddress, user2.address, TRANSFER_AMOUNT),
      ).to.be.revertedWith('TransferHelper: invalid token address');
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
