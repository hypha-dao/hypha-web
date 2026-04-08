import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';

describe('EnergySettlement', function () {
  async function deployFixture() {
    const [owner, member1, member2, paymentRecipient, other] =
      await ethers.getSigners();

    // Deploy mock EURC token
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const eurcToken = await MockERC20.deploy('Euro Coin', 'EURC', 6); // 6 decimals like real EURC

    // Deploy EnergyToken contract
    const EnergyToken = await ethers.getContractFactory('EnergyToken');
    const energyToken = await EnergyToken.deploy(
      'Community Energy Token',
      'CET',
      owner.address,
    );

    // Deploy EnergyDistribution contract
    const EnergyDistribution = await ethers.getContractFactory(
      'EnergyDistributionImplementation',
    );
    const energyDistribution = await upgrades.deployProxy(
      EnergyDistribution,
      [owner.address, energyToken.target],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    // Authorize the energy distribution contract to mint/burn tokens
    await energyToken.setAuthorized(energyDistribution.target, true);

    // Deploy EnergySettlement contract
    const EnergySettlement = await ethers.getContractFactory(
      'EnergySettlement',
    );
    const energySettlement = await EnergySettlement.deploy(
      eurcToken.target,
      energyDistribution.target,
      paymentRecipient.address,
      owner.address,
    );

    // Set settlement contract in energy distribution
    await energyDistribution.setSettlementContract(energySettlement.target);

    // Mint some EURC tokens to test users
    await eurcToken.mint(member1.address, ethers.parseUnits('1000', 6)); // 1000 EURC
    await eurcToken.mint(member2.address, ethers.parseUnits('500', 6)); // 500 EURC
    await eurcToken.mint(other.address, ethers.parseUnits('100', 6)); // 100 EURC

    return {
      energyDistribution,
      energyToken,
      energySettlement,
      eurcToken,
      owner,
      member1,
      member2,
      paymentRecipient,
      other,
    };
  }

  async function setupWithDebtFixture() {
    const contracts = await loadFixture(deployFixture);
    const { energyDistribution, member1, member2, other } = contracts;

    // Add members to create some debt scenario
    await energyDistribution.addMember(member1.address, [1001], 5000); // 50%
    await energyDistribution.addMember(member2.address, [2001], 3000); // 30%
    await energyDistribution.addMember(other.address, [8888], 2000); // 20% - Community fund

    // Set community device ID
    await energyDistribution.setCommunityDeviceId(8888);

    // Create energy distribution to establish some allocations
    const energySources = [
      { sourceId: 1, price: 10, quantity: 100, isImport: false }, // 100 kWh @ $0.10/kWh
      { sourceId: 3, price: 25, quantity: 50, isImport: true }, // 50 kWh imports @ $0.25/kWh
    ];
    await energyDistribution.distributeEnergyTokens(energySources, 0);

    // Create consumption that matches available energy but creates debt due to high consumption
    const consumptionRequests = [
      { deviceId: 1001, quantity: 75 }, // Member1 consumes 75 kWh
      { deviceId: 2001, quantity: 45 }, // Member2 consumes 45 kWh
      { deviceId: 8888, quantity: 30 }, // Community consumes 30 kWh
      // Total: 150 kWh (matches available energy)
    ];
    await energyDistribution.consumeEnergyTokens(consumptionRequests);

    return contracts;
  }

  describe('Deployment', function () {
    it('Should deploy with correct parameters', async function () {
      const {
        energySettlement,
        eurcToken,
        energyDistribution,
        paymentRecipient,
      } = await loadFixture(deployFixture);

      expect(await energySettlement.eurcToken()).to.equal(eurcToken.target);
      expect(await energySettlement.energyDistribution()).to.equal(
        energyDistribution.target,
      );
      expect(await energySettlement.paymentRecipient()).to.equal(
        paymentRecipient.address,
      );
    });

    it('Should revert with invalid parameters', async function () {
      const [owner, paymentRecipient] = await ethers.getSigners();
      const EnergySettlement = await ethers.getContractFactory(
        'EnergySettlement',
      );

      // Deploy mock contracts for valid addresses
      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const eurcToken = await MockERC20.deploy('Euro Coin', 'EURC', 6);

      const EnergyToken = await ethers.getContractFactory('EnergyToken');
      const energyToken = await EnergyToken.deploy('CET', 'CET', owner.address);

      const EnergyDistribution = await ethers.getContractFactory(
        'EnergyDistributionImplementation',
      );
      const energyDistribution = await upgrades.deployProxy(
        EnergyDistribution,
        [owner.address, energyToken.target],
        { initializer: 'initialize', kind: 'uups' },
      );

      // Test invalid EURC token
      await expect(
        EnergySettlement.deploy(
          ethers.ZeroAddress,
          energyDistribution.target,
          paymentRecipient.address,
          owner.address,
        ),
      ).to.be.revertedWith('Invalid EURC token address');

      // Test invalid energy distribution
      await expect(
        EnergySettlement.deploy(
          eurcToken.target,
          ethers.ZeroAddress,
          paymentRecipient.address,
          owner.address,
        ),
      ).to.be.revertedWith('Invalid Energy Distribution address');

      // Test invalid payment recipient
      await expect(
        EnergySettlement.deploy(
          eurcToken.target,
          energyDistribution.target,
          ethers.ZeroAddress,
          owner.address,
        ),
      ).to.be.revertedWith('Invalid payment recipient address');
    });
  });

  describe('Debt Settlement', function () {
    it('Should settle debt correctly', async function () {
      const {
        energySettlement,
        energyDistribution,
        eurcToken,
        member1,
        paymentRecipient,
      } = await loadFixture(setupWithDebtFixture);

      // Check initial debt
      const [initialBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(initialBalance).to.be.lt(0); // Should have debt

      // Calculate debt in EURC terms
      const debtInEurc = await energySettlement.getDebtInEurc(member1.address);
      expect(debtInEurc).to.be.gt(0);

      // Approve EURC spending
      await eurcToken
        .connect(member1)
        .approve(energySettlement.target, debtInEurc);

      // Get initial EURC balances
      const initialPayerBalance = await eurcToken.balanceOf(member1.address);
      const initialRecipientBalance = await eurcToken.balanceOf(
        paymentRecipient.address,
      );

      // Settle debt
      await expect(
        energySettlement
          .connect(member1)
          .settleDebt(member1.address, debtInEurc),
      )
        .to.emit(energySettlement, 'DebtSettled')
        .to.emit(energyDistribution, 'DebtSettled');

      // Check final balance
      const [finalBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(finalBalance).to.equal(0); // Debt should be cleared

      // Check EURC transfers
      const finalPayerBalance = await eurcToken.balanceOf(member1.address);
      const finalRecipientBalance = await eurcToken.balanceOf(
        paymentRecipient.address,
      );

      expect(finalPayerBalance).to.equal(initialPayerBalance - debtInEurc);
      expect(finalRecipientBalance).to.equal(
        initialRecipientBalance + debtInEurc,
      );
    });

    it('Should settle partial debt', async function () {
      const { energySettlement, energyDistribution, eurcToken, member1 } =
        await loadFixture(setupWithDebtFixture);

      const [initialBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const debtAmount = -initialBalance;

      // Settle only half the debt
      const partialAmount = ethers.parseUnits('2', 6); // 2 EURC
      await eurcToken
        .connect(member1)
        .approve(energySettlement.target, partialAmount);

      await energySettlement
        .connect(member1)
        .settleDebt(member1.address, partialAmount);

      const [finalBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );

      // Should have reduced debt but not zero
      expect(finalBalance).to.be.lt(0);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it('Should allow settling debt for another user', async function () {
      const {
        energySettlement,
        energyDistribution,
        eurcToken,
        member1,
        member2,
      } = await loadFixture(setupWithDebtFixture);

      const [initialBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const debtInEurc = await energySettlement.getDebtInEurc(member1.address);

      // Member2 pays Member1's debt
      await eurcToken
        .connect(member2)
        .approve(energySettlement.target, debtInEurc);

      await expect(
        energySettlement
          .connect(member2)
          .settleDebt(member1.address, debtInEurc),
      ).to.emit(energySettlement, 'DebtSettled');

      const [finalBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(finalBalance).to.equal(0);
    });

    it('Should use settleOwnDebt convenience function', async function () {
      const { energySettlement, energyDistribution, eurcToken, member1 } =
        await loadFixture(setupWithDebtFixture);

      const debtInEurc = await energySettlement.getDebtInEurc(member1.address);
      await eurcToken
        .connect(member1)
        .approve(energySettlement.target, debtInEurc);

      await expect(
        energySettlement.connect(member1).settleOwnDebt(debtInEurc),
      ).to.emit(energySettlement, 'DebtSettled');

      const [finalBalance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(finalBalance).to.equal(0);
    });

    it('Should revert when no debt exists', async function () {
      const { energySettlement, eurcToken, other } = await loadFixture(
        setupWithDebtFixture,
      );

      // Other user has no debt (community fund has positive balance)
      await eurcToken
        .connect(other)
        .approve(energySettlement.target, ethers.parseUnits('10', 6));

      await expect(
        energySettlement
          .connect(other)
          .settleDebt(other.address, ethers.parseUnits('10', 6)),
      ).to.be.revertedWith('No debt to settle');
    });

    it('Should revert with invalid parameters', async function () {
      const { energySettlement, member1 } = await loadFixture(
        setupWithDebtFixture,
      );

      // Invalid debtor address
      await expect(
        energySettlement.connect(member1).settleDebt(ethers.ZeroAddress, 1000),
      ).to.be.revertedWith('Invalid debtor address');

      // Zero amount
      await expect(
        energySettlement.connect(member1).settleDebt(member1.address, 0),
      ).to.be.revertedWith('Amount must be greater than 0');
    });
  });

  describe('Admin Functions', function () {
    it('Should update payment recipient', async function () {
      const { energySettlement, owner, member1 } = await loadFixture(
        deployFixture,
      );

      await expect(
        energySettlement.connect(owner).setPaymentRecipient(member1.address),
      ).to.emit(energySettlement, 'PaymentRecipientUpdated');

      expect(await energySettlement.paymentRecipient()).to.equal(
        member1.address,
      );
    });

    it('Should revert payment recipient update from non-owner', async function () {
      const { energySettlement, member1 } = await loadFixture(deployFixture);

      await expect(
        energySettlement.connect(member1).setPaymentRecipient(member1.address),
      ).to.be.revertedWithCustomError(
        energySettlement,
        'OwnableUnauthorizedAccount',
      );
    });

    it('Should allow emergency token recovery', async function () {
      const { energySettlement, eurcToken, owner } = await loadFixture(
        deployFixture,
      );

      // Send some tokens to the settlement contract
      const amount = ethers.parseUnits('100', 6);
      await eurcToken.mint(energySettlement.target, amount);

      const initialOwnerBalance = await eurcToken.balanceOf(owner.address);

      await energySettlement
        .connect(owner)
        .emergencyRecover(eurcToken.target, amount);

      const finalOwnerBalance = await eurcToken.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance + amount);
    });
  });

  describe('View Functions', function () {
    it('Should return correct debt in EURC', async function () {
      const { energySettlement, energyDistribution, member1 } =
        await loadFixture(setupWithDebtFixture);

      const [balance] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const debtInEurc = await energySettlement.getDebtInEurc(member1.address);

      if (balance < 0) {
        const expectedEurc = BigInt(-balance) * BigInt(10000); // Convert from cents to EURC
        expect(debtInEurc).to.equal(expectedEurc);
      } else {
        expect(debtInEurc).to.equal(0);
      }
    });

    it('Should return zero debt for positive balance', async function () {
      const { energySettlement, other } = await loadFixture(
        setupWithDebtFixture,
      );

      const debtInEurc = await energySettlement.getDebtInEurc(other.address);
      expect(debtInEurc).to.equal(0);
    });
  });

  describe('Integration', function () {
    it('Should maintain zero-sum property after settlement', async function () {
      const { energySettlement, energyDistribution, eurcToken, member1 } =
        await loadFixture(setupWithDebtFixture);

      // Check zero-sum before settlement
      const [isZeroSumBefore] =
        await energyDistribution.verifyZeroSumProperty();
      expect(isZeroSumBefore).to.be.true;

      // Settle debt
      const debtInEurc = await energySettlement.getDebtInEurc(member1.address);
      await eurcToken
        .connect(member1)
        .approve(energySettlement.target, debtInEurc);
      await energySettlement
        .connect(member1)
        .settleDebt(member1.address, debtInEurc);

      // Check zero-sum after settlement
      const [isZeroSumAfter] = await energyDistribution.verifyZeroSumProperty();
      expect(isZeroSumAfter).to.be.true;

      // Verify settled balance tracking
      const settledBalance = await energyDistribution.getSettledBalance();
      expect(settledBalance).to.be.lt(0); // Should be negative (external money brought in)
    });

    it('Should handle multiple settlements', async function () {
      const {
        energySettlement,
        energyDistribution,
        eurcToken,
        member1,
        member2,
      } = await loadFixture(setupWithDebtFixture);

      // Settle both members' debts
      const debt1 = await energySettlement.getDebtInEurc(member1.address);
      const debt2 = await energySettlement.getDebtInEurc(member2.address);

      await eurcToken.connect(member1).approve(energySettlement.target, debt1);
      await eurcToken.connect(member2).approve(energySettlement.target, debt2);

      await energySettlement.connect(member1).settleOwnDebt(debt1);
      await energySettlement.connect(member2).settleOwnDebt(debt2);

      // Both should have zero debt
      expect(
        await energyDistribution.getCashCreditBalance(member1.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member2.address),
      ).to.equal(0);

      // System should still be zero-sum
      const [isZeroSum] = await energyDistribution.verifyZeroSumProperty();
      expect(isZeroSum).to.be.true;

      // Verify settled balance tracks all external settlements
      const settledBalance = await energyDistribution.getSettledBalance();
      expect(settledBalance).to.be.lt(0); // Should be negative (total external money brought in)
    });
  });
});
