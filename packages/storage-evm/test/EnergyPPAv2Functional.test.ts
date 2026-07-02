import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { keccak256, toUtf8Bytes } from 'ethers';

const IMPORT_SOURCE_ID = keccak256(toUtf8Bytes('IMPORT'));
const SOLAR_SOURCE_ID = keccak256(toUtf8Bytes('SOLAR_PARK_A'));
const BATTERY_SOURCE_ID = keccak256(toUtf8Bytes('BATTERY_1'));

const REGULAR_SPACE_TOKEN_FQN =
  'contracts/RegularSpaceToken.sol:RegularSpaceToken';

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
    [],
  ]);
  const Proxy = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await Proxy.deploy(await impl.getAddress(), init);
  return Impl.attach(await proxy.getAddress());
}

// ═══════════════════════════════════════════════════════════════════════════
//  Functional correctness tests for EnergyPPAv2
//  Focus: energy credit balances, ownership token balances, value flow
// ═══════════════════════════════════════════════════════════════════════════

describe('EnergyPPAv2 — Functional Correctness', function () {
  this.timeout(300_000);

  // ─────────────────────────────────────────────────────────────────────
  //  Shared fixture: 1 solar source, 1 battery source, 4 members
  //
  //  Solar ownership:  Alice 40%, Bob 35%, Charlie 25%  (total 10000)
  //  Battery ownership: Alice 50%, Dave 50%             (total 10000)
  //
  //  Members with devices:
  //    Alice   → device 1001
  //    Bob     → device 2001
  //    Charlie → device 3001
  //    Dave    → device 4001
  //
  //  Fees: community 5% (500 bps), aggregator 3% (300 bps)
  // ─────────────────────────────────────────────────────────────────────

  async function communityFixture() {
    const [owner, community, aggregator, alice, bob, charlie, dave] =
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

    // ── Solar token: Alice 40%, Bob 35%, Charlie 25% ──
    const solarToken = await deployRegularSpaceToken(
      owner,
      'Solar Park A',
      'SOLAR-A',
      10000n,
      1n,
    );
    await solarToken.mint(owner.address, 10000n);
    await solarToken.transfer(alice.address, 4000);
    await solarToken.transfer(bob.address, 3500);
    await solarToken.transfer(charlie.address, 2500);

    // ── Battery token: Alice 50%, Dave 50% ──
    const batteryToken = await deployRegularSpaceToken(
      owner,
      'Battery 1',
      'BAT-1',
      10000n,
      2n,
    );
    await batteryToken.mint(owner.address, 10000n);
    await batteryToken.transfer(alice.address, 5000);
    await batteryToken.transfer(dave.address, 5000);

    await ppa.registerSource(SOLAR_SOURCE_ID, 0, solarToken.target, 10);
    await ppa.registerSource(BATTERY_SOURCE_ID, 1, batteryToken.target, 15);

    await ppa.addMember(alice.address, [1001], ethers.ZeroHash);
    await ppa.addMember(bob.address, [2001], ethers.ZeroHash);
    await ppa.addMember(charlie.address, [3001], ethers.ZeroHash);
    await ppa.addMember(dave.address, [4001], ethers.ZeroHash);

    await ppa.setExportDeviceId(9999);

    // Pre-fund members with stablecoins for settlement tests
    const largeAmount = ethers.parseUnits('100000', 6);
    for (const member of [alice, bob, charlie, dave]) {
      await stablecoin.mint(member.address, largeAmount);
    }

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
    };
  }

  // Helper: log all balances for a nice table
  async function logBalanceTable(
    ppa: any,
    energyToken: any,
    solarToken: any,
    batteryToken: any,
    stablecoin: any,
    accounts: { name: string; address: string }[],
  ) {
    console.log(
      '\n  ┌─────────────┬─────────────────┬──────────────┬──────────────┬──────────────┐',
    );
    console.log(
      '  │ Member      │ Energy Credit   │ Solar Tokens │ Bat. Tokens  │ Stablecoin   │',
    );
    console.log(
      '  ├─────────────┼─────────────────┼──────────────┼──────────────┼──────────────┤',
    );
    for (const a of accounts) {
      const credit = await ppa.getEnergyCreditBalance(a.address);
      const solar = await solarToken.balanceOf(a.address);
      const bat = await batteryToken.balanceOf(a.address);
      const usd = await stablecoin.balanceOf(a.address);
      const creditStr = credit.toString().padStart(15);
      const solarStr = solar.toString().padStart(12);
      const batStr = bat.toString().padStart(12);
      const usdStr = usd.toString().padStart(12);
      console.log(
        `  │ ${a.name.padEnd(
          11,
        )} │ ${creditStr} │ ${solarStr} │ ${batStr} │ ${usdStr} │`,
      );
    }
    const importBal = await ppa.getImportEnergyCreditBalance();
    const exportBal = await ppa.getExportEnergyCreditBalance();
    const settledBal = await ppa.getSettledBalance();
    console.log(
      '  ├─────────────┼─────────────────┼──────────────┴──────────────┴──────────────┤',
    );
    console.log(
      `  │ Import      │ ${importBal
        .toString()
        .padStart(15)} │                                            │`,
    );
    console.log(
      `  │ Export      │ ${exportBal
        .toString()
        .padStart(15)} │                                            │`,
    );
    console.log(
      `  │ Settled     │ ${settledBal
        .toString()
        .padStart(15)} │                                            │`,
    );
    const contractUSD = await ppa.getContractStablecoinBalance();
    console.log(
      `  │ Contract $  │ ${contractUSD
        .toString()
        .padStart(15)} │                                            │`,
    );
    console.log(
      '  └─────────────┴─────────────────┴────────────────────────────────────────────┘',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  1. Ownership token balances are correct after setup
  // ═══════════════════════════════════════════════════════════════════════

  describe('ownership token setup', function () {
    it('solar ownership: Alice 40%, Bob 35%, Charlie 25%', async function () {
      const { solarToken, alice, bob, charlie, dave } = await loadFixture(
        communityFixture,
      );

      expect(await solarToken.balanceOf(alice.address)).to.equal(4000n);
      expect(await solarToken.balanceOf(bob.address)).to.equal(3500n);
      expect(await solarToken.balanceOf(charlie.address)).to.equal(2500n);
      expect(await solarToken.balanceOf(dave.address)).to.equal(0n);

      const totalSupply = await solarToken.totalSupply();
      expect(totalSupply).to.equal(10000n);
    });

    it('battery ownership: Alice 50%, Dave 50%', async function () {
      const { batteryToken, alice, bob, charlie, dave } = await loadFixture(
        communityFixture,
      );

      expect(await batteryToken.balanceOf(alice.address)).to.equal(5000n);
      expect(await batteryToken.balanceOf(bob.address)).to.equal(0n);
      expect(await batteryToken.balanceOf(charlie.address)).to.equal(0n);
      expect(await batteryToken.balanceOf(dave.address)).to.equal(5000n);
    });

    it('PPA correctly reports ownership bps per source', async function () {
      const { ppa, alice, bob, charlie, dave } = await loadFixture(
        communityFixture,
      );

      // Solar ownership in bps
      expect(
        await ppa.getSourceOwnershipBps(SOLAR_SOURCE_ID, alice.address),
      ).to.equal(4000n);
      expect(
        await ppa.getSourceOwnershipBps(SOLAR_SOURCE_ID, bob.address),
      ).to.equal(3500n);
      expect(
        await ppa.getSourceOwnershipBps(SOLAR_SOURCE_ID, charlie.address),
      ).to.equal(2500n);
      expect(
        await ppa.getSourceOwnershipBps(SOLAR_SOURCE_ID, dave.address),
      ).to.equal(0n);

      // Battery ownership in bps
      expect(
        await ppa.getSourceOwnershipBps(BATTERY_SOURCE_ID, alice.address),
      ).to.equal(5000n);
      expect(
        await ppa.getSourceOwnershipBps(BATTERY_SOURCE_ID, dave.address),
      ).to.equal(5000n);
      expect(
        await ppa.getSourceOwnershipBps(BATTERY_SOURCE_ID, bob.address),
      ).to.equal(0n);
    });

    it('getAllSourceOwnerships returns both sources for each member', async function () {
      const { ppa, alice } = await loadFixture(communityFixture);

      const [ids, bps] = await ppa.getAllSourceOwnerships(alice.address);
      expect(ids.length).to.equal(2);
      expect(bps[0]).to.equal(4000n); // solar
      expect(bps[1]).to.equal(5000n); // battery
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  2. Single source consumption — value distribution
  // ═══════════════════════════════════════════════════════════════════════

  describe('single source: solar consumption with fees', function () {
    it('distributes revenue correctly: fees → holders proportionally', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, energyToken, solarToken, batteryToken, stablecoin } = f;
      const { community, aggregator, alice, bob, charlie, dave } = f;

      // Dave consumes 200 kWh from solar @ 10 per kWh → charge = 2000
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

      // Verify fees
      expect(await ppa.getEnergyCreditBalance(community.address)).to.equal(
        100n,
      );
      expect(await ppa.getEnergyCreditBalance(aggregator.address)).to.equal(
        60n,
      );

      // Verify holder shares: Alice 40%, Bob 35%, Charlie 25% (of remaining)
      const aliceShare = (1840n * 4000n) / 10000n; // 736
      const bobShare = (1840n * 3500n) / 10000n; // 644
      const charlieShare = 1840n - aliceShare - bobShare; // 460

      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        aliceShare,
      );
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(bobShare);
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(
        charlieShare,
      );

      // Dave was charged the full amount
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-2000n);

      // EnergyToken reflects positive balances (credit holders get tokens)
      expect(await energyToken.balanceOf(alice.address)).to.equal(736n);
      expect(await energyToken.balanceOf(bob.address)).to.equal(644n);
      expect(await energyToken.balanceOf(charlie.address)).to.equal(460n);
      expect(await energyToken.balanceOf(dave.address)).to.equal(0n);

      // Ownership tokens unchanged
      expect(await solarToken.balanceOf(alice.address)).to.equal(4000n);
      expect(await solarToken.balanceOf(bob.address)).to.equal(3500n);

      console.log('\n  After Dave consumes 200 kWh solar @ 10:');
      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        [
          { name: 'Alice', address: alice.address },
          { name: 'Bob', address: bob.address },
          { name: 'Charlie', address: charlie.address },
          { name: 'Dave', address: dave.address },
          { name: 'Community', address: community.address },
          { name: 'Aggregator', address: aggregator.address },
        ],
      );

      const [ok, drift] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
      expect(drift).to.equal(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  3. Multi-source consumption — value split independently per source
  // ═══════════════════════════════════════════════════════════════════════

  describe('multi-source consumption', function () {
    it('each source revenue is split to its own token holders', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, energyToken, solarToken, batteryToken, stablecoin } = f;
      const { community, aggregator, alice, bob, charlie, dave } = f;

      // Bob consumes 100 kWh solar @ 10 = 1000 revenue
      // Charlie consumes 200 kWh battery @ 15 = 3000 revenue
      await ppa.consumeEnergy([
        {
          deviceId: 2001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 200,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
      ]);

      // ── Solar revenue: 1000 ──
      const solarCommunityFee = (1000n * 500n) / 10000n; // 50
      const solarAggregatorFee = (1000n * 300n) / 10000n; // 30
      const solarRemaining = 1000n - 50n - 30n; // 920
      // Alice: 920 * 4000/10000 = 368, Bob: 920 * 3500/10000 = 322, Charlie: 920-368-322 = 230

      // ── Battery revenue: 3000 ──
      const batCommunityFee = (3000n * 500n) / 10000n; // 150
      const batAggregatorFee = (3000n * 300n) / 10000n; // 90
      const batRemaining = 3000n - 150n - 90n; // 2760
      // Alice: 2760 * 5000/10000 = 1380, Dave: 2760 - 1380 = 1380

      // Total fees
      expect(await ppa.getEnergyCreditBalance(community.address)).to.equal(
        solarCommunityFee + batCommunityFee, // 200
      );
      expect(await ppa.getEnergyCreditBalance(aggregator.address)).to.equal(
        solarAggregatorFee + batAggregatorFee, // 120
      );

      // Alice: solar share + battery share (no consumption)
      const aliceExpected = 368n + 1380n;
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        aliceExpected,
      );

      // Bob: charged -1000 + solar share 322
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(
        -1000n + 322n,
      );

      // Charlie: charged -3000 + solar share 230 (no battery tokens!)
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(
        -3000n + 230n,
      );

      // Dave: battery share only = 1380
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(1380n);

      console.log('\n  After Bob=100kWh solar, Charlie=200kWh battery:');
      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        [
          { name: 'Alice', address: alice.address },
          { name: 'Bob', address: bob.address },
          { name: 'Charlie', address: charlie.address },
          { name: 'Dave', address: dave.address },
          { name: 'Community', address: community.address },
          { name: 'Aggregator', address: aggregator.address },
        ],
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  4. Import + local in same batch
  // ═══════════════════════════════════════════════════════════════════════

  describe('import vs local source separation', function () {
    it('import charges go to importBalance, local charges to source holders', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, community, aggregator, alice, bob, charlie, dave } = f;

      // Dave: 50 kWh solar @ 10 = 500 (local revenue)
      // Dave: 30 kWh import @ 25 = 750 (import charge)
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 50,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 30,
          pricePerKwh: 25,
          sourceId: IMPORT_SOURCE_ID,
        },
      ]);

      // Dave total charge: -500 + -750 = -1250
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-1250n);

      // Import balance absorbs 750
      expect(await ppa.getImportEnergyCreditBalance()).to.equal(750n);

      // Solar revenue 500 → fees → holders
      const communityFee = (500n * 500n) / 10000n; // 25
      const aggregatorFee = (500n * 300n) / 10000n; // 15
      const remaining = 500n - 25n - 15n; // 460

      expect(await ppa.getEnergyCreditBalance(community.address)).to.equal(25n);
      expect(await ppa.getEnergyCreditBalance(aggregator.address)).to.equal(
        15n,
      );

      const aliceShare = (460n * 4000n) / 10000n; // 184
      const bobShare = (460n * 3500n) / 10000n; // 161
      const charlieShare = 460n - aliceShare - bobShare; // 115

      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        aliceShare,
      );
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(bobShare);
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(
        charlieShare,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  5. Consumer who is also an owner — net balance
  // ═══════════════════════════════════════════════════════════════════════

  describe('consumer-owner net balance', function () {
    it('Alice consumes solar but gets part back as owner', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, alice, bob, charlie } = f;

      // Alice consumes 100 kWh solar @ 10 = 1000 charge
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const communityFee = (1000n * 500n) / 10000n; // 50
      const aggregatorFee = (1000n * 300n) / 10000n; // 30
      const remaining = 1000n - 50n - 30n; // 920

      const aliceShare = (920n * 4000n) / 10000n; // 368
      // Alice net: -1000 (charge) + 368 (owner share) = -632
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        -1000n + aliceShare,
      );

      // Bob and Charlie get free money (no consumption)
      const bobShare = (920n * 3500n) / 10000n; // 322
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(bobShare);
      const charlieShare = 920n - aliceShare - bobShare;
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(
        charlieShare,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    it('Alice consumes from battery where she owns 50%', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, alice, dave } = f;

      // Alice consumes 100 kWh battery @ 15 = 1500 charge
      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 100,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
      ]);

      const communityFee = (1500n * 500n) / 10000n; // 75
      const aggregatorFee = (1500n * 300n) / 10000n; // 45
      const remaining = 1500n - 75n - 45n; // 1380

      const aliceShare = (1380n * 5000n) / 10000n; // 690
      const daveShare = 1380n - aliceShare; // 690

      // Alice: -1500 + 690 = -810
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        -1500n + aliceShare,
      );
      // Dave: pure owner benefit = 690
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(
        daveShare,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  6. Full lifecycle: consume → settle debt → claim credit
  // ═══════════════════════════════════════════════════════════════════════

  describe('full settlement lifecycle', function () {
    it('consume → settle → claim, stablecoin flows are correct', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, energyToken, solarToken, batteryToken, stablecoin } = f;
      const { community, aggregator, alice, bob, charlie, dave } = f;

      const accounts = [
        { name: 'Alice', address: alice.address },
        { name: 'Bob', address: bob.address },
        { name: 'Charlie', address: charlie.address },
        { name: 'Dave', address: dave.address },
        { name: 'Community', address: community.address },
        { name: 'Aggregator', address: aggregator.address },
      ];

      // ── Step 1: Consumption ──
      // Dave consumes 500 kWh solar @ 10 = 5000 charge
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 500,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const communityFee = (5000n * 500n) / 10000n; // 250
      const aggregatorFee = (5000n * 300n) / 10000n; // 150
      const remaining = 5000n - 250n - 150n; // 4600
      const aliceShare = (4600n * 4000n) / 10000n; // 1840
      const bobShare = (4600n * 3500n) / 10000n; // 1610
      const charlieShare = 4600n - aliceShare - bobShare; // 1150

      console.log('\n  ═══ Step 1: After consumption ═══');
      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );

      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-5000n);
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(1840n);
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(1610n);
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(1150n);

      // ── Step 2: Dave settles his debt ──
      const daveDebtStablecoin = await ppa.getDebtInStablecoin(dave.address);
      expect(daveDebtStablecoin).to.equal(5000n * 10000n); // 50_000_000

      const daveUsdBefore = await stablecoin.balanceOf(dave.address);
      await stablecoin.connect(dave).approve(ppa.target, daveDebtStablecoin);
      await ppa.connect(dave).settleOwnDebt(daveDebtStablecoin);
      const daveUsdAfter = await stablecoin.balanceOf(dave.address);

      // Dave's stablecoin decreased by exact debt amount
      expect(daveUsdBefore - daveUsdAfter).to.equal(daveDebtStablecoin);
      // Dave's energy credit is now 0
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(0n);
      // Contract holds the stablecoins
      expect(await ppa.getContractStablecoinBalance()).to.equal(
        daveDebtStablecoin,
      );

      console.log('\n  ═══ Step 2: After Dave settles debt ═══');
      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );

      // ── Step 3: Alice claims her full credit ──
      const aliceCreditStablecoin = await ppa.getCreditInStablecoin(
        alice.address,
      );
      expect(aliceCreditStablecoin).to.equal(1840n * 10000n); // 18_400_000

      const aliceUsdBefore = await stablecoin.balanceOf(alice.address);
      await ppa.connect(alice).claimCredit(1840n);
      const aliceUsdAfter = await stablecoin.balanceOf(alice.address);

      expect(aliceUsdAfter - aliceUsdBefore).to.equal(aliceCreditStablecoin);
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(0n);
      expect(await energyToken.balanceOf(alice.address)).to.equal(0n);

      // ── Step 4: Bob claims partial (1000 of 1610) ──
      const bobUsdBefore = await stablecoin.balanceOf(bob.address);
      await ppa.connect(bob).claimCredit(1000n);
      const bobUsdAfter = await stablecoin.balanceOf(bob.address);

      expect(bobUsdAfter - bobUsdBefore).to.equal(1000n * 10000n);
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(610n);
      expect(await energyToken.balanceOf(bob.address)).to.equal(610n);

      console.log(
        '\n  ═══ Step 3-4: After Alice full claim, Bob partial claim ═══',
      );
      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );

      // ── Verify contract stablecoin balance ──
      // Received: 50_000_000 (Dave's debt)
      // Paid out: 18_400_000 (Alice) + 10_000_000 (Bob)
      // Remaining: 21_600_000
      expect(await ppa.getContractStablecoinBalance()).to.equal(21_600_000n);

      // Zero-sum still holds
      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    it('partial settlement: Dave pays half, then the rest', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, stablecoin, dave } = f;

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Dave debt: 1000 internal = 10_000_000 stablecoin
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-1000n);

      // Pay half: 500 internal = 5_000_000 stablecoin
      await stablecoin.connect(dave).approve(ppa.target, 5_000_000n);
      await ppa.connect(dave).settleOwnDebt(5_000_000n);
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-500n);

      // Pay the rest
      await stablecoin.connect(dave).approve(ppa.target, 5_000_000n);
      await ppa.connect(dave).settleOwnDebt(5_000_000n);
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(0n);

      // Total contract balance = full debt
      expect(await ppa.getContractStablecoinBalance()).to.equal(10_000_000n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  7. Multiple intervals — balances accumulate
  // ═══════════════════════════════════════════════════════════════════════

  describe('multiple consumption intervals', function () {
    it('balances accumulate across two intervals', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, alice, bob, charlie, dave } = f;

      // Interval 1: Dave 100 kWh solar @ 10 = 1000
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const r1 = 1000n;
      const r1community = (r1 * 500n) / 10000n; // 50
      const r1aggregator = (r1 * 300n) / 10000n; // 30
      const r1remaining = r1 - r1community - r1aggregator; // 920
      const r1alice = (r1remaining * 4000n) / 10000n; // 368

      // Interval 2: Dave 200 kWh solar @ 15 = 3000
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 200,
          pricePerKwh: 15,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const r2 = 3000n;
      const r2community = (r2 * 500n) / 10000n; // 150
      const r2aggregator = (r2 * 300n) / 10000n; // 90
      const r2remaining = r2 - r2community - r2aggregator; // 2760
      const r2alice = (r2remaining * 4000n) / 10000n; // 1104

      // Dave accumulated charge: -1000 + -3000 = -4000
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-4000n);

      // Alice accumulated: 368 + 1104 = 1472
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        r1alice + r2alice,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });

    it('different sources in different intervals', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, alice, bob, charlie, dave } = f;

      // Interval 1: Dave 100 kWh solar @ 10 = 1000
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Interval 2: Bob 50 kWh battery @ 15 = 750
      await ppa.consumeEnergy([
        {
          deviceId: 2001,
          quantity: 50,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
      ]);

      // Solar revenue split: Alice, Bob, Charlie get shares
      // Battery revenue split: Alice, Dave get shares
      // Dave: -1000 (consumer) + battery share
      // Bob: -750 (consumer) + solar share

      const solarRevenue = 1000n;
      const sCommunity = (solarRevenue * 500n) / 10000n;
      const sAggregator = (solarRevenue * 300n) / 10000n;
      const sRemaining = solarRevenue - sCommunity - sAggregator;
      const sAlice = (sRemaining * 4000n) / 10000n;
      const sBob = (sRemaining * 3500n) / 10000n;
      const sCharlie = sRemaining - sAlice - sBob;

      const batRevenue = 750n;
      const bCommunity = (batRevenue * 500n) / 10000n;
      const bAggregator = (batRevenue * 300n) / 10000n;
      const bRemaining = batRevenue - bCommunity - bAggregator;
      const bAlice = (bRemaining * 5000n) / 10000n;
      const bDave = bRemaining - bAlice;

      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        sAlice + bAlice,
      );
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(
        -750n + sBob,
      );
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(
        sCharlie,
      );
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(
        -1000n + bDave,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  8. Export readings
  // ═══════════════════════════════════════════════════════════════════════

  describe('energy export', function () {
    it('export revenue is split to source holders, export balance debited', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, owner, community, aggregator, alice, bob, charlie } = f;

      await ppa.addMember(owner.address, [9999], ethers.ZeroHash);

      // Export 300 kWh solar @ 8 = 2400 revenue
      await ppa.consumeEnergy([
        {
          deviceId: 9999,
          quantity: 300,
          pricePerKwh: 8,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      expect(await ppa.getExportEnergyCreditBalance()).to.equal(-2400n);

      const communityFee = (2400n * 500n) / 10000n; // 120
      const aggregatorFee = (2400n * 300n) / 10000n; // 72
      const remaining = 2400n - 120n - 72n; // 2208

      expect(await ppa.getEnergyCreditBalance(community.address)).to.equal(
        120n,
      );
      expect(await ppa.getEnergyCreditBalance(aggregator.address)).to.equal(
        72n,
      );

      const aliceShare = (2208n * 4000n) / 10000n; // 883
      const bobShare = (2208n * 3500n) / 10000n; // 772
      const charlieShare = 2208n - aliceShare - bobShare;

      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        aliceShare,
      );
      expect(await ppa.getEnergyCreditBalance(bob.address)).to.equal(bobShare);
      expect(await ppa.getEnergyCreditBalance(charlie.address)).to.equal(
        charlieShare,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  9. Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  describe('edge cases', function () {
    it('overpayment is capped — stablecoin not overcharged', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, stablecoin, dave } = f;

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 10,
          pricePerKwh: 5,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Debt is 50 internal = 500_000 stablecoin
      const actualDebt = await ppa.getDebtInStablecoin(dave.address);
      const overpay = actualDebt * 5n;

      const before = await stablecoin.balanceOf(dave.address);
      await stablecoin.connect(dave).approve(ppa.target, overpay);
      await ppa.connect(dave).settleOwnDebt(overpay);
      const after = await stablecoin.balanceOf(dave.address);

      // Only actual debt transferred, not the overpay
      expect(before - after).to.equal(actualDebt);
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(0n);
    });

    it('overclaim is capped — only actual credit paid', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, stablecoin, alice, dave } = f;

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Fund the contract (Dave settles)
      const debt = await ppa.getDebtInStablecoin(dave.address);
      await stablecoin.connect(dave).approve(ppa.target, debt);
      await ppa.connect(dave).settleOwnDebt(debt);

      const aliceCredit = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceCredit).to.be.gt(0n);

      const before = await stablecoin.balanceOf(alice.address);
      await ppa.connect(alice).claimCredit(999999n); // way more than credit
      const after = await stablecoin.balanceOf(alice.address);

      // Only got actual credit worth
      expect(after - before).to.equal(BigInt(aliceCredit) * 10000n);
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(0n);
    });

    it('claim fails if contract has insufficient liquidity', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, alice, dave } = f;

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Alice has credit but no one settled yet → contract has 0 stablecoins
      expect(await ppa.getContractStablecoinBalance()).to.equal(0n);
      const aliceCredit = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceCredit).to.be.gt(0n);

      await expect(
        ppa.connect(alice).claimCredit(aliceCredit),
      ).to.be.revertedWith('Insufficient contract liquidity');
    });

    it('cannot settle if no debt', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, stablecoin, alice, dave } = f;

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Alice has positive balance — cannot settle
      await stablecoin.connect(alice).approve(ppa.target, 1_000_000n);
      await expect(
        ppa.connect(alice).settleOwnDebt(1_000_000n),
      ).to.be.revertedWith('No debt');
    });

    it('cannot claim if no credit', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, dave } = f;

      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Dave has negative balance — cannot claim
      await expect(ppa.connect(dave).claimCredit(100n)).to.be.revertedWith(
        'No credit',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  10. Ownership token transfer affects future revenue
  // ═══════════════════════════════════════════════════════════════════════

  describe('ownership token transfers', function () {
    it('transferring solar tokens changes future revenue split', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, solarToken, owner, alice, bob, charlie, dave } = f;

      // Interval 1: Dave consumes, Alice gets 40% of solar revenue
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const r1 = 1000n;
      const r1fee = (r1 * 500n) / 10000n + (r1 * 300n) / 10000n;
      const r1remaining = r1 - r1fee;
      const r1aliceShare = (r1remaining * 4000n) / 10000n;

      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        r1aliceShare,
      );

      // Alice transfers half her solar tokens to Dave (4000 → 2000 each)
      // owner is the executor, so Alice needs to transfer directly
      await solarToken.connect(alice).transfer(dave.address, 2000);

      expect(await solarToken.balanceOf(alice.address)).to.equal(2000n);
      expect(await solarToken.balanceOf(dave.address)).to.equal(2000n);

      // Interval 2: Dave consumes again, now Alice gets 20% and Dave gets 20%
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      const r2 = 1000n;
      const r2fee = (r2 * 500n) / 10000n + (r2 * 300n) / 10000n;
      const r2remaining = r2 - r2fee;
      // New ownership: Alice 2000/10000 = 20%, Bob 3500, Charlie 2500, Dave 2000
      const r2aliceShare = (r2remaining * 2000n) / 10000n;
      const r2bobShare = (r2remaining * 3500n) / 10000n;
      const r2daveShare = (r2remaining * 2000n) / 10000n;

      // Alice accumulated: r1 share + r2 share
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.equal(
        r1aliceShare + r2aliceShare,
      );

      // Dave: -2000 (two consumptions) + r2 dave share (only from second interval)
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(
        -2000n + r2daveShare,
      );

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  11. Factory deployment — verify everything wired correctly
  // ═══════════════════════════════════════════════════════════════════════

  describe('factory deployment', function () {
    it('deployCommunity creates a working community with correct token ownership', async function () {
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

      const solarId = keccak256(toUtf8Bytes('SOLAR'));
      const batId = keccak256(toUtf8Bytes('BAT'));

      const tx = await factory.deployCommunity({
        admin: owner.address,
        stablecoin: stablecoin.target,
        communityAddress: community.address,
        aggregatorAddress: aggregator.address,
        gridOperator: owner.address,
        communityFeeBps: 500,
        aggregatorFeeBps: 300,
        exportDeviceId: 9999,
        energyTokenName: 'Community Energy',
        energyTokenSymbol: 'CET',
        sources: [
          {
            sourceId: solarId,
            sourceType: 0,
            tokenName: 'Solar',
            tokenSymbol: 'SOL',
            basePricePerKwh: 10,
            holders: [alice.address, bob.address, charlie.address],
            holderAmounts: [4000, 3500, 2500],
          },
          {
            sourceId: batId,
            sourceType: 1,
            tokenName: 'Battery',
            tokenSymbol: 'BAT',
            basePricePerKwh: 15,
            holders: [alice.address, dave.address],
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
            deviceIds: [4001],
            metadataHash: ethers.ZeroHash,
          },
        ],
        // Optimization strategy: rank Lowest Price > Self-Consumption > Min CO2,
        // with a 10% variable social allocation split across two goal wallets.
        purposeRanking: [2, 0, 1],
        socialMode: 2,
        socialFixedKwh: 0,
        socialVariableBps: 1000,
        socialWallets: [community.address, aggregator.address],
        socialWalletShares: [6000, 4000],
      });

      const receipt = await tx.wait();
      const event = receipt!.logs.find((log: any) => {
        try {
          return factory.interface.parseLog(log)?.name === 'CommunityDeployed';
        } catch {
          return false;
        }
      });
      const parsed = factory.interface.parseLog(event as any);
      const proxyAddr = parsed!.args.proxy;
      const sourceTokenAddrs = parsed!.args.sourceTokens;

      const ppa = await ethers.getContractAt('EnergyPPAv2', proxyAddr);

      // Verify ownership transferred to admin
      expect(await ppa.owner()).to.equal(owner.address);

      // Verify the optimization strategy was configured during deploy
      const [optRanking, optMode, , optVariableBps, optConfigured] =
        await ppa.getOptimizationConfig();
      expect(optRanking.map((r: bigint) => Number(r))).to.deep.equal([2, 0, 1]);
      expect(Number(optMode)).to.equal(2);
      expect(Number(optVariableBps)).to.equal(1000);
      expect(optConfigured).to.equal(true);
      const optWallets = await ppa.getSocialWallets();
      expect(optWallets.length).to.equal(2);
      expect(Number(optWallets[0].shareBps)).to.equal(6000);

      // Verify source token ownership
      const RSTFactory = await ethers.getContractFactory(
        REGULAR_SPACE_TOKEN_FQN,
      );
      const solarToken = RSTFactory.attach(sourceTokenAddrs[0]);
      const batToken = RSTFactory.attach(sourceTokenAddrs[1]);

      expect(await solarToken.balanceOf(alice.address)).to.equal(4000n);
      expect(await solarToken.balanceOf(bob.address)).to.equal(3500n);
      expect(await solarToken.balanceOf(charlie.address)).to.equal(2500n);
      expect(await solarToken.totalSupply()).to.equal(10000n);

      expect(await batToken.balanceOf(alice.address)).to.equal(5000n);
      expect(await batToken.balanceOf(dave.address)).to.equal(5000n);
      expect(await batToken.totalSupply()).to.equal(10000n);

      // Verify PPA reports correct ownership bps
      expect(await ppa.getSourceOwnershipBps(solarId, alice.address)).to.equal(
        4000n,
      );
      expect(await ppa.getSourceOwnershipBps(batId, dave.address)).to.equal(
        5000n,
      );

      // Verify the community actually works — do a consumption
      await ppa.updateWhitelist(owner.address, true);
      await ppa.consumeEnergy([
        { deviceId: 4001, quantity: 100, pricePerKwh: 10, sourceId: solarId },
      ]);

      // Dave charged -1000
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.equal(-1000n);

      // Alice gets solar revenue
      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);
      expect(aliceBal).to.be.gt(0n);

      const [ok] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;

      console.log('\n  Factory-deployed community works correctly!');
      console.log(`  PPA proxy: ${proxyAddr}`);
      console.log(
        `  Solar token: ${
          sourceTokenAddrs[0]
        } (supply: ${await solarToken.totalSupply()})`,
      );
      console.log(
        `  Battery token: ${
          sourceTokenAddrs[1]
        } (supply: ${await batToken.totalSupply()})`,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  12. Emergency reset
  // ═══════════════════════════════════════════════════════════════════════

  describe('emergency reset', function () {
    it('clears all balances to zero', async function () {
      const f = await loadFixture(communityFixture);
      const {
        ppa,
        energyToken,
        community,
        aggregator,
        alice,
        bob,
        charlie,
        dave,
      } = f;

      // Create some balances
      await ppa.consumeEnergy([
        {
          deviceId: 4001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 1001,
          quantity: 50,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
      ]);

      // Verify non-zero before reset
      expect(await ppa.getEnergyCreditBalance(dave.address)).to.not.equal(0n);
      expect(await ppa.getEnergyCreditBalance(alice.address)).to.not.equal(0n);

      await ppa.emergencyReset();

      // All zeroed
      for (const addr of [alice, bob, charlie, dave]) {
        expect(await ppa.getEnergyCreditBalance(addr.address)).to.equal(0n);
        expect(await energyToken.balanceOf(addr.address)).to.equal(0n);
      }
      expect(await ppa.getEnergyCreditBalance(community.address)).to.equal(0n);
      expect(await ppa.getEnergyCreditBalance(aggregator.address)).to.equal(0n);
      expect(await ppa.getImportEnergyCreditBalance()).to.equal(0n);
      expect(await ppa.getExportEnergyCreditBalance()).to.equal(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  13. Multi-cycle simulation — full day with mixed sources, settlement,
  //      ownership transfer, and claims. Detailed logs at every step.
  // ═══════════════════════════════════════════════════════════════════════

  describe('multi-cycle simulation (5 intervals + settlements + claims)', function () {
    // Pure math helper: compute how _distributeSourceRevenue splits revenue
    function computeDistribution(
      totalRevenue: bigint,
      communityFeeBps: bigint,
      aggregatorFeeBps: bigint,
      holders: { name: string; tokens: bigint }[],
      totalSupply: bigint,
    ) {
      const communityFee = (totalRevenue * communityFeeBps) / 10000n;
      const aggregatorFee = (totalRevenue * aggregatorFeeBps) / 10000n;
      const remaining = totalRevenue - communityFee - aggregatorFee;

      let distributed = 0n;
      const shares: { name: string; share: bigint }[] = [];
      const holdersWithTokens = holders.filter((h) => h.tokens > 0n);
      const lastHolder = holdersWithTokens[holdersWithTokens.length - 1];

      for (const h of holders) {
        if (h.tokens === 0n) {
          shares.push({ name: h.name, share: 0n });
          continue;
        }
        let share: bigint;
        if (h.name === lastHolder.name) {
          share = remaining - distributed;
        } else {
          share = (remaining * h.tokens) / totalSupply;
        }
        distributed += share;
        shares.push({ name: h.name, share });
      }

      return { communityFee, aggregatorFee, remaining, shares };
    }

    function logDistribution(
      label: string,
      source: string,
      totalRevenue: bigint,
      dist: ReturnType<typeof computeDistribution>,
    ) {
      console.log(`\n    📊 ${label} — ${source} revenue: ${totalRevenue}`);
      console.log(`       Community fee (5%): ${dist.communityFee}`);
      console.log(`       Aggregator fee (3%): ${dist.aggregatorFee}`);
      console.log(`       Remaining for holders: ${dist.remaining}`);
      for (const s of dist.shares) {
        if (s.share > 0n) {
          console.log(`         ${s.name}: +${s.share}`);
        }
      }
    }

    it('5-interval day with mixed consumption, settlements, token transfer, and claims', async function () {
      const f = await loadFixture(communityFixture);
      const { ppa, energyToken, solarToken, batteryToken, stablecoin } = f;
      const { community, aggregator, alice, bob, charlie, dave } = f;

      const accounts = [
        { name: 'Alice', address: alice.address },
        { name: 'Bob', address: bob.address },
        { name: 'Charlie', address: charlie.address },
        { name: 'Dave', address: dave.address },
        { name: 'Community', address: community.address },
        { name: 'Aggregator', address: aggregator.address },
      ];

      // Track expected balances in JS to cross-check at every step
      const expected: Record<string, bigint> = {
        Alice: 0n,
        Bob: 0n,
        Charlie: 0n,
        Dave: 0n,
        Community: 0n,
        Aggregator: 0n,
        Import: 0n,
        Export: 0n,
        Settled: 0n,
      };

      // Solar: Alice 4000, Bob 3500, Charlie 2500 (total 10000)
      // Battery: Alice 5000, Dave 5000 (total 10000)
      const solarHolders = [
        { name: 'Alice', tokens: 4000n },
        { name: 'Bob', tokens: 3500n },
        { name: 'Charlie', tokens: 2500n },
        { name: 'Dave', tokens: 0n },
      ];
      const batteryHolders = [
        { name: 'Alice', tokens: 5000n },
        { name: 'Bob', tokens: 0n },
        { name: 'Charlie', tokens: 0n },
        { name: 'Dave', tokens: 5000n },
      ];

      function applyDistribution(dist: ReturnType<typeof computeDistribution>) {
        expected['Community'] += dist.communityFee;
        expected['Aggregator'] += dist.aggregatorFee;
        for (const s of dist.shares) {
          expected[s.name] += s.share;
        }
      }

      async function verifyAll(step: string) {
        for (const a of accounts) {
          const actual = await ppa.getEnergyCreditBalance(a.address);
          expect(actual).to.equal(
            expected[a.name],
            `${step}: ${a.name} energy credit mismatch`,
          );
        }
        expect(await ppa.getImportEnergyCreditBalance()).to.equal(
          expected['Import'],
          `${step}: Import balance mismatch`,
        );
        expect(await ppa.getExportEnergyCreditBalance()).to.equal(
          expected['Export'],
          `${step}: Export balance mismatch`,
        );
        expect(await ppa.getSettledBalance()).to.equal(
          expected['Settled'],
          `${step}: Settled balance mismatch`,
        );
        const [ok, drift] = await ppa.verifyZeroSum();
        expect(ok).to.be.true;
        expect(drift).to.equal(0n);
      }

      console.log(
        '\n  ════════════════════════════════════════════════════════════',
      );
      console.log(
        '  ║  MULTI-CYCLE SIMULATION: A Full Day of Energy Trading  ║',
      );
      console.log(
        '  ════════════════════════════════════════════════════════════',
      );

      console.log('\n  Initial ownership:');
      console.log(
        '    Solar:   Alice=4000(40%) Bob=3500(35%) Charlie=2500(25%)',
      );
      console.log('    Battery: Alice=5000(50%) Dave=5000(50%)');
      console.log('    Fees: Community=5% Aggregator=3%');

      // ══════════════════════════════════════════════════════════════════
      //  Interval 1: Morning — Everyone uses solar
      // ══════════════════════════════════════════════════════════════════

      console.log(
        '\n  ─── Interval 1: Morning — All members consume solar ───',
      );

      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 80,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 120,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 60,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 200,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      // Charges: Alice -800, Bob -1200, Charlie -600, Dave -2000
      expected['Alice'] -= 800n;
      expected['Bob'] -= 1200n;
      expected['Charlie'] -= 600n;
      expected['Dave'] -= 2000n;

      const solarRev1 = 800n + 1200n + 600n + 2000n; // 4600
      const dist1 = computeDistribution(
        solarRev1,
        500n,
        300n,
        solarHolders,
        10000n,
      );
      logDistribution('Interval 1', 'Solar', solarRev1, dist1);
      applyDistribution(dist1);

      console.log(
        `\n    Net charges: Alice=-800 Bob=-1200 Charlie=-600 Dave=-2000`,
      );
      console.log(
        `    Net after revenue: Alice=${expected['Alice']} Bob=${expected['Bob']} Charlie=${expected['Charlie']} Dave=${expected['Dave']}`,
      );

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('Interval 1');

      // ══════════════════════════════════════════════════════════════════
      //  Interval 2: Midday — Solar + Battery mix
      // ══════════════════════════════════════════════════════════════════

      console.log('\n  ─── Interval 2: Midday — Solar + Battery mix ───');

      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 50,
          pricePerKwh: 12,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 100,
          pricePerKwh: 12,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 80,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 150,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
      ]);

      // Charges
      expected['Alice'] -= 50n * 12n; // -600
      expected['Bob'] -= 100n * 12n; // -1200
      expected['Charlie'] -= 80n * 15n; // -1200
      expected['Dave'] -= 150n * 15n; // -2250

      // Solar revenue: 600 + 1200 = 1800
      const solarRev2 = 600n + 1200n;
      const dist2solar = computeDistribution(
        solarRev2,
        500n,
        300n,
        solarHolders,
        10000n,
      );
      logDistribution('Interval 2', 'Solar', solarRev2, dist2solar);
      applyDistribution(dist2solar);

      // Battery revenue: 1200 + 2250 = 3450
      const batRev2 = 1200n + 2250n;
      const dist2bat = computeDistribution(
        batRev2,
        500n,
        300n,
        batteryHolders,
        10000n,
      );
      logDistribution('Interval 2', 'Battery', batRev2, dist2bat);
      applyDistribution(dist2bat);

      console.log(
        `\n    Net: Alice=${expected['Alice']} Bob=${expected['Bob']} Charlie=${expected['Charlie']} Dave=${expected['Dave']}`,
      );
      console.log(
        `    Fees total: Community=${expected['Community']} Aggregator=${expected['Aggregator']}`,
      );

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('Interval 2');

      // ══════════════════════════════════════════════════════════════════
      //  Interval 3: Afternoon — Import from grid
      // ══════════════════════════════════════════════════════════════════

      console.log(
        '\n  ─── Interval 3: Afternoon — Grid import (no local revenue) ───',
      );

      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 40,
          pricePerKwh: 25,
          sourceId: IMPORT_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 60,
          pricePerKwh: 25,
          sourceId: IMPORT_SOURCE_ID,
        },
      ]);

      expected['Alice'] -= 40n * 25n; // -1000
      expected['Dave'] -= 60n * 25n; // -1500
      expected['Import'] += 1000n + 1500n; // 2500

      console.log(
        `    Alice charged -1000 (import), Dave charged -1500 (import)`,
      );
      console.log(`    Import balance: ${expected['Import']}`);
      console.log(`    No revenue to source holders for import readings`);

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('Interval 3');

      // ══════════════════════════════════════════════════════════════════
      //  Mid-day settlement: Dave pays off his debt
      // ══════════════════════════════════════════════════════════════════

      console.log('\n  ─── Settlement: Dave pays his full debt ───');

      const daveBal = await ppa.getEnergyCreditBalance(dave.address);
      console.log(`    Dave energy credit balance: ${daveBal}`);

      const daveDebt = await ppa.getDebtInStablecoin(dave.address);
      console.log(
        `    Dave debt in stablecoin: ${daveDebt} (${
          Number(daveDebt) / 1_000_000
        } USDC)`,
      );

      const daveUsdBefore = await stablecoin.balanceOf(dave.address);
      await stablecoin.connect(dave).approve(ppa.target, daveDebt);
      await ppa.connect(dave).settleOwnDebt(daveDebt);
      const daveUsdAfter = await stablecoin.balanceOf(dave.address);

      const daveInternalDebt = daveDebt / 10000n;
      expected['Dave'] += daveInternalDebt;
      expected['Settled'] -= daveInternalDebt;

      console.log(
        `    Dave paid: ${daveDebt} stablecoin (${
          daveUsdBefore - daveUsdAfter
        } transferred)`,
      );
      console.log(`    Dave energy credit now: ${expected['Dave']}`);

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('Dave settlement');

      // ══════════════════════════════════════════════════════════════════
      //  Alice claims her positive credit
      // ══════════════════════════════════════════════════════════════════

      const aliceBal = await ppa.getEnergyCreditBalance(alice.address);

      if (aliceBal > 0n) {
        console.log('\n  ─── Claim: Alice claims her credit ───');
        console.log(`    Alice energy credit: ${aliceBal}`);

        const aliceCreditStablecoin = await ppa.getCreditInStablecoin(
          alice.address,
        );
        console.log(
          `    Alice credit in stablecoin: ${aliceCreditStablecoin} (${
            Number(aliceCreditStablecoin) / 1_000_000
          } USDC)`,
        );

        const aliceUsdBefore = await stablecoin.balanceOf(alice.address);
        await ppa.connect(alice).claimCredit(aliceBal);
        const aliceUsdAfter = await stablecoin.balanceOf(alice.address);

        expected['Alice'] -= BigInt(aliceBal);
        expected['Settled'] += BigInt(aliceBal);

        console.log(
          `    Alice received: ${aliceUsdAfter - aliceUsdBefore} stablecoin`,
        );
        console.log(`    Alice energy credit now: ${expected['Alice']}`);

        await logBalanceTable(
          ppa,
          energyToken,
          solarToken,
          batteryToken,
          stablecoin,
          accounts,
        );
        await verifyAll('Alice claim');
      }

      // ══════════════════════════════════════════════════════════════════
      //  Ownership transfer: Alice sells half her solar to Dave
      // ══════════════════════════════════════════════════════════════════

      console.log(
        '\n  ─── Ownership Transfer: Alice sells 2000 solar tokens to Dave ───',
      );
      console.log(
        `    Before: Alice solar=${await solarToken.balanceOf(
          alice.address,
        )} Dave solar=${await solarToken.balanceOf(dave.address)}`,
      );

      await solarToken.connect(alice).transfer(dave.address, 2000);

      console.log(
        `    After:  Alice solar=${await solarToken.balanceOf(
          alice.address,
        )} Dave solar=${await solarToken.balanceOf(dave.address)}`,
      );
      console.log(
        `    New solar ownership: Alice=20% Bob=35% Charlie=25% Dave=20%`,
      );

      // Update holders for future calculations
      solarHolders[0].tokens = 2000n; // Alice
      solarHolders[3].tokens = 2000n; // Dave

      // ══════════════════════════════════════════════════════════════════
      //  Interval 4: Evening — Solar with new ownership split
      // ══════════════════════════════════════════════════════════════════

      console.log('\n  ─── Interval 4: Evening — Solar with new ownership ───');

      await ppa.consumeEnergy([
        {
          deviceId: 2001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 100,
          pricePerKwh: 10,
          sourceId: SOLAR_SOURCE_ID,
        },
      ]);

      expected['Bob'] -= 1000n;
      expected['Charlie'] -= 1000n;

      const solarRev4 = 2000n;
      const dist4 = computeDistribution(
        solarRev4,
        500n,
        300n,
        solarHolders,
        10000n,
      );
      logDistribution('Interval 4', 'Solar (new ownership)', solarRev4, dist4);
      applyDistribution(dist4);

      console.log(`\n    Dave now gets solar revenue share!`);
      console.log(
        `    Net: Alice=${expected['Alice']} Bob=${expected['Bob']} Charlie=${expected['Charlie']} Dave=${expected['Dave']}`,
      );

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('Interval 4');

      // ══════════════════════════════════════════════════════════════════
      //  Interval 5: Night — Battery only + some import
      // ══════════════════════════════════════════════════════════════════

      console.log('\n  ─── Interval 5: Night — Battery + Import ───');

      await ppa.consumeEnergy([
        {
          deviceId: 1001,
          quantity: 100,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
        {
          deviceId: 2001,
          quantity: 70,
          pricePerKwh: 15,
          sourceId: BATTERY_SOURCE_ID,
        },
        {
          deviceId: 3001,
          quantity: 30,
          pricePerKwh: 30,
          sourceId: IMPORT_SOURCE_ID,
        },
        {
          deviceId: 4001,
          quantity: 50,
          pricePerKwh: 30,
          sourceId: IMPORT_SOURCE_ID,
        },
      ]);

      expected['Alice'] -= 100n * 15n; // -1500
      expected['Bob'] -= 70n * 15n; // -1050
      expected['Charlie'] -= 30n * 30n; // -900
      expected['Dave'] -= 50n * 30n; // -1500
      expected['Import'] += 900n + 1500n; // +2400

      const batRev5 = 1500n + 1050n; // 2550
      const dist5bat = computeDistribution(
        batRev5,
        500n,
        300n,
        batteryHolders,
        10000n,
      );
      logDistribution('Interval 5', 'Battery', batRev5, dist5bat);
      applyDistribution(dist5bat);

      console.log(`\n    Import charges: Charlie=-900 Dave=-1500`);
      console.log(`    Import balance total: ${expected['Import']}`);

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('Interval 5');

      // ══════════════════════════════════════════════════════════════════
      //  End-of-day: Everyone with debt settles, everyone with credit claims
      // ══════════════════════════════════════════════════════════════════

      console.log('\n  ─── End of Day: Full settlement round ───');

      // Settle all debts first
      for (const member of [alice, bob, charlie, dave]) {
        const name = accounts.find((a) => a.address === member.address)!.name;
        const bal = await ppa.getEnergyCreditBalance(member.address);
        if (bal < 0n) {
          const debt = await ppa.getDebtInStablecoin(member.address);
          await stablecoin.connect(member).approve(ppa.target, debt);
          await ppa.connect(member).settleOwnDebt(debt);

          const internalDebt = debt / 10000n;
          expected[name] += internalDebt;
          expected['Settled'] -= internalDebt;

          console.log(
            `    ${name} settled debt: ${debt} stablecoin (${internalDebt} internal)`,
          );
        }
      }

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('After all settlements');

      // Now claim all credits
      console.log('\n  ─── End of Day: Credit claims ───');

      for (const member of [alice, bob, charlie, dave, community, aggregator]) {
        const name = accounts.find((a) => a.address === member.address)?.name;
        if (!name) continue;
        const bal = await ppa.getEnergyCreditBalance(member.address);
        if (bal > 0n) {
          const creditUsd = await ppa.getCreditInStablecoin(member.address);
          const contractBal = await ppa.getContractStablecoinBalance();

          if (contractBal >= creditUsd) {
            const before = await stablecoin.balanceOf(member.address);
            await ppa.connect(member).claimCredit(bal);
            const after = await stablecoin.balanceOf(member.address);

            expected[name] -= BigInt(bal);
            expected['Settled'] += BigInt(bal);

            console.log(
              `    ${name} claimed: ${
                after - before
              } stablecoin (${bal} internal)`,
            );
          } else {
            console.log(
              `    ${name} has credit=${bal} but insufficient liquidity (contract=$${contractBal})`,
            );
          }
        }
      }

      await logBalanceTable(
        ppa,
        energyToken,
        solarToken,
        batteryToken,
        stablecoin,
        accounts,
      );
      await verifyAll('After all claims');

      // ══════════════════════════════════════════════════════════════════
      //  Final summary
      // ══════════════════════════════════════════════════════════════════

      console.log(
        '\n  ════════════════════════════════════════════════════════════',
      );
      console.log(
        '  ║  FINAL SUMMARY                                         ║',
      );
      console.log(
        '  ════════════════════════════════════════════════════════════',
      );

      const contractStablecoin = await ppa.getContractStablecoinBalance();
      console.log(
        `\n    Contract stablecoin remaining: ${contractStablecoin} (${
          Number(contractStablecoin) / 1_000_000
        } USDC)`,
      );
      console.log(`    Import balance (owed to grid): ${expected['Import']}`);
      console.log(`    Settled balance: ${expected['Settled']}`);

      const memberInitialUsd = ethers.parseUnits('100000', 6);
      for (const a of accounts) {
        const finalCredit = await ppa.getEnergyCreditBalance(a.address);
        const finalUsd = await stablecoin.balanceOf(a.address);
        const isMember = ['Alice', 'Bob', 'Charlie', 'Dave'].includes(a.name);
        const initialUsd = isMember ? memberInitialUsd : 0n;
        const usdChange = finalUsd - initialUsd;
        const sign = usdChange >= 0n ? '+' : '';
        console.log(
          `    ${a.name.padEnd(11)} credit=${finalCredit
            .toString()
            .padStart(6)}  stablecoin Δ: ${sign}${
            Number(usdChange) / 1_000_000
          } USDC`,
        );
      }

      const [ok, drift] = await ppa.verifyZeroSum();
      expect(ok).to.be.true;
      expect(drift).to.equal(0n);
      console.log(`\n    Zero-sum verified ✓  (drift: ${drift})`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Optimization strategy (REC Level 1 base purposes + Level 2 social)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Optimization strategy', function () {
    // BasePurpose: SELF_CONSUMPTION=0, MIN_CO2=1, LOWEST_PRICE=2
    // SocialMode:  NONE=0, FIXED=1, VARIABLE=2

    it('owner can set the optimization config and read it back', async function () {
      const { ppa } = await loadFixture(communityFixture);

      await ppa.setOptimizationConfig([2, 0, 1], 2, 0, 1500);

      const [ranking, mode, fixedKwh, variableBps, configured] =
        await ppa.getOptimizationConfig();
      expect(ranking.map((r: bigint) => Number(r))).to.deep.equal([2, 0, 1]);
      expect(Number(mode)).to.equal(2);
      expect(fixedKwh).to.equal(0n);
      expect(Number(variableBps)).to.equal(1500);
      expect(configured).to.equal(true);
    });

    it('stores fixed-mode kWh allocation', async function () {
      const { ppa } = await loadFixture(communityFixture);
      await ppa.setOptimizationConfig([0, 1, 2], 1, 1000n, 0);
      const [, mode, fixedKwh] = await ppa.getOptimizationConfig();
      expect(Number(mode)).to.equal(1);
      expect(fixedKwh).to.equal(1000n);
    });

    it('reverts for a non-owner', async function () {
      const { ppa, alice } = await loadFixture(communityFixture);
      await expect(ppa.connect(alice).setOptimizationConfig([0, 1, 2], 0, 0, 0))
        .to.be.reverted;
    });

    it('reverts when the ranking is not distinct', async function () {
      const { ppa } = await loadFixture(communityFixture);
      await expect(
        ppa.setOptimizationConfig([0, 0, 1], 0, 0, 0),
      ).to.be.revertedWith('Ranking must be distinct');
    });

    it('reverts when variableBps exceeds 100%', async function () {
      const { ppa } = await loadFixture(communityFixture);
      await expect(
        ppa.setOptimizationConfig([0, 1, 2], 2, 0, 10001),
      ).to.be.revertedWith('variableBps > 100%');
    });

    it('sets social wallets whose shares sum to 100%', async function () {
      const { ppa, community, aggregator } = await loadFixture(
        communityFixture,
      );
      await ppa.setSocialWallets(
        [community.address, aggregator.address],
        [6000, 4000],
      );
      const wallets = await ppa.getSocialWallets();
      expect(wallets.length).to.equal(2);
      expect(wallets[0].wallet).to.equal(community.address);
      expect(Number(wallets[0].shareBps)).to.equal(6000);
      expect(Number(wallets[1].shareBps)).to.equal(4000);
    });

    it('reverts when social wallet shares do not sum to 100%', async function () {
      const { ppa, community, aggregator } = await loadFixture(
        communityFixture,
      );
      await expect(
        ppa.setSocialWallets(
          [community.address, aggregator.address],
          [6000, 3000],
        ),
      ).to.be.revertedWith('Shares must sum to 100%');
    });

    it('clears social wallets when given empty arrays', async function () {
      const { ppa, community, aggregator } = await loadFixture(
        communityFixture,
      );
      await ppa.setSocialWallets(
        [community.address, aggregator.address],
        [5000, 5000],
      );
      await ppa.setSocialWallets([], []);
      const wallets = await ppa.getSocialWallets();
      expect(wallets.length).to.equal(0);
    });

    it('reverts setSocialWallets for a non-owner', async function () {
      const { ppa, alice, community } = await loadFixture(communityFixture);
      await expect(
        ppa.connect(alice).setSocialWallets([community.address], [10000]),
      ).to.be.reverted;
    });
  });
});
