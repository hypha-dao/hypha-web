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
    });

    it('Should handle over-consumption correctly', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setupDistributionFixture,
      );

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
    });

    it('Should handle exact consumption correctly', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setupDistributionFixture,
      );

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
    });

    it('Should reject consumption for non-existent device', async function () {
      const { energyDistribution } = await loadFixture(
        setupDistributionFixture,
      );

      const consumptionRequests = [
        { deviceId: 9999, quantity: 100 }, // Non-existent device
      ];

      await expect(
        energyDistribution.consumeEnergyTokens(consumptionRequests),
      ).to.be.revertedWith('Device not found');
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
      const { energyDistribution, member1, member2 } = await loadFixture(
        setupDistributionFixture,
      );

      // Log initial allocations
      const allocation1 = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const allocation2 = await energyDistribution.getAllocatedTokens(
        member2.address,
      );

      console.log('\n=== INITIAL ALLOCATIONS ===');
      console.log(
        `Member1 allocated: ${allocation1} tokens (40% of 1500 total)`,
      );
      console.log(
        `Member2 allocated: ${allocation2} tokens (35% of 1500 total)`,
      );

      // Log collective consumption before consumption
      const collectiveConsumptionBefore =
        await energyDistribution.getCollectiveConsumption();
      console.log('\n=== COLLECTIVE CONSUMPTION (sorted by price) ===');
      for (let i = 0; i < collectiveConsumptionBefore.length; i++) {
        const item = collectiveConsumptionBefore[i];
        console.log(
          `Item ${i}: Owner=${item.owner.slice(0, 8)}..., Price=${
            item.price
          }, Quantity=${item.quantity}`,
        );
      }

      // Create scenario where member2 over-consumes and should pay higher prices
      const consumptionRequests = [
        { deviceId: 1001, quantity: 100 }, // member1: under-consumption
        { deviceId: 2001, quantity: 700 }, // member2: over-consumption (allocated 525)
      ];

      console.log('\n=== CONSUMPTION REQUESTS ===');
      console.log(`Member1 consuming: 100 tokens (allocated: ${allocation1})`);
      console.log(`Member2 consuming: 700 tokens (allocated: ${allocation2})`);
      console.log(
        `Member1 excess: ${100 - Number(allocation1)} (${
          100 < Number(allocation1) ? 'UNDER' : 'OVER'
        }-consumption)`,
      );
      console.log(
        `Member2 excess: ${700 - Number(allocation2)} (${
          700 < Number(allocation2) ? 'UNDER' : 'OVER'
        }-consumption)`,
      );

      await energyDistribution.consumeEnergyTokens(consumptionRequests);

      const balance1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const balance2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );

      console.log('\n=== FINAL CASH CREDIT BALANCES ===');
      console.log(
        `Member1 (${member1.address.slice(0, 8)}...): ${balance1} (${
          Number(balance1) > 0
            ? 'POSITIVE'
            : Number(balance1) < 0
            ? 'NEGATIVE'
            : 'ZERO'
        })`,
      );
      console.log(
        `Member2 (${member2.address.slice(0, 8)}...): ${balance2} (${
          Number(balance2) > 0
            ? 'POSITIVE'
            : Number(balance2) < 0
            ? 'NEGATIVE'
            : 'ZERO'
        })`,
      );

      // Log breakdown of Member1's calculation
      console.log('\n=== MEMBER1 CALCULATION BREAKDOWN ===');
      console.log(`Allocated: ${allocation1} tokens`);
      console.log(`Consumed: 100 tokens`);
      console.log(`Unused: ${Number(allocation1) - 100} tokens`);
      console.log(`Member1 had tokens at two prices:`);
      console.log(`- 400 tokens at price 100 = 40,000 value`);
      console.log(`- 200 tokens at price 200 = 40,000 value`);
      console.log(`After consuming 100 tokens (cheapest first):`);
      console.log(`- Used: 100 tokens at price 100`);
      console.log(`- Unused: 300 tokens at price 100 = 30,000 value`);
      console.log(`- Unused: 200 tokens at price 200 = 40,000 value`);
      console.log(`Total unused value: 30,000 + 40,000 = 70,000`);

      // Log breakdown of Member2's calculation
      console.log('\n=== MEMBER2 CALCULATION BREAKDOWN ===');
      console.log(`Allocated: ${allocation2} tokens`);
      console.log(`Consumed: 700 tokens`);
      console.log(`Excess: ${700 - Number(allocation2)} tokens`);
      console.log(`Member2 had tokens at two prices:`);
      console.log(`- 350 tokens at price 100 = 35,000 value`);
      console.log(`- 175 tokens at price 200 = 35,000 value`);
      console.log(`After consuming all 525 allocated tokens (free):`);
      console.log(
        `- Need additional: ${
          700 - Number(allocation2)
        } tokens from collective pool`,
      );
      console.log(
        `- Extra tokens consumed at cheapest rate: ${
          700 - Number(allocation2)
        } × 100 = ${(700 - Number(allocation2)) * 100} cost`,
      );

      // Log collective consumption after consumption
      const collectiveConsumptionAfter =
        await energyDistribution.getCollectiveConsumption();
      console.log('\n=== COLLECTIVE CONSUMPTION AFTER ===');
      for (let i = 0; i < collectiveConsumptionAfter.length; i++) {
        const item = collectiveConsumptionAfter[i];
        console.log(
          `Item ${i}: Owner=${item.owner.slice(0, 8)}..., Price=${
            item.price
          }, Quantity=${item.quantity}`,
        );
      }

      expect(balance1).to.be.gt(0); // Under-consumption = positive
      expect(balance2).to.be.lt(0); // Over-consumption = negative

      // Verify the economics: under-consumer gets value for unused tokens,
      // over-consumer pays for extra consumption at cheapest rates
      // Member1: 500 unused tokens (300×100 + 200×200) = 70,000 value
      expect(balance1).to.equal(70000);
      // Member2: 175 extra tokens at cheapest rate (175×100) = -17,500 cost
      expect(balance2).to.equal(-17500);

      console.log('\n=== TEST PASSED: Economics verified ===');
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
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(deployFixture);

      // Add members with fractional percentages that sum to 100%
      await energyDistribution.addMember(member1.address, [1001], 3333); // 33.33%
      await energyDistribution.addMember(member2.address, [2001], 3333); // 33.33%
      await energyDistribution.addMember(member3.address, [3001], 3334); // 33.34%

      const sources = [{ sourceId: 1, price: 100, quantity: 999 }]; // Number that doesn't divide evenly
      await energyDistribution.distributeEnergyTokens(sources);

      // Verify allocation (should handle rounding)
      const total =
        Number(await energyDistribution.getAllocatedTokens(member1.address)) +
        Number(await energyDistribution.getAllocatedTokens(member2.address)) +
        Number(await energyDistribution.getAllocatedTokens(member3.address));

      expect(total).to.be.closeTo(999, 3); // Allow for rounding differences
    });

    it('Should handle complete energy distribution and consumption cycle', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(deployFixture);

      // Setup members
      await energyDistribution.addMember(member1.address, [1001, 1002], 5000); // 50%
      await energyDistribution.addMember(member2.address, [2001], 3000); // 30%
      await energyDistribution.addMember(member3.address, [3001], 2000); // 20%

      // Distribute energy
      const sources = [
        { sourceId: 1, price: 50, quantity: 500 }, // Cheap energy
        { sourceId: 2, price: 100, quantity: 300 }, // Medium price
        { sourceId: 3, price: 200, quantity: 200 }, // Expensive energy
      ];
      await energyDistribution.distributeEnergyTokens(sources);

      // Consume energy with mixed patterns
      const consumptionRequests = [
        { deviceId: 1001, quantity: 200 }, // member1
        { deviceId: 1002, quantity: 100 }, // member1 total: 300 (under-consumption)
        { deviceId: 2001, quantity: 400 }, // member2: 400 (over-consumption)
        { deviceId: 3001, quantity: 150 }, // member3: 150 (under-consumption)
      ];
      await energyDistribution.consumeEnergyTokens(consumptionRequests);

      // Verify final state
      const balance1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const balance2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const balance3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );

      expect(balance1).to.be.gt(0); // Under-consumer
      expect(balance2).to.be.lt(0); // Over-consumer
      expect(balance3).to.be.gt(0); // Under-consumer

      // Total balance should not be zero (due to price differences)
      const totalBalance =
        Number(balance1) + Number(balance2) + Number(balance3);
      console.log(`Total system balance: ${totalBalance}`);
    });
  });
});
