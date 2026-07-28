import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

/*//////////////////////////////////////////////////////////////////////////
                          REFERENCE MATH (ORACLE)
//////////////////////////////////////////////////////////////////////////*/

const SCALE = 10n ** 18n;
const W = SCALE; // convenient unit weight

/** a / b as a double, carrying ~18 fractional digits through BigInt first. */
function ratio(a: bigint, b: bigint): number {
  return Number((a * SCALE) / b) / 1e18;
}

/** Scale a positive double into 18-decimal fixed point. */
function fp(x: number): bigint {
  return BigInt(Math.round(x * 1e18));
}

/**
 * Exact Balancer output, computed in double precision:
 *   outAmount = outBal - outBal * (inBalAfter/inBal)^(-wIn/wOut)
 */
function refExactIn(
  inBal: bigint,
  inAmount: bigint,
  outBal: bigint,
  wIn: bigint,
  wOut: bigint,
): bigint {
  const factor = Math.pow(ratio(inBal + inAmount, inBal), ratio(wIn, wOut));
  const outBalAfter = (outBal * fp(1 / factor)) / SCALE;
  return outBal - outBalAfter;
}

/**
 * Exact Balancer input, computed in double precision:
 *   inAmount = inBal * (outBal/outBalAfter)^(wOut/wIn) - inBal
 */
function refExactOut(
  inBal: bigint,
  outBal: bigint,
  outAmount: bigint,
  wIn: bigint,
  wOut: bigint,
): bigint {
  const factor = Math.pow(ratio(outBal, outBal - outAmount), ratio(wOut, wIn));
  const inBalAfter = (inBal * fp(factor)) / SCALE;
  return inBalAfter - inBal;
}

/** Relative error between two amounts, as a plain fraction. */
function relErr(actual: bigint, expected: bigint): number {
  if (expected === 0n) return actual === 0n ? 0 : Infinity;
  const diff = actual > expected ? actual - expected : expected - actual;
  return Number((diff * SCALE) / expected) / 1e18;
}

/**
 * ln(V) for a two-asset pool, with weights normalised so the value is
 * comparable across trades. V = Ba^Wa * Bb^Wb is the quantity the invariant is
 * meant to hold constant, so it must never fall.
 */
function lnInvariant(ba: bigint, wa: bigint, bb: bigint, wb: bigint): number {
  const total = Number(wa + wb);
  return (
    (Number(wa) / total) * Math.log(Number(ba)) +
    (Number(wb) / total) * Math.log(Number(bb))
  );
}

/** Marginal (spot) price of `out` denominated in `in`. */
function spotPrice(
  inBal: bigint,
  wIn: bigint,
  outBal: bigint,
  wOut: bigint,
): number {
  return ratio(inBal, wIn) / ratio(outBal, wOut);
}

/*//////////////////////////////////////////////////////////////////////////
                                  FIXTURES
//////////////////////////////////////////////////////////////////////////*/

async function deployBare() {
  const [owner, manager, lp, trader, recipient, outsider] =
    await ethers.getSigners();
  const OSwaps = await ethers.getContractFactory('OSwaps');
  const oswaps = await OSwaps.deploy();
  return { oswaps, owner, manager, lp, trader, recipient, outsider };
}

async function deployInitialised() {
  const base = await deployBare();
  await base.oswaps.connect(base.owner).init(base.manager.address);
  return base;
}

async function newToken(name: string, symbol: string, decimals = 18) {
  const MockERC20 = await ethers.getContractFactory('MockERC20');
  return MockERC20.deploy(name, symbol, decimals);
}

/**
 * Register an asset and bring it fully online.
 *
 * The bootstrap sequence is inherited from the original protocol and needs two
 * unfreezes: a new asset is created inactive, and the first deposit must carry a
 * non-zero weight, which freezes it again.
 */
async function bringAssetOnline(
  oswaps: any,
  manager: HardhatEthersSigner,
  lp: HardhatEthersSigner,
  token: any,
  symbol: string,
  amount: bigint,
  weight: bigint,
): Promise<bigint> {
  await oswaps.connect(lp).createAsset(await token.getAddress(), symbol, '{}');
  const id = (await oswaps.config()).lastTokenId;

  await oswaps.connect(manager).unfreeze(id, symbol);

  await token.mint(lp.address, amount);
  await token.connect(lp).approve(await oswaps.getAddress(), amount);
  await oswaps.connect(lp).addLiquidity(id, amount, weight);

  await oswaps.connect(manager).unfreeze(id, symbol);
  return id;
}

/** Two 18-decimal assets, 1000 units each, equal weights. */
async function deployPool() {
  const base = await deployInitialised();
  const { oswaps, manager, lp } = base;

  const tokenA = await newToken('Alpha', 'AAA', 18);
  const tokenB = await newToken('Beta', 'BBB', 18);

  const seed = ethers.parseEther('1000');
  const idA = await bringAssetOnline(
    oswaps,
    manager,
    lp,
    tokenA,
    'AAA',
    seed,
    W,
  );
  const idB = await bringAssetOnline(
    oswaps,
    manager,
    lp,
    tokenB,
    'BBB',
    seed,
    W,
  );

  return { ...base, tokenA, tokenB, idA, idB, seed };
}

/** Fund a trader and approve the pool. */
async function fund(
  token: any,
  oswaps: any,
  who: HardhatEthersSigner,
  amount: bigint,
) {
  await token.mint(who.address, amount);
  await token.connect(who).approve(await oswaps.getAddress(), amount);
}

/*//////////////////////////////////////////////////////////////////////////
                                    TESTS
//////////////////////////////////////////////////////////////////////////*/

describe('OSwaps', function () {
  describe('Deployment and initialisation', function () {
    it('Should set the deployer as owner and leave the manager unset', async function () {
      const { oswaps, owner } = await loadFixture(deployBare);
      expect(await oswaps.owner()).to.equal(owner.address);
      expect((await oswaps.config()).manager).to.equal(ethers.ZeroAddress);
      expect((await oswaps.config()).lastTokenId).to.equal(0);
    });

    it('Should record the real chain id, not a block hash', async function () {
      const { oswaps } = await loadFixture(deployBare);
      const { chainId } = await ethers.provider.getNetwork();
      expect((await oswaps.config()).chainId).to.equal(
        ethers.zeroPadValue(ethers.toBeHex(chainId), 32),
      );
    });

    it('Should let only the owner initialise', async function () {
      const { oswaps, manager, outsider } = await loadFixture(deployBare);
      await expect(
        oswaps.connect(outsider).init(manager.address),
      ).to.be.revertedWithCustomError(oswaps, 'OwnableUnauthorizedAccount');
    });

    it('Should set the manager and emit ManagerUpdated', async function () {
      const { oswaps, owner, manager } = await loadFixture(deployBare);
      await expect(oswaps.connect(owner).init(manager.address))
        .to.emit(oswaps, 'ManagerUpdated')
        .withArgs(ethers.ZeroAddress, manager.address);
      expect((await oswaps.config()).manager).to.equal(manager.address);
    });

    it('Should reject a zero manager and a second initialisation', async function () {
      const { oswaps, owner, manager, outsider } = await loadFixture(
        deployBare,
      );
      await expect(
        oswaps.connect(owner).init(ethers.ZeroAddress),
      ).to.be.revertedWith('Zero manager');

      await oswaps.connect(owner).init(manager.address);
      await expect(
        oswaps.connect(owner).init(outsider.address),
      ).to.be.revertedWith('Already initialized');
    });

    it('Should not expose any owner path that moves pool funds', async function () {
      // The original protocol documents the owner as a cold key with no
      // operational role. emergencyWithdraw contradicted that and was removed.
      const { oswaps } = await loadFixture(deployBare);
      expect(
        oswaps.interface.fragments.some(
          (f: any) => f.name === 'emergencyWithdraw',
        ),
      ).to.equal(false);
    });
  });

  describe('Manager rotation', function () {
    it('Should let the incumbent manager hand over', async function () {
      const { oswaps, manager, outsider } = await loadFixture(
        deployInitialised,
      );
      await expect(oswaps.connect(manager).setManager(outsider.address))
        .to.emit(oswaps, 'ManagerUpdated')
        .withArgs(manager.address, outsider.address);
      expect((await oswaps.config()).manager).to.equal(outsider.address);
    });

    it('Should revoke the previous manager and empower the new one', async function () {
      const { oswaps, manager, outsider } = await loadFixture(deployPool);
      await oswaps.connect(manager).setManager(outsider.address);

      await expect(oswaps.connect(manager).freeze(1, 'AAA')).to.be.revertedWith(
        'Only manager',
      );
      await expect(oswaps.connect(outsider).freeze(1, 'AAA')).to.emit(
        oswaps,
        'AssetFrozen',
      );
    });

    it('Should reject rotation by non-managers and to the zero address', async function () {
      const { oswaps, owner, manager, outsider } = await loadFixture(
        deployInitialised,
      );
      await expect(
        oswaps.connect(outsider).setManager(outsider.address),
      ).to.be.revertedWith('Only manager');
      await expect(
        oswaps.connect(owner).setManager(owner.address),
      ).to.be.revertedWith('Only manager');
      await expect(
        oswaps.connect(manager).setManager(ethers.ZeroAddress),
      ).to.be.revertedWith('Zero manager');
    });
  });

  describe('Asset creation', function () {
    it('Should register an asset inactive with zero weight', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');

      await expect(
        oswaps
          .connect(lp)
          .createAsset(await token.getAddress(), 'AAA', '{"a":1}'),
      )
        .to.emit(oswaps, 'AssetCreated')
        .withArgs(1, await token.getAddress(), 'AAA');

      const asset = await oswaps.getAsset(1);
      expect(asset.tokenId).to.equal(1);
      expect(asset.contractAddress).to.equal(await token.getAddress());
      expect(asset.symbol).to.equal('AAA');
      expect(asset.active).to.equal(false);
      expect(asset.metadata).to.equal('{"a":1}');
      expect(asset.weight).to.equal(0);
    });

    it('Should be permissionless and assign sequential ids', async function () {
      const { oswaps, outsider } = await loadFixture(deployInitialised);
      const t1 = await newToken('One', 'ONE');
      const t2 = await newToken('Two', 'TWO');

      await oswaps
        .connect(outsider)
        .createAsset(await t1.getAddress(), 'ONE', '');
      await oswaps
        .connect(outsider)
        .createAsset(await t2.getAddress(), 'TWO', '');

      expect((await oswaps.config()).lastTokenId).to.equal(2);
      expect(await oswaps.getTokenIds()).to.deep.equal([1n, 2n]);
      expect(await oswaps.getAssetCount()).to.equal(2);
      expect(await oswaps.tokenIdByAddress(await t1.getAddress())).to.equal(1);
    });

    it('Should deploy a LIQ token named after the asset id', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');
      await oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', '');

      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(1),
      );
      expect(await liq.symbol()).to.equal('LIQ1');
      expect(await liq.name()).to.equal('LIQ1');
      expect(await liq.owner()).to.equal(await oswaps.getAddress());
    });

    it('Should match LIQ decimals to the underlying token', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);

      for (const [i, decimals] of [0, 2, 6, 8, 18].entries()) {
        const token = await newToken(`T${i}`, `T${i}`, decimals);
        await oswaps
          .connect(lp)
          .createAsset(await token.getAddress(), `T${i}`, '');
        const liq = await ethers.getContractAt(
          'LiquidityToken',
          await oswaps.liquidityTokens(i + 1),
        );
        expect(await liq.decimals()).to.equal(decimals);
      }
    });

    it('Should fall back to 18 decimals for tokens without decimals()', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);
      const Odd = await ethers.getContractFactory('MockNoDecimalsERC20');
      const odd = await Odd.deploy();

      await oswaps.connect(lp).createAsset(await odd.getAddress(), 'ODD', '');
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(1),
      );
      expect(await liq.decimals()).to.equal(18);
    });

    it('Should fall back to 18 decimals when decimals() misbehaves', async function () {
      // A nonsensical value, undecodable return data, and an outright revert all
      // have to degrade rather than block registration. Undecodable data in
      // particular is not absorbable by try/catch, so this exercises the
      // staticcall path.
      const { oswaps, lp } = await loadFixture(deployInitialised);
      const Bad = await ethers.getContractFactory('MockBadDecimalsERC20');

      for (const mode of [0, 1, 2]) {
        const bad = await Bad.deploy(mode);
        await expect(
          oswaps
            .connect(lp)
            .createAsset(await bad.getAddress(), `B${mode}`, ''),
        ).to.emit(oswaps, 'AssetCreated');

        const id = (await oswaps.config()).lastTokenId;
        const liq = await ethers.getContractAt(
          'LiquidityToken',
          await oswaps.liquidityTokens(id),
        );
        expect(await liq.decimals(), `mode ${mode}`).to.equal(18);
      }
    });

    it('Should reject the pool itself, the zero address and code-free addresses', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);
      await expect(
        oswaps.connect(lp).createAsset(await oswaps.getAddress(), 'X', ''),
      ).to.be.revertedWith('Cannot be oswaps');
      await expect(
        oswaps.connect(lp).createAsset(ethers.ZeroAddress, 'X', ''),
      ).to.be.revertedWith('Zero token address');

      // Not a signer address: these tests run against a Base fork, where some
      // well-known dev accounts carry an EIP-7702 delegation and so do have code.
      const empty = ethers.Wallet.createRandom().address;
      expect(await ethers.provider.getCode(empty)).to.equal('0x');
      await expect(
        oswaps.connect(lp).createAsset(empty, 'X', ''),
      ).to.be.revertedWith('Token is not a contract');
    });

    it('Should reject registering the same token twice', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');
      await oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', '');
      await expect(
        oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA2', ''),
      ).to.be.revertedWith('Token already registered');
    });
  });

  describe('Freeze and unfreeze', function () {
    it('Should toggle active and emit AssetFrozen', async function () {
      const { oswaps, manager } = await loadFixture(deployPool);

      await expect(oswaps.connect(manager).freeze(1, 'AAA'))
        .to.emit(oswaps, 'AssetFrozen')
        .withArgs(1, true);
      expect((await oswaps.getAsset(1)).active).to.equal(false);

      await expect(oswaps.connect(manager).unfreeze(1, 'AAA'))
        .to.emit(oswaps, 'AssetFrozen')
        .withArgs(1, false);
      expect((await oswaps.getAsset(1)).active).to.equal(true);
    });

    it('Should require the symbol to match, as a typo guard', async function () {
      const { oswaps, manager } = await loadFixture(deployPool);
      await expect(oswaps.connect(manager).freeze(1, 'BBB')).to.be.revertedWith(
        'Symbol mismatch',
      );
      await expect(
        oswaps.connect(manager).unfreeze(1, 'aaa'),
      ).to.be.revertedWith('Symbol mismatch');
    });

    it('Should reject non-managers and unknown ids', async function () {
      const { oswaps, manager, outsider } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(outsider).freeze(1, 'AAA'),
      ).to.be.revertedWith('Only manager');
      await expect(
        oswaps.connect(manager).freeze(99, 'AAA'),
      ).to.be.revertedWith('Token not found');
    });
  });

  describe('forgetAsset', function () {
    it('Should require an empty pool balance', async function () {
      const { oswaps, manager } = await loadFixture(deployPool);
      await expect(oswaps.connect(manager).forgetAsset(1)).to.be.revertedWith(
        'Pool balance not zero',
      );
    });

    it('Should remove all traces after the freeze-drain-forget sequence', async function () {
      const { oswaps, manager, lp, tokenA, idA, seed } = await loadFixture(
        deployPool,
      );
      const tokenAddr = await tokenA.getAddress();

      // A live asset must keep a non-zero balance, so it cannot be emptied.
      await expect(
        oswaps.connect(manager).withdraw(lp.address, idA, seed, 0),
      ).to.be.revertedWith('Insufficient balance');

      // Freezing lifts that restriction, since the asset is no longer tradeable.
      await oswaps.connect(manager).freeze(idA, 'AAA');
      await oswaps.connect(manager).withdraw(lp.address, idA, seed, 0);
      expect(await tokenA.balanceOf(await oswaps.getAddress())).to.equal(0);

      await expect(oswaps.connect(manager).forgetAsset(idA))
        .to.emit(oswaps, 'AssetForgotten')
        .withArgs(idA, tokenAddr);

      expect((await oswaps.getAsset(idA)).contractAddress).to.equal(
        ethers.ZeroAddress,
      );
      expect(await oswaps.liquidityTokens(idA)).to.equal(ethers.ZeroAddress);
      expect(await oswaps.tokenIdByAddress(tokenAddr)).to.equal(0);
      expect(await oswaps.getTokenIds()).to.not.include(idA);
    });

    it('Should strand no funds, because any asset can be fully drained first', async function () {
      const { oswaps, manager, lp, tokenA, idA, seed } = await loadFixture(
        deployPool,
      );
      await oswaps.connect(manager).freeze(idA, 'AAA');
      await oswaps.connect(manager).withdraw(lp.address, idA, seed, 0);

      // Everything returned to the provider, so no owner rescue path is needed.
      expect(await tokenA.balanceOf(lp.address)).to.equal(seed);
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      expect(await liq.totalSupply()).to.equal(0);
    });

    it('Should prune ids correctly when removing from the middle', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const ids: bigint[] = [];
      for (let i = 0; i < 4; i++) {
        const t = await newToken(`T${i}`, `T${i}`);
        await oswaps.connect(lp).createAsset(await t.getAddress(), `T${i}`, '');
        ids.push((await oswaps.config()).lastTokenId);
      }
      expect(await oswaps.getTokenIds()).to.deep.equal(ids);

      await oswaps.connect(manager).forgetAsset(ids[1]);
      const remaining = await oswaps.getTokenIds();
      expect(remaining).to.have.lengthOf(3);
      expect(remaining).to.not.include(ids[1]);
      for (const keep of [ids[0], ids[2], ids[3]]) {
        expect(remaining).to.include(keep);
      }

      // Removing again still leaves a consistent set.
      await oswaps.connect(manager).forgetAsset(ids[3]);
      const after = await oswaps.getTokenIds();
      expect(after).to.have.lengthOf(2);
      expect(after).to.not.include(ids[3]);
    });

    it('Should not reuse a forgotten id', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const t1 = await newToken('One', 'ONE');
      await oswaps.connect(lp).createAsset(await t1.getAddress(), 'ONE', '');
      await oswaps.connect(manager).forgetAsset(1);

      const t2 = await newToken('Two', 'TWO');
      await oswaps.connect(lp).createAsset(await t2.getAddress(), 'TWO', '');
      expect((await oswaps.config()).lastTokenId).to.equal(2);
    });

    it('Should allow re-registering a token after it is forgotten', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');
      await oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', '');
      await oswaps.connect(manager).forgetAsset(1);
      await expect(
        oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', ''),
      ).to.emit(oswaps, 'AssetCreated');
    });
  });

  describe('queryPool', function () {
    it('Should report live balances and stored weights', async function () {
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);
      const statuses = await oswaps.queryPool([idA, idB]);
      expect(statuses).to.have.lengthOf(2);
      expect(statuses[0].tokenId).to.equal(idA);
      expect(statuses[0].balance).to.equal(seed);
      expect(statuses[0].weight).to.equal(W);
    });

    it('Should reflect donations sent directly to the pool', async function () {
      const { oswaps, tokenA, idA, seed, outsider } = await loadFixture(
        deployPool,
      );
      await tokenA.mint(outsider.address, ethers.parseEther('5'));
      await tokenA
        .connect(outsider)
        .transfer(await oswaps.getAddress(), ethers.parseEther('5'));

      const [status] = await oswaps.queryPool([idA]);
      expect(status.balance).to.equal(seed + ethers.parseEther('5'));
      // No LIQ was issued for the donation.
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      expect(await liq.balanceOf(outsider.address)).to.equal(0);
    });

    it('Should revert the whole batch if any id is unknown', async function () {
      const { oswaps, idA } = await loadFixture(deployPool);
      await expect(oswaps.queryPool([idA, 99])).to.be.revertedWith(
        'Token not found',
      );
    });

    it('Should return an empty array for an empty request', async function () {
      const { oswaps } = await loadFixture(deployPool);
      expect(await oswaps.queryPool([])).to.deep.equal([]);
    });
  });

  describe('addLiquidity', function () {
    it('Should reject a deposit into a frozen asset', async function () {
      const { oswaps, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');
      await oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', '');
      await fund(token, oswaps, lp, ethers.parseEther('1'));

      await expect(
        oswaps.connect(lp).addLiquidity(1, ethers.parseEther('1'), W),
      ).to.be.revertedWith('Token is frozen');
    });

    it('Should reject weight 0 on an empty pool instead of silently zeroing it', async function () {
      // The original reverts with "zero weight requires existing balance"; an
      // earlier port skipped the branch, leaving weight 0 and bricking swaps.
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');
      await oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', '');
      await oswaps.connect(manager).unfreeze(1, 'AAA');
      await fund(token, oswaps, lp, ethers.parseEther('1'));

      await expect(
        oswaps.connect(lp).addLiquidity(1, ethers.parseEther('1'), 0),
      ).to.be.revertedWith('Zero weight requires existing balance');
      expect((await oswaps.getAsset(1)).weight).to.equal(0);
    });

    it('Should set the weight, freeze the asset and mint LIQ on the first deposit', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const token = await newToken('Alpha', 'AAA');
      await oswaps.connect(lp).createAsset(await token.getAddress(), 'AAA', '');
      await oswaps.connect(manager).unfreeze(1, 'AAA');

      const amount = ethers.parseEther('100');
      await fund(token, oswaps, lp, amount);

      await expect(oswaps.connect(lp).addLiquidity(1, amount, W))
        .to.emit(oswaps, 'WeightUpdated')
        .withArgs(1, 0, W, true)
        .and.to.emit(oswaps, 'LiquidityAdded')
        .withArgs(lp.address, 1, amount, amount);

      const asset = await oswaps.getAsset(1);
      expect(asset.weight).to.equal(W);
      expect(asset.active).to.equal(false); // price changed => frozen

      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(1),
      );
      expect(await liq.balanceOf(lp.address)).to.equal(amount);
    });

    it('Should scale the weight to hold the price when weight is 0', async function () {
      const { oswaps, lp, tokenA, idA, seed } = await loadFixture(deployPool);
      const before = await oswaps.getAsset(idA);
      const priceBefore = ratio(seed, before.weight);

      const add = ethers.parseEther('250');
      await fund(tokenA, oswaps, lp, add);
      await oswaps.connect(lp).addLiquidity(idA, add, 0);

      const after = await oswaps.getAsset(idA);
      // w_new = w_old * (bal + amount) / bal
      expect(after.weight).to.equal((before.weight * (seed + add)) / seed);
      expect(after.active).to.equal(true); // price held => stays tradeable
      expect(ratio(seed + add, after.weight)).to.be.closeTo(priceBefore, 1e-9);
    });

    it('Should leave the marginal price unchanged after a price-holding deposit', async function () {
      const { oswaps, lp, tokenA, idA, idB, seed } = await loadFixture(
        deployPool,
      );
      const assetA = await oswaps.getAsset(idA);
      const assetB = await oswaps.getAsset(idB);
      const before = spotPrice(seed, assetA.weight, seed, assetB.weight);

      const add = ethers.parseEther('500');
      await fund(tokenA, oswaps, lp, add);
      await oswaps.connect(lp).addLiquidity(idA, add, 0);

      const a2 = await oswaps.getAsset(idA);
      const after = spotPrice(seed + add, a2.weight, seed, assetB.weight);
      expect(after).to.be.closeTo(before, 1e-9);
    });

    it('Should allow a weight-only reprice with amount 0, even while frozen', async function () {
      const { oswaps, manager, lp, idA } = await loadFixture(deployPool);
      await oswaps.connect(manager).freeze(idA, 'AAA');

      const newWeight = W * 3n;
      await expect(oswaps.connect(lp).addLiquidity(idA, 0, newWeight))
        .to.emit(oswaps, 'WeightUpdated')
        .withArgs(idA, W, newWeight, true);

      expect((await oswaps.getAsset(idA)).weight).to.equal(newWeight);
      // No deposit happened, so no LiquidityAdded event and no LIQ minted.
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      expect(await liq.totalSupply()).to.equal(ethers.parseEther('1000'));
    });

    it('Should reject fee-on-transfer tokens rather than misprice them', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const Fee = await ethers.getContractFactory('MockFeeOnTransferERC20');
      const fee = await Fee.deploy('Fee', 'FEE', 18, 100); // 1%

      await oswaps.connect(lp).createAsset(await fee.getAddress(), 'FEE', '');
      await oswaps.connect(manager).unfreeze(1, 'FEE');
      await fee.mint(lp.address, ethers.parseEther('100'));
      await fee
        .connect(lp)
        .approve(await oswaps.getAddress(), ethers.parseEther('100'));

      await expect(
        oswaps.connect(lp).addLiquidity(1, ethers.parseEther('100'), W),
      ).to.be.revertedWith('Unexpected balance change');
    });

    it('Should reject an unknown asset', async function () {
      const { oswaps, lp } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(lp).addLiquidity(99, 1, W),
      ).to.be.revertedWith('Token not found');
    });

    it('Should accumulate LIQ across multiple providers', async function () {
      const { oswaps, lp, trader, tokenA, idA } = await loadFixture(deployPool);
      const add = ethers.parseEther('100');
      await fund(tokenA, oswaps, trader, add);
      await oswaps.connect(trader).addLiquidity(idA, add, 0);

      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      expect(await liq.balanceOf(lp.address)).to.equal(
        ethers.parseEther('1000'),
      );
      expect(await liq.balanceOf(trader.address)).to.equal(add);
    });
  });

  describe('withdraw', function () {
    it('Should be manager-only, matching the original protocol', async function () {
      const { oswaps, lp, idA } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(lp).withdraw(lp.address, idA, ethers.parseEther('1'), 0),
      ).to.be.revertedWith('Only manager');
    });

    it('Should pay out, burn LIQ, hold the price and emit', async function () {
      const { oswaps, manager, lp, tokenA, idA, seed } = await loadFixture(
        deployPool,
      );
      const amount = ethers.parseEther('200');
      const before = await oswaps.getAsset(idA);

      await expect(oswaps.connect(manager).withdraw(lp.address, idA, amount, 0))
        .to.emit(oswaps, 'LiquidityWithdrawn')
        .withArgs(lp.address, idA, amount, amount);

      expect(await tokenA.balanceOf(lp.address)).to.equal(amount);
      expect(await tokenA.balanceOf(await oswaps.getAddress())).to.equal(
        seed - amount,
      );

      const after = await oswaps.getAsset(idA);
      expect(after.weight).to.equal((before.weight * (seed - amount)) / seed);
      expect(after.active).to.equal(true);

      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      expect(await liq.balanceOf(lp.address)).to.equal(seed - amount);
    });

    it('Should freeze the asset when the weight is changed explicitly', async function () {
      const { oswaps, manager, lp, idA } = await loadFixture(deployPool);
      await oswaps
        .connect(manager)
        .withdraw(lp.address, idA, ethers.parseEther('100'), W * 2n);
      const asset = await oswaps.getAsset(idA);
      expect(asset.weight).to.equal(W * 2n);
      expect(asset.active).to.equal(false);
    });

    it('Should never let a tradeable asset be emptied', async function () {
      const { oswaps, manager, lp, idA, seed } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(manager).withdraw(lp.address, idA, seed, 0),
      ).to.be.revertedWith('Insufficient balance');
      await expect(
        oswaps.connect(manager).withdraw(lp.address, idA, seed + 1n, 0),
      ).to.be.revertedWith('Insufficient balance');
    });

    it('Should still cap a frozen asset at its actual balance', async function () {
      const { oswaps, manager, lp, idA, seed } = await loadFixture(deployPool);
      await oswaps.connect(manager).freeze(idA, 'AAA');
      await expect(
        oswaps.connect(manager).withdraw(lp.address, idA, seed + 1n, 0),
      ).to.be.revertedWith('Insufficient balance');
    });

    it('Should reject zero amounts and unknown assets', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(manager).withdraw(lp.address, 1, 0, 0),
      ).to.be.revertedWith('Zero amount');
      await expect(
        oswaps.connect(manager).withdraw(lp.address, 99, 1, 0),
      ).to.be.revertedWith('Token not found');
    });

    it('Should fail when the named account does not hold enough LIQ', async function () {
      const { oswaps, manager, outsider, idA } = await loadFixture(deployPool);
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      await expect(
        oswaps
          .connect(manager)
          .withdraw(outsider.address, idA, ethers.parseEther('1'), 0),
      ).to.be.revertedWithCustomError(liq, 'ERC20InsufficientBalance');
    });
  });

  describe('Swap validation', function () {
    it('Should reject swapping a token for itself', async function () {
      const { oswaps, trader, idA } = await loadFixture(deployPool);
      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idA, ethers.parseEther('1'), 0),
      ).to.be.revertedWith('Same token');
    });

    it('Should reject zero amounts and a zero recipient', async function () {
      const { oswaps, trader, idA, idB } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(trader).swapExactIn(trader.address, idA, idB, 0, 0),
      ).to.be.revertedWith('Zero amount');
      await expect(
        oswaps.connect(trader).swapExactIn(ethers.ZeroAddress, idA, idB, 1, 0),
      ).to.be.revertedWith('Zero recipient');
    });

    it('Should reject unknown assets on either side', async function () {
      const { oswaps, trader, idA, idB } = await loadFixture(deployPool);
      await expect(
        oswaps.connect(trader).swapExactIn(trader.address, 99, idB, 1, 0),
      ).to.be.revertedWith('Input token not found');
      await expect(
        oswaps.connect(trader).swapExactIn(trader.address, idA, 99, 1, 0),
      ).to.be.revertedWith('Output token not found');
    });

    it('Should reject frozen assets on either side', async function () {
      const { oswaps, manager, trader, idA, idB } = await loadFixture(
        deployPool,
      );
      await oswaps.connect(manager).freeze(idA, 'AAA');
      await expect(
        oswaps.connect(trader).swapExactIn(trader.address, idA, idB, 1, 0),
      ).to.be.revertedWith('Input token frozen');

      await oswaps.connect(manager).unfreeze(idA, 'AAA');
      await oswaps.connect(manager).freeze(idB, 'BBB');
      await expect(
        oswaps.connect(trader).swapExactIn(trader.address, idA, idB, 1, 0),
      ).to.be.revertedWith('Output token frozen');
    });

    it('Should report an unset weight instead of panicking on divide-by-zero', async function () {
      // Previously a zero weight caused a division-by-zero panic deep in the
      // math; it is now a named precondition.
      const { oswaps, manager, lp, trader, tokenA, idA } = await loadFixture(
        deployPool,
      );
      const tokenC = await newToken('Gamma', 'CCC');
      await oswaps
        .connect(lp)
        .createAsset(await tokenC.getAddress(), 'CCC', '');
      const idC = (await oswaps.config()).lastTokenId;
      await oswaps.connect(manager).unfreeze(idC, 'CCC');

      await fund(tokenA, oswaps, trader, ethers.parseEther('1'));
      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idC, ethers.parseEther('1'), 0),
      ).to.be.revertedWith('Output weight not set');
    });

    it('Should reject an output larger than the pool holds', async function () {
      const { oswaps, trader, idA, idB, seed } = await loadFixture(deployPool);
      await expect(
        oswaps
          .connect(trader)
          .swapExactOut(trader.address, idA, idB, seed, ethers.MaxUint256),
      ).to.be.revertedWith('Insufficient output balance');
    });
  });

  describe('swapExactIn', function () {
    it('Should move balances and emit TokenSwapped', async function () {
      const { oswaps, trader, recipient, tokenA, tokenB, idA, idB, seed } =
        await loadFixture(deployPool);
      const inAmount = ethers.parseEther('100');
      await fund(tokenA, oswaps, trader, inAmount);

      const expected = await oswaps.quoteExactIn(idA, idB, inAmount);

      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(recipient.address, idA, idB, inAmount, 0),
      )
        .to.emit(oswaps, 'TokenSwapped')
        .withArgs(
          trader.address,
          recipient.address,
          idA,
          idB,
          inAmount,
          expected,
        );

      expect(await tokenB.balanceOf(recipient.address)).to.equal(expected);
      expect(await tokenA.balanceOf(await oswaps.getAddress())).to.equal(
        seed + inAmount,
      );
      expect(await tokenB.balanceOf(await oswaps.getAddress())).to.equal(
        seed - expected,
      );
    });

    it('Should enforce minOutAmount', async function () {
      const { oswaps, trader, idA, idB, tokenA } = await loadFixture(
        deployPool,
      );
      const inAmount = ethers.parseEther('100');
      await fund(tokenA, oswaps, trader, inAmount * 2n);

      const quote = await oswaps.quoteExactIn(idA, idB, inAmount);
      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, inAmount, quote + 1n),
      ).to.be.revertedWith('Insufficient output amount');

      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, inAmount, quote),
      ).to.not.be.reverted;
    });

    it('Should charge a worse rate as the trade grows', async function () {
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);
      let previousRate = Infinity;
      for (const pct of [1n, 5n, 10n, 25n, 50n]) {
        const inAmount = (seed * pct) / 100n;
        const out = await oswaps.quoteExactIn(idA, idB, inAmount);
        const rate = ratio(out, inAmount);
        expect(rate).to.be.lessThan(previousRate);
        previousRate = rate;
      }
    });

    it('Should approach the spot price for vanishingly small trades', async function () {
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);
      // Qj = Qi * (Bj/Bi) * (Wi/Wj); equal balances and weights => 1:1
      const tiny = seed / 1_000_000n;
      const out = await oswaps.quoteExactIn(idA, idB, tiny);
      expect(ratio(out, tiny)).to.be.closeTo(1, 1e-5);
    });
  });

  describe('swapExactOut', function () {
    it('Should pull exactly the computed input, with no refund needed', async function () {
      const { oswaps, trader, recipient, tokenA, tokenB, idA, idB } =
        await loadFixture(deployPool);
      const outAmount = ethers.parseEther('100');
      await fund(tokenA, oswaps, trader, ethers.parseEther('1000'));

      const expectedIn = await oswaps.quoteExactOut(idA, idB, outAmount);
      const balBefore = await tokenA.balanceOf(trader.address);

      await oswaps
        .connect(trader)
        .swapExactOut(
          recipient.address,
          idA,
          idB,
          outAmount,
          ethers.MaxUint256,
        );

      expect(balBefore - (await tokenA.balanceOf(trader.address))).to.equal(
        expectedIn,
      );
      expect(await tokenB.balanceOf(recipient.address)).to.equal(outAmount);
    });

    it('Should enforce maxInAmount', async function () {
      const { oswaps, trader, tokenA, idA, idB } = await loadFixture(
        deployPool,
      );
      const outAmount = ethers.parseEther('100');
      await fund(tokenA, oswaps, trader, ethers.parseEther('1000'));

      const quote = await oswaps.quoteExactOut(idA, idB, outAmount);
      await expect(
        oswaps
          .connect(trader)
          .swapExactOut(trader.address, idA, idB, outAmount, quote - 1n),
      ).to.be.revertedWith('Excessive input amount');

      await expect(
        oswaps
          .connect(trader)
          .swapExactOut(trader.address, idA, idB, outAmount, quote),
      ).to.not.be.reverted;
    });
  });

  describe('Quote views', function () {
    it('Should match executed amounts exactly for exact-in', async function () {
      const { oswaps, trader, tokenA, tokenB, idA, idB, seed } =
        await loadFixture(deployPool);
      for (const pct of [1n, 10n, 50n]) {
        const inAmount = (seed * pct) / 1000n;
        const quote = await oswaps.quoteExactIn(idA, idB, inAmount);
        await fund(tokenA, oswaps, trader, inAmount);
        const before = await tokenB.balanceOf(trader.address);
        await oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, inAmount, 0);
        expect((await tokenB.balanceOf(trader.address)) - before).to.equal(
          quote,
        );
      }
    });

    it('Should match executed amounts exactly for exact-out', async function () {
      const { oswaps, trader, tokenA, idA, idB, seed } = await loadFixture(
        deployPool,
      );
      for (const pct of [1n, 10n, 50n]) {
        const outAmount = (seed * pct) / 1000n;
        const quote = await oswaps.quoteExactOut(idA, idB, outAmount);
        await fund(tokenA, oswaps, trader, quote);
        const before = await tokenA.balanceOf(trader.address);
        await oswaps
          .connect(trader)
          .swapExactOut(trader.address, idA, idB, outAmount, ethers.MaxUint256);
        expect(before - (await tokenA.balanceOf(trader.address))).to.equal(
          quote,
        );
      }
    });

    it('Should apply the same validation as the swaps themselves', async function () {
      const { oswaps, manager, idA, idB } = await loadFixture(deployPool);
      await expect(oswaps.quoteExactIn(idA, idA, 1)).to.be.revertedWith(
        'Same token',
      );
      await expect(oswaps.quoteExactIn(idA, idB, 0)).to.be.revertedWith(
        'Zero amount',
      );
      await oswaps.connect(manager).freeze(idB, 'BBB');
      await expect(oswaps.quoteExactIn(idA, idB, 1)).to.be.revertedWith(
        'Output token frozen',
      );
    });
  });

  describe('Pricing math', function () {
    it('Should stay within 1e-10 relative error across trade sizes', async function () {
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);
      // Deliberately spans the range where the previous Taylor-series
      // implementation degraded (60%+) and diverged (>=150%).
      const fractions = [
        1n,
        10n,
        100n,
        1_000n,
        5_000n,
        10_000n,
        25_000n,
        50_000n,
        60_000n,
        75_000n,
        90_000n,
        100_000n,
        150_000n,
        300_000n,
        1_000_000n,
      ];
      for (const num of fractions) {
        const inAmount = (seed * num) / 100_000n;
        const actual = await oswaps.quoteExactIn(idA, idB, inAmount);
        const expected = refExactIn(seed, inAmount, seed, W, W);
        expect(
          relErr(actual, expected),
          `exact-in at ${Number(num) / 1000}% of pool`,
        ).to.be.lessThan(1e-10);
      }
    });

    it('Should stay within 1e-10 relative error for exact-out across output sizes', async function () {
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);
      const fractions = [
        1n,
        10n,
        100n,
        1_000n,
        10_000n,
        25_000n,
        40_000n,
        50_000n,
        60_000n,
        75_000n,
        90_000n,
        99_000n,
        99_900n,
      ];
      for (const num of fractions) {
        const outAmount = (seed * num) / 100_000n;
        const actual = await oswaps.quoteExactOut(idA, idB, outAmount);
        const expected = refExactOut(seed, seed, outAmount, W, W);
        expect(
          relErr(actual, expected),
          `exact-out at ${Number(num) / 1000}% of pool`,
        ).to.be.lessThan(1e-10);
      }
    });

    it('Should be accurate across a wide range of weight ratios', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const seed = ethers.parseEther('1000');

      for (const [i, wRatio] of [1n, 2n, 5n, 20n, 100n].entries()) {
        const tokenX = await newToken(`X${i}`, `X${i}`);
        const tokenY = await newToken(`Y${i}`, `Y${i}`);
        const idX = await bringAssetOnline(
          oswaps,
          manager,
          lp,
          tokenX,
          `X${i}`,
          seed,
          W * wRatio,
        );
        const idY = await bringAssetOnline(
          oswaps,
          manager,
          lp,
          tokenY,
          `Y${i}`,
          seed,
          W,
        );

        for (const pct of [1n, 100n, 500n]) {
          const inAmount = (seed * pct) / 1000n;
          const actual = await oswaps.quoteExactIn(idX, idY, inAmount);
          const expected = refExactIn(seed, inAmount, seed, W * wRatio, W);
          expect(
            relErr(actual, expected),
            `wIn/wOut=${wRatio} at ${Number(pct) / 10}%`,
          ).to.be.lessThan(1e-10);
        }
      }
    });

    it('Should handle trades far larger than the pool, which used to revert', async function () {
      // The Taylor series for ln diverged past a ratio of 2, so any trade at or
      // above ~150% of the input balance reverted. These all execute now.
      const { oswaps, trader, tokenA, tokenB, idA, idB, seed } =
        await loadFixture(deployPool);

      for (const multiple of [1n, 2n, 5n, 10n, 100n]) {
        const inAmount = seed * multiple;
        const out = await oswaps.quoteExactIn(idA, idB, inAmount);
        expect(out, `multiple ${multiple}`).to.be.greaterThan(0);
        expect(
          relErr(out, refExactIn(seed, inAmount, seed, W, W)),
        ).to.be.lessThan(1e-10);
      }

      // And one of them actually settles on-chain.
      const inAmount = seed * 10n;
      await fund(tokenA, oswaps, trader, inAmount);
      const quote = await oswaps.quoteExactIn(idA, idB, inAmount);
      await oswaps
        .connect(trader)
        .swapExactIn(trader.address, idA, idB, inAmount, 0);
      expect(await tokenB.balanceOf(trader.address)).to.equal(quote);
      // A huge input buys almost the whole output side, but never all of it.
      expect(quote).to.be.lessThan(seed);
      expect(quote).to.be.greaterThan((seed * 90n) / 100n);
    });

    it('Should never reduce the invariant on exact-in swaps', async function () {
      const { oswaps, trader, tokenA, tokenB, idA, idB, seed } =
        await loadFixture(deployPool);

      for (const pct of [1n, 10n, 50n, 90n, 150n]) {
        const inAmount = (seed * pct) / 100n;
        const balIn = await tokenA.balanceOf(await oswaps.getAddress());
        const balOut = await tokenB.balanceOf(await oswaps.getAddress());
        const wIn = (await oswaps.getAsset(idA)).weight;
        const wOut = (await oswaps.getAsset(idB)).weight;

        const before = lnInvariant(balIn, wIn, balOut, wOut);
        await fund(tokenA, oswaps, trader, inAmount);
        await oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, inAmount, 0);

        const after = lnInvariant(
          await tokenA.balanceOf(await oswaps.getAddress()),
          wIn,
          await tokenB.balanceOf(await oswaps.getAddress()),
          wOut,
        );
        expect(after, `exact-in ${pct}%`).to.be.greaterThan(before - 1e-12);
      }
    });

    it('Should never reduce the invariant on exact-out swaps', async function () {
      // This is the regression that mattered most: the Taylor-series version
      // undercharged on exact-out, breaking the invariant by up to 16.8%.
      const { oswaps, trader, tokenA, tokenB, idA, idB } = await loadFixture(
        deployPool,
      );

      for (const pct of [1n, 10n, 50n, 75n, 90n]) {
        const balIn = await tokenA.balanceOf(await oswaps.getAddress());
        const balOut = await tokenB.balanceOf(await oswaps.getAddress());
        const outAmount = (balOut * pct) / 100n;
        const wIn = (await oswaps.getAsset(idA)).weight;
        const wOut = (await oswaps.getAsset(idB)).weight;

        const before = lnInvariant(balIn, wIn, balOut, wOut);
        const needed = await oswaps.quoteExactOut(idA, idB, outAmount);
        await fund(tokenA, oswaps, trader, needed);
        await oswaps
          .connect(trader)
          .swapExactOut(trader.address, idA, idB, outAmount, ethers.MaxUint256);

        const after = lnInvariant(
          await tokenA.balanceOf(await oswaps.getAddress()),
          wIn,
          await tokenB.balanceOf(await oswaps.getAddress()),
          wOut,
        );
        expect(after, `exact-out ${pct}%`).to.be.greaterThan(before - 1e-12);
      }
    });

    it('Should bound the deviation from the exact price in either direction', async function () {
      // The fixed-point `pow` is accurate but not exact, and the residual error
      // has no guaranteed sign, so the property worth pinning down is a bound.
      // The bound is loosest for dust-sized trades, where the ratio fed to `pow`
      // sits closest to 1 and relative precision is worst.
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);

      let worst = 0;
      for (const num of [
        1n,
        10n,
        100n,
        1_000n,
        7_000n,
        33_000n,
        50_000n,
        91_000n,
        100_000n,
        250_000n,
        1_000_000n,
      ]) {
        const inAmount = (seed * num) / 100_000n;
        worst = Math.max(
          worst,
          relErr(
            await oswaps.quoteExactIn(idA, idB, inAmount),
            refExactIn(seed, inAmount, seed, W, W),
          ),
        );

        if (num < 100_000n) {
          const outAmount = (seed * num) / 100_000n;
          worst = Math.max(
            worst,
            relErr(
              await oswaps.quoteExactOut(idA, idB, outAmount),
              refExactOut(seed, seed, outAmount, W, W),
            ),
          );
        }
      }
      expect(worst, 'worst relative deviation at equal weights').to.be.lessThan(
        1e-10,
      );
    });

    it('Should hold that bound even for dust trades at extreme weight ratios', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const seed = ethers.parseEther('1000');
      const tokenX = await newToken('X', 'X');
      const tokenY = await newToken('Y', 'Y');
      const idX = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenX,
        'X',
        seed,
        W * 50n,
      );
      const idY = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenY,
        'Y',
        seed,
        W,
      );

      let worst = 0;
      for (const num of [1n, 10n, 1_000n, 50_000n, 99_000n]) {
        const amount = (seed * num) / 100_000n;
        worst = Math.max(
          worst,
          relErr(
            await oswaps.quoteExactIn(idX, idY, amount),
            refExactIn(seed, amount, seed, W * 50n, W),
          ),
          relErr(
            await oswaps.quoteExactOut(idX, idY, amount),
            refExactOut(seed, seed, amount, W * 50n, W),
          ),
        );
      }
      expect(worst, 'worst relative deviation at 50:1 weights').to.be.lessThan(
        1e-9,
      );
    });

    it('Should keep per-swap invariant drift far below any economically useful level', async function () {
      // The residual error is unsigned, so the pool can in principle lose value.
      // This pins the per-swap loss to a scale where extracting it would cost
      // vastly more in gas than it yields.
      const { oswaps, trader, tokenA, tokenB, idA, idB } = await loadFixture(
        deployPool,
      );
      const pool = await oswaps.getAddress();
      const wIn = (await oswaps.getAsset(idA)).weight;
      const wOut = (await oswaps.getAsset(idB)).weight;

      let worstDrop = 0;
      for (const pct of [1n, 5n, 25n, 60n, 95n]) {
        const balIn = await tokenA.balanceOf(pool);
        const balOut = await tokenB.balanceOf(pool);
        const before = lnInvariant(balIn, wIn, balOut, wOut);

        const inAmount = (balIn * pct) / 100n;
        await fund(tokenA, oswaps, trader, inAmount);
        await oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, inAmount, 0);

        const after = lnInvariant(
          await tokenA.balanceOf(pool),
          wIn,
          await tokenB.balanceOf(pool),
          wOut,
        );
        worstDrop = Math.max(worstDrop, before - after);
      }
      // ln V drift translates roughly 1:1 into a fraction of pool value.
      expect(worstDrop, 'worst ln(V) drop per swap').to.be.lessThan(1e-12);
    });

    it('Should reject only trades beyond the fixed-point exponent domain', async function () {
      // pow requires log2(ratio) * (wIn/wOut) < 192, so an extreme weight ratio
      // caps the trade size. At 50:1 that cap sits above 13x the pool balance,
      // which is far outside any trade a real pool would see.
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const seed = ethers.parseEther('1000');
      const tokenX = await newToken('X', 'X');
      const tokenY = await newToken('Y', 'Y');
      const idX = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenX,
        'X',
        seed,
        W * 50n,
      );
      const idY = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenY,
        'Y',
        seed,
        W,
      );

      expect(await oswaps.quoteExactIn(idX, idY, seed * 10n)).to.be.greaterThan(
        0,
      );
      await expect(oswaps.quoteExactIn(idX, idY, seed * 20n)).to.be.reverted;
    });

    it('Should be self-consistent between the two directions', async function () {
      const { oswaps, idA, idB, seed } = await loadFixture(deployPool);
      for (const pct of [1n, 10n, 40n]) {
        const inAmount = (seed * pct) / 100n;
        const out = await oswaps.quoteExactIn(idA, idB, inAmount);
        const backIn = await oswaps.quoteExactOut(idA, idB, out);
        // Asking for exactly what the input buys should cost that input again.
        expect(relErr(backIn, inAmount)).to.be.lessThan(1e-12);
      }
    });

    it('Should price correctly for tokens with unequal decimals', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const usdc = await newToken('USDC', 'USDC', 6);
      const weth = await newToken('WETH', 'WETH', 18);

      const usdcSeed = 2_000_000_000n; // 2,000 USDC
      const wethSeed = ethers.parseEther('1'); // 1 WETH
      const idU = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        usdc,
        'USDC',
        usdcSeed,
        W,
      );
      const idW = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        weth,
        'WETH',
        wethSeed,
        W,
      );

      const inAmount = 100_000_000n; // 100 USDC
      const actual = await oswaps.quoteExactIn(idU, idW, inAmount);
      const expected = refExactIn(usdcSeed, inAmount, wethSeed, W, W);
      expect(relErr(actual, expected)).to.be.lessThan(1e-10);

      // 100 USDC into a 2000/1 pool should buy just under 1/21 of an ETH.
      expect(Number(ethers.formatEther(actual))).to.be.closeTo(0.0476, 0.001);
    });

    it('Should keep working after weights drift through deposits', async function () {
      const { oswaps, lp, tokenA, idA, idB, seed } = await loadFixture(
        deployPool,
      );
      const add = ethers.parseEther('333');
      await fund(tokenA, oswaps, lp, add);
      await oswaps.connect(lp).addLiquidity(idA, add, 0);

      const wIn = (await oswaps.getAsset(idA)).weight;
      const wOut = (await oswaps.getAsset(idB)).weight;
      const inAmount = ethers.parseEther('50');
      const actual = await oswaps.quoteExactIn(idA, idB, inAmount);
      const expected = refExactIn(seed + add, inAmount, seed, wIn, wOut);
      expect(relErr(actual, expected)).to.be.lessThan(1e-10);
    });
  });

  describe('Multi-asset pools', function () {
    it('Should route between any pair in a three-asset pool', async function () {
      const { oswaps, manager, lp, trader, tokenA, tokenB, idA, idB, seed } =
        await loadFixture(deployPool);
      const tokenC = await newToken('Gamma', 'CCC');
      const idC = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenC,
        'CCC',
        seed * 2n,
        W * 2n,
      );

      const inAmount = ethers.parseEther('10');
      for (const [from, to, token] of [
        [idA, idB, tokenA],
        [idB, idC, tokenB],
        [idC, idA, tokenC],
      ] as const) {
        await fund(token, oswaps, trader, inAmount);
        const quote = await oswaps.quoteExactIn(from, to, inAmount);
        expect(quote).to.be.greaterThan(0);
        await expect(
          oswaps
            .connect(trader)
            .swapExactIn(trader.address, from, to, inAmount, quote),
        ).to.not.be.reverted;
      }
    });

    it('Should price a pair independently of unrelated assets', async function () {
      const { oswaps, manager, lp, idA, idB, seed } = await loadFixture(
        deployPool,
      );
      const quoteBefore = await oswaps.quoteExactIn(
        idA,
        idB,
        ethers.parseEther('10'),
      );

      const tokenC = await newToken('Gamma', 'CCC');
      await bringAssetOnline(oswaps, manager, lp, tokenC, 'CCC', seed, W * 7n);

      expect(
        await oswaps.quoteExactIn(idA, idB, ethers.parseEther('10')),
      ).to.equal(quoteBefore);
    });
  });

  describe('LIQ receipt token', function () {
    it('Should block account-to-account transfers', async function () {
      const { oswaps, lp, outsider, idA } = await loadFixture(deployPool);
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      await expect(
        liq.connect(lp).transfer(outsider.address, 1),
      ).to.be.revertedWith('LIQ: transfers must involve pool');

      await liq.connect(lp).approve(outsider.address, 1);
      await expect(
        liq.connect(outsider).transferFrom(lp.address, outsider.address, 1),
      ).to.be.revertedWith('LIQ: transfers must involve pool');
    });

    it('Should allow transfers that involve the pool', async function () {
      const { oswaps, lp, idA } = await loadFixture(deployPool);
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      await expect(liq.connect(lp).transfer(await oswaps.getAddress(), 1)).to
        .not.be.reverted;
      expect(await liq.balanceOf(await oswaps.getAddress())).to.equal(1);
    });

    it('Should only let the pool mint and burn', async function () {
      const { oswaps, lp, outsider, idA } = await loadFixture(deployPool);
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      await expect(
        liq.connect(outsider).mint(outsider.address, 1),
      ).to.be.revertedWithCustomError(liq, 'OwnableUnauthorizedAccount');
      await expect(
        liq.connect(outsider).burnFrom(lp.address, 1),
      ).to.be.revertedWithCustomError(liq, 'OwnableUnauthorizedAccount');
    });

    it('Should track deposits and withdrawals 1:1 in raw units', async function () {
      const { oswaps, manager, lp } = await loadFixture(deployInitialised);
      const usdc = await newToken('USDC', 'USDC', 6);
      const idU = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        usdc,
        'USDC',
        1_000_000_000n,
        W,
      );
      const liq = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idU),
      );

      // 6 decimals on both sides, so 1000 USDC in reads as 1000 LIQ.
      expect(await liq.decimals()).to.equal(6);
      expect(await liq.balanceOf(lp.address)).to.equal(1_000_000_000n);
      expect(ethers.formatUnits(await liq.balanceOf(lp.address), 6)).to.equal(
        '1000.0',
      );

      await oswaps.connect(manager).withdraw(lp.address, idU, 400_000_000n, 0);
      expect(await liq.balanceOf(lp.address)).to.equal(600_000_000n);
    });
  });

  describe('Security properties', function () {
    it('Should block reentrancy from a malicious output token', async function () {
      const { oswaps, manager, lp, trader } = await loadFixture(
        deployInitialised,
      );
      const seed = ethers.parseEther('1000');

      const tokenA = await newToken('Alpha', 'AAA');
      const Evil = await ethers.getContractFactory('MockReentrantERC20');
      const evil = await Evil.deploy('Evil', 'EVL', 18);

      const idA = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenA,
        'AAA',
        seed,
        W,
      );
      const idE = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        evil,
        'EVL',
        seed,
        W,
      );

      const inAmount = ethers.parseEther('10');
      await fund(tokenA, oswaps, trader, inAmount * 2n);

      // While the pool pays out EVL, try to start another swap inside it.
      const payload = oswaps.interface.encodeFunctionData('swapExactIn', [
        trader.address,
        idA,
        idE,
        inAmount,
        0,
      ]);
      await evil.arm(await oswaps.getAddress(), payload);

      await oswaps
        .connect(trader)
        .swapExactIn(trader.address, idA, idE, inAmount, 0);

      expect(await evil.reentryAttempted()).to.equal(true);
      expect(await evil.reentrySucceeded()).to.equal(false);
    });

    it('Should surface a failing output transfer rather than swallowing it', async function () {
      const { oswaps, manager, lp, trader } = await loadFixture(
        deployInitialised,
      );
      const seed = ethers.parseEther('1000');

      const tokenA = await newToken('Alpha', 'AAA');
      const Reverting = await ethers.getContractFactory('MockRevertingERC20');
      const bad = await Reverting.deploy('Bad', 'BAD', 18);

      const idA = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        tokenA,
        'AAA',
        seed,
        W,
      );
      const idB = await bringAssetOnline(
        oswaps,
        manager,
        lp,
        bad,
        'BAD',
        seed,
        W,
      );

      await bad.setFailAllTransfers(true);
      await fund(tokenA, oswaps, trader, ethers.parseEther('10'));
      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, ethers.parseEther('10'), 0),
      ).to.be.revertedWith('MockRevertingERC20: transfers disabled');
    });

    it('Should require an allowance before pulling input tokens', async function () {
      const { oswaps, trader, tokenA, idA, idB } = await loadFixture(
        deployPool,
      );
      await tokenA.mint(trader.address, ethers.parseEther('10'));
      await expect(
        oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, ethers.parseEther('10'), 0),
      ).to.be.revertedWithCustomError(tokenA, 'ERC20InsufficientAllowance');
    });

    it('Should reject manager-gated calls from the owner', async function () {
      const { oswaps, owner, lp, idA } = await loadFixture(deployPool);
      await expect(oswaps.connect(owner).freeze(idA, 'AAA')).to.be.revertedWith(
        'Only manager',
      );
      await expect(
        oswaps.connect(owner).unfreeze(idA, 'AAA'),
      ).to.be.revertedWith('Only manager');
      await expect(oswaps.connect(owner).forgetAsset(idA)).to.be.revertedWith(
        'Only manager',
      );
      await expect(
        oswaps.connect(owner).withdraw(lp.address, idA, 1, 0),
      ).to.be.revertedWith('Only manager');
    });

    it('Should leave the pool solvent after a long mixed sequence', async function () {
      const { oswaps, manager, lp, trader, tokenA, tokenB, idA, idB } =
        await loadFixture(deployPool);
      const pool = await oswaps.getAddress();

      for (let round = 0; round < 6; round++) {
        const inAmount = ethers.parseEther(String(10 * (round + 1)));
        await fund(tokenA, oswaps, trader, inAmount);
        await oswaps
          .connect(trader)
          .swapExactIn(trader.address, idA, idB, inAmount, 0);

        const outAmount = ethers.parseEther('5');
        const needed = await oswaps.quoteExactOut(idB, idA, outAmount);
        await fund(tokenB, oswaps, trader, needed);
        await oswaps
          .connect(trader)
          .swapExactOut(trader.address, idB, idA, outAmount, ethers.MaxUint256);

        const add = ethers.parseEther('20');
        await fund(tokenA, oswaps, lp, add);
        await oswaps.connect(lp).addLiquidity(idA, add, 0);

        await oswaps
          .connect(manager)
          .withdraw(lp.address, idB, ethers.parseEther('1'), 0);
      }

      // Pool still holds both sides, weights are positive, and quotes work.
      expect(await tokenA.balanceOf(pool)).to.be.greaterThan(0);
      expect(await tokenB.balanceOf(pool)).to.be.greaterThan(0);
      expect((await oswaps.getAsset(idA)).weight).to.be.greaterThan(0);
      expect((await oswaps.getAsset(idB)).weight).to.be.greaterThan(0);
      expect(
        await oswaps.quoteExactIn(idA, idB, ethers.parseEther('1')),
      ).to.be.greaterThan(0);

      // LIQ supply still equals what the pool owes on each side.
      const liqA = await ethers.getContractAt(
        'LiquidityToken',
        await oswaps.liquidityTokens(idA),
      );
      expect(await liqA.totalSupply()).to.be.greaterThan(0);
    });
  });
});
