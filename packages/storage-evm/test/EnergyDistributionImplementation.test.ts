import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('EnergyDistributionImplementation', function () {
  // We define a fixture to reuse the same setup in every test
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, member1, member2, member3, other] = await ethers.getSigners();

    // Deploy the EnergyDistribution contract
    const EnergyDistribution = await ethers.getContractFactory(
      'EnergyDistributionImplementation',
    );
    const energyDistribution = await upgrades.deployProxy(
      EnergyDistribution,
      [owner.address],
      {
        initializer: 'initialize',
        kind: 'uups',
      },
    );

    return {
      energyDistribution,
      owner,
      member1,
      member2,
      member3,
      other,
    };
  }

  describe('Deployment & Initialization', function () {
    it('Should set the right owner', async function () {
      const { energyDistribution, owner } = await loadFixture(deployFixture);
      expect(await energyDistribution.owner()).to.equal(owner.address);
    });

    it('Should initialize with zero total ownership percentage', async function () {
      const { energyDistribution } = await loadFixture(deployFixture);
      expect(await energyDistribution.getTotalOwnershipPercentage()).to.equal(
        0,
      );
    });

    it('Should start with empty collective consumption', async function () {
      const { energyDistribution } = await loadFixture(deployFixture);
      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();
      expect(collectiveConsumption.length).to.equal(0);
    });
  });

  describe('Member Management', function () {
    it('Should add members successfully', async function () {
      const { energyDistribution, owner, member1 } = await loadFixture(
        deployFixture,
      );

      const deviceIds = [1001, 1002];
      const ownershipPercentage = 3000; // 30%

      await expect(
        energyDistribution.addMember(
          member1.address,
          deviceIds,
          ownershipPercentage,
        ),
      )
        .to.emit(energyDistribution, 'MemberAdded')
        .withArgs(member1.address, deviceIds, ownershipPercentage);

      // Verify member was added
      const member = await energyDistribution.getMember(member1.address);
      expect(member.memberAddress).to.equal(member1.address);
      expect(member.ownershipPercentage).to.equal(ownershipPercentage);
      expect(member.isActive).to.be.true;
      expect(member.deviceIds.length).to.equal(2);
      expect(member.deviceIds[0]).to.equal(1001);
      expect(member.deviceIds[1]).to.equal(1002);

      // Verify device ownership mapping
      expect(await energyDistribution.getDeviceOwner(1001)).to.equal(
        member1.address,
      );
      expect(await energyDistribution.getDeviceOwner(1002)).to.equal(
        member1.address,
      );

      // Verify total ownership percentage
      expect(await energyDistribution.getTotalOwnershipPercentage()).to.equal(
        3000,
      );
    });

    it('Should add multiple members with correct ownership distribution', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(deployFixture);

      // Add three members with different ownership percentages
      await energyDistribution.addMember(member1.address, [1001, 1002], 4000); // 40%
      await energyDistribution.addMember(member2.address, [2001, 2002], 3500); // 35%
      await energyDistribution.addMember(member3.address, [3001], 2500); // 25%

      expect(await energyDistribution.getTotalOwnershipPercentage()).to.equal(
        10000,
      ); // 100%
    });

    it('Should reject adding member with invalid parameters', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      // Test zero address
      await expect(
        energyDistribution.addMember(ethers.ZeroAddress, [1001], 3000),
      ).to.be.revertedWith('Invalid member address');

      // Test zero ownership percentage
      await expect(
        energyDistribution.addMember(member1.address, [1001], 0),
      ).to.be.revertedWith('Ownership percentage must be greater than 0');

      // Test ownership exceeding 100%
      await expect(
        energyDistribution.addMember(member1.address, [1001], 10001),
      ).to.be.revertedWith('Total ownership exceeds 100%');
    });

    it('Should reject adding member with duplicate device IDs', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        deployFixture,
      );

      await energyDistribution.addMember(member1.address, [1001, 1002], 3000);

      // Try to add another member with overlapping device ID
      await expect(
        energyDistribution.addMember(member2.address, [1002, 2001], 3000),
      ).to.be.revertedWith('Device ID already assigned');
    });

    it('Should reject adding existing member', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001], 3000);

      // Try to add the same member again
      await expect(
        energyDistribution.addMember(member1.address, [2001], 2000),
      ).to.be.revertedWith('Member already exists');
    });

    it('Should remove members successfully', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        deployFixture,
      );

      // Add members first
      await energyDistribution.addMember(member1.address, [1001, 1002], 4000);
      await energyDistribution.addMember(member2.address, [2001], 3000);

      // Remove member1
      await expect(energyDistribution.removeMember(member1.address))
        .to.emit(energyDistribution, 'MemberRemoved')
        .withArgs(member1.address);

      // Verify member was removed
      await expect(
        energyDistribution.getMember(member1.address),
      ).to.be.revertedWith('Member does not exist');

      // Verify device ownership was cleared
      expect(await energyDistribution.getDeviceOwner(1001)).to.equal(
        ethers.ZeroAddress,
      );
      expect(await energyDistribution.getDeviceOwner(1002)).to.equal(
        ethers.ZeroAddress,
      );

      // Verify total ownership percentage was updated
      expect(await energyDistribution.getTotalOwnershipPercentage()).to.equal(
        3000,
      );

      // Verify other member still exists
      const member2Data = await energyDistribution.getMember(member2.address);
      expect(member2Data.isActive).to.be.true;
    });

    it('Should reject removing non-existent member', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await expect(
        energyDistribution.removeMember(member1.address),
      ).to.be.revertedWith('Member does not exist');
    });

    it('Should only allow owner to manage members', async function () {
      const { energyDistribution, member1, other } = await loadFixture(
        deployFixture,
      );

      await expect(
        energyDistribution
          .connect(other)
          .addMember(member1.address, [1001], 3000),
      ).to.be.revertedWithCustomError(
        energyDistribution,
        'OwnableUnauthorizedAccount',
      );

      // Add member as owner first
      await energyDistribution.addMember(member1.address, [1001], 3000);

      await expect(
        energyDistribution.connect(other).removeMember(member1.address),
      ).to.be.revertedWithCustomError(
        energyDistribution,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Energy Distribution', function () {
    async function setupMembersFixture() {
      const fixture = await loadFixture(deployFixture);
      const { energyDistribution, member1, member2, member3 } = fixture;

      // Add three members with specific ownership percentages
      await energyDistribution.addMember(member1.address, [1001, 1002], 4000); // 40%
      await energyDistribution.addMember(member2.address, [2001, 2002], 3500); // 35%
      await energyDistribution.addMember(member3.address, [3001], 2500); // 25%

      return fixture;
    }

    it('Should distribute energy tokens based on ownership percentages', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupMembersFixture);

      const sources = [
        { sourceId: 1, price: 100, quantity: 1000 }, // 1000 units at price 100
        { sourceId: 2, price: 150, quantity: 500 }, // 500 units at price 150
      ];

      await expect(energyDistribution.distributeEnergyTokens(sources))
        .to.emit(energyDistribution, 'EnergyDistributed')
        .withArgs(2, 1500); // 2 sources, 1500 total quantity

      // Check allocated tokens (40%, 35%, 25% of 1500 = 600, 525, 375)
      expect(
        await energyDistribution.getAllocatedTokens(member1.address),
      ).to.equal(600);
      expect(
        await energyDistribution.getAllocatedTokens(member2.address),
      ).to.equal(525);
      expect(
        await energyDistribution.getAllocatedTokens(member3.address),
      ).to.equal(375);

      // Check collective consumption was created and sorted by price
      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();
      expect(collectiveConsumption.length).to.equal(6); // 3 members × 2 sources

      // Should be sorted by price (100 first, then 150)
      expect(collectiveConsumption[0].price).to.equal(100);
      expect(collectiveConsumption[1].price).to.equal(100);
      expect(collectiveConsumption[2].price).to.equal(100);
      expect(collectiveConsumption[3].price).to.equal(150);
      expect(collectiveConsumption[4].price).to.equal(150);
      expect(collectiveConsumption[5].price).to.equal(150);
    });

    it('Should reject distribution when ownership is not 100%', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      // Add only one member with partial ownership
      await energyDistribution.addMember(member1.address, [1001], 5000); // 50%

      const sources = [{ sourceId: 1, price: 100, quantity: 1000 }];

      await expect(
        energyDistribution.distributeEnergyTokens(sources),
      ).to.be.revertedWith('Total ownership must be 100%');
    });

    it('Should reject empty sources array', async function () {
      const { energyDistribution } = await loadFixture(setupMembersFixture);

      await expect(
        energyDistribution.distributeEnergyTokens([]),
      ).to.be.revertedWith('No sources provided');
    });

    it('Should clear previous distribution', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setupMembersFixture,
      );

      // First distribution
      const sources1 = [{ sourceId: 1, price: 100, quantity: 1000 }];
      await energyDistribution.distributeEnergyTokens(sources1);
      expect(
        await energyDistribution.getAllocatedTokens(member1.address),
      ).to.equal(400);

      // Second distribution should clear the first
      const sources2 = [{ sourceId: 2, price: 200, quantity: 2000 }];
      await energyDistribution.distributeEnergyTokens(sources2);
      expect(
        await energyDistribution.getAllocatedTokens(member1.address),
      ).to.equal(800);
    });

    it('Should only allow owner to distribute tokens', async function () {
      const { energyDistribution, other } = await loadFixture(
        setupMembersFixture,
      );

      const sources = [{ sourceId: 1, price: 100, quantity: 1000 }];

      await expect(
        energyDistribution.connect(other).distributeEnergyTokens(sources),
      ).to.be.revertedWithCustomError(
        energyDistribution,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Energy Consumption', function () {
    async function setupDistributionFixture() {
      const fixture = await loadFixture(deployFixture);
      const { energyDistribution, member1, member2, member3 } = fixture;

      // Add three members
      await energyDistribution.addMember(member1.address, [1001, 1002], 4000); // 40%
      await energyDistribution.addMember(member2.address, [2001, 2002], 3500); // 35%
      await energyDistribution.addMember(member3.address, [3001], 2500); // 25%

      // Distribute energy tokens
      const sources = [
        { sourceId: 1, price: 100, quantity: 1000 }, // 1000 units at price 100
        { sourceId: 2, price: 200, quantity: 500 }, // 500 units at price 200
      ];
      await energyDistribution.distributeEnergyTokens(sources);
      // Allocated: member1=600, member2=525, member3=375

      return fixture;
    }

    it('Should handle under-consumption correctly', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupDistributionFixture);

      // Member1 consumes less than allocated (600 allocated, 400 consumed)
      const consumptionRequests = [
        { deviceId: 1001, quantity: 200 },
        { deviceId: 1002, quantity: 200 }, // Total 400 for member1
      ];

      await expect(
        energyDistribution.consumeEnergyTokens(consumptionRequests),
      ).to.emit(energyDistribution, 'EnergyConsumed');

      // Member1 should have positive cash credit balance
      const balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(balance).to.be.gt(0); // Should be positive due to under-consumption

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle under-consumption correctly ===',
      );
      const finalBalanceMember1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1}`,
      );
      // Balances for other members will also be affected by export
      const finalBalanceMember2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2}`,
      );
      const finalBalanceMember3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      console.log(
        `Member3 (${member3.address}) final balance: ${finalBalanceMember3}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should handle over-consumption correctly', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupDistributionFixture);

      // Member1 consumes more than allocated (600 allocated, 800 consumed)
      const consumptionRequests = [
        { deviceId: 1001, quantity: 400 },
        { deviceId: 1002, quantity: 400 }, // Total 800 for member1
      ];

      await energyDistribution.consumeEnergyTokens(consumptionRequests);

      // Member1 should have negative cash credit balance
      const balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(balance).to.be.lt(0); // Should be negative due to over-consumption

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle over-consumption correctly ===',
      );
      const finalBalanceMember1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1}`,
      );
      const finalBalanceMember2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2}`,
      );
      const finalBalanceMember3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      console.log(
        `Member3 (${member3.address}) final balance: ${finalBalanceMember3}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should handle exact consumption correctly', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupDistributionFixture);

      // Member1 consumes exactly what was allocated (600)
      const consumptionRequests = [
        { deviceId: 1001, quantity: 300 },
        { deviceId: 1002, quantity: 300 }, // Total 600 for member1
      ];

      await energyDistribution.consumeEnergyTokens(consumptionRequests);

      // Member1 should have zero or minimal cash credit balance
      const balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(balance).to.equal(0);

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle exact consumption correctly ===',
      );
      const finalBalanceMember1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1}`,
      );
      const finalBalanceMember2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2}`,
      );
      const finalBalanceMember3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      console.log(
        `Member3 (${member3.address}) final balance: ${finalBalanceMember3}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should process multiple members correctly', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupDistributionFixture);

      const consumptionRequests = [
        { deviceId: 1001, quantity: 300 }, // member1: 300
        { deviceId: 1002, quantity: 100 }, // member1: +100 = 400 total (under-consumption)
        { deviceId: 2001, quantity: 600 }, // member2: 600 (over-consumption, allocated 525)
        { deviceId: 3001, quantity: 200 }, // member3: 200 (under-consumption, allocated 375)
      ];

      await energyDistribution.consumeEnergyTokens(consumptionRequests);

      // Check cash credit balances
      const balance1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const balance2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const balance3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );

      expect(balance1).to.be.gt(0); // Under-consumption = positive
      expect(balance2).to.be.lt(0); // Over-consumption = negative
      expect(balance3).to.be.gt(0); // Under-consumption = positive

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should process multiple members correctly ===',
      );
      const finalBalanceMember1_multi =
        await energyDistribution.getCashCreditBalance(member1.address);
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1_multi}`,
      );
      const finalBalanceMember2_multi =
        await energyDistribution.getCashCreditBalance(member2.address);
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2_multi}`,
      );
      const finalBalanceMember3_multi =
        await energyDistribution.getCashCreditBalance(member3.address);
      console.log(
        `Member3 (${member3.address}) final balance: ${finalBalanceMember3_multi}`,
      );
      const exportBalance_multi =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance_multi}`);
    });

    it('Should reject consumption for non-existent device', async function () {
      const { energyDistribution, owner } = await loadFixture(
        setupDistributionFixture,
      );

      const consumptionRequests = [{ deviceId: 9999, quantity: 50 }];

      await expect(
        energyDistribution
          .connect(owner)
          .consumeEnergyTokens(consumptionRequests),
      ).to.be.revertedWith('Device not registered to any member');
    });

    it('Should reject empty consumption requests', async function () {
      const { energyDistribution } = await loadFixture(
        setupDistributionFixture,
      );

      await expect(
        energyDistribution.consumeEnergyTokens([]),
      ).to.be.revertedWith('No consumption requests provided');
    });

    it('Should only allow owner to consume tokens', async function () {
      const { energyDistribution, other } = await loadFixture(
        setupDistributionFixture,
      );

      const consumptionRequests = [{ deviceId: 1001, quantity: 100 }];

      await expect(
        energyDistribution
          .connect(other)
          .consumeEnergyTokens(consumptionRequests),
      ).to.be.revertedWithCustomError(
        energyDistribution,
        'OwnableUnauthorizedAccount',
      );
    });

    it('Should calculate cash credits based on price sorting', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupDistributionFixture);

      // Log initial allocations for all members
      const allocation1 = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const allocation2 = await energyDistribution.getAllocatedTokens(
        member2.address,
      );
      const allocation3 = await energyDistribution.getAllocatedTokens(
        member3.address,
      );

      console.log('\n=== INITIAL ALLOCATIONS ===');
      console.log(
        `Member1 allocated: ${allocation1} tokens (40% of 1500 total)`,
      );
      console.log(
        `Member2 allocated: ${allocation2} tokens (35% of 1500 total)`,
      );
      console.log(
        `Member3 allocated: ${allocation3} tokens (25% of 1500 total)`,
      );

      // Helper function to log collective consumption state
      function logCollectiveConsumption(title: string, collective: any[]) {
        console.log(`\n=== ${title} ===`);
        let total = 0;
        for (let i = 0; i < collective.length; i++) {
          const item = collective[i];
          const memberName =
            item.owner === member1.address
              ? 'Member1'
              : item.owner === member2.address
              ? 'Member2'
              : 'Member3';
          console.log(
            `  Item ${i}: ${memberName} - ${item.quantity} tokens @ price ${
              item.price
            } = value ${Number(item.quantity) * Number(item.price)}`,
          );
          total += Number(item.quantity);
        }
        console.log(`  TOTAL TOKENS: ${total}`);
        return total;
      }

      // Log collective consumption before consumption
      const collectiveConsumptionBefore =
        await energyDistribution.getCollectiveConsumption();
      logCollectiveConsumption(
        'COLLECTIVE CONSUMPTION BEFORE CONSUMPTION',
        collectiveConsumptionBefore,
      );

      // Process ALL consumption in a SINGLE call (no step-by-step to avoid double processing)
      console.log('\n=== PROCESSING ALL CONSUMPTION IN SINGLE CALL ===');
      console.log(`Member1 consuming: 100 tokens (allocated: ${allocation1})`);
      console.log(`Member2 consuming: 700 tokens (allocated: ${allocation2})`);
      console.log(`Member3 consuming: 0 tokens (allocated: ${allocation3})`);

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 100 }, // member1
        { deviceId: 2001, quantity: 700 }, // member2
        // member3 doesn't consume anything
      ]);

      // Show final state
      const collectiveAfterAll =
        await energyDistribution.getCollectiveConsumption();
      logCollectiveConsumption(
        'COLLECTIVE CONSUMPTION AFTER ALL PROCESSING',
        collectiveAfterAll,
      );

      // Get all balances
      const balance1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const balance2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const balance3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      const finalExportBalance =
        await energyDistribution.getExportCashCreditBalance();

      console.log('\n=== FINAL CASH CREDIT BALANCES ===');
      console.log(`Member1: ${balance1}`);
      console.log(`Member2: ${balance2}`);
      console.log(`Member3: ${balance3}`);
      console.log(`Export: ${finalExportBalance}`);

      const totalSystemBalance =
        Number(balance1) +
        Number(balance2) +
        Number(balance3) +
        Number(finalExportBalance);
      console.log(`Total system balance: ${totalSystemBalance} (should be 0)`);

      console.log('\n=== EXPECTED CALCULATION ===');
      console.log(
        '1. Member1 burns 100@100 from his tokens, gets 0 initial credit',
      );
      console.log(
        '2. Member2 burns all 525 tokens + buys 175 extra from Member1',
      );
      console.log('3. Member2 pays Member1: 175×100 = 17,500');
      console.log('4. Export remaining tokens:');
      console.log('   - Member1: 125@100 + 200@200 = 52,500');
      console.log('   - Member3: 250@100 + 125@200 = 50,000');
      console.log('5. Final balances:');
      console.log('   - Member1: 17,500 + 52,500 = 70,000');
      console.log('   - Member2: -17,500');
      console.log('   - Member3: 50,000');
      console.log('   - Export: -102,500');
      console.log('   - Total: 0');

      // Test expectations with correct values
      expect(balance1).to.equal(70000); // Payment from Member2 + export payment
      expect(balance2).to.equal(-17500); // Over-consumption cost
      expect(balance3).to.equal(50000); // Export payment only
      expect(finalExportBalance).to.equal(-102500); // Export cost
      expect(totalSystemBalance).to.equal(0); // Zero-sum system

      console.log('\n=== TEST PASSED: Zero-sum economics verified ===');

      // Balances are already logged extensively in this test, but for consistency:
      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should calculate cash credits based on price sorting ===',
      );
      const finalBalanceMember1_calc =
        await energyDistribution.getCashCreditBalance(member1.address);
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1_calc}`,
      );
      const finalBalanceMember2_calc =
        await energyDistribution.getCashCreditBalance(member2.address);
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2_calc}`,
      );
      const finalBalanceMember3_calc =
        await energyDistribution.getCashCreditBalance(member3.address);
      console.log(
        `Member3 (${member3.address}) final balance: ${finalBalanceMember3_calc}`,
      );
      const finalExportBalance_calc =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${finalExportBalance_calc}`);
    });
  });

  describe('View Functions', function () {
    it('Should return correct collective consumption', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        deployFixture,
      );

      await energyDistribution.addMember(member1.address, [1001], 5000);
      await energyDistribution.addMember(member2.address, [2001], 5000);

      const sources = [
        { sourceId: 1, price: 200, quantity: 1000 },
        { sourceId: 2, price: 100, quantity: 500 },
      ];
      await energyDistribution.distributeEnergyTokens(sources);

      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();

      // Should be sorted by price (100 first, then 200)
      expect(collectiveConsumption[0].price).to.equal(100);
      expect(collectiveConsumption[1].price).to.equal(100);
      expect(collectiveConsumption[2].price).to.equal(200);
      expect(collectiveConsumption[3].price).to.equal(200);
    });

    it('Should return correct device owner', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001, 1002], 5000);

      expect(await energyDistribution.getDeviceOwner(1001)).to.equal(
        member1.address,
      );
      expect(await energyDistribution.getDeviceOwner(1002)).to.equal(
        member1.address,
      );
      expect(await energyDistribution.getDeviceOwner(9999)).to.equal(
        ethers.ZeroAddress,
      );
    });

    it('Should return zero cash credit balance for new members', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001], 5000);

      expect(
        await energyDistribution.getCashCreditBalance(member1.address),
      ).to.equal(0);
    });
  });

  describe('Edge Cases and Integration', function () {
    it('Should handle fractional ownership percentages correctly', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        deployFixture,
      );

      // Add members with fractional percentages that sum to 100%
      await energyDistribution.addMember(member1.address, [1001], 3333); // 33.33%
      await energyDistribution.addMember(member2.address, [2001], 6667); // 66.67%

      const sources = [{ sourceId: 1, price: 100, quantity: 1000 }];
      await energyDistribution.distributeEnergyTokens(sources);

      // Check allocations
      const allocation1 = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const allocation2 = await energyDistribution.getAllocatedTokens(
        member2.address,
      );

      expect(allocation1).to.equal(333); // 33.33% of 1000
      expect(allocation2).to.equal(667); // 66.67% of 1000 + remainder (since member2 is last)
      expect(Number(allocation1) + Number(allocation2)).to.equal(1000); // Total should be exactly 1000

      // Note: No consumption in this test, so balances remain 0.
      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle fractional ownership percentages correctly ===',
      );
      const finalBalanceMember1_frac =
        await energyDistribution.getCashCreditBalance(member1.address);
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1_frac}`,
      );
      const finalBalanceMember2_frac =
        await energyDistribution.getCashCreditBalance(member2.address);
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2_frac}`,
      );
      const exportBalance_frac =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance_frac}`); // Will be 0 as no consumption/export processing happened
    });
  });
});
