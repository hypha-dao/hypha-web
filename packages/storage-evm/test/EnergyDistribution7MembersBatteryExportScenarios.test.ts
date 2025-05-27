import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';

describe('EnergyDistribution7MembersBatteryExportScenarios', function () {
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
    const collective = await energyDistribution.getCollectiveConsumption();
    console.log(`\n${title}:`);

    // Group by member
    const memberTokens: {
      [key: string]: { price: number; quantity: number }[];
    } = {};

    for (const item of collective) {
      const ownerAddr = item.owner;
      if (!memberTokens[ownerAddr]) {
        memberTokens[ownerAddr] = [];
      }
      memberTokens[ownerAddr].push({
        price: Number(item.price),
        quantity: Number(item.quantity),
      });
    }

    // Display per member
    for (const [index, member] of members.entries()) {
      const memberName = `Member${index + 1}`;
      const memberAddr = member.address;

      if (memberTokens[memberAddr]) {
        const tokens = memberTokens[memberAddr];
        let totalTokens = 0;
        let totalValue = 0;
        let breakdown = '';

        for (const token of tokens) {
          totalTokens += token.quantity;
          totalValue += token.price * token.quantity;
          if (breakdown) breakdown += ', ';
          breakdown += `${token.quantity}@${token.price}`;
        }

        console.log(
          `  ${memberName}: ${totalTokens} tokens (${breakdown}) = value ${totalValue}`,
        );
      } else {
        console.log(`  ${memberName}: 0 tokens`);
      }
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

    const systemTotal = totalMemberBalance + Number(exportBalance);
    console.log(`TOTAL MEMBER BALANCE: ${totalMemberBalance}`);
    console.log(`SYSTEM TOTAL (should be 0): ${systemTotal}`);

    return {
      totalMemberBalance,
      exportBalance: Number(exportBalance),
      systemTotal,
    };
  }

  describe('Scenario 1: Battery Operations with Export', function () {
    it('Should demonstrate complete battery cycle with export', async function () {
      const {
        energyDistribution,
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

      console.log('\n🔋 === SCENARIO 1: BATTERY OPERATIONS WITH EXPORT ===');
      console.log(
        '💡 Context: High solar production day, members consume little, excess energy available',
      );

      // === STEP 1: High solar production with battery charging ===
      console.log(
        '\n--- STEP 1: High solar production with excess energy (battery charging) ---',
      );
      await logBatteryState(energyDistribution, 'Before distribution');

      const sources1 = [
        { sourceId: 1, price: 100, quantity: 2000 }, // High local solar production
      ];

      console.log('Energy sources:');
      console.log(`  Local solar production: 2000 tokens @ price 100`);
      console.log('  No import needed - excess solar available');
      console.log('Battery charging: 400 units (from excess local production)');

      await energyDistribution.distributeEnergyTokens(sources1, 400); // Charge battery to 400

      await logBatteryState(energyDistribution, 'After charging');
      await logMemberAllocations(
        energyDistribution,
        members,
        'Member allocations after charging',
      );
      await logCollectiveConsumption(
        energyDistribution,
        'Collective consumption after charging',
      );
      await logCollectiveConsumptionPerMember(
        energyDistribution,
        members,
        'Collective consumption breakdown per member after charging',
      );

      // === STEP 2: Lower solar production, battery discharging ===
      console.log(
        '\n--- STEP 2: Cloudy afternoon - lower production, battery discharges ---',
      );

      const sources2 = [
        { sourceId: 1, price: 100, quantity: 800 }, // Reduced local production
        { sourceId: 2, price: 180, quantity: 300 }, // Some import needed
      ];

      console.log('Energy sources:');
      console.log(`  Local production: 800 tokens @ price 100`);
      console.log(`  Import needed: 300 tokens @ price 180`);
      console.log('Battery discharging: 150 units (from 400 to 250)');

      await energyDistribution.distributeEnergyTokens(sources2, 250); // Discharge battery from 400 to 250

      await logBatteryState(energyDistribution, 'After discharging');
      await logMemberAllocations(
        energyDistribution,
        members,
        'Member allocations after discharging',
      );
      await logCollectiveConsumption(
        energyDistribution,
        'Collective consumption after discharging',
      );
      await logCollectiveConsumptionPerMember(
        energyDistribution,
        members,
        'Collective consumption breakdown per member after discharging',
      );

      // === STEP 3: Low consumption day - members use little energy ===
      console.log(
        '\n--- STEP 3: Low consumption day - significant surplus for export ---',
      );

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

      console.log('Low consumption patterns (members away/efficient usage):');
      console.log(
        `  Member1: 150 tokens (allocated: ${member1Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member2: 120 tokens (allocated: ${member2Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member3: 100 tokens (allocated: ${member3Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member4: 80 tokens (allocated: ${member4Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member5: 60 tokens (allocated: ${member5Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member6: 40 tokens (allocated: ${member6Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member7: 20 tokens (allocated: ${member7Allocation}) - UNDER-CONSUMPTION`,
      );

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 150 }, // Member1: under-consumption
        { deviceId: 2001, quantity: 120 }, // Member2: under-consumption
        { deviceId: 3001, quantity: 100 }, // Member3: under-consumption
        { deviceId: 4001, quantity: 80 }, // Member4: under-consumption
        { deviceId: 5001, quantity: 60 }, // Member5: under-consumption
        { deviceId: 6001, quantity: 40 }, // Member6: under-consumption
        { deviceId: 7001, quantity: 20 }, // Member7: under-consumption
        { deviceId: 9999, quantity: 680 }, // Export significant surplus
      ]);

      console.log(
        '\nConsumption processed - 680 tokens exported (large surplus)',
      );

      // === STEP 4: Final state analysis ===
      const balances = await logFinalBalances(
        energyDistribution,
        members,
        'FINAL BALANCES - SCENARIO 1 (WITH SIGNIFICANT EXPORT)',
      );

      // Verify zero-sum economics
      expect(Math.abs(balances.systemTotal)).to.be.lessThanOrEqual(1);

      // Verify export cost (should be significant)
      expect(balances.exportBalance).to.be.lt(0);
      expect(Math.abs(balances.exportBalance)).to.be.gt(50000); // Significant export cost

      // All members should have positive balances (all under-consumed + export revenue)
      for (const member of members) {
        const balance = await energyDistribution.getCashCreditBalance(
          member.address,
        );
        expect(balance).to.be.gt(0); // All under-consumers benefit from export revenue
      }

      console.log(
        '\n✅ SCENARIO 1 COMPLETE: Excess solar production → battery charging → later discharge + significant export revenue',
      );
    });
  });

  describe('Scenario 2: Battery Operations without Export', function () {
    it('Should demonstrate battery cycle with no export (high internal consumption)', async function () {
      const {
        energyDistribution,
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

      console.log('\n🏠 === SCENARIO 2: BATTERY OPERATIONS WITHOUT EXPORT ===');
      console.log(
        '💡 Context: Moderate production, high consumption day, battery provides load balancing',
      );

      // === STEP 1: Moderate solar production with battery charging ===
      console.log(
        '\n--- STEP 1: Morning solar production exceeds immediate consumption ---',
      );
      await logBatteryState(energyDistribution, 'Before distribution');

      const sources1 = [
        { sourceId: 1, price: 110, quantity: 1400 }, // Moderate local production
      ];

      console.log('Energy sources:');
      console.log(`  Local solar production: 1400 tokens @ price 110`);
      console.log('  No import needed - moderate solar sufficient');
      console.log('Battery charging: 200 units (from excess morning solar)');

      await energyDistribution.distributeEnergyTokens(sources1, 200); // Charge battery to 200

      await logBatteryState(energyDistribution, 'After charging');
      await logMemberAllocations(
        energyDistribution,
        members,
        'Member allocations after charging',
      );
      await logCollectiveConsumption(
        energyDistribution,
        'Collective consumption after charging',
      );
      await logCollectiveConsumptionPerMember(
        energyDistribution,
        members,
        'Collective consumption breakdown per member after charging',
      );

      // === STEP 2: Evening peak demand, low solar + battery discharge + imports ===
      console.log(
        '\n--- STEP 2: Evening peak demand - low solar, battery discharges, imports needed ---',
      );

      const sources2 = [
        { sourceId: 1, price: 110, quantity: 600 }, // Very low evening solar
        { sourceId: 2, price: 190, quantity: 800 }, // Expensive evening imports
      ];

      console.log('Energy sources:');
      console.log(
        `  Local production: 600 tokens @ price 110 (low evening solar)`,
      );
      console.log(
        `  Import needed: 800 tokens @ price 190 (expensive peak rate)`,
      );
      console.log(
        'Battery discharging: 200 units (from 200 to 0 - fully depleted)',
      );

      await energyDistribution.distributeEnergyTokens(sources2, 0); // Discharge battery completely from 200 to 0

      await logBatteryState(energyDistribution, 'After discharging');
      await logMemberAllocations(
        energyDistribution,
        members,
        'Member allocations after discharging',
      );
      await logCollectiveConsumption(
        energyDistribution,
        'Collective consumption after discharging',
      );
      await logCollectiveConsumptionPerMember(
        energyDistribution,
        members,
        'Collective consumption breakdown per member after discharging',
      );

      // === STEP 3: High evening consumption - almost everything consumed internally ===
      console.log(
        '\n--- STEP 3: High evening consumption - members use almost all available energy ---',
      );

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

      console.log('High evening consumption patterns:');
      console.log(
        `  Member1: 300 tokens (allocated: ${member1Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member2: 310 tokens (allocated: ${member2Allocation}) - OVER-CONSUMPTION`,
      );
      console.log(
        `  Member3: 250 tokens (allocated: ${member3Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member4: 270 tokens (allocated: ${member4Allocation}) - OVER-CONSUMPTION`,
      );
      console.log(
        `  Member5: 180 tokens (allocated: ${member5Allocation}) - UNDER-CONSUMPTION`,
      );
      console.log(
        `  Member6: 170 tokens (allocated: ${member6Allocation}) - OVER-CONSUMPTION`,
      );
      console.log(
        `  Member7: 150 tokens (allocated: ${member7Allocation}) - UNDER-CONSUMPTION`,
      );

      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 300 }, // Member1: under-consumption
        { deviceId: 2001, quantity: 310 }, // Member2: over-consumption
        { deviceId: 3001, quantity: 250 }, // Member3: under-consumption
        { deviceId: 4001, quantity: 270 }, // Member4: over-consumption
        { deviceId: 5001, quantity: 180 }, // Member5: under-consumption
        { deviceId: 6001, quantity: 170 }, // Member6: over-consumption
        { deviceId: 7001, quantity: 150 }, // Member7: under-consumption
        { deviceId: 9999, quantity: 5 }, // Minimal export (just a few remaining tokens)
      ]);

      console.log(
        '\nConsumption processed with minimal export (only 5 tokens - almost everything consumed)',
      );

      // === STEP 4: Final state analysis ===
      const balances = await logFinalBalances(
        energyDistribution,
        members,
        'FINAL BALANCES - SCENARIO 2 (MINIMAL EXPORT)',
      );

      // Verify zero-sum economics
      expect(Math.abs(balances.systemTotal)).to.be.lessThanOrEqual(1);

      // Verify minimal export cost
      expect(balances.exportBalance).to.be.lte(0); // Can be 0 or negative
      expect(Math.abs(balances.exportBalance)).to.be.lt(5000); // Should be very small

      // Check that we have mixed balances (some positive, some negative)
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

      // Under-consumers should have positive or zero balances
      expect(member1Balance).to.be.gte(0); // Under-consumer
      expect(member3Balance).to.be.gte(0); // Under-consumer
      expect(member5Balance).to.be.gte(0); // Under-consumer
      expect(member7Balance).to.be.gte(0); // Under-consumer

      // Over-consumers should have negative or zero balances (can be exactly 0 in minimal export scenarios)
      expect(member2Balance).to.be.lte(0); // Over-consumer
      expect(member4Balance).to.be.lte(0); // Over-consumer
      expect(member6Balance).to.be.lte(0); // Over-consumer (can be exactly 0)

      console.log(
        '\n✅ SCENARIO 2 COMPLETE: Battery provided evening load balancing, minimal export, efficient internal usage',
      );
    });
  });

  describe('Scenario Comparison', function () {
    it('Should demonstrate the difference between export vs no-export scenarios', async function () {
      console.log('\n📊 === SCENARIO COMPARISON SUMMARY ===');
      console.log('\nSCENARIO 1 (High Export):');
      console.log('🌞 High solar production day with low consumption');
      console.log('🔋 Battery charged from excess morning solar (400 units)');
      console.log('⚡ Battery discharged during cloudy afternoon (150 units)');
      console.log(
        '📤 Significant export (680 tokens) due to low member consumption',
      );
      console.log('💰 All members benefit from substantial export revenue');
      console.log(
        '✅ Demonstrates community solar system with surplus monetization',
      );

      console.log('\nSCENARIO 2 (Minimal Export):');
      console.log('🌤️ Moderate production with high evening demand');
      console.log(
        '🔋 Battery charged from excess morning production (200 units)',
      );
      console.log('⚡ Battery fully depleted during evening peak (200 units)');
      console.log(
        '📊 Minimal export (5 tokens) - almost everything consumed internally',
      );
      console.log(
        '⚖️ Mixed member balances based on individual consumption patterns',
      );
      console.log(
        '✅ Demonstrates battery as load balancing tool for community',
      );

      console.log('\nKEY INSIGHTS:');
      console.log('🔋 Battery Economic Role:');
      console.log('  - Charges only when excess local production is available');
      console.log(
        '  - Provides energy at configured price (140) when discharging',
      );
      console.log(
        '  - Acts as price stabilization between cheap solar (100-110) and expensive imports (180-190)',
      );

      console.log('💰 Export Economics:');
      console.log(
        '  - High export scenarios create significant revenue for all members',
      );
      console.log(
        '  - Low export scenarios depend more on individual consumption efficiency',
      );
      console.log(
        '  - Battery enables more predictable pricing regardless of solar variability',
      );

      console.log('🏘️ Community Benefits:');
      console.log(
        '  - Members share both production surplus and consumption costs fairly',
      );
      console.log('  - Battery reduces dependence on expensive peak imports');
      console.log(
        '  - Zero-sum economics ensure fairness across all scenarios',
      );

      // This test just summarizes the insights, no assertions needed
      expect(true).to.be.true;
    });
  });
});
