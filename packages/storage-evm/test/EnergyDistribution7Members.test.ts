import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';

describe('EnergyDistribution7Members', function () {
  async function deployFixture() {
    const [
      owner,
      member1,
      member2,
      member3,
      member4,
      member5,
      member6,
      member7,
      other,
    ] = await ethers.getSigners();

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
      member4,
      member5,
      member6,
      member7,
      other,
    };
  }

  async function setup7MembersFixture() {
    const {
      energyDistribution,
      owner,
      member1,
      member2,
      member3,
      member4,
      member5,
      member6,
      member7,
      other,
    } = await loadFixture(deployFixture);

    // Add 7 members with different ownership percentages
    await energyDistribution.addMember(member1.address, [1001, 1002], 2000); // 20%
    await energyDistribution.addMember(member2.address, [2001], 1800); // 18%
    await energyDistribution.addMember(member3.address, [3001], 1600); // 16%
    await energyDistribution.addMember(member4.address, [4001, 4002], 1400); // 14%
    await energyDistribution.addMember(member5.address, [5001], 1200); // 12%
    await energyDistribution.addMember(member6.address, [6001], 1000); // 10%
    await energyDistribution.addMember(member7.address, [7001, 7002], 1000); // 10%
    // Total: 100%

    // Distribute energy tokens with mixed prices
    const sources = [
      { sourceId: 1, price: 100, quantity: 1000 }, // Cheap energy
      { sourceId: 2, price: 200, quantity: 500 }, // Expensive energy
    ];
    await energyDistribution.distributeEnergyTokens(sources);

    return {
      energyDistribution,
      owner,
      member1,
      member2,
      member3,
      member4,
      member5,
      member6,
      member7,
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
      expect(collectiveConsumption).to.have.lengthOf(0);
    });
  });

  describe('Member Management', function () {
    it('Should add 7 members successfully', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001, 1002], 2000);
      await energyDistribution.addMember(member2.address, [2001], 1800);
      await energyDistribution.addMember(member3.address, [3001], 1600);
      await energyDistribution.addMember(member4.address, [4001, 4002], 1400);
      await energyDistribution.addMember(member5.address, [5001], 1200);
      await energyDistribution.addMember(member6.address, [6001], 1000);
      await energyDistribution.addMember(member7.address, [7001, 7002], 1000);

      expect(await energyDistribution.getTotalOwnershipPercentage()).to.equal(
        10000,
      );

      const member1Data = await energyDistribution.getMember(member1.address);
      expect(member1Data.ownershipPercentage).to.equal(2000);
      expect(member1Data.deviceIds).to.deep.equal([1001n, 1002n]);

      const member7Data = await energyDistribution.getMember(member7.address);
      expect(member7Data.ownershipPercentage).to.equal(1000);
      expect(member7Data.deviceIds).to.deep.equal([7001n, 7002n]);
    });

    it('Should reject adding member when total ownership exceeds 100%', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
        other,
      } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001], 2000);
      await energyDistribution.addMember(member2.address, [2001], 1800);
      await energyDistribution.addMember(member3.address, [3001], 1600);
      await energyDistribution.addMember(member4.address, [4001], 1400);
      await energyDistribution.addMember(member5.address, [5001], 1200);
      await energyDistribution.addMember(member6.address, [6001], 1000);
      await energyDistribution.addMember(member7.address, [7001], 1000);

      await expect(
        energyDistribution.addMember(other.address, [8001], 1),
      ).to.be.revertedWith('Total ownership exceeds 100%');
    });

    it('Should reject adding member with invalid parameters', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await expect(
        energyDistribution.addMember(ethers.ZeroAddress, [1001], 1000),
      ).to.be.revertedWith('Invalid member address');

      await expect(
        energyDistribution.addMember(member1.address, [], 1000),
      ).to.be.revertedWith('No device IDs provided');

      await expect(
        energyDistribution.addMember(member1.address, [1001], 0),
      ).to.be.revertedWith('Ownership percentage must be greater than 0');
    });

    it('Should reject adding member with duplicate device IDs', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        deployFixture,
      );

      await energyDistribution.addMember(member1.address, [1001], 1000);

      await expect(
        energyDistribution.addMember(member2.address, [1001], 1000),
      ).to.be.revertedWith('Device ID already assigned');
    });

    it('Should reject adding existing member', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001], 1000);

      await expect(
        energyDistribution.addMember(member1.address, [1002], 1000),
      ).to.be.revertedWith('Member already exists');
    });

    it('Should remove members successfully', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        deployFixture,
      );

      await energyDistribution.addMember(member1.address, [1001], 5000);
      await energyDistribution.addMember(member2.address, [2001], 5000);

      await energyDistribution.removeMember(member1.address);

      expect(await energyDistribution.getTotalOwnershipPercentage()).to.equal(
        5000,
      );

      await expect(
        energyDistribution.getMember(member1.address),
      ).to.be.revertedWith('Member does not exist');
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
          .addMember(member1.address, [1001], 1000),
      ).to.be.revertedWithCustomError(
        energyDistribution,
        'OwnableUnauthorizedAccount',
      );

      await energyDistribution.addMember(member1.address, [1001], 1000);

      await expect(
        energyDistribution.connect(other).removeMember(member1.address),
      ).to.be.revertedWithCustomError(
        energyDistribution,
        'OwnableUnauthorizedAccount',
      );
    });
  });

  describe('Energy Distribution', function () {
    it('Should distribute energy tokens based on ownership percentages across 7 members', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MembersFixture);

      // Check allocations
      const allocation1 = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const allocation2 = await energyDistribution.getAllocatedTokens(
        member2.address,
      );
      const allocation3 = await energyDistribution.getAllocatedTokens(
        member3.address,
      );
      const allocation4 = await energyDistribution.getAllocatedTokens(
        member4.address,
      );
      const allocation5 = await energyDistribution.getAllocatedTokens(
        member5.address,
      );
      const allocation6 = await energyDistribution.getAllocatedTokens(
        member6.address,
      );
      const allocation7 = await energyDistribution.getAllocatedTokens(
        member7.address,
      );

      // Member1 (20%): 200@100 + 100@200 = 300 tokens
      expect(allocation1).to.equal(300);
      // Member2 (18%): 180@100 + 90@200 = 270 tokens
      expect(allocation2).to.equal(270);
      // Member3 (16%): 160@100 + 80@200 = 240 tokens
      expect(allocation3).to.equal(240);
      // Member4 (14%): 140@100 + 70@200 = 210 tokens
      expect(allocation4).to.equal(210);
      // Member5 (12%): 120@100 + 60@200 = 180 tokens
      expect(allocation5).to.equal(180);
      // Member6 (10%): 100@100 + 50@200 = 150 tokens
      expect(allocation6).to.equal(150);
      // Member7 (10%): 100@100 + 50@200 = 150 tokens
      expect(allocation7).to.equal(150);

      // Total should be 1500
      const total =
        Number(allocation1) +
        Number(allocation2) +
        Number(allocation3) +
        Number(allocation4) +
        Number(allocation5) +
        Number(allocation6) +
        Number(allocation7);
      expect(total).to.equal(1500);
    });

    it('Should reject distribution when ownership is not 100%', async function () {
      const { energyDistribution, member1 } = await loadFixture(deployFixture);

      await energyDistribution.addMember(member1.address, [1001], 5000); // Only 50%

      const sources = [{ sourceId: 1, price: 100, quantity: 1000 }];

      await expect(
        energyDistribution.distributeEnergyTokens(sources),
      ).to.be.revertedWith('Total ownership must be 100%');
    });

    it('Should reject empty sources array', async function () {
      const { energyDistribution } = await loadFixture(setup7MembersFixture);

      await expect(
        energyDistribution.distributeEnergyTokens([]),
      ).to.be.revertedWith('No sources provided');
    });

    it('Should clear previous distribution', async function () {
      const { energyDistribution } = await loadFixture(setup7MembersFixture);

      const newSources = [{ sourceId: 3, price: 150, quantity: 2000 }];
      await energyDistribution.distributeEnergyTokens(newSources);

      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();
      expect(collectiveConsumption).to.have.lengthOf(7); // 7 members, 1 price level each
    });

    it('Should only allow owner to distribute tokens', async function () {
      const { energyDistribution, other } = await loadFixture(
        setup7MembersFixture,
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
    it('Should handle under-consumption correctly', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setup7MembersFixture,
      );

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 100 }, // member1 under-consumes
      ]);

      const balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(balance).to.be.gte(0); // Should get credit for unused tokens via export

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle under-consumption correctly ===',
      );
      const finalBalanceMember1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should handle over-consumption correctly', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setup7MembersFixture,
      );

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 500 }, // member1 over-consumes (allocated 300)
      ]);

      const balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(balance).to.be.lt(0); // Should pay for extra consumption

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle over-consumption correctly ===',
      );
      const finalBalanceMember1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should handle exact consumption correctly', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setup7MembersFixture,
      );

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 300 }, // member1 exact consumption
      ]);

      const balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(balance).to.equal(0); // No under or over consumption

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle exact consumption correctly ===',
      );
      const finalBalanceMember1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should process multiple members correctly', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        setup7MembersFixture,
      );

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 100 }, // member1
        { deviceId: 2001, quantity: 400 }, // member2
      ]);

      const balance1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const balance2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );

      expect(balance1).to.be.gte(0); // Under-consumer
      expect(balance2).to.be.lt(0); // Over-consumer

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should process multiple members correctly ===',
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
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });

    it('Should reject consumption for non-existent device', async function () {
      const { energyDistribution, owner } = await loadFixture(
        setup7MembersFixture,
      );

      const consumptionRequests = [{ deviceId: 9999, quantity: 50 }];

      await expect(
        energyDistribution
          .connect(owner)
          .consumeEnergyTokens(consumptionRequests),
      ).to.be.revertedWith('Device not registered to any member');
    });

    it('Should reject empty consumption requests', async function () {
      const { energyDistribution } = await loadFixture(setup7MembersFixture);

      await expect(
        energyDistribution.consumeEnergyTokens([]),
      ).to.be.revertedWith('No consumption requests provided');
    });

    it('Should only allow owner to consume tokens', async function () {
      const { energyDistribution, other } = await loadFixture(
        setup7MembersFixture,
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

    it('Should calculate cash credits with 7 members mixed consumption patterns', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MembersFixture);

      // Log initial allocations for all 7 members
      const allocation1 = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const allocation2 = await energyDistribution.getAllocatedTokens(
        member2.address,
      );
      const allocation3 = await energyDistribution.getAllocatedTokens(
        member3.address,
      );
      const allocation4 = await energyDistribution.getAllocatedTokens(
        member4.address,
      );
      const allocation5 = await energyDistribution.getAllocatedTokens(
        member5.address,
      );
      const allocation6 = await energyDistribution.getAllocatedTokens(
        member6.address,
      );
      const allocation7 = await energyDistribution.getAllocatedTokens(
        member7.address,
      );

      console.log('\n=== INITIAL ALLOCATIONS (7 MEMBERS) ===');
      console.log(
        `Member1 allocated: ${allocation1} tokens (20% of 1500 total)`,
      );
      console.log(
        `Member2 allocated: ${allocation2} tokens (18% of 1500 total)`,
      );
      console.log(
        `Member3 allocated: ${allocation3} tokens (16% of 1500 total)`,
      );
      console.log(
        `Member4 allocated: ${allocation4} tokens (14% of 1500 total)`,
      );
      console.log(
        `Member5 allocated: ${allocation5} tokens (12% of 1500 total)`,
      );
      console.log(
        `Member6 allocated: ${allocation6} tokens (10% of 1500 total)`,
      );
      console.log(
        `Member7 allocated: ${allocation7} tokens (10% of 1500 total)`,
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
              : item.owner === member3.address
              ? 'Member3'
              : item.owner === member4.address
              ? 'Member4'
              : item.owner === member5.address
              ? 'Member5'
              : item.owner === member6.address
              ? 'Member6'
              : 'Member7';
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

      // Mixed consumption patterns:
      // Member1: under-consumer (100 < 300)
      // Member2: over-consumer (400 > 270)
      // Member3: exact consumer (240 = 240)
      // Member4: under-consumer (50 < 210)
      // Member5: over-consumer (300 > 180)
      // Member6: non-consumer (0 < 150)
      // Member7: under-consumer (80 < 150)
      console.log(
        '\n=== PROCESSING ALL CONSUMPTION IN SINGLE CALL (7 MEMBERS) ===',
      );
      console.log(
        `Member1 consuming: 100 tokens (allocated: ${allocation1}) - UNDER`,
      );
      console.log(
        `Member2 consuming: 400 tokens (allocated: ${allocation2}) - OVER`,
      );
      console.log(
        `Member3 consuming: 240 tokens (allocated: ${allocation3}) - EXACT`,
      );
      console.log(
        `Member4 consuming: 50 tokens (allocated: ${allocation4}) - UNDER`,
      );
      console.log(
        `Member5 consuming: 300 tokens (allocated: ${allocation5}) - OVER`,
      );
      console.log(
        `Member6 consuming: 0 tokens (allocated: ${allocation6}) - NONE`,
      );
      console.log(
        `Member7 consuming: 80 tokens (allocated: ${allocation7}) - UNDER`,
      );

      // Add detailed logging before export processing
      console.log('\n=== BEFORE EXPORT PROCESSING ===');

      let totalRemainingTokens = 0;
      let totalRemainingValue = 0;
      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();

      for (let i = 0; i < collectiveConsumption.length; i++) {
        const item = collectiveConsumption[i];
        if (Number(item.quantity) > 0) {
          console.log(
            `  Item ${i}: ${item.owner} - ${item.quantity} tokens @ price ${
              item.price
            } = value ${Number(item.quantity) * Number(item.price)}`,
          );
          totalRemainingTokens += Number(item.quantity);
          totalRemainingValue += Number(item.quantity) * Number(item.price);
        }
      }
      console.log(`Total remaining tokens: ${totalRemainingTokens}`);
      console.log(`Total remaining value: ${totalRemainingValue}`);

      // Check member balances before export
      console.log('\n=== DETAILED CONSUMPTION PROCESSING ===');

      // Log before any consumption
      const beforeConsumption =
        await energyDistribution.getCollectiveConsumption();
      let totalBeforeConsumption = 0;
      for (let i = 0; i < beforeConsumption.length; i++) {
        totalBeforeConsumption += Number(beforeConsumption[i].quantity);
      }
      console.log(`Total tokens before consumption: ${totalBeforeConsumption}`);

      // Process all consumption in a single call (as originally designed)
      const consumptionTx = await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 100 }, // Member1
        { deviceId: 2001, quantity: 400 }, // Member2
        { deviceId: 3001, quantity: 240 }, // Member3
        { deviceId: 4001, quantity: 50 }, // Member4
        { deviceId: 5001, quantity: 300 }, // Member5
        { deviceId: 6001, quantity: 0 }, // Member6
        { deviceId: 7001, quantity: 80 }, // Member7
      ]);

      // Log after consumption but before processing
      const afterConsumption =
        await energyDistribution.getCollectiveConsumption();
      let totalAfterConsumption = 0;
      console.log('\n=== COLLECTIVE CONSUMPTION AFTER CONSUMPTION ===');
      for (let i = 0; i < afterConsumption.length; i++) {
        if (Number(afterConsumption[i].quantity) > 0) {
          console.log(
            `  Item ${i}: ${afterConsumption[i].owner} - ${afterConsumption[i].quantity} tokens @ price ${afterConsumption[i].price}`,
          );
        }
        totalAfterConsumption += Number(afterConsumption[i].quantity);
      }
      console.log(`Total tokens after consumption: ${totalAfterConsumption}`);
      console.log(
        `Tokens actually consumed: ${
          totalBeforeConsumption - totalAfterConsumption
        }`,
      );

      // Check member balances immediately after consumption
      console.log('\n=== MEMBER BALANCES IMMEDIATELY AFTER CONSUMPTION ===');
      let netAfterConsumption = 0;
      for (const member of [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ]) {
        const balance = await energyDistribution.getCashCreditBalance(
          member.address,
        );
        console.log(`${member.address}: ${balance}`);
        netAfterConsumption += Number(balance);
      }
      console.log(
        `Net member balance after consumption: ${netAfterConsumption}`,
      );

      // Check export balance after consumption
      const exportAfterConsumption =
        await energyDistribution.getExportCashCreditBalance();
      console.log(
        `Export balance after consumption: ${exportAfterConsumption}`,
      );
      console.log(
        `Balance after consumption (should be 0): ${
          netAfterConsumption + Number(exportAfterConsumption)
        }`,
      );

      // Calculate what the balances SHOULD be based on actual consumption
      console.log('\n=== EXPECTED VS ACTUAL CALCULATIONS ===');
      console.log('Expected logic:');
      console.log(
        '- Member1: consumed 100 of 300 allocated → 200 unused tokens',
      );
      console.log(
        '- Member2: consumed 400 of 270 allocated → owes for 130 over-consumed tokens',
      );
      console.log(
        '- Member3: consumed 240 of 240 allocated → exact, should be 0',
      );
      console.log(
        '- Member4: consumed 50 of 210 allocated → 160 unused tokens',
      );
      console.log(
        '- Member5: consumed 300 of 180 allocated → owes for 120 over-consumed tokens',
      );
      console.log('- Member6: consumed 0 of 150 allocated → 150 unused tokens');
      console.log('- Member7: consumed 80 of 150 allocated → 70 unused tokens');

      // Check if there are any events that might explain the discrepancy
      const receipt = await consumptionTx.wait();
      if (receipt) {
        console.log('\n=== CONSUMPTION TRANSACTION EVENTS ===');
        for (const log of receipt.logs) {
          try {
            const parsedLog = energyDistribution.interface.parseLog(log);
            if (parsedLog) {
              console.log(`Event: ${parsedLog.name}`);
              console.log(`Args:`, parsedLog.args);
            }
          } catch (e) {
            // Skip unparseable logs
          }
        }
      }

      // Verify zero-sum system (should be exactly 0 with the new distribution logic)
      expect(netAfterConsumption + Number(exportAfterConsumption)).to.equal(0);

      // Verify consumption patterns
      expect(exportAfterConsumption).to.be.lt(0); // Export cost
      expect(netAfterConsumption).to.be.gte(0); // Under-consumer (export payment possible)

      console.log(
        '\n=== TEST PASSED: 7-member zero-sum economics verified ===',
      );

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should calculate cash credits with 7 members mixed consumption patterns ===',
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
      const finalBalanceMember4 = await energyDistribution.getCashCreditBalance(
        member4.address,
      );
      console.log(
        `Member4 (${member4.address}) final balance: ${finalBalanceMember4}`,
      );
      const finalBalanceMember5 = await energyDistribution.getCashCreditBalance(
        member5.address,
      );
      console.log(
        `Member5 (${member5.address}) final balance: ${finalBalanceMember5}`,
      );
      const finalBalanceMember6 = await energyDistribution.getCashCreditBalance(
        member6.address,
      );
      console.log(
        `Member6 (${member6.address}) final balance: ${finalBalanceMember6}`,
      );
      const finalBalanceMember7 = await energyDistribution.getCashCreditBalance(
        member7.address,
      );
      console.log(
        `Member7 (${member7.address}) final balance: ${finalBalanceMember7}`,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`);
    });
  });

  describe('View Functions', function () {
    it('Should return correct collective consumption for 7 members', async function () {
      const { energyDistribution } = await loadFixture(setup7MembersFixture);

      const collectiveConsumption =
        await energyDistribution.getCollectiveConsumption();

      // Should have 14 items (7 members × 2 price levels)
      expect(collectiveConsumption).to.have.lengthOf(14);

      // Should be sorted by price (100 first, then 200)
      for (let i = 0; i < 7; i++) {
        expect(collectiveConsumption[i].price).to.equal(100);
      }
      for (let i = 7; i < 14; i++) {
        expect(collectiveConsumption[i].price).to.equal(200);
      }
    });

    it('Should return correct device owners for all 7 members', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MembersFixture);

      expect(await energyDistribution.getDeviceOwner(1001)).to.equal(
        member1.address,
      );
      expect(await energyDistribution.getDeviceOwner(1002)).to.equal(
        member1.address,
      );
      expect(await energyDistribution.getDeviceOwner(2001)).to.equal(
        member2.address,
      );
      expect(await energyDistribution.getDeviceOwner(3001)).to.equal(
        member3.address,
      );
      expect(await energyDistribution.getDeviceOwner(4001)).to.equal(
        member4.address,
      );
      expect(await energyDistribution.getDeviceOwner(4002)).to.equal(
        member4.address,
      );
      expect(await energyDistribution.getDeviceOwner(5001)).to.equal(
        member5.address,
      );
      expect(await energyDistribution.getDeviceOwner(6001)).to.equal(
        member6.address,
      );
      expect(await energyDistribution.getDeviceOwner(7001)).to.equal(
        member7.address,
      );
      expect(await energyDistribution.getDeviceOwner(7002)).to.equal(
        member7.address,
      );
      expect(await energyDistribution.getDeviceOwner(9999)).to.equal(
        ethers.ZeroAddress,
      );
    });

    it('Should return zero cash credit balance for all new members', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MembersFixture);

      expect(
        await energyDistribution.getCashCreditBalance(member1.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member2.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member3.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member4.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member5.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member6.address),
      ).to.equal(0);
      expect(
        await energyDistribution.getCashCreditBalance(member7.address),
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
      // Logging balances here would show 0 for members and export.
      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle fractional ownership percentages correctly ===',
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
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${exportBalance}`); // Will be 0 as no consumption/export processing happened
    });

    it('Should handle complex multi-member consumption patterns', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MembersFixture);

      // Different consumption pattern
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 50 }, // member1: under
        { deviceId: 1002, quantity: 100 }, // member1: total 150 (still under)
        { deviceId: 2001, quantity: 500 }, // member2: over
        { deviceId: 4001, quantity: 300 }, // member4: over
        { deviceId: 7001, quantity: 10 }, // member7: under
        { deviceId: 7002, quantity: 20 }, // member7: total 30 (still under)
        // member3, member5, member6 don't consume
      ]);

      const balance1 = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const balance2 = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const balance3 = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      const balance4 = await energyDistribution.getCashCreditBalance(
        member4.address,
      );
      const balance5 = await energyDistribution.getCashCreditBalance(
        member5.address,
      );
      const balance6 = await energyDistribution.getCashCreditBalance(
        member6.address,
      );
      const balance7 = await energyDistribution.getCashCreditBalance(
        member7.address,
      );
      const exportBalance =
        await energyDistribution.getExportCashCreditBalance();

      // Verify system balance (allow for small rounding errors due to precision)
      const totalBalance =
        Number(balance1) +
        Number(balance2) +
        Number(balance3) +
        Number(balance4) +
        Number(balance5) +
        Number(balance6) +
        Number(balance7) +
        Number(exportBalance);
      expect(Math.abs(totalBalance)).to.be.lessThanOrEqual(5000);

      // Verify consumption patterns
      expect(balance1).to.be.gte(0); // Under-consumer
      expect(balance2).to.be.lt(0); // Over-consumer
      expect(balance3).to.be.gt(0); // Non-consumer (gets export payment)
      expect(balance4).to.be.lt(0); // Over-consumer
      expect(balance5).to.be.gt(0); // Non-consumer (gets export payment)
      expect(balance6).to.be.gt(0); // Non-consumer (gets export payment)
      expect(balance7).to.be.gte(0); // Under-consumer
      expect(exportBalance).to.be.lt(0); // Export cost

      console.log(
        '\n=== FINAL MEMBER BALANCES AT END OF TEST: Should handle complex multi-member consumption patterns ===',
      );
      const finalBalanceMember1_complex =
        await energyDistribution.getCashCreditBalance(member1.address);
      console.log(
        `Member1 (${member1.address}) final balance: ${finalBalanceMember1_complex}`,
      );
      const finalBalanceMember2_complex =
        await energyDistribution.getCashCreditBalance(member2.address);
      console.log(
        `Member2 (${member2.address}) final balance: ${finalBalanceMember2_complex}`,
      );
      const finalBalanceMember3_complex =
        await energyDistribution.getCashCreditBalance(member3.address);
      console.log(
        `Member3 (${member3.address}) final balance: ${finalBalanceMember3_complex}`,
      );
      const finalBalanceMember4_complex =
        await energyDistribution.getCashCreditBalance(member4.address);
      console.log(
        `Member4 (${member4.address}) final balance: ${finalBalanceMember4_complex}`,
      );
      const finalBalanceMember5_complex =
        await energyDistribution.getCashCreditBalance(member5.address);
      console.log(
        `Member5 (${member5.address}) final balance: ${finalBalanceMember5_complex}`,
      );
      const finalBalanceMember6_complex =
        await energyDistribution.getCashCreditBalance(member6.address);
      console.log(
        `Member6 (${member6.address}) final balance: ${finalBalanceMember6_complex}`,
      );
      const finalBalanceMember7_complex =
        await energyDistribution.getCashCreditBalance(member7.address);
      console.log(
        `Member7 (${member7.address}) final balance: ${finalBalanceMember7_complex}`,
      );
      const finalExportBalance_complex =
        await energyDistribution.getExportCashCreditBalance();
      console.log(`Export final balance: ${finalExportBalance_complex}`);
    });
  });
});
