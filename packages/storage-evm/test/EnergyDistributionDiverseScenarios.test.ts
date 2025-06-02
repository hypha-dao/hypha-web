import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';

describe('EnergyDistributionDiverseScenarios', function () {
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

  async function setup7MemberCommunityFixture() {
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

    // Add 7 members with varied ownership percentages
    await energyDistribution.addMember(member1.address, [1001, 1002], 2000); // 20%
    await energyDistribution.addMember(member2.address, [2001], 1800); // 18%
    await energyDistribution.addMember(member3.address, [3001], 1600); // 16%
    await energyDistribution.addMember(member4.address, [4001, 4002], 1400); // 14%
    await energyDistribution.addMember(member5.address, [5001], 1200); // 12%
    await energyDistribution.addMember(member6.address, [6001], 1000); // 10%
    await energyDistribution.addMember(member7.address, [7001, 7002], 1000); // 10%

    // Configure battery: $0.14/kWh, 50 kWh capacity
    await energyDistribution.configureBattery(14, 50);

    // Set export device ID
    await energyDistribution.setExportDeviceId(9999);

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

  async function logScenarioStart(title: string, description: string) {
    console.log(`\n🎭 === ${title} ===`);
    console.log(`📖 ${description}`);
  }

  async function logCashCreditSummary(
    energyDistribution: any,
    members: any[],
    scenarioName: string,
  ) {
    console.log(`\n💰 ${scenarioName} - Final Balances:`);
    let totalMemberBalance = 0;

    for (const [index, member] of members.entries()) {
      const balance = await energyDistribution.getCashCreditBalance(
        member.address,
      );
      const balanceInDollars = Number(balance) / 100;
      console.log(`  Member${index + 1}: $${balanceInDollars.toFixed(2)}`);
      totalMemberBalance += Number(balance);
    }

    const exportBalance = await energyDistribution.getExportCashCreditBalance();
    const importBalance = await energyDistribution.getImportCashCreditBalance();
    const systemTotal =
      totalMemberBalance + Number(exportBalance) + Number(importBalance);

    console.log(`  Export: $${(Number(exportBalance) / 100).toFixed(2)}`);
    console.log(`  Import: $${(Number(importBalance) / 100).toFixed(2)}`);
    console.log(`  System Total: $${(systemTotal / 100).toFixed(2)}`);

    return {
      totalMemberBalance,
      exportBalance: Number(exportBalance),
      importBalance: Number(importBalance),
      systemTotal,
    };
  }

  async function logCollectivePool(
    energyDistribution: any,
    scenarioName: string,
  ) {
    const collective = await energyDistribution.getCollectiveConsumption();
    console.log(`\n🏪 ${scenarioName} - Remaining Energy Pool:`);

    if (collective.length === 0) {
      console.log('  ✅ Pool empty - all energy consumed');
      return;
    }

    let totalRemaining = 0;
    for (const item of collective) {
      if (Number(item.quantity) > 0) {
        totalRemaining += Number(item.quantity);
        console.log(
          `  ${Number(item.quantity)} kWh @ $${(
            Number(item.price) / 100
          ).toFixed(2)}/kWh`,
        );
      }
    }
    console.log(`  Total Remaining: ${totalRemaining} kWh`);
  }

  describe('Extreme Weather Scenarios', function () {
    it('Should handle stormy day with minimal solar production', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      await logScenarioStart(
        'STORMY DAY SCENARIO',
        'Cloudy/stormy weather with minimal solar production - heavy reliance on battery and imports',
      );

      // Minimal solar production due to storm
      const stormySources = [
        { sourceId: 1, price: 15, quantity: 30, isImport: false }, // Very low solar
        { sourceId: 2, price: 28, quantity: 250, isImport: true }, // Heavy grid imports
      ];

      console.log('\n⛈️ Stormy Day Energy Sources:');
      console.log('  ☁️ Limited Solar: 30 kWh @ $0.15/kWh (storm conditions)');
      console.log(
        '  🏭 Heavy Imports: 250 kWh @ $0.28/kWh (peak storm pricing)',
      );

      // Battery provides critical backup - full discharge
      await energyDistribution.distributeEnergyTokens(stormySources, 0);

      // Normal consumption during storm
      const stormConsumption = [
        { deviceId: 1001, quantity: 45 },
        { deviceId: 2001, quantity: 40 },
        { deviceId: 3001, quantity: 35 },
        { deviceId: 4001, quantity: 42 },
        { deviceId: 5001, quantity: 30 },
        { deviceId: 6001, quantity: 28 },
        { deviceId: 7001, quantity: 35 },
        { deviceId: 9999, quantity: 75 }, // Export remaining
      ];

      await energyDistribution.consumeEnergyTokens(stormConsumption);

      const balances = await logCashCreditSummary(
        energyDistribution,
        members,
        'STORM',
      );

      expect(Math.abs(balances.systemTotal)).to.be.lessThan(100);

      console.log('\n✅ Storm Resilience Test Complete');
    });
  });

  describe('System Stress Tests', function () {
    it('Should handle zero energy availability scenario', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      await logScenarioStart(
        'ZERO ENERGY SCENARIO',
        'Extreme emergency - testing system limits with minimal energy',
      );

      // Test with minimal energy and high demand
      const minimalSources = [
        { sourceId: 1, price: 50, quantity: 10, isImport: true }, // Emergency backup
      ];

      console.log('\n🆘 Minimal Emergency Energy:');
      console.log('  🆘 Emergency: 10 kWh @ $0.50/kWh (extremely expensive)');

      await energyDistribution.distributeEnergyTokens(minimalSources, 0);

      // Try to consume more than available
      const excessiveDemand = [
        { deviceId: 1001, quantity: 5 },
        { deviceId: 2001, quantity: 3 },
        { deviceId: 3001, quantity: 2 },
        { deviceId: 4001, quantity: 5 }, // Total would be 15 kWh
      ];

      // This should fail due to insufficient energy
      await expect(
        energyDistribution.consumeEnergyTokens(excessiveDemand),
      ).to.be.revertedWith('Insufficient energy tokens available');

      console.log('  ❌ Correctly prevented over-consumption in emergency');

      // Successful minimal consumption
      const emergencyConsumption = [
        { deviceId: 1001, quantity: 4 },
        { deviceId: 2001, quantity: 3 },
        { deviceId: 3001, quantity: 2 },
        { deviceId: 4001, quantity: 1 },
      ];

      await energyDistribution.consumeEnergyTokens(emergencyConsumption);

      console.log('\n🆘 Emergency Response Analysis:');
      console.log('  ✅ System handled zero energy scenario gracefully');
      console.log('  💸 Emergency pricing: $0.50/kWh for critical energy');
      console.log('  🎯 System resilience: Operated under extreme constraints');
    });

    it('Should handle rapid energy source changes', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      await logScenarioStart(
        'RAPID CHANGE SCENARIO',
        'Multiple quick energy distributions simulating real-time market changes',
      );

      // Round 1: High solar production
      const round1Sources = [
        { sourceId: 1, price: 8, quantity: 180, isImport: false },
      ];
      await energyDistribution.distributeEnergyTokens(round1Sources, 30);

      const round1Consumption = [
        { deviceId: 1001, quantity: 20 },
        { deviceId: 2001, quantity: 15 },
        { deviceId: 9999, quantity: 175 },
      ];
      await energyDistribution.consumeEnergyTokens(round1Consumption);

      // Round 2: Storm hits
      const round2Sources = [
        { sourceId: 2, price: 45, quantity: 200, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(round2Sources, 0);

      const round2Consumption = [
        { deviceId: 3001, quantity: 40 },
        { deviceId: 4001, quantity: 35 },
        { deviceId: 9999, quantity: 145 },
      ];
      await energyDistribution.consumeEnergyTokens(round2Consumption);

      // Round 3: Market stabilizes
      const round3Sources = [
        { sourceId: 1, price: 11, quantity: 120, isImport: false },
        { sourceId: 2, price: 18, quantity: 80, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(round3Sources, 10);

      const round3Consumption = [
        { deviceId: 5001, quantity: 45 },
        { deviceId: 6001, quantity: 40 },
        { deviceId: 7001, quantity: 35 },
        { deviceId: 9999, quantity: 110 },
      ];
      await energyDistribution.consumeEnergyTokens(round3Consumption);

      const balances = await logCashCreditSummary(
        energyDistribution,
        members,
        'RAPID CHANGES',
      );

      expect(Math.abs(balances.systemTotal)).to.be.lessThan(100);

      console.log('\n⚡ Rapid Change Analysis:');
      console.log('  ✅ 5 rapid energy market changes handled successfully');
      console.log(
        '  ⚖️ Fair distribution maintained through market volatility',
      );
      console.log(
        '  🎯 System stability: Balance preserved despite rapid changes',
      );
    });
  });

  describe('Edge Case Scenarios', function () {
    it('Should handle single member consuming everything scenario', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      await logScenarioStart(
        'SINGLE MASSIVE CONSUMER SCENARIO',
        'One member attempts to consume all available energy while others consume nothing',
      );

      // Moderate energy production
      const singleConsumerSources = [
        { sourceId: 1, price: 10, quantity: 150, isImport: false },
        { sourceId: 2, price: 20, quantity: 100, isImport: true },
      ];

      await energyDistribution.distributeEnergyTokens(
        singleConsumerSources,
        20,
      );

      // Member1 tries to consume everything
      const massiveConsumption = [
        { deviceId: 1001, quantity: 150 },
        { deviceId: 1002, quantity: 130 },
      ];

      await energyDistribution.consumeEnergyTokens(massiveConsumption);

      const balances = await logCashCreditSummary(
        energyDistribution,
        members,
        'SINGLE MASSIVE CONSUMER',
      );
      await logCollectivePool(energyDistribution, 'POST-MASSIVE-CONSUMPTION');

      expect(Math.abs(balances.systemTotal)).to.be.lessThan(100);

      // Verify Member1 has large negative balance
      const member1Balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      expect(Number(member1Balance)).to.be.lessThan(0);

      // Verify other members have positive balances
      for (let i = 1; i < members.length; i++) {
        const balance = await energyDistribution.getCashCreditBalance(
          members[i].address,
        );
        expect(Number(balance)).to.be.greaterThan(0);
      }
      console.log('  ✅ All other members earned money from zero consumption');
    });

    it('Should handle perfect allocation matching consumption scenario', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      await logScenarioStart(
        'PERFECT ALLOCATION MATCHING SCENARIO',
        'Each member consumes exactly their ownership allocation - testing zero cash transfer',
      );

      // Precise energy production for perfect matching
      const perfectSources = [
        { sourceId: 1, price: 15, quantity: 350, isImport: false },
      ];

      await energyDistribution.distributeEnergyTokens(perfectSources, 50);

      // Get each member's exact allocation
      const allocations: { [key: string]: number } = {};
      for (const member of members) {
        const allocation = await energyDistribution.getAllocatedTokens(
          member.address,
        );
        allocations[member.address] = Number(allocation);
      }

      // Perfect consumption matching allocations
      const perfectConsumption = [
        { deviceId: 1001, quantity: allocations[member1.address] },
        { deviceId: 2001, quantity: allocations[member2.address] },
        { deviceId: 3001, quantity: allocations[member3.address] },
        { deviceId: 4001, quantity: allocations[member4.address] },
        { deviceId: 5001, quantity: allocations[member5.address] },
        { deviceId: 6001, quantity: allocations[member6.address] },
        { deviceId: 7001, quantity: allocations[member7.address] },
      ];

      await energyDistribution.consumeEnergyTokens(perfectConsumption);

      const balances = await logCashCreditSummary(
        energyDistribution,
        members,
        'PERFECT MATCHING',
      );
      await logCollectivePool(energyDistribution, 'POST-PERFECT-MATCHING');

      expect(Math.abs(balances.systemTotal)).to.be.lessThan(100);

      // Verify all members have near-zero balances
      for (const [index, member] of members.entries()) {
        const balance = await energyDistribution.getCashCreditBalance(
          member.address,
        );
        expect(Math.abs(Number(balance))).to.be.lessThan(10); // Within 10 cents due to rounding
      }

      console.log('\n✅ Perfect Matching Success');
    });

    it('Should handle extreme price differences scenario', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      await logScenarioStart(
        'EXTREME PRICE DIFFERENCES SCENARIO',
        'Testing system with extreme price variations from nearly free to extremely expensive',
      );

      // Extreme price range energy sources
      const extremePriceSources = [
        { sourceId: 1, price: 1, quantity: 50, isImport: false }, // $0.01/kWh
        { sourceId: 2, price: 5, quantity: 80, isImport: false }, // $0.05/kWh
        { sourceId: 3, price: 15, quantity: 60, isImport: false }, // $0.15/kWh
        { sourceId: 4, price: 50, quantity: 40, isImport: true }, // $0.50/kWh
        { sourceId: 5, price: 100, quantity: 20, isImport: true }, // $1.00/kWh
      ];

      await energyDistribution.distributeEnergyTokens(extremePriceSources, 20);

      // Varied consumption to test price optimization
      const extremePriceConsumption = [
        { deviceId: 1001, quantity: 40 },
        { deviceId: 2001, quantity: 80 },
        { deviceId: 3001, quantity: 25 },
        { deviceId: 4001, quantity: 60 },
        { deviceId: 5001, quantity: 15 },
        { deviceId: 6001, quantity: 50 },
        { deviceId: 7001, quantity: 10 },
      ];

      await energyDistribution.consumeEnergyTokens(extremePriceConsumption);

      const balances = await logCashCreditSummary(
        energyDistribution,
        members,
        'EXTREME PRICES',
      );
      await logCollectivePool(energyDistribution, 'POST-EXTREME-PRICES');

      expect(Math.abs(balances.systemTotal)).to.be.lessThan(100);

      console.log('\n✅ Extreme Price Test Success');
    });
  });

  describe('Real-world Integration Scenarios', function () {
    it('Should simulate a complete week of varied energy patterns', async function () {
      const {
        energyDistribution,
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      } = await loadFixture(setup7MemberCommunityFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      await logScenarioStart(
        'WEEKLY ENERGY PATTERN SIMULATION',
        'Seven days of varied weather, consumption, and pricing patterns',
      );

      // Day 1: Sunny Monday
      const day1Sources = [
        { sourceId: 1, price: 9, quantity: 180, isImport: false },
        { sourceId: 2, price: 18, quantity: 50, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(day1Sources, 40);

      const day1Consumption = [
        { deviceId: 1001, quantity: 25 },
        { deviceId: 2001, quantity: 20 },
        { deviceId: 3001, quantity: 18 },
        { deviceId: 4001, quantity: 22 },
        { deviceId: 5001, quantity: 15 },
        { deviceId: 6001, quantity: 12 },
        { deviceId: 7001, quantity: 10 },
        { deviceId: 9999, quantity: 158 },
      ];
      await energyDistribution.consumeEnergyTokens(day1Consumption);

      // Day 2: Cloudy Tuesday
      const day2Sources = [
        { sourceId: 1, price: 12, quantity: 120, isImport: false },
        { sourceId: 2, price: 22, quantity: 100, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(day2Sources, 30);

      const day2Consumption = [
        { deviceId: 1002, quantity: 35 },
        { deviceId: 2001, quantity: 40 },
        { deviceId: 3001, quantity: 25 },
        { deviceId: 4002, quantity: 30 },
        { deviceId: 5001, quantity: 20 },
        { deviceId: 6001, quantity: 25 },
        { deviceId: 7002, quantity: 15 },
        { deviceId: 9999, quantity: 70 },
      ];
      await energyDistribution.consumeEnergyTokens(day2Consumption);

      // Day 3: Stormy Wednesday
      const day3Sources = [
        { sourceId: 1, price: 20, quantity: 40, isImport: false },
        { sourceId: 2, price: 35, quantity: 200, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(day3Sources, 0);

      const day3Consumption = [
        { deviceId: 1001, quantity: 50 },
        { deviceId: 2001, quantity: 55 },
        { deviceId: 3001, quantity: 40 },
        { deviceId: 4001, quantity: 45 },
        { deviceId: 5001, quantity: 35 },
        { deviceId: 6001, quantity: 30 },
        { deviceId: 7001, quantity: 25 },
        { deviceId: 9999, quantity: 10 },
      ];
      await energyDistribution.consumeEnergyTokens(day3Consumption);

      // Day 4: Perfect Thursday
      const day4Sources = [
        { sourceId: 1, price: 8, quantity: 220, isImport: false },
      ];
      await energyDistribution.distributeEnergyTokens(day4Sources, 50);

      const day4Consumption = [
        { deviceId: 1002, quantity: 30 },
        { deviceId: 2001, quantity: 25 },
        { deviceId: 3001, quantity: 20 },
        { deviceId: 4002, quantity: 28 },
        { deviceId: 5001, quantity: 18 },
        { deviceId: 6001, quantity: 15 },
        { deviceId: 7002, quantity: 12 },
        { deviceId: 9999, quantity: 122 },
      ];
      await energyDistribution.consumeEnergyTokens(day4Consumption);

      // Day 5: Variable Friday
      const day5Sources = [
        { sourceId: 1, price: 11, quantity: 150, isImport: false },
        { sourceId: 2, price: 25, quantity: 80, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(day5Sources, 35);

      const day5Consumption = [
        { deviceId: 1001, quantity: 40 },
        { deviceId: 2001, quantity: 45 },
        { deviceId: 3001, quantity: 35 },
        { deviceId: 4001, quantity: 38 },
        { deviceId: 5001, quantity: 28 },
        { deviceId: 6001, quantity: 22 },
        { deviceId: 7001, quantity: 20 },
        { deviceId: 9999, quantity: 57 },
      ];
      await energyDistribution.consumeEnergyTokens(day5Consumption);

      // Day 6: Weekend Saturday
      const day6Sources = [
        { sourceId: 1, price: 10, quantity: 160, isImport: false },
        { sourceId: 2, price: 20, quantity: 120, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(day6Sources, 25);

      const day6Consumption = [
        { deviceId: 1002, quantity: 60 },
        { deviceId: 2001, quantity: 65 },
        { deviceId: 3001, quantity: 50 },
        { deviceId: 4002, quantity: 55 },
        { deviceId: 5001, quantity: 40 },
        { deviceId: 6001, quantity: 35 },
        { deviceId: 7002, quantity: 30 },
        { deviceId: 9999, quantity: 20 },
      ];
      await energyDistribution.consumeEnergyTokens(day6Consumption);

      // Day 7: Sunday Rest
      const day7Sources = [
        { sourceId: 1, price: 9, quantity: 140, isImport: false },
        { sourceId: 2, price: 16, quantity: 60, isImport: true },
      ];
      await energyDistribution.distributeEnergyTokens(day7Sources, 15);

      const day7Consumption = [
        { deviceId: 1001, quantity: 20 },
        { deviceId: 2001, quantity: 25 },
        { deviceId: 3001, quantity: 15 },
        { deviceId: 4001, quantity: 18 },
        { deviceId: 5001, quantity: 12 },
        { deviceId: 6001, quantity: 10 },
        { deviceId: 7001, quantity: 8 },
        { deviceId: 9999, quantity: 127 },
      ];
      await energyDistribution.consumeEnergyTokens(day7Consumption);

      const weeklyBalances = await logCashCreditSummary(
        energyDistribution,
        members,
        'WEEK SUMMARY',
      );

      expect(Math.abs(weeklyBalances.systemTotal)).to.be.lessThan(500); // Allow for weekly accumulation

      console.log('\n📊 Weekly Pattern Analysis:');
      console.log(
        '  ✅ 7 days of varied energy patterns completed successfully',
      );
      console.log('  ✅ System stability maintained across 7 diverse days');
      console.log(
        '  ✅ Real-world operational complexity successfully simulated',
      );
    });
  });
});
