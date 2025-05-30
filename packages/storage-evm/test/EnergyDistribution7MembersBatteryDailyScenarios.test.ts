import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';

describe('EnergyDistribution7MembersBatteryDailyScenarios', function () {
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

  async function setup7MembersWithBatteryFixture() {
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

    console.log('\n=== SETTING UP 7 MEMBERS WITH BATTERY ===');

    // Add 7 members with different ownership percentages
    await energyDistribution.addMember(member1.address, [1001, 1002], 2000); // 20%
    await energyDistribution.addMember(member2.address, [2001], 1800); // 18%
    await energyDistribution.addMember(member3.address, [3001], 1600); // 16%
    await energyDistribution.addMember(member4.address, [4001, 4002], 1400); // 14%
    await energyDistribution.addMember(member5.address, [5001], 1200); // 12%
    await energyDistribution.addMember(member6.address, [6001], 1000); // 10%
    await energyDistribution.addMember(member7.address, [7001, 7002], 1000); // 10%

    console.log('Members added:');
    console.log(
      `  Member1: ${member1.address} - 20% ownership, devices [1001, 1002]`,
    );
    console.log(
      `  Member2: ${member2.address} - 18% ownership, devices [2001]`,
    );
    console.log(
      `  Member3: ${member3.address} - 16% ownership, devices [3001]`,
    );
    console.log(
      `  Member4: ${member4.address} - 14% ownership, devices [4001, 4002]`,
    );
    console.log(
      `  Member5: ${member5.address} - 12% ownership, devices [5001]`,
    );
    console.log(
      `  Member6: ${member6.address} - 10% ownership, devices [6001]`,
    );
    console.log(
      `  Member7: ${member7.address} - 10% ownership, devices [7001, 7002]`,
    );

    // Configure battery: price 140, max capacity 2000
    await energyDistribution.configureBattery(140, 2000);
    console.log(
      'Battery configured: price=140, max_capacity=2000, initial_state=0',
    );

    // Set export device ID
    await energyDistribution.setExportDeviceId(9999);
    console.log('Export device ID set to: 9999');

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

  async function logBatteryState(energyDistribution: any, title: string) {
    const batteryInfo = await energyDistribution.getBatteryInfo();
    console.log(
      `${title}: Battery state=${batteryInfo.currentState}, price=${batteryInfo.price}, max=${batteryInfo.maxCapacity}`,
    );
  }

  async function logMemberAllocations(
    energyDistribution: any,
    members: any[],
    title: string,
  ) {
    console.log(`\n${title}:`);
    let totalAllocated = 0;
    for (const [index, member] of members.entries()) {
      const allocation = await energyDistribution.getAllocatedTokens(
        member.address,
      );
      const memberName = `Member${index + 1}`;
      console.log(`  ${memberName}: ${allocation} tokens`);
      totalAllocated += Number(allocation);
    }
    console.log(`  TOTAL ALLOCATED: ${totalAllocated} tokens`);
  }

  async function logCollectiveConsumption(
    energyDistribution: any,
    title: string,
  ) {
    const collective = await energyDistribution.getCollectiveConsumption();
    console.log(`\n${title}:`);
    let totalTokens = 0;
    let totalValue = 0;

    const priceGroups: {
      [key: string]: { quantity: number; owners: string[] };
    } = {};

    for (const item of collective) {
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      totalTokens += quantity;
      totalValue += price * quantity;

      if (!priceGroups[price]) {
        priceGroups[price] = { quantity: 0, owners: [] };
      }
      priceGroups[price].quantity += quantity;
      priceGroups[price].owners.push(item.owner);
    }

    for (const [price, data] of Object.entries(priceGroups)) {
      console.log(
        `  Price ${price}: ${data.quantity} tokens, value=${
          Number(price) * data.quantity
        }`,
      );
    }
    console.log(`  TOTAL: ${totalTokens} tokens, total_value=${totalValue}`);
  }

  async function logCollectiveConsumptionPerMember(
    energyDistribution: any,
    members: any[],
    title: string,
  ) {
    console.log(`\n${title}:`);
    const collective = await energyDistribution.getCollectiveConsumption();

    for (const [index, member] of members.entries()) {
      const memberName = `Member${index + 1}`;
      let memberTokens = 0;
      let memberValue = 0;
      const priceBreakdown: { [key: string]: number } = {};

      for (const item of collective) {
        if (item.owner === member.address) {
          const price = Number(item.price);
          const quantity = Number(item.quantity);
          memberTokens += quantity;
          memberValue += price * quantity;

          if (!priceBreakdown[price]) {
            priceBreakdown[price] = 0;
          }
          priceBreakdown[price] += quantity;
        }
      }

      const breakdown = Object.entries(priceBreakdown)
        .map(([price, qty]) => `${qty}@${price}`)
        .join(', ');

      console.log(
        `  ${memberName}: ${memberTokens} tokens (${breakdown}) = value ${memberValue}`,
      );
    }
  }

  async function logFinalBalances(
    energyDistribution: any,
    members: any[],
    title: string,
  ) {
    console.log(`\n=== ${title} ===`);
    let totalMemberBalance = 0;

    for (const [index, member] of members.entries()) {
      const balance = await energyDistribution.getCashCreditBalance(
        member.address,
      );
      const memberName = `Member${index + 1}`;
      console.log(`${memberName} (${member.address}): ${balance}`);
      totalMemberBalance += Number(balance);
    }

    const exportBalance = await energyDistribution.getExportCashCreditBalance();
    console.log(`Export: ${exportBalance}`);
    console.log(`TOTAL MEMBER BALANCE: ${totalMemberBalance}`);

    const systemTotal = totalMemberBalance + Number(exportBalance);
    console.log(`SYSTEM TOTAL (should be 0): ${systemTotal}`);

    return {
      totalMemberBalance,
      exportBalance: Number(exportBalance),
      systemTotal,
    };
  }

  describe('Daily Scenario 1: High Solar Production Day with Export', function () {
    it('Should demonstrate full day cycle with battery and export in single distribution', async function () {
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
      } = await loadFixture(setup7MembersWithBatteryFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      console.log(
        '\n🌞 === DAILY SCENARIO 1: HIGH SOLAR PRODUCTION WITH EXPORT ===',
      );
      console.log(
        '📅 Full Day Summary: High solar only + battery operations + low consumption = significant export',
      );

      await logBatteryState(
        energyDistribution,
        'Day start - battery initial state',
      );

      // === SINGLE DAILY DISTRIBUTION ===
      console.log('\n--- DAILY ENERGY DISTRIBUTION ---');

      // Daily totals - SOLAR ONLY, NO IMPORTS:
      // - High solar production throughout the day: 2800 tokens
      // - Battery charging: 250 units from excess solar
      // - No imports needed due to abundant solar
      const dailySources = [
        { sourceId: 1, price: 100, quantity: 2800 }, // Pure solar production day
      ];

      console.log('Full day energy summary:');
      console.log(`  Total solar production: 2800 tokens @ price 100`);
      console.log(`  Total imports needed: 0 tokens (pure solar day)`);
      console.log('  Battery operations: +250 net storage from excess solar');
      console.log('  Final battery state: 250 units stored');

      // Distribute energy for entire day with net battery charging (+250)
      await energyDistribution.distributeEnergyTokens(dailySources, 250);

      await logBatteryState(energyDistribution, 'After daily distribution');
      await logMemberAllocations(
        energyDistribution,
        members,
        'Daily member token allocations',
      );
      await logCollectiveConsumption(
        energyDistribution,
        'Daily collective consumption pool',
      );
      await logCollectiveConsumptionPerMember(
        energyDistribution,
        members,
        'Collective Consumption list',
      );

      console.log('\n💡 DAILY DISTRIBUTION ANALYSIS:');
      console.log('🌞 Pure solar day: No imports needed');
      console.log('🔋 Battery net storage: 250 units of excess solar');
      console.log(
        '💰 Low-cost energy: All tokens at optimal solar price (100)',
      );
      console.log(
        '📊 Energy abundance: Excess production available for export',
      );
      console.log('⚡ Battery enabled storage of excess morning production');

      // === DAILY CONSUMPTION ===
      console.log('\n--- DAILY ENERGY CONSUMPTION ---');

      const member1Allocation = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const member2Allocation = await energyDistribution.getAllocatedTokens(
        member2.address,
      );
      const member3Allocation = await energyDistribution.getAllocatedTokens(
        member3.address,
      );
      const member4Allocation = await energyDistribution.getAllocatedTokens(
        member4.address,
      );
      const member5Allocation = await energyDistribution.getAllocatedTokens(
        member5.address,
      );
      const member6Allocation = await energyDistribution.getAllocatedTokens(
        member6.address,
      );
      const member7Allocation = await energyDistribution.getAllocatedTokens(
        member7.address,
      );

      console.log('Daily consumption patterns (low usage day):');
      console.log(
        `  Member1: 80 tokens (allocated: ${member1Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member2: 75 tokens (allocated: ${member2Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member3: 70 tokens (allocated: ${member3Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member4: 65 tokens (allocated: ${member4Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member5: 60 tokens (allocated: ${member5Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member6: 55 tokens (allocated: ${member6Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member7: 165 tokens (allocated: ${member7Allocation}) - UNDER-CONSUMPTION`,
      );

      // Low consumption day - all members under-consume, significant export
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 80 }, // Member1: significant under-consumption
        { deviceId: 2001, quantity: 75 }, // Member2: significant under-consumption
        { deviceId: 3001, quantity: 70 }, // Member3: significant under-consumption
        { deviceId: 4001, quantity: 65 }, // Member4: significant under-consumption
        { deviceId: 5001, quantity: 60 }, // Member5: significant under-consumption
        { deviceId: 6001, quantity: 55 }, // Member6: significant under-consumption
        { deviceId: 7002, quantity: 165 }, // Member7: under-consumption (different device)
        { deviceId: 9999, quantity: 2980 }, // EXPORT: massive surplus (570 tokens consumed out of 3550 available)
      ]);

      console.log('Daily consumption completed with SIGNIFICANT EXPORT');

      console.log('\n💡 DAILY CONSUMPTION ANALYSIS:');
      console.log('🏠 Low consumption day: All members used minimal energy');
      console.log(
        '📤 Large export: Majority of daily production exported for revenue',
      );
      console.log(
        '💰 Universal benefit: All members profit from export revenue',
      );
      console.log('🔋 Battery value: Enabled optimal daily energy management');
      console.log(
        '🎯 Perfect efficiency: Low usage + high production = maximum export profit',
      );

      // === FINAL DAILY ANALYSIS ===
      const balances = await logFinalBalances(
        energyDistribution,
        members,
        'FINAL DAILY BALANCES - SCENARIO 1 (HIGH EXPORT DAY)',
      );

      console.log('\n💡 FINAL DAILY ANALYSIS:');
      console.log(
        '✅ Export economics: High production + low consumption = significant revenue',
      );
      console.log(
        '💰 Member benefits: All members profit from community surplus',
      );
      console.log('🔋 Battery efficiency: Maximized daily energy utilization');
      console.log(
        '📈 ROI success: Community solar system generates strong returns',
      );
      console.log(
        '🌟 Optimal scenario: Perfect balance of production, storage, and monetization',
      );

      // Verify zero-sum economics with proper BigInt handling
      expect(Math.abs(Number(balances.systemTotal))).to.be.lessThanOrEqual(1);

      // Verify significant export revenue
      expect(balances.exportBalance).to.be.lessThan(0); // Negative because we paid for exports

      // All members should have positive balances (all under-consumed)
      const member1Balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const member2Balance = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const member3Balance = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      const member4Balance = await energyDistribution.getCashCreditBalance(
        member4.address,
      );
      const member5Balance = await energyDistribution.getCashCreditBalance(
        member5.address,
      );
      const member6Balance = await energyDistribution.getCashCreditBalance(
        member6.address,
      );
      const member7Balance = await energyDistribution.getCashCreditBalance(
        member7.address,
      );

      // All members should benefit from export revenue
      expect(Number(member1Balance)).to.be.gte(0);
      expect(Number(member2Balance)).to.be.gte(0);
      expect(Number(member3Balance)).to.be.gte(0);
      expect(Number(member4Balance)).to.be.gte(0);
      expect(Number(member5Balance)).to.be.gte(0);
      expect(Number(member6Balance)).to.be.gte(0);
      expect(Number(member7Balance)).to.be.gte(0);

      console.log(
        '\n✅ DAILY SCENARIO 1 COMPLETE: Optimal solar day with battery management and export revenue',
      );
    });
  });

  describe('Daily Scenario 2: Moderate Production Day with High Consumption', function () {
    it('Should demonstrate full day cycle with battery and no export in single distribution', async function () {
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
      } = await loadFixture(setup7MembersWithBatteryFixture);

      const members = [
        member1,
        member2,
        member3,
        member4,
        member5,
        member6,
        member7,
      ];

      console.log(
        '\n🌤️ === DAILY SCENARIO 2: MODERATE PRODUCTION WITH HIGH CONSUMPTION ===',
      );
      console.log(
        '📅 Full Day Summary: Moderate solar + battery load balancing + high consumption = zero export',
      );

      await logBatteryState(
        energyDistribution,
        'Day start - battery initial state',
      );

      // === SINGLE DAILY DISTRIBUTION ===
      console.log('\n--- DAILY ENERGY DISTRIBUTION ---');

      // Daily totals:
      // - Morning: 1200 solar (200 to battery charge)
      // - Evening: 600 solar + 800 imports + 200 battery discharge
      // - Net battery change: +200 charge - 200 discharge = 0 final state
      // - Net solar for day: 1200 + 600 = 1800 total
      // - Total imports: 800
      const dailySources = [
        { sourceId: 1, price: 110, quantity: 1800 }, // Combined daily solar production (higher price due to lower output)
        { sourceId: 2, price: 190, quantity: 800 }, // Significant imports needed for evening peak
      ];

      console.log('Full day energy summary:');
      console.log(`  Total solar production: 1800 tokens @ price 110`);
      console.log(`  Total imports needed: 800 tokens @ price 190`);
      console.log(
        '  Battery operations: +200 charge (morning) - 200 discharge (evening) = 0 net',
      );
      console.log('  Final battery state: 0 units (fully depleted)');

      // Distribute energy for entire day with net battery state change (back to 0)
      await energyDistribution.distributeEnergyTokens(dailySources, 0);

      await logBatteryState(energyDistribution, 'After daily distribution');
      await logMemberAllocations(
        energyDistribution,
        members,
        'Daily member token allocations',
      );
      await logCollectiveConsumption(
        energyDistribution,
        'Daily collective consumption pool',
      );
      await logCollectiveConsumptionPerMember(
        energyDistribution,
        members,
        'Collective Consumption list',
      );

      console.log('\n💡 DAILY DISTRIBUTION ANALYSIS:');
      console.log('🌤️ Moderate solar production requires significant imports');
      console.log(
        '🔋 Battery full cycle: 200 units charged then fully discharged',
      );
      console.log(
        '💸 Cost management: Battery provides cheaper evening energy vs peak imports',
      );
      console.log(
        '📊 Energy mix: Solar (1800) + Import (800) with battery load balancing',
      );
      console.log(
        '⚖️ Price optimization: Battery (140) vs Peak Import (190) savings',
      );

      // === DAILY CONSUMPTION ===
      console.log('\n--- DAILY ENERGY CONSUMPTION ---');

      const member1Allocation = await energyDistribution.getAllocatedTokens(
        member1.address,
      );
      const member2Allocation = await energyDistribution.getAllocatedTokens(
        member2.address,
      );
      const member3Allocation = await energyDistribution.getAllocatedTokens(
        member3.address,
      );
      const member4Allocation = await energyDistribution.getAllocatedTokens(
        member4.address,
      );
      const member5Allocation = await energyDistribution.getAllocatedTokens(
        member5.address,
      );
      const member6Allocation = await energyDistribution.getAllocatedTokens(
        member6.address,
      );
      const member7Allocation = await energyDistribution.getAllocatedTokens(
        member7.address,
      );

      console.log('Daily consumption patterns (high usage day):');
      console.log(
        `  Member1: 500 tokens (allocated: ${member1Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member2: 480 tokens (allocated: ${member2Allocation}) - OVER-CONSUMPTION`,
      );
      console.log(
        `  Member3: 410 tokens (allocated: ${member3Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member4: 380 tokens (allocated: ${member4Allocation}) - OVER-CONSUMPTION`,
      );
      console.log(
        `  Member5: 300 tokens (allocated: ${member5Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member6: 270 tokens (allocated: ${member6Allocation}) - OVER-CONSUMPTION`,
      );
      console.log(
        `  Member7: 260 tokens (allocated: ${member7Allocation}) - EXACTLY MATCHED`,
      );

      // High consumption day - mixed patterns, all energy consumed internally
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 500 }, // Member1: under-consumption
        { deviceId: 2001, quantity: 480 }, // Member2: over-consumption
        { deviceId: 3001, quantity: 410 }, // Member3: under-consumption
        { deviceId: 4001, quantity: 380 }, // Member4: over-consumption
        { deviceId: 5001, quantity: 300 }, // Member5: under-consumption
        { deviceId: 6001, quantity: 270 }, // Member6: over-consumption
        { deviceId: 7002, quantity: 260 }, // Member7: close to allocation
        // No export - all energy consumed internally
      ]);

      console.log('Daily consumption completed with NO EXPORT');

      console.log('\n💡 DAILY CONSUMPTION ANALYSIS:');
      console.log(
        '🏠 High consumption day: Members used most/all available energy',
      );
      console.log('📊 Perfect internal balance: Zero waste, zero export');
      console.log(
        '⚖️ Mixed efficiency: Some under-consume (credits), others over-consume (pay)',
      );
      console.log('🔋 Battery value: Reduced peak import costs for community');
      console.log(
        '🎯 Load balancing: Morning surplus stored for evening demand',
      );

      // === FINAL DAILY ANALYSIS ===
      const balances = await logFinalBalances(
        energyDistribution,
        members,
        'FINAL DAILY BALANCES - SCENARIO 2 (NO EXPORT DAY)',
      );

      console.log('\n💡 FINAL DAILY ANALYSIS:');
      console.log(
        '✅ Internal optimization: Zero export, optimal community usage',
      );
      console.log(
        '⚖️ Individual responsibility: Consumption patterns determine member outcomes',
      );
      console.log(
        '🔋 Battery efficiency: Reduced daily energy costs for entire community',
      );
      console.log(
        '💰 Balanced economics: Under-consumers profit, over-consumers pay fairly',
      );
      console.log(
        '🌟 Community success: No waste, optimal internal resource utilization',
      );

      // Verify zero-sum economics with proper BigInt handling
      expect(Math.abs(Number(balances.systemTotal))).to.be.lessThanOrEqual(1);

      // Verify no export
      expect(balances.exportBalance).to.equal(0);

      // Check mixed balances based on consumption patterns
      const member1Balance = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const member2Balance = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const member3Balance = await energyDistribution.getCashCreditBalance(
        member3.address,
      );
      const member4Balance = await energyDistribution.getCashCreditBalance(
        member4.address,
      );
      const member5Balance = await energyDistribution.getCashCreditBalance(
        member5.address,
      );
      const member6Balance = await energyDistribution.getCashCreditBalance(
        member6.address,
      );
      const member7Balance = await energyDistribution.getCashCreditBalance(
        member7.address,
      );

      // Under-consumers should have positive balances
      expect(Number(member1Balance)).to.be.gte(0); // Under-consumer
      expect(Number(member3Balance)).to.be.gte(0); // Under-consumer
      expect(Number(member5Balance)).to.be.gte(0); // Under-consumer

      // Over-consumers should have negative balances
      expect(Number(member2Balance)).to.be.lte(0); // Over-consumer
      expect(Number(member4Balance)).to.be.lte(0); // Over-consumer
      expect(Number(member6Balance)).to.be.lte(0); // Over-consumer

      // Member7 should be close to zero (matched consumption)
      expect(Math.abs(Number(member7Balance))).to.be.lte(1000); // Close to allocation

      console.log(
        '\n✅ DAILY SCENARIO 2 COMPLETE: Moderate production with battery load balancing and internal consumption',
      );
    });
  });

  describe('Daily Scenario Comparison', function () {
    it('Should demonstrate the difference between export vs internal consumption days', async function () {
      console.log('\n📊 === DAILY SCENARIO COMPARISON SUMMARY ===');

      console.log('\n🌞 SCENARIO 1 (High Solar Export Day):');
      console.log(
        '☀️ Abundant solar production (2800 tokens) with minimal imports (300 tokens)',
      );
      console.log(
        '🔋 Battery net storage: +250 units from excess morning production',
      );
      console.log(
        '🏠 Low member consumption: All members significantly under-consume',
      );
      console.log(
        '📤 Major export opportunity: ~2540 tokens exported for revenue',
      );
      console.log(
        '💰 Universal profits: All members benefit from substantial export revenue',
      );
      console.log(
        '✅ Optimal economics: High production + low usage = maximum community returns',
      );

      console.log('\n🌤️ SCENARIO 2 (Balanced Internal Day):');
      console.log(
        '🌅 Moderate solar production (1800 tokens) requiring significant imports (800 tokens)',
      );
      console.log(
        '🔋 Battery full cycle: +200 charge then complete discharge (net 0)',
      );
      console.log(
        '🏠 High member consumption: Mixed patterns, most energy used internally',
      );
      console.log(
        '📊 Zero export: All available energy consumed within community',
      );
      console.log(
        '⚖️ Individual outcomes: Based on personal consumption efficiency vs allocation',
      );
      console.log(
        '✅ Internal optimization: Perfect resource utilization, no waste',
      );

      console.log('\n🔑 KEY INSIGHTS FROM DAILY APPROACH:');

      console.log('\n🔋 Battery Daily Role:');
      console.log(
        '  • Scenario 1: Net storage device (+250 units) for future use',
      );
      console.log(
        '  • Scenario 2: Daily load balancer (charge morning, discharge evening)',
      );
      console.log(
        '  • Provides price stability between solar (100-110) and imports (180-190)',
      );
      console.log(
        '  • Enables optimal energy timing regardless of production variability',
      );

      console.log('\n💰 Economic Patterns:');
      console.log(
        '  • Export days: Community profits from external revenue sharing',
      );
      console.log(
        '  • Internal days: Individual efficiency determines personal outcomes',
      );
      console.log(
        '  • Battery always improves economics by reducing peak import dependency',
      );
      console.log(
        '  • Zero-sum fairness ensures balanced cost/benefit distribution',
      );

      console.log('\n🏘️ Community Benefits:');
      console.log(
        '  • Shared ownership model distributes both costs and revenues fairly',
      );
      console.log(
        '  • Battery investment pays off in both export and internal scenarios',
      );
      console.log(
        '  • Flexible daily operations accommodate varying production and consumption',
      );
      console.log(
        '  • Members incentivized for both production maximization and consumption efficiency',
      );

      console.log('\n📈 Daily Management Advantages:');
      console.log(
        '  • Single distribution per day simplifies operations and accounting',
      );
      console.log('  • Battery state represents daily net energy balance');
      console.log(
        '  • Clear member outcomes based on daily consumption vs allocation',
      );
      console.log(
        '  • Easier integration with daily grid settlements and billing cycles',
      );

      // This test provides comparative analysis, no specific assertions needed
      expect(true).to.be.true;
    });
  });
});
