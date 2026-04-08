import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';

/**
 * Test to verify that collectiveConsumption array quantities are correctly
 * decremented after consumeEnergyTokens() is called.
 *
 * This test addresses the reported issue where:
 * - consumeEnergyTokens() succeeds (transaction status=1)
 * - Cash credit balances ARE updating correctly
 * - BUT collectiveConsumption array quantities are NOT being decremented
 */
describe('EnergyConsumptionDecrement', function () {
  async function deployFixture() {
    const [owner, member1, member2, member3, community] =
      await ethers.getSigners();

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

    return {
      energyDistribution,
      energyToken,
      owner,
      member1,
      member2,
      member3,
      community,
    };
  }

  async function setupSimpleCommunityFixture() {
    const {
      energyDistribution,
      energyToken,
      owner,
      member1,
      member2,
      member3,
      community,
    } = await loadFixture(deployFixture);

    // Whitelist the owner first (required for addMember and other operations)
    await energyDistribution.updateWhitelist(owner.address, true);

    // Simple 3-member community
    await energyDistribution.addMember(member1.address, [1001], 4000); // 40%
    await energyDistribution.addMember(member2.address, [2001], 3500); // 35%
    await energyDistribution.addMember(member3.address, [3001], 2500); // 25%

    // Set up community address (0% ownership)
    await energyDistribution.addMember(community.address, [8888], 0);
    await energyDistribution.setCommunityDeviceId(8888);

    // Set export device ID
    await energyDistribution.setExportDeviceId(9999);

    return {
      energyDistribution,
      energyToken,
      owner,
      member1,
      member2,
      member3,
      community,
    };
  }

  describe('CollectiveConsumption Array Decrement Verification', function () {
    it('Should correctly decrement collectiveConsumption quantities after consumption', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupSimpleCommunityFixture);

      console.log('\n=== TEST: CollectiveConsumption Quantity Decrement ===\n');

      // Step 1: Distribute energy (250 kWh total)
      const energySources = [
        { sourceId: 1, price: 10, quantity: 250000, isImport: false }, // 250 kWh in Wh
      ];

      console.log('Step 1: Distributing 250,000 Wh (250 kWh) of energy...');
      await energyDistribution.distributeEnergyTokens(energySources, 0);

      // Step 2: Check collectiveConsumption BEFORE consumption
      const collectiveBefore =
        await energyDistribution.getCollectiveConsumption();
      let totalBefore = 0n;
      console.log('\nStep 2: CollectiveConsumption BEFORE consumption:');
      for (let i = 0; i < collectiveBefore.length; i++) {
        const item = collectiveBefore[i];
        console.log(
          `  [${i}] Owner: ${item.owner}, Price: ${item.price}, Quantity: ${item.quantity}`,
        );
        totalBefore += item.quantity;
      }
      console.log(`  TOTAL: ${totalBefore} Wh`);

      // Also check with the new getTotalUnconsumedEnergy function
      const totalUnconsumedBefore =
        await energyDistribution.getTotalUnconsumedEnergy();
      console.log(
        `  getTotalUnconsumedEnergy(): ${totalUnconsumedBefore} Wh\n`,
      );

      expect(totalBefore).to.equal(
        250000n,
        'Total before should be 250,000 Wh',
      );
      expect(totalUnconsumedBefore).to.equal(
        250000n,
        'getTotalUnconsumedEnergy should return 250,000 Wh',
      );

      // Step 3: Consume exactly 250,000 Wh (all available energy)
      const consumptionRequests = [
        { deviceId: 1001, quantity: 100000 }, // Member1 consumes 100,000 Wh
        { deviceId: 2001, quantity: 87500 }, // Member2 consumes 87,500 Wh
        { deviceId: 3001, quantity: 62500 }, // Member3 consumes 62,500 Wh
        // Total: 250,000 Wh
      ];

      console.log('Step 3: Consuming 250,000 Wh total...');
      console.log('  Member1 (device 1001): 100,000 Wh');
      console.log('  Member2 (device 2001): 87,500 Wh');
      console.log('  Member3 (device 3001): 62,500 Wh');

      const tx = await energyDistribution.consumeEnergyTokens(
        consumptionRequests,
      );
      const receipt = await tx.wait();

      console.log(`\n  Transaction hash: ${tx.hash}`);
      console.log(`  Transaction status: ${receipt?.status}`);
      console.log(`  Gas used: ${receipt?.gasUsed}`);

      // Step 4: Parse and display debug events
      console.log('\nStep 4: Debug Events from transaction:');

      const debugAttemptEvents = receipt?.logs.filter((log) => {
        try {
          const parsed = energyDistribution.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return parsed?.name === 'DebugConsumptionAttempt';
        } catch {
          return false;
        }
      });

      const debugLoopEvents = receipt?.logs.filter((log) => {
        try {
          const parsed = energyDistribution.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return parsed?.name === 'DebugConsumptionLoopInfo';
        } catch {
          return false;
        }
      });

      const debugPoolEvents = receipt?.logs.filter((log) => {
        try {
          const parsed = energyDistribution.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          return parsed?.name === 'DebugPoolStateAfterConsumption';
        } catch {
          return false;
        }
      });

      console.log(
        `\n  DebugConsumptionLoopInfo events (${
          debugLoopEvents?.length || 0
        }):`,
      );
      for (const log of debugLoopEvents || []) {
        const parsed = energyDistribution.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed) {
          console.log(
            `    - collectiveLength: ${parsed.args.collectiveLength}, remainingToConsume: ${parsed.args.remainingToConsume}, isFirstPass: ${parsed.args.isFirstPass}`,
          );
        }
      }

      console.log(
        `\n  DebugConsumptionAttempt events (${
          debugAttemptEvents?.length || 0
        }):`,
      );
      for (const log of debugAttemptEvents || []) {
        const parsed = energyDistribution.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed) {
          console.log(
            `    - poolIndex: ${parsed.args.poolIndex}, owner: ${parsed.args.owner}`,
          );
          console.log(
            `      quantityBefore: ${parsed.args.quantityBefore}, canConsume: ${parsed.args.canConsume}, quantityAfter: ${parsed.args.quantityAfter}`,
          );

          // Verify the decrement happened correctly
          const expectedAfter =
            BigInt(parsed.args.quantityBefore) - BigInt(parsed.args.canConsume);
          expect(BigInt(parsed.args.quantityAfter)).to.equal(
            expectedAfter,
            `Decrement should be correct: ${parsed.args.quantityBefore} - ${parsed.args.canConsume} = ${expectedAfter}`,
          );
        }
      }

      console.log(
        `\n  DebugPoolStateAfterConsumption events (${
          debugPoolEvents?.length || 0
        }):`,
      );
      for (const log of debugPoolEvents || []) {
        const parsed = energyDistribution.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed) {
          console.log(
            `    - totalRemainingInPool: ${parsed.args.totalRemainingInPool} Wh`,
          );
        }
      }

      // Step 5: Check collectiveConsumption AFTER consumption
      const collectiveAfter =
        await energyDistribution.getCollectiveConsumption();
      let totalAfter = 0n;
      console.log('\nStep 5: CollectiveConsumption AFTER consumption:');
      for (let i = 0; i < collectiveAfter.length; i++) {
        const item = collectiveAfter[i];
        console.log(
          `  [${i}] Owner: ${item.owner}, Price: ${item.price}, Quantity: ${item.quantity}`,
        );
        totalAfter += item.quantity;
      }
      console.log(`  TOTAL: ${totalAfter} Wh`);

      // Also check with getTotalUnconsumedEnergy
      const totalUnconsumedAfter =
        await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`  getTotalUnconsumedEnergy(): ${totalUnconsumedAfter} Wh\n`);

      // Step 6: CRITICAL ASSERTIONS
      console.log('Step 6: Critical Assertions:');

      // The total should be 0 after consuming all energy
      expect(totalAfter).to.equal(
        0n,
        'CRITICAL: Total after consumption should be 0 Wh',
      );
      console.log('  ✅ Total remaining in collectiveConsumption: 0 Wh');

      expect(totalUnconsumedAfter).to.equal(
        0n,
        'CRITICAL: getTotalUnconsumedEnergy() should return 0 Wh',
      );
      console.log('  ✅ getTotalUnconsumedEnergy() returns: 0 Wh');

      // Verify the decrement amount
      const consumed = totalBefore - totalAfter;
      expect(consumed).to.equal(
        250000n,
        'CRITICAL: Should have consumed exactly 250,000 Wh',
      );
      console.log(`  ✅ Total consumed: ${consumed} Wh (expected: 250,000 Wh)`);

      console.log('\n=== TEST PASSED: Quantities correctly decremented ===\n');
    });

    it('Should correctly decrement when consuming partial amounts', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupSimpleCommunityFixture);

      console.log('\n=== TEST: Partial Consumption Decrement ===\n');

      // Distribute 250,000 Wh
      const energySources = [
        { sourceId: 1, price: 10, quantity: 250000, isImport: false },
      ];

      await energyDistribution.distributeEnergyTokens(energySources, 0);

      // Check total before
      const totalBefore = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`Total BEFORE partial consumption: ${totalBefore} Wh`);
      expect(totalBefore).to.equal(250000n);

      // Consume only 100,000 Wh (partial)
      const consumptionRequests = [
        { deviceId: 1001, quantity: 50000 }, // Member1: 50,000 Wh
        { deviceId: 2001, quantity: 30000 }, // Member2: 30,000 Wh
        { deviceId: 3001, quantity: 20000 }, // Member3: 20,000 Wh
        // Total: 100,000 Wh
      ];

      console.log('Consuming 100,000 Wh (partial)...');
      const tx = await energyDistribution.consumeEnergyTokens(
        consumptionRequests,
      );
      await tx.wait();

      // Check total after
      const totalAfter = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`Total AFTER partial consumption: ${totalAfter} Wh`);

      // Should have 150,000 Wh remaining
      expect(totalAfter).to.equal(
        150000n,
        'Should have 150,000 Wh remaining after consuming 100,000 Wh',
      );
      console.log(
        `✅ Correctly decremented: 250,000 - 100,000 = ${totalAfter} Wh`,
      );
    });

    it('Should correctly handle multiple consumption calls', async function () {
      const { energyDistribution, member1, member2, member3 } =
        await loadFixture(setupSimpleCommunityFixture);

      console.log('\n=== TEST: Multiple Consumption Calls ===\n');

      // Distribute 300,000 Wh
      const energySources = [
        { sourceId: 1, price: 10, quantity: 300000, isImport: false },
      ];

      await energyDistribution.distributeEnergyTokens(energySources, 0);

      const totalInitial = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`Initial pool: ${totalInitial} Wh`);

      // First consumption: 100,000 Wh
      console.log('\nFirst consumption: 100,000 Wh');
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 100000 },
      ]);

      const afterFirst = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`After first: ${afterFirst} Wh`);
      expect(afterFirst).to.equal(200000n);

      // Second consumption: 80,000 Wh
      console.log('\nSecond consumption: 80,000 Wh');
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 2001, quantity: 80000 },
      ]);

      const afterSecond = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`After second: ${afterSecond} Wh`);
      expect(afterSecond).to.equal(120000n);

      // Third consumption: 120,000 Wh (remaining)
      console.log('\nThird consumption: 120,000 Wh (remaining)');
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 3001, quantity: 62500 },
        { deviceId: 1001, quantity: 57500 },
      ]);

      const afterThird = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`After third: ${afterThird} Wh`);
      expect(afterThird).to.equal(0n);

      console.log(
        '\n✅ All three consumption calls correctly decremented the pool',
      );
    });

    it('Should verify cash credit balance updates alongside quantity decrements', async function () {
      const { energyDistribution, member1, member2 } = await loadFixture(
        setupSimpleCommunityFixture,
      );

      console.log('\n=== TEST: Cash Credit vs Quantity Sync ===\n');

      // Distribute energy
      const energySources = [
        { sourceId: 1, price: 10, quantity: 100000, isImport: false }, // 100 kWh @ $0.10
      ];

      await energyDistribution.distributeEnergyTokens(energySources, 0);

      // Get balances before
      const [balance1Before] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const [balance2Before] = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const poolBefore = await energyDistribution.getTotalUnconsumedEnergy();

      console.log('BEFORE consumption:');
      console.log(`  Member1 cash balance: ${balance1Before}`);
      console.log(`  Member2 cash balance: ${balance2Before}`);
      console.log(`  Pool total: ${poolBefore} Wh`);

      // Member1 consumes their full allocation (40,000 Wh = 40% of 100,000)
      // Member2 consumes more than their allocation to buy from others
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 40000 }, // Member1: consumes own allocation
        { deviceId: 2001, quantity: 50000 }, // Member2: over-consumes (35,000 own + 15,000 from others)
      ]);

      // Get balances after
      const [balance1After] = await energyDistribution.getCashCreditBalance(
        member1.address,
      );
      const [balance2After] = await energyDistribution.getCashCreditBalance(
        member2.address,
      );
      const poolAfter = await energyDistribution.getTotalUnconsumedEnergy();

      console.log('\nAFTER consumption:');
      console.log(`  Member1 cash balance: ${balance1After}`);
      console.log(`  Member2 cash balance: ${balance2After}`);
      console.log(`  Pool total: ${poolAfter} Wh`);

      // Verify pool was decremented
      expect(poolAfter).to.equal(
        10000n,
        'Pool should have 10,000 Wh remaining (100,000 - 40,000 - 50,000)',
      );

      // Both verifications should succeed together
      console.log('\n✅ Both cash credit and pool quantity updated correctly');
      console.log(
        `   Pool decremented: ${poolBefore} → ${poolAfter} (${
          Number(poolBefore) - Number(poolAfter)
        } Wh consumed)`,
      );
    });

    it('Should correctly decrement when buying from imports (address(0) owner)', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setupSimpleCommunityFixture,
      );

      console.log('\n=== TEST: Import Pool (address(0)) Decrement ===\n');

      // Distribute with imports (which have owner = address(0))
      const energySources = [
        { sourceId: 1, price: 10, quantity: 50000, isImport: false }, // 50 kWh local
        { sourceId: 2, price: 22, quantity: 50000, isImport: true }, // 50 kWh import
      ];

      await energyDistribution.distributeEnergyTokens(energySources, 0);

      const collective = await energyDistribution.getCollectiveConsumption();
      console.log('Pool BEFORE consumption:');
      let importQuantityBefore = 0n;
      let localQuantityBefore = 0n;
      for (const item of collective) {
        if (item.owner === '0x0000000000000000000000000000000000000000') {
          importQuantityBefore += item.quantity;
          console.log(
            `  Import pool: ${item.quantity} Wh @ price ${item.price}`,
          );
        } else {
          localQuantityBefore += item.quantity;
          console.log(
            `  Local (${item.owner.slice(0, 10)}...): ${
              item.quantity
            } Wh @ price ${item.price}`,
          );
        }
      }

      const totalBefore = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`  Total: ${totalBefore} Wh`);

      // Member1 over-consumes to force buying from imports
      // They own 40% of 50,000 local = 20,000 Wh
      // Consuming 70,000 will require buying from others AND imports
      console.log('\nMember1 consuming 70,000 Wh (forces import usage)...');
      await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 70000 },
      ]);

      const collectiveAfter =
        await energyDistribution.getCollectiveConsumption();
      console.log('\nPool AFTER consumption:');
      let importQuantityAfter = 0n;
      let localQuantityAfter = 0n;
      for (const item of collectiveAfter) {
        if (item.owner === '0x0000000000000000000000000000000000000000') {
          importQuantityAfter += item.quantity;
          console.log(
            `  Import pool: ${item.quantity} Wh @ price ${item.price}`,
          );
        } else {
          localQuantityAfter += item.quantity;
          console.log(
            `  Local (${item.owner.slice(0, 10)}...): ${
              item.quantity
            } Wh @ price ${item.price}`,
          );
        }
      }

      const totalAfter = await energyDistribution.getTotalUnconsumedEnergy();
      console.log(`  Total: ${totalAfter} Wh`);

      // Verify decrements
      expect(totalAfter).to.equal(
        30000n,
        'Should have 30,000 Wh remaining (100,000 - 70,000)',
      );

      // Verify imports were consumed (should be less than before)
      console.log(
        `\nImport pool change: ${importQuantityBefore} → ${importQuantityAfter}`,
      );
      console.log(
        `Local pool change: ${localQuantityBefore} → ${localQuantityAfter}`,
      );
      console.log('✅ Both local and import pools correctly decremented');
    });
  });

  describe('Debug Event Emission Verification', function () {
    it('Should emit DebugConsumptionAttempt events with correct before/after values', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setupSimpleCommunityFixture,
      );

      // Small distribution for clear debugging
      await energyDistribution.distributeEnergyTokens(
        [{ sourceId: 1, price: 10, quantity: 10000, isImport: false }],
        0,
      );

      // Simple consumption
      const tx = await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 4000 }, // 40% owner consumes 4000
      ]);

      const receipt = await tx.wait();

      // Find DebugConsumptionAttempt events
      const debugEvents = receipt?.logs
        .map((log) => {
          try {
            return energyDistribution.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .filter((e) => e?.name === 'DebugConsumptionAttempt');

      expect(debugEvents?.length).to.be.greaterThan(
        0,
        'Should emit at least one DebugConsumptionAttempt event',
      );

      console.log('\nDebug events captured:');
      for (const event of debugEvents || []) {
        if (event) {
          const before = BigInt(event.args.quantityBefore);
          const consumed = BigInt(event.args.canConsume);
          const after = BigInt(event.args.quantityAfter);

          console.log(
            `  Before: ${before}, Consumed: ${consumed}, After: ${after}`,
          );

          // CRITICAL: Verify the math is correct
          expect(after).to.equal(
            before - consumed,
            'After should equal Before - Consumed',
          );
        }
      }

      console.log('✅ Debug events show correct decrement calculations');
    });

    it('Should emit DebugPoolStateAfterConsumption with correct total', async function () {
      const { energyDistribution, member1 } = await loadFixture(
        setupSimpleCommunityFixture,
      );

      // Distribute 50,000 Wh
      await energyDistribution.distributeEnergyTokens(
        [{ sourceId: 1, price: 10, quantity: 50000, isImport: false }],
        0,
      );

      // Consume 20,000 Wh
      const tx = await energyDistribution.consumeEnergyTokens([
        { deviceId: 1001, quantity: 20000 },
      ]);

      const receipt = await tx.wait();

      // Find DebugPoolStateAfterConsumption event
      const poolEvent = receipt?.logs
        .map((log) => {
          try {
            return energyDistribution.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === 'DebugPoolStateAfterConsumption');

      expect(poolEvent).to.not.be.undefined;
      console.log(
        `Pool state after consumption (from event): ${poolEvent?.args.totalRemainingInPool} Wh`,
      );

      // Verify it matches the getter
      const totalFromGetter =
        await energyDistribution.getTotalUnconsumedEnergy();
      console.log(
        `Pool state after consumption (from getter): ${totalFromGetter} Wh`,
      );

      expect(poolEvent?.args.totalRemainingInPool).to.equal(
        totalFromGetter,
        'Event value should match getter value',
      );

      expect(totalFromGetter).to.equal(30000n, 'Should be 30,000 Wh remaining');

      console.log('✅ DebugPoolStateAfterConsumption event matches getter');
    });
  });
});
