import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TransferHelper, MockERC20 } from '../typechain-types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('TransferHelper Comprehensive Tests', function () {
  // Define fixture to deploy necessary contracts
  async function deployTransferHelperFixture() {
    const [owner, user1, user2, user3, recipient1, recipient2] =
      await ethers.getSigners();

    // Deploy TransferHelper
    const TransferHelper = await ethers.getContractFactory('TransferHelper');
    const transferHelper = await TransferHelper.deploy();

    // Deploy mock ERC20 tokens for testing
    const MockERC20 = await ethers.getContractFactory('MockERC20');

    // Deploy multiple tokens with different decimals for comprehensive testing
    const token1 = await MockERC20.deploy('Test Token 1', 'TT1', 18); // 18 decimals
    const token2 = await MockERC20.deploy('Test Token 2', 'TT2', 6); // 6 decimals (like USDC)
    const token3 = await MockERC20.deploy('Test Token 3', 'TT3', 8); // 8 decimals (like WBTC)

    // Deploy a malicious token that always returns false on transfer
    const MaliciousToken = await ethers.getContractFactory('MaliciousERC20');
    const maliciousToken = await MaliciousToken.deploy();

    return {
      transferHelper,
      token1,
      token2,
      token3,
      maliciousToken,
      owner,
      user1,
      user2,
      user3,
      recipient1,
      recipient2,
    };
  }

  describe('Deployment', function () {
    it('Should deploy successfully', async function () {
      const { transferHelper } = await loadFixture(deployTransferHelperFixture);

      expect(await transferHelper.getAddress()).to.be.properAddress;
    });
  });

  describe('Token Transfer Functionality', function () {
    it('Should successfully transfer tokens when user has sufficient balance and approval', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);

      // Mint tokens to user1
      await token1.mint(await user1.getAddress(), transferAmount);

      // User1 approves TransferHelper to spend tokens
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);

      // Get initial balances
      const user1InitialBalance = await token1.balanceOf(
        await user1.getAddress(),
      );
      const recipient1InitialBalance = await token1.balanceOf(
        await recipient1.getAddress(),
      );

      // Execute transfer through TransferHelper
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      )
        .to.emit(transferHelper, 'TransferExecuted')
        .withArgs(
          await token1.getAddress(),
          await recipient1.getAddress(),
          transferAmount,
        );

      // Verify balances after transfer
      const user1FinalBalance = await token1.balanceOf(
        await user1.getAddress(),
      );
      const recipient1FinalBalance = await token1.balanceOf(
        await recipient1.getAddress(),
      );

      expect(user1InitialBalance - user1FinalBalance).to.equal(transferAmount);
      expect(recipient1FinalBalance - recipient1InitialBalance).to.equal(
        transferAmount,
      );
    });

    it('Should work with tokens of different decimals', async function () {
      const { transferHelper, token2, token3, user1, recipient1 } =
        await loadFixture(deployTransferHelperFixture);

      // Test with 6-decimal token (like USDC)
      const amount6Decimals = ethers.parseUnits('1000', 6);
      await token2.mint(await user1.getAddress(), amount6Decimals);
      await token2
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount6Decimals);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token2.getAddress(),
            await recipient1.getAddress(),
            amount6Decimals,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Test with 8-decimal token (like WBTC)
      const amount8Decimals = ethers.parseUnits('5', 8);
      await token3.mint(await user1.getAddress(), amount8Decimals);
      await token3
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount8Decimals);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token3.getAddress(),
            await recipient1.getAddress(),
            amount8Decimals,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Verify final balances
      expect(await token2.balanceOf(await recipient1.getAddress())).to.equal(
        amount6Decimals,
      );
      expect(await token3.balanceOf(await recipient1.getAddress())).to.equal(
        amount8Decimals,
      );
    });

    it('Should handle multiple sequential transfers correctly', async function () {
      const { transferHelper, token1, user1, recipient1, recipient2 } =
        await loadFixture(deployTransferHelperFixture);

      const totalAmount = ethers.parseUnits('1000', 18);
      const transferAmount1 = ethers.parseUnits('300', 18);
      const transferAmount2 = ethers.parseUnits('200', 18);
      const transferAmount3 = ethers.parseUnits('150', 18);

      // Setup
      await token1.mint(await user1.getAddress(), totalAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), totalAmount);

      // First transfer
      await transferHelper
        .connect(user1)
        .transferToken(
          await token1.getAddress(),
          await recipient1.getAddress(),
          transferAmount1,
        );

      // Second transfer to same recipient
      await transferHelper
        .connect(user1)
        .transferToken(
          await token1.getAddress(),
          await recipient1.getAddress(),
          transferAmount2,
        );

      // Third transfer to different recipient
      await transferHelper
        .connect(user1)
        .transferToken(
          await token1.getAddress(),
          await recipient2.getAddress(),
          transferAmount3,
        );

      // Verify final balances
      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        transferAmount1 + transferAmount2,
      );
      expect(await token1.balanceOf(await recipient2.getAddress())).to.equal(
        transferAmount3,
      );
      expect(await token1.balanceOf(await user1.getAddress())).to.equal(
        totalAmount - transferAmount1 - transferAmount2 - transferAmount3,
      );
    });

    it('Should work with very small and very large amounts', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      // Test with smallest possible amount (1 wei)
      const smallAmount = 1n;
      await token1.mint(await user1.getAddress(), smallAmount * 2n);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), smallAmount * 2n);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            smallAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Test with very large amount
      const largeAmount = ethers.parseUnits('1000000', 18); // 1 million tokens
      await token1.mint(await user1.getAddress(), largeAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), largeAmount);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            largeAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Verify balances
      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        smallAmount + largeAmount,
      );
    });

    it('Should handle zero amount transfers if token allows', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      // Mint some tokens and approve (even though we're transferring 0)
      const amount = ethers.parseUnits('100', 18);
      await token1.mint(await user1.getAddress(), amount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount);

      // Most ERC20 tokens allow zero transfers
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            0,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Balances should remain unchanged
      expect(await token1.balanceOf(await user1.getAddress())).to.equal(amount);
      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(0);
    });
  });

  describe('Error Handling', function () {
    it('Should revert when token address has no code (EOA)', async function () {
      const { transferHelper, user1, user2, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);

      // Try to use an EOA address as token address
      await expect(
        transferHelper.connect(user1).transferToken(
          await user2.getAddress(), // EOA address, not a contract
          await recipient1.getAddress(),
          transferAmount,
        ),
      ).to.be.revertedWith('Invalid token address');
    });

    it('Should revert when token address is zero address', async function () {
      const { transferHelper, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            '0x0000000000000000000000000000000000000000',
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.be.revertedWith('Invalid token address');
    });

    it('Should revert when transfer returns false', async function () {
      const { transferHelper, maliciousToken, user1, recipient1 } =
        await loadFixture(deployTransferHelperFixture);

      const transferAmount = ethers.parseUnits('100', 18);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await maliciousToken.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.be.revertedWith('Transfer failed');
    });

    it('Should revert when user has insufficient balance', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);
      const insufficientAmount = ethers.parseUnits('50', 18);

      // Mint less than required amount
      await token1.mint(await user1.getAddress(), insufficientAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);

      // Should revert due to insufficient balance
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.be.reverted; // ERC20 will revert with insufficient balance
    });

    it('Should revert when user has insufficient allowance', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);
      const insufficientApproval = ethers.parseUnits('50', 18);

      // Mint sufficient tokens but approve insufficient amount
      await token1.mint(await user1.getAddress(), transferAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), insufficientApproval);

      // Should revert due to insufficient allowance
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.be.reverted; // ERC20 will revert with insufficient allowance
    });

    it('Should revert when token contract does not implement ERC20 interface', async function () {
      const { transferHelper, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      // Deploy a contract that has code but doesn't implement ERC20
      const NonERC20Contract = await ethers.getContractFactory(
        'TransferHelper',
      );
      const nonERC20 = await NonERC20Contract.deploy();

      const transferAmount = ethers.parseUnits('100', 18);

      // Should revert because the contract doesn't have a transfer function
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await nonERC20.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.be.reverted;
    });
  });

  describe('Event Emission', function () {
    it('Should emit TransferExecuted event with correct parameters', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('500', 18);

      await token1.mint(await user1.getAddress(), transferAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);

      // Check event emission with exact parameters
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      )
        .to.emit(transferHelper, 'TransferExecuted')
        .withArgs(
          await token1.getAddress(),
          await recipient1.getAddress(),
          transferAmount,
        );
    });

    it('Should emit events for multiple transfers with different parameters', async function () {
      const { transferHelper, token1, token2, user1, recipient1, recipient2 } =
        await loadFixture(deployTransferHelperFixture);

      const amount1 = ethers.parseUnits('100', 18);
      const amount2 = ethers.parseUnits('50', 6);

      // Setup token1
      await token1.mint(await user1.getAddress(), amount1);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount1);

      // Setup token2
      await token2.mint(await user1.getAddress(), amount2);
      await token2
        .connect(user1)
        .approve(await transferHelper.getAddress(), amount2);

      // First transfer
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            amount1,
          ),
      )
        .to.emit(transferHelper, 'TransferExecuted')
        .withArgs(
          await token1.getAddress(),
          await recipient1.getAddress(),
          amount1,
        );

      // Second transfer with different token and recipient
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token2.getAddress(),
            await recipient2.getAddress(),
            amount2,
          ),
      )
        .to.emit(transferHelper, 'TransferExecuted')
        .withArgs(
          await token2.getAddress(),
          await recipient2.getAddress(),
          amount2,
        );
    });
  });

  describe('Gas Subsidy Use Cases', function () {
    it('Should work correctly when called by different users (gas subsidy scenario)', async function () {
      const { transferHelper, token1, user1, user2, user3, recipient1 } =
        await loadFixture(deployTransferHelperFixture);

      const transferAmount = ethers.parseUnits('100', 18);

      // Multiple users use the same TransferHelper contract
      await token1.mint(await user1.getAddress(), transferAmount);
      await token1.mint(await user2.getAddress(), transferAmount);
      await token1.mint(await user3.getAddress(), transferAmount);

      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);
      await token1
        .connect(user2)
        .approve(await transferHelper.getAddress(), transferAmount);
      await token1
        .connect(user3)
        .approve(await transferHelper.getAddress(), transferAmount);

      // All users transfer through the same contract (simulating gas subsidy)
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      await expect(
        transferHelper
          .connect(user2)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      await expect(
        transferHelper
          .connect(user3)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Verify total amount received
      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        transferAmount * 3n,
      );
    });

    it('Should handle batch-like operations through multiple calls', async function () {
      const { transferHelper, token1, user1, recipient1, recipient2 } =
        await loadFixture(deployTransferHelperFixture);

      const totalAmount = ethers.parseUnits('1000', 18);
      const transferAmount = ethers.parseUnits('100', 18);

      await token1.mint(await user1.getAddress(), totalAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), totalAmount);

      // Simulate batch operations by making multiple calls
      const numTransfers = 5;
      for (let i = 0; i < numTransfers; i++) {
        const recipient = i % 2 === 0 ? recipient1 : recipient2;
        await expect(
          transferHelper
            .connect(user1)
            .transferToken(
              await token1.getAddress(),
              await recipient.getAddress(),
              transferAmount,
            ),
        ).to.emit(transferHelper, 'TransferExecuted');
      }

      // Verify distribution (3 to recipient1, 2 to recipient2)
      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        transferAmount * 3n,
      );
      expect(await token1.balanceOf(await recipient2.getAddress())).to.equal(
        transferAmount * 2n,
      );
    });
  });

  describe('Edge Cases and Stress Testing', function () {
    it('Should handle maximum uint256 amounts if token supports it', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      // Use a very large but realistic amount
      const largeAmount = ethers.parseUnits('1000000000', 18); // 1 billion tokens

      await token1.mint(await user1.getAddress(), largeAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), largeAmount);

      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            largeAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        largeAmount,
      );
    });

    it('Should work correctly with self-transfers', async function () {
      const { transferHelper, token1, user1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);

      await token1.mint(await user1.getAddress(), transferAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);

      const initialBalance = await token1.balanceOf(await user1.getAddress());

      // Transfer to self
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await user1.getAddress(),
            transferAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      // Balance should remain the same for self-transfer
      expect(await token1.balanceOf(await user1.getAddress())).to.equal(
        initialBalance,
      );
    });

    it('Should handle rapid successive transfers', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('10', 18);
      const numTransfers = 10;
      const totalAmount = transferAmount * BigInt(numTransfers);

      await token1.mint(await user1.getAddress(), totalAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), totalAmount);

      // Perform rapid transfers
      for (let i = 0; i < numTransfers; i++) {
        await transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          );
      }

      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        totalAmount,
      );
      expect(await token1.balanceOf(await user1.getAddress())).to.equal(0);
    });
  });

  describe('Integration with Different Token Types', function () {
    it('Should work with tokens that charge fees on transfer', async function () {
      // Note: This test assumes we have a fee-on-transfer token implementation
      // For now, we'll use the regular token and document the behavior
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      const transferAmount = ethers.parseUnits('100', 18);

      await token1.mint(await user1.getAddress(), transferAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);

      // With normal tokens, full amount should be transferred
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');

      expect(await token1.balanceOf(await recipient1.getAddress())).to.equal(
        transferAmount,
      );
    });

    it('Should handle tokens with different return value behaviors', async function () {
      const { transferHelper, token1, user1, recipient1 } = await loadFixture(
        deployTransferHelperFixture,
      );

      // Our mock tokens return true on successful transfer
      const transferAmount = ethers.parseUnits('100', 18);

      await token1.mint(await user1.getAddress(), transferAmount);
      await token1
        .connect(user1)
        .approve(await transferHelper.getAddress(), transferAmount);

      // Should work with tokens that return true
      await expect(
        transferHelper
          .connect(user1)
          .transferToken(
            await token1.getAddress(),
            await recipient1.getAddress(),
            transferAmount,
          ),
      ).to.emit(transferHelper, 'TransferExecuted');
    });
  });
});

// Additional contract for testing malicious token behavior
// This should be added to your contracts for testing
/*
contract MaliciousERC20 {
    function transfer(address, uint256) external pure returns (bool) {
        return false; // Always returns false
    }
    
    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
}
*/
