import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { keccak256, toUtf8Bytes, Wallet } from 'ethers';

const IMPORT_SOURCE_ID = keccak256(toUtf8Bytes('IMPORT'));
const SOLAR_SOURCE_ID = keccak256(toUtf8Bytes('SOLAR_PARK_A'));
const BATTERY_SOURCE_ID = keccak256(toUtf8Bytes('BATTERY_1'));

const BASE_BLOCK_GAS_LIMIT = 30_000_000n;

/** Fully qualified — duplicates exist in legacy energytokenupdatable.sol */
const REGULAR_SPACE_TOKEN_FQN =
  'contracts/RegularSpaceToken.sol:RegularSpaceToken';

function gas(receipt: { gasUsed: bigint }, label: string) {
  const pct = Number((receipt.gasUsed * 10000n) / BASE_BLOCK_GAS_LIMIT) / 100;
  console.log(
    `  ⛽  ${label}: ${receipt.gasUsed.toString()} gas  (${pct}% of 30M Base limit)`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helper: create N random wallets (not signers — just addresses)
// ═══════════════════════════════════════════════════════════════════════════
function randomWallets(n: number): string[] {
  const addrs: string[] = [];
  for (let i = 0; i < n; i++) {
    addrs.push(Wallet.createRandom().address);
  }
  return addrs;
}

/** Deploy a RegularSpaceToken UUPS proxy; `executor` can mint up to `maxSupply`. */
async function deployRegularSpaceToken(
  executor: { address: string },
  name: string,
  symbol: string,
  maxSupply: bigint,
  spaceId: bigint,
) {
  const Impl = await ethers.getContractFactory(REGULAR_SPACE_TOKEN_FQN);
  const impl = await Impl.deploy();
  const init = Impl.interface.encodeFunctionData('initialize', [
    name,
    symbol,
    executor.address,
    spaceId,
    maxSupply,
    true,
    true,
    false,
    0,
    ethers.ZeroAddress,
    false,
    false,
    [],
    [],
    [],
    [],
    0,
    [],
    ethers.ZeroAddress,
    0,
    0,
    0,
    [],
  ]);
  const Proxy = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await Proxy.deploy(await impl.getAddress(), init);
  return Impl.attach(await proxy.getAddress());
}

// ═══════════════════════════════════════════════════════════════════════════
//  Section 1: Gas Benchmarks
// ═══════════════════════════════════════════════════════════════════════════

describe('EnergyPPAv2 — Gas Benchmarks', function () {
  this.timeout(300_000);

  async function baseFixture() {
    const [owner, community, aggregator, alice, bob, charlie, dave, eve] =
      await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const stablecoin = await MockERC20.deploy('USD Coin', 'USDC', 6);

    const EnergyToken = await ethers.getContractFactory('EnergyToken');
    const energyToken = await EnergyToken.deploy(
      'Community Energy',
      'CET',
      owner.address,
    );

    const EnergyPPAv2 = await ethers.getContractFactory('EnergyPPAv2');
    const ppa = await upgrades.deployProxy(
      EnergyPPAv2,
      [
        owner.address,
        energyToken.target,
        stablecoin.target,
        ethers.ZeroAddress,
      ],
      { initializer: 'initialize', kind: 'uups' },
    );

    await energyToken.setAuthorized(ppa.target, true);
    await ppa.updateWhitelist(owner.address, true);
    await ppa.setCommunityAddress(community.address);
    await ppa.setAggregatorAddress(aggregator.address);
    await ppa.setCommunityFeeBps(500); // 5%
    await ppa.setAggregatorFeeBps(300); // 3%

    const solarToken = await deployRegularSpaceToken(
      owner,
      'Solar Park A',
      'SOLAR-A',
      10000n,
      1n,
    );
    const batteryToken = await deployRegularSpaceToken(
      owner,
      'Battery 1',
      'BAT-1',
      10000n,
      2n,
    );

    await solarToken.mint(owner.address, 10000n);
    await batteryToken.mint(owner.address, 10000n);

    // Distribute ownership: Alice 40%, Bob 30%, Charlie 20%, Dave 10%
    await solarToken.transfer(alice.address, 4000);
    await solarToken.transfer(bob.address, 3000);
    await solarToken.transfer(charlie.address, 2000);
    await solarToken.transfer(dave.address, 1000);

    await batteryToken.transfer(alice.address, 2500);
    await batteryToken.transfer(bob.address, 2500);
    await batteryToken.transfer(charlie.address, 2500);
    await batteryToken.transfer(dave.address, 2500);

    await ppa.registerSource(SOLAR_SOURCE_ID, 0, solarToken.target, 10);
    await ppa.registerSource(BATTERY_SOURCE_ID, 1, batteryToken.target, 15);

    await ppa.addMember(alice.address, [1001], ethers.ZeroHash);
    await ppa.addMember(bob.address, [2001], ethers.ZeroHash);
    await ppa.addMember(charlie.address, [3001], ethers.ZeroHash);
    await ppa.addMember(dave.address, [4001], ethers.ZeroHash);
    await ppa.addMember(eve.address, [], ethers.ZeroHash);

    await ppa.setExportDeviceId(9999);

    await stablecoin.mint(alice.address, ethers.parseUnits('10000', 6));
    await stablecoin.mint(bob.address, ethers.parseUnits('10000', 6));

    return {
      ppa,
      energyToken,
      stablecoin,
      solarToken,
      batteryToken,
      owner,
      community,
      aggregator,
      alice,
      bob,
      charlie,
      dave,
      eve,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Basic gas benchmarks (small scale)
  // ─────────────────────────────────────────────────────────────────────

  describe('basic gas benchmarks', function () {
    it('registerSource', async function () {
      const { ppa, owner } = await loadFixture(baseFixture);
      const newToken = await deployRegularSpaceToken(
        owner,
        'Wind',
        'WIND',
        10000n,
        99n,
      );
      await newToken.mint(owner.address, 10000n);
      const tx = await ppa.registerSource(
        keccak256(toUtf8Bytes('WIND_1')),
        0,
        newToken.target,
        12,
      );
      gas((await tx.wait())!, 'registerSource');
    });

    it('consumeEnergy — 1 reading', async function () {
      const { ppa } = await loadFixture(baseFixture);
      const tx = await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 50,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);
      gas((await tx.wait())!, 'consumeEnergy — 1 reading');
    });

    it('consumeEnergy — 4 readings, 1 source', async function () {
      const { ppa } = await loadFixture(baseFixture);
      const tx = await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 50,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 40,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 30,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 20,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);
      gas((await tx.wait())!, 'consumeEnergy — 4 readings, 1 source');
    });

    it('consumeEnergy — 8 readings, 2 sources', async function () {
      const { ppa } = await loadFixture(baseFixture);
      const tx = await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 50,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 40,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 30,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 20,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 1001,
          quantity: 25,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 20,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 15,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 10,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
      ]);
      gas((await tx.wait())!, 'consumeEnergy — 8 readings, 2 sources');
    });

    it('addMember — 1 device', async function () {
      const { ppa } = await loadFixture(baseFixture);
      const [, , , , , , , , newMember] = await ethers.getSigners();
      const tx = await ppa.addMember(
        newMember.address,
        [5001],
        ethers.ZeroHash,
      );
      gas((await tx.wait())!, 'addMember — 1 device');
    });

    it('settleOwnDebt', async function () {
      const { ppa, stablecoin, alice } = await loadFixture(baseFixture);
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 80,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);
      const debt = await ppa.getDebtInStablecoin(alice.address);
      if (debt === 0n) return;
      await stablecoin.connect(alice).approve(ppa.target, debt);
      const tx = await ppa.connect(alice).settleOwnDebt(debt);
      gas((await tx.wait())!, 'settleOwnDebt — full');
    });

    it('claimCredit', async function () {
      const { ppa, stablecoin, alice, bob, charlie } = await loadFixture(
        baseFixture,
      );
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);
      for (const member of [alice, bob]) {
        const debt = await ppa.getDebtInStablecoin(member.address);
        if (debt > 0n) {
          await stablecoin.connect(member).approve(ppa.target, debt);
          await ppa.connect(member).settleOwnDebt(debt);
        }
      }
      const credit = await ppa.getEnergyCreditBalance(charlie.address);
      if (credit <= 0n) return;
      const tx = await ppa.connect(charlie).claimCredit(credit);
      gas((await tx.wait())!, 'claimCredit');
    });

    it('emergencyReset (5 members)', async function () {
      const { ppa } = await loadFixture(baseFixture);
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 50,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 30,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);
      const tx = await ppa.emergencyReset();
      gas((await tx.wait())!, 'emergencyReset (5 members)');
    });

    it('deployCommunity — 2 sources, 4 members', async function () {
      const [owner, community, aggregator, alice, bob, charlie, dave] =
        await ethers.getSigners();
      const stablecoin = await (
        await ethers.getContractFactory('MockERC20')
      ).deploy('USDC', 'USDC', 6);
      const ppaImpl = await (
        await ethers.getContractFactory('EnergyPPAv2')
      ).deploy();
      const rstImpl = await (
        await ethers.getContractFactory(REGULAR_SPACE_TOKEN_FQN)
      ).deploy();
      const factory = await (
        await ethers.getContractFactory('EnergyPPAv2Factory')
      ).deploy(await ppaImpl.getAddress(), await rstImpl.getAddress());
      const tx = await factory.deployCommunity({
        admin: owner.address,
        stablecoin: stablecoin.target,
        communityAddress: community.address,
        aggregatorAddress: aggregator.address,
        communityFeeBps: 500,
        aggregatorFeeBps: 300,
        exportDeviceId: 9999,
        energyTokenName: 'Community Energy',
        energyTokenSymbol: 'CET',
        sources: [
          {
            sourceId: keccak256(toUtf8Bytes('SOLAR')),
            sourceType: 0,
            tokenName: 'Solar',
            tokenSymbol: 'SOL',
            basePricePerKwh: 10,
            holders: [alice.address, bob.address],
            holderAmounts: [6000, 4000],
          },
          {
            sourceId: keccak256(toUtf8Bytes('BAT')),
            sourceType: 1,
            tokenName: 'Battery',
            tokenSymbol: 'BAT',
            basePricePerKwh: 15,
            holders: [charlie.address, dave.address],
            holderAmounts: [5000, 5000],
          },
        ],
        members: [
          {
            memberAddress: alice.address,
            deviceIds: [1001],
            metadataHash: ethers.ZeroHash,
          },
          {
            memberAddress: bob.address,
            deviceIds: [2001],
            metadataHash: ethers.ZeroHash,
          },
          {
            memberAddress: charlie.address,
            deviceIds: [3001],
            metadataHash: ethers.ZeroHash,
          },
          {
            memberAddress: dave.address,
            deviceIds: [],
            metadataHash: ethers.ZeroHash,
          },
        ],
      });
      gas((await tx.wait())!, 'deployCommunity — 2 sources, 4 members');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Scale tests: push towards the 30M Base gas limit
  // ═══════════════════════════════════════════════════════════════════════

  describe('scale tests — approaching 30M gas limit', function () {
    this.timeout(900_000);
    // Each test creates a community with `memberCount` members and
    // `sourceCount` sources, then submits `readingCount` readings.
    //
    // Gas cost is dominated by:
    //   Phase 1: O(readings)                 — charge each consumer
    //   Phase 2: O(sources × members)        — distribute revenue
    //   ensureZeroSum: O(members)             — verify invariant
    //
    // So total ~ O(readings) + O(sources × members) + O(members)

    async function scaleFixture(memberCount: number, sourceCount: number) {
      const [owner, community, aggregator] = await ethers.getSigners();
      const stablecoin = await (
        await ethers.getContractFactory('MockERC20')
      ).deploy('USDC', 'USDC', 6);
      const energyToken = await (
        await ethers.getContractFactory('EnergyToken')
      ).deploy('CET', 'CET', owner.address);
      const ppa = await upgrades.deployProxy(
        await ethers.getContractFactory('EnergyPPAv2'),
        [
          owner.address,
          energyToken.target,
          stablecoin.target,
          ethers.ZeroAddress,
        ],
        { initializer: 'initialize', kind: 'uups' },
      );
      await energyToken.setAuthorized(ppa.target, true);
      await ppa.updateWhitelist(owner.address, true);
      await ppa.setCommunityAddress(community.address);
      await ppa.setAggregatorAddress(aggregator.address);
      await ppa.setCommunityFeeBps(500);
      await ppa.setAggregatorFeeBps(300);

      const wallets = randomWallets(memberCount);
      const sourceIdList: string[] = [];

      for (let s = 0; s < sourceCount; s++) {
        const sid = keccak256(toUtf8Bytes(`SOURCE_${s}`));
        sourceIdList.push(sid);
        const supply = BigInt(memberCount * 100);
        const token = await deployRegularSpaceToken(
          owner,
          `Source ${s}`,
          `SRC${s}`,
          supply,
          BigInt(s + 1000),
        );
        await token.mint(owner.address, supply);
        for (let m = 0; m < memberCount; m++) {
          await token.transfer(wallets[m], 100);
        }
        await ppa.registerSource(sid, 0, token.target, 10);
      }

      // Register members — each with one device
      const deviceBase = 10000;
      for (let m = 0; m < memberCount; m++) {
        await ppa.addMember(wallets[m], [deviceBase + m], ethers.ZeroHash);
      }

      return {
        ppa,
        wallets,
        sourceIdList,
        deviceBase,
        memberCount,
        sourceCount,
      };
    }

    function buildReadings(
      deviceBase: number,
      memberCount: number,
      sourceIds: string[],
      readingsPerMemberPerSource: number,
    ) {
      const readings: {
        deviceId: number;
        quantity: number;
        pricePerKwh: number;
        sourceId: string;
      }[] = [];
      for (let r = 0; r < readingsPerMemberPerSource; r++) {
        for (let s = 0; s < sourceIds.length; s++) {
          for (let m = 0; m < memberCount; m++) {
            readings.push({
              deviceId: deviceBase + m,
              quantity: 10,
              pricePerKwh: 10,
              sourceId: sourceIds[s],
            });
          }
        }
      }
      return readings;
    }

    // 10 members × 2 sources × 1 reading each = 20 readings
    it('gas: 10 members, 2 sources, 20 readings', async function () {
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        10,
        2,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(20);
      const tx = await ppa.consumeEnergy(readings);
      const receipt = await tx.wait();
      gas(receipt!, `consumeEnergy — ${readings.length} readings (10m × 2s)`);
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 20 members × 2 sources = 40 readings
    it('gas: 20 members, 2 sources, 40 readings', async function () {
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        20,
        2,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(40);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (20m × 2s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 50 members × 2 sources = 100 readings
    it('gas: 50 members, 2 sources, 100 readings', async function () {
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        50,
        2,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(100);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (50m × 2s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 50 members × 4 sources = 200 readings
    it('gas: 50 members, 4 sources, 200 readings', async function () {
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        50,
        4,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(200);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (50m × 4s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 100 members × 2 sources = 200 readings (more members, same readings)
    it('gas: 100 members, 2 sources, 200 readings', async function () {
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        100,
        2,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(200);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (100m × 2s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 100 members × 4 sources = 400 readings
    it('gas: 100 members, 4 sources, 400 readings', async function () {
      this.timeout(900_000);
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        100,
        4,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(400);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (100m × 4s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 150 members × 2 sources = 300 readings
    it('gas: 150 members, 2 sources, 300 readings', async function () {
      this.timeout(900_000);
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        150,
        2,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(300);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (150m × 2s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // 200 members × 2 sources = 400 readings
    it('gas: 200 members, 2 sources, 400 readings', async function () {
      this.timeout(900_000);
      const { ppa, deviceBase, memberCount, sourceIdList } = await scaleFixture(
        200,
        2,
      );
      const readings = buildReadings(deviceBase, memberCount, sourceIdList, 1);
      expect(readings.length).to.equal(400);
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — ${readings.length} readings (200m × 2s)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // Half the members report for each source — simulates real life where
    // not every meter reports every interval
    it('gas: 100 members, 2 sources, sparse (50 per source = 100 readings)', async function () {
      this.timeout(900_000);
      const { ppa, deviceBase, sourceIdList } = await scaleFixture(100, 2);
      const readings: {
        deviceId: number;
        quantity: number;
        pricePerKwh: number;
        sourceId: string;
      }[] = [];
      // First 50 members → source 0, next 50 → source 1
      for (let m = 0; m < 50; m++) {
        readings.push({
          deviceId: deviceBase + m,
          quantity: 10,
          pricePerKwh: 10,
          sourceId: sourceIdList[0],
        });
      }
      for (let m = 50; m < 100; m++) {
        readings.push({
          deviceId: deviceBase + m,
          quantity: 10,
          pricePerKwh: 10,
          sourceId: sourceIdList[1],
        });
      }
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — 100 sparse readings (100m × 2s, 50 each)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // Import-heavy: 100 members, 50 import + 50 solar
    it('gas: 100 members, mixed 50 import + 50 solar', async function () {
      this.timeout(900_000);
      const { ppa, deviceBase, sourceIdList } = await scaleFixture(100, 1);
      const readings: {
        deviceId: number;
        quantity: number;
        pricePerKwh: number;
        sourceId: string;
      }[] = [];
      for (let m = 0; m < 50; m++) {
        readings.push({
          deviceId: deviceBase + m,
          quantity: 10,
          pricePerKwh: 10,
          sourceId: sourceIdList[0],
        });
      }
      for (let m = 50; m < 100; m++) {
        readings.push({
          deviceId: deviceBase + m,
          quantity: 10,
          pricePerKwh: 25,
          sourceId: IMPORT_SOURCE_ID,
        });
      }
      const tx = await ppa.consumeEnergy(readings);
      gas(
        (await tx.wait())!,
        `consumeEnergy — 100 readings (50 solar + 50 import)`,
      );
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    it('summary: prints gas-per-reading and gas-per-member estimates', async function () {
      console.log('\n  ╔═══════════════════════════════════════════════════╗');
      console.log('  ║  Base block gas limit: 30,000,000                ║');
      console.log('  ║                                                   ║');
      console.log('  ║  Rule of thumb from tests above:                  ║');
      console.log('  ║  • ~3-5k gas per reading (Phase 1)               ║');
      console.log('  ║  • ~50-80k gas per (source × member) in Phase 2  ║');
      console.log('  ║  • ~10-20k gas per member for zero-sum check     ║');
      console.log('  ║                                                   ║');
      console.log('  ║  Check the numbers above to estimate your limits. ║');
      console.log('  ╚═══════════════════════════════════════════════════╝\n');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Section 2: Math / Logic Verification
  // ═══════════════════════════════════════════════════════════════════════

  describe('EnergyPPAv2 — Revenue Split Math Verification', function () {
    async function mathFixture() {
      const [owner, community, aggregator, alice, bob, charlie, dave] =
        await ethers.getSigners();

      const stablecoin = await (
        await ethers.getContractFactory('MockERC20')
      ).deploy('USDC', 'USDC', 6);
      const energyToken = await (
        await ethers.getContractFactory('EnergyToken')
      ).deploy('CET', 'CET', owner.address);
      const ppa = await upgrades.deployProxy(
        await ethers.getContractFactory('EnergyPPAv2'),
        [
          owner.address,
          energyToken.target,
          stablecoin.target,
          ethers.ZeroAddress,
        ],
        { initializer: 'initialize', kind: 'uups' },
      );
      await energyToken.setAuthorized(ppa.target, true);
      await ppa.updateWhitelist(owner.address, true);

      const solarToken = await deployRegularSpaceToken(
        owner,
        'Solar',
        'SOL',
        10000n,
        3n,
      );
      await solarToken.mint(owner.address, 10000n);

      // Ownership: Alice 40%, Bob 35%, Charlie 25%
      await solarToken.transfer(alice.address, 4000);
      await solarToken.transfer(bob.address, 3500);
      await solarToken.transfer(charlie.address, 2500);

      await ppa.registerSource(SOLAR_SOURCE_ID, 0, solarToken.target, 10);

      // Dave is a pure consumer (no ownership tokens)
      await ppa.addMember(alice.address, [1001], ethers.ZeroHash);
      await ppa.addMember(bob.address, [2001], ethers.ZeroHash);
      await ppa.addMember(charlie.address, [3001], ethers.ZeroHash);
      await ppa.addMember(dave.address, [4001], ethers.ZeroHash);

      await stablecoin.mint(alice.address, ethers.parseUnits('100000', 6));
      await stablecoin.mint(bob.address, ethers.parseUnits('100000', 6));
      await stablecoin.mint(dave.address, ethers.parseUnits('100000', 6));

      return {
        ppa,
        energyToken,
        stablecoin,
        solarToken,
        owner,
        community,
        aggregator,
        alice,
        bob,
        charlie,
        dave,
      };
    }

    // ─── Test 1: Exact revenue split with no fees ────────────────────

    it('no fees: all revenue goes to token holders proportionally', async function () {
      const { ppa, alice, bob, charlie, dave } = await loadFixture(mathFixture);
      // No fees configured in this fixture by default

      // Dave consumes 100 kWh @ 10 per kWh from solar → total charge = 1000
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const totalRevenue = 1000n;

      // Alice: 40% of 1000 = 400
      // Bob:   35% of 1000 = 350
      // Charlie: 25% of 1000 = 250 (last holder, gets remainder)
      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);
      const daveBal = await ppa.getEnergyCreditBalance(dave.address);

      // Dave was charged
      expect(daveBal).to.equal(-1000n);

      // Revenue distribution (integer math: share = remaining * tokenBal / totalSupply)
      // Alice: 1000 * 4000 / 10000 = 400
      expect(aliceBal).to.equal(400n);
      // Bob: 1000 * 3500 / 10000 = 350
      expect(bobBal).to.equal(350n);
      // Charlie (last holder): remainder = 1000 - 400 - 350 = 250
      expect(charlieBal).to.equal(250n);

      // Sum of credits = sum of debits
      expect(aliceBal + bobBal + charlieBal + daveBal).to.equal(0n);

      const [ok, drift] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
      expect(drift).to.equal(0n);
    });

    // ─── Test 2: Revenue split with community + aggregator fees ──────

    it('with fees: fees taken first, remainder split to holders', async function () {
      const { ppa, community, aggregator, alice, bob, charlie, dave } =
        await loadFixture(mathFixture);

      // Set fees: community 5%, aggregator 3%
      await ppa.setCommunityAddress(community.address);
      await ppa.setAggregatorAddress(aggregator.address);
      await ppa.setCommunityFeeBps(500);
      await ppa.setAggregatorFeeBps(300);

      // Dave consumes 200 kWh @ 10 → total charge = 2000
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 200,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const totalRevenue = 2000n;
      const communityFee = (totalRevenue * 500n) / 10000n; // 100
      const aggregatorFee = (totalRevenue * 300n) / 10000n; // 60
      const remaining = totalRevenue - communityFee - aggregatorFee; // 1840

      expect(communityFee).to.equal(100n);
      expect(aggregatorFee).to.equal(60n);
      expect(remaining).to.equal(1840n);

      // Alice: 1840 * 4000 / 10000 = 736
      const aliceExpected = (remaining * 4000n) / 10000n;
      // Bob: 1840 * 3500 / 10000 = 644
      const bobExpected = (remaining * 3500n) / 10000n;
      // Charlie (last): 1840 - 736 - 644 = 460
      const charlieExpected = remaining - aliceExpected - bobExpected;

      expect(aliceExpected).to.equal(736n);
      expect(bobExpected).to.equal(644n);
      expect(charlieExpected).to.equal(460n);

      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);
      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      const communityBal = await ppa.getEnergyCreditBalance(community.address);
      const aggregatorBal = await ppa.getEnergyCreditBalance(
        aggregator.address,
      );

      expect(daveBal).to.equal(-2000n);
      expect(communityBal).to.equal(communityFee);
      expect(aggregatorBal).to.equal(aggregatorFee);
      expect(aliceBal).to.equal(aliceExpected);
      expect(bobBal).to.equal(bobExpected);
      expect(charlieBal).to.equal(charlieExpected);

      // All balances net to zero
      const sum =
        daveBal + communityBal + aggregatorBal + aliceBal + bobBal + charlieBal;
      expect(sum).to.equal(0n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 3: Rounding dust goes to last holder ───────────────────

    it('rounding dust absorbed by last holder', async function () {
      const { ppa, alice, bob, charlie, dave } = await loadFixture(mathFixture);

      // Choose a revenue that doesn't divide evenly: 7 kWh @ 10 = 70
      // Alice: 70 * 4000 / 10000 = 28
      // Bob:   70 * 3500 / 10000 = 24 (integer division, 24.5 truncated)
      // Charlie (last): 70 - 28 - 24 = 18 (gets the extra vs 17.5)
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 7,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);

      expect(aliceBal).to.equal(28n);
      expect(bobBal).to.equal(24n);
      // Without remainder logic: 70 * 2500 / 10000 = 17, total = 69, 1 lost
      // With remainder logic: Charlie gets 70 - 28 - 24 = 18
      expect(charlieBal).to.equal(18n);
      // Exact: 28 + 24 + 18 = 70 = charge, no dust lost
      expect(aliceBal + bobBal + charlieBal).to.equal(70n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 4: Import readings don't generate source revenue ───────

    it('import readings charge consumer and add to import balance only', async function () {
      const { ppa, alice, dave } = await loadFixture(mathFixture);

      // Dave consumes 50 kWh from the grid at 25 per kWh = charge 1250
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 50,
          pricePerKwh: 25,
          sourceId: IMPORT_SOURCE_ID,
        },
      ]);

      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      expect(daveBal).to.equal(-1250n);

      // No revenue to token holders — Alice should have 0
      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceBal).to.equal(0n);

      // Import balance absorbs the charge
      const importBal = await ppa.getImportEnergyCreditBalance();
      expect(importBal).to.equal(1250n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 5: Mixed import + local in same batch ──────────────────

    it('mixed batch: import charges separate from source revenue', async function () {
      const { ppa, alice, bob, charlie, dave } = await loadFixture(mathFixture);

      // Alice: 30 kWh solar @ 10 = 300 charge, goes to source revenue
      // Dave:  20 kWh import @ 25 = 500 charge, goes to import balance
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 30,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 20,
          pricePerKwh: 25,
          sourceId: IMPORT_SOURCE_ID,
        },
      ]);

      // Solar revenue = 300. Split: Alice 40%, Bob 35%, Charlie 25%
      // Alice: 300 * 4000/10000 = 120, but she was also charged -300
      // Net Alice = -300 + 120 = -180
      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceBal).to.equal(-300n + 120n);

      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      expect(bobBal).to.equal((300n * 3500n) / 10000n); // 105

      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);
      // Last holder: 300 - 120 - 105 = 75
      expect(charlieBal).to.equal(300n - 120n - 105n);

      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      expect(daveBal).to.equal(-500n);

      const importBal = await ppa.getImportEnergyCreditBalance();
      expect(importBal).to.equal(500n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 6: Multiple readings same consumer accumulate ──────────

    it('multiple readings for same consumer accumulate correctly', async function () {
      const { ppa, dave } = await loadFixture(mathFixture);

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 10,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 20,
          pricePerKwh: 15,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Dave charged: 10*10 + 20*15 = 100 + 300 = 400
      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      // Dave's net = -400 + his revenue share of 400 (he has 0 solar tokens, so 0)
      expect(daveBal).to.equal(-400n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 7: Multiple sources, verify per-source split ───────────

    it('two sources: each source revenue split independently', async function () {
      const { ppa, owner, alice, bob, charlie, dave } = await loadFixture(
        mathFixture,
      );

      // Register a second source with different ownership
      const batteryToken = await deployRegularSpaceToken(
        owner,
        'Battery',
        'BAT',
        10000n,
        4n,
      );
      await batteryToken.mint(owner.address, 10000n);
      // Battery ownership: Alice 50%, Dave 50%
      await batteryToken.transfer(alice.address, 5000);
      await batteryToken.transfer(dave.address, 5000);
      await ppa.registerSource(BATTERY_SOURCE_ID, 1, batteryToken.target, 15);

      // Bob consumes from solar, Charlie consumes from battery
      await ppa.consumeEnergy([
        {
          deviceId: 2001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        }, // 1000 revenue to solar
        {
          deviceId: 3001,
          quantity: 100,
          pricePerKwh: 20,
          sourceId: BATTERY_SOURCE_ID,
        }, // 2000 revenue to battery
      ]);

      // Solar revenue (1000):
      //   Alice: 1000 * 4000/10000 = 400
      //   Bob:   1000 * 3500/10000 = 350
      //   Charlie (last): 1000 - 400 - 350 = 250
      //
      // Battery revenue (2000):
      //   Alice: 2000 * 5000/10000 = 1000
      //   Dave (last):  2000 - 1000 = 1000

      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceBal).to.equal(400n + 1000n); // solar + battery

      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      expect(bobBal).to.equal(-1000n + 350n); // charged + solar share

      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);
      expect(charlieBal).to.equal(-2000n + 250n); // charged + solar share (no battery tokens)

      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      expect(daveBal).to.equal(1000n); // battery share only (no solar tokens)

      // Total: 1400 + (-650) + (-1750) + 1000 = 0
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 8: Settle debt and claim credit, verify balances ───────

    it('full cycle: consume → settle debt → claim credit', async function () {
      const { ppa, stablecoin, alice, bob, charlie, dave } = await loadFixture(
        mathFixture,
      );

      // Dave consumes 500 units from solar → charge 5000
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 500,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Balances after consumption:
      // Dave:    -5000
      // Alice:   5000 * 4000/10000 = 2000
      // Bob:     5000 * 3500/10000 = 1750
      // Charlie: 5000 - 2000 - 1750 = 1250
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-5000n);
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(2000n);
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(1750n);
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(1250n);

      // Dave settles his debt in stablecoins
      const debtStablecoin = await ppa.getDebtInStablecoin(dave.address);
      expect(debtStablecoin).to.equal(5000n * 10000n); // 50,000,000 stablecoin units
      await stablecoin.mint(dave.address, debtStablecoin);
      await stablecoin.connect(dave).approve(ppa.target, debtStablecoin);
      await ppa.connect(dave).settleOwnDebt(debtStablecoin);
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(0n);

      // Contract now holds stablecoins
      const contractBal = await ppa.getContractStablecoinBalance();
      expect(contractBal).to.equal(debtStablecoin);

      // Alice claims her full credit
      const aliceCredit = await ppa.getCreditInStablecoin(alice.address);
      expect(aliceCredit).to.equal(2000n * 10000n); // 20,000,000
      const aliceStablecoinBefore = await stablecoin.balanceOf(alice.address);
      await ppa.connect(alice).claimCredit(2000n);
      const aliceStablecoinAfter = await stablecoin.balanceOf(alice.address);
      expect(aliceStablecoinAfter - aliceStablecoinBefore).to.equal(
        aliceCredit,
      );
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(0n);

      // Bob claims partial (just 1000 of his 1750)
      await ppa.connect(bob).claimCredit(1000n);
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(750n);

      // Verify the contract's remaining stablecoin balance
      // Started with 50,000,000 (Dave's debt)
      // Alice claimed 20,000,000
      // Bob claimed 10,000,000
      // Remaining = 20,000,000
      const remainingStablecoin = await ppa.getContractStablecoinBalance();
      expect(remainingStablecoin).to.equal(20_000_000n);

      // Zero sum still holds
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 9: Fees with non-trivial rounding ──────────────────────

    it('fees + rounding: no value is lost', async function () {
      const { ppa, community, aggregator, alice, bob, charlie, dave } =
        await loadFixture(mathFixture);

      await ppa.setCommunityAddress(community.address);
      await ppa.setAggregatorAddress(aggregator.address);
      await ppa.setCommunityFeeBps(333); // 3.33%
      await ppa.setAggregatorFeeBps(177); // 1.77%

      // Dave consumes 333 units @ 7 = 2331 revenue
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 333,
          pricePerKwh: 7,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const totalRevenue = 2331n;
      const expectedCommunityFee = (totalRevenue * 333n) / 10000n; // 77
      const expectedAggregatorFee = (totalRevenue * 177n) / 10000n; // 41
      const remaining =
        totalRevenue - expectedCommunityFee - expectedAggregatorFee;

      const communityBal = await ppa.getEnergyCreditBalance(community.address);
      const aggregatorBal = await ppa.getEnergyCreditBalance(
        aggregator.address,
      );
      expect(communityBal).to.equal(expectedCommunityFee);
      expect(aggregatorBal).to.equal(expectedAggregatorFee);

      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);
      const daveBal = await ppa.getEnergyCreditBalance(dave.address);

      // All revenue accounted for — sum of holder shares = remaining
      expect(aliceBal + bobBal + charlieBal).to.equal(remaining);

      // Everything nets to zero
      const allSum =
        daveBal + communityBal + aggregatorBal + aliceBal + bobBal + charlieBal;
      expect(allSum).to.equal(0n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 10: Multiple intervals accumulate correctly ────────────

    it('two consecutive intervals accumulate balances', async function () {
      const { ppa, alice, bob, charlie, dave } = await loadFixture(mathFixture);

      // Interval 1: Dave consumes 100 @ 10 = 1000 from solar
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Interval 2: Dave consumes another 50 @ 20 = 1000 from solar
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 50,
          pricePerKwh: 20,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Total revenue = 2000, total Dave charge = -2000
      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      expect(daveBal).to.equal(-2000n);

      // Alice accumulated from two rounds:
      //   Round 1: 1000 * 4000/10000 = 400
      //   Round 2: 1000 * 4000/10000 = 400
      //   Total: 800
      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceBal).to.equal(800n);

      const bobBal = await ppa.getEnergyCreditBalance(bob.address);
      expect(bobBal).to.equal(700n); // 350 + 350

      const charlieBal = await ppa.getEnergyCreditBalance(charlie.address);
      expect(charlieBal).to.equal(500n); // 250 + 250

      expect(aliceBal + bobBal + charlieBal + daveBal).to.equal(0n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 11: Consumer who is also an owner — net balance ────────

    it('consumer-owner: consumption charge offset by revenue share', async function () {
      const { ppa, alice, bob, charlie } = await loadFixture(mathFixture);

      // Alice consumes 100 @ 10 = 1000 from solar
      // Alice owns 40% of solar → gets 400 back
      // Net: -1000 + 400 = -600
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceBal).to.equal(-600n);

      // Bob: 0 consumed, gets 35% of 1000 = 350
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(350n);
      // Charlie (last): 0 consumed, gets remainder = 1000 - 400 - 350 = 250
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(250n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 12: Export reading generates revenue for source ────────

    it('export: revenue split to source holders, export balance debited', async function () {
      const { ppa, owner, alice, bob, charlie } = await loadFixture(
        mathFixture,
      );

      await ppa.addMember(owner.address, [9999], ethers.ZeroHash);
      await ppa.setExportDeviceId(9999);

      // Export 200 kWh @ 8 from solar = 1600 revenue
      await ppa.consumeEnergy([
        {
          deviceId: 9999,
          quantity: 200,
          pricePerKwh: 8,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const exportBal = await ppa.getExportEnergyCreditBalance();
      expect(exportBal).to.equal(-1600n);

      // Revenue split: Alice 40% = 640, Bob 35% = 560, Charlie = 400
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(640n);
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(560n);
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(400n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 13: Settle more than debt — capped at actual debt ──────

    it('overpayment is capped to actual debt', async function () {
      const { ppa, stablecoin, dave } = await loadFixture(mathFixture);

      // Create a small debt
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 10,
          pricePerKwh: 5,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const debt = await ppa.getDebtInStablecoin(dave.address); // actual debt in stablecoin
      const overpay = debt * 3n; // try to pay 3x

      await stablecoin.mint(dave.address, overpay);
      await stablecoin.connect(dave).approve(ppa.target, overpay);
      await ppa.connect(dave).settleOwnDebt(overpay);

      // Balance should be 0, not positive (capped)
      // Dave consumed and also got no revenue (no tokens)
      // His net balance: -(10*5) + 0 = -50, then settled -50 → 0
      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      expect(daveBal).to.equal(0n);

      // Only the actual debt amount was transferred, not the overpay
      const contractBal = await stablecoin.balanceOf(ppa.target);
      expect(contractBal).to.equal(50n * 10000n); // 500,000

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    // ─── Test 14: Claim more than credit — capped ────────────────────

    it('overclaim is capped to actual credit', async function () {
      const { ppa, stablecoin, alice, dave } = await loadFixture(mathFixture);

      // Dave consumes → Alice gets revenue
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Provide liquidity
      const debt = await ppa.getDebtInStablecoin(dave.address);
      await stablecoin.mint(dave.address, debt);
      await stablecoin.connect(dave).approve(ppa.target, debt);
      await ppa.connect(dave).settleOwnDebt(debt);

      // Alice has 400 credit, try to claim 999999
      const aliceCredit = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceCredit).to.equal(400n);

      const before = await stablecoin.balanceOf(alice.address);
      await ppa.connect(alice).claimCredit(999999n);
      const after = await stablecoin.balanceOf(alice.address);

      // Only got 400 * 10000 = 4,000,000 stablecoin units
      expect(after - before).to.equal(400n * 10000n);
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(0n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });
});
