import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * Focused tests for DecayingSpaceToken's decay-clock accounting.
 *
 * These deploy the token directly behind a UUPS proxy (no DAO factory plumbing)
 * so they exercise only the decay logic in DecayingSpaceToken.
 *
 * Regression target: previously `applyDecay` reset `lastApplied` to
 * `block.timestamp` on every call. Because applyDecay runs on every
 * mint/transfer, an account interacting more often than `decayRate` would
 * repeatedly reset its clock and never decay. The fix advances the clock by
 * whole elapsed periods only, banking the sub-period remainder.
 */
describe('DecayingSpaceToken decay clock accounting', function () {
  const DECAY_INTERVAL = 3600; // 1 hour
  const INITIAL = 10000n;

  let executor: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  async function deployToken(
    decayPercentage: number,
    decayInterval: number = DECAY_INTERVAL,
    transferable: boolean = false,
  ) {
    const signers = await ethers.getSigners();
    executor = signers[0];
    alice = signers[1];
    bob = signers[2];

    const DecayingSpaceToken = await ethers.getContractFactory(
      'DecayingSpaceToken',
    );

    const token = await upgrades.deployProxy(
      DecayingSpaceToken,
      [
        'Decay Token', // name
        'DCY', // symbol
        executor.address, // _executor
        1n, // _spaceId
        0n, // _maxSupply (unlimited)
        transferable, // _transferable
        false, // _fixedMaxSupply
        false, // _autoMinting
        0n, // _tokenPrice
        ethers.ZeroAddress, // _priceCurrencyFeed
        false, // _useTransferWhitelist
        false, // _useReceiveWhitelist
        [], // _initialTransferWhitelist
        [], // _initialReceiveWhitelist
        [], // _initialTransferWhitelistSpaceIds
        [], // _initialReceiveWhitelistSpaceIds
        decayPercentage, // _decayPercentage (basis points)
        decayInterval, // _decayInterval (seconds)
        ethers.ZeroAddress, // _paymentToken
        0n, // _paymentTokenPricePerToken
        0n, // _tokensForSale
        0, // _purchaseEligibilityMode
        [], // _initialPurchaseWhitelistSpaceIds
        [], // _initialAuthorizedMinters
      ],
      {
        initializer:
          'initialize(string,string,address,uint256,uint256,bool,bool,bool,uint256,address,bool,bool,address[],address[],uint256[],uint256[],uint256,uint256,address,uint256,uint256,uint8,uint256[],address[])',
        kind: 'uups',
        unsafeAllow: ['constructor'],
      },
    );
    await token.waitForDeployment();
    return token;
  }

  it('applies a single period of decay via the view function', async function () {
    const token = await deployToken(1000); // 10% per interval
    await token.connect(executor).mint(alice.address, INITIAL);

    await time.increase(DECAY_INTERVAL);

    // View function reflects decay without mutating balances.
    expect(await token.balanceOf(alice.address)).to.equal(
      (INITIAL * 9000n) / 10000n,
    );
    // Underlying supply is untouched until decay is materialized.
    expect(await token.totalSupply()).to.equal(INITIAL);
  });

  it('does NOT decay for a partial interval', async function () {
    const token = await deployToken(1000);
    await token.connect(executor).mint(alice.address, INITIAL);

    await time.increase(DECAY_INTERVAL / 2);

    expect(await token.balanceOf(alice.address)).to.equal(INITIAL);
  });

  it('cannot be avoided by frequent sub-interval applyDecay calls', async function () {
    const token = await deployToken(1000); // 10% per interval
    await token.connect(executor).mint(alice.address, INITIAL);

    // Materialize decay every half interval. Each individual call sees less
    // than one full period, but the elapsed time must keep accumulating.
    // With the old "reset to now" behavior the balance would stay at INITIAL.
    for (let i = 0; i < 6; i++) {
      await time.increase(DECAY_INTERVAL / 2);
      await token.applyDecay(alice.address);
    }

    // ~3 full periods elapse over the 6 half-interval steps -> 0.9^3.
    const expected =
      (INITIAL * 9000n * 9000n * 9000n) / (10000n * 10000n * 10000n);

    const balance = await token.balanceOf(alice.address);
    expect(balance).to.be.lessThan(INITIAL);
    expect(balance).to.be.closeTo(expected, 1n);
  });

  it('preserves the leftover sub-interval time between applyDecay calls', async function () {
    const token = await deployToken(1000);
    await token.connect(executor).mint(alice.address, INITIAL);

    // 1.5 periods -> one period materializes, half a period is banked.
    await time.increase(DECAY_INTERVAL + DECAY_INTERVAL / 2);
    await token.applyDecay(alice.address);

    const afterFirst = await token.balanceOf(alice.address);
    expect(afterFirst).to.be.closeTo((INITIAL * 9000n) / 10000n, 1n);

    // Another half period completes a second period thanks to the banked
    // remainder. If the remainder had been discarded (clock reset to `now`),
    // no further decay would happen here.
    await time.increase(DECAY_INTERVAL / 2);
    await token.applyDecay(alice.address);

    const afterSecond = await token.balanceOf(alice.address);
    expect(afterSecond).to.be.lessThan(afterFirst);
    expect(afterSecond).to.be.closeTo(
      (INITIAL * 9000n * 9000n) / (10000n * 10000n),
      1n,
    );
  });

  it('materializes decay by burning, reducing totalSupply', async function () {
    const token = await deployToken(1000);
    await token.connect(executor).mint(alice.address, INITIAL);

    await time.increase(DECAY_INTERVAL);
    await token.applyDecay(alice.address);

    const expected = (INITIAL * 9000n) / 10000n;
    expect(await token.balanceOf(alice.address)).to.equal(expected);
    expect(await token.totalSupply()).to.equal(expected);
    expect(await token.totalBurnedFromDecay()).to.equal(INITIAL - expected);
  });

  it('refreshes the clock for newly minted holders so they get a full period', async function () {
    const token = await deployToken(1000);
    await token.connect(executor).mint(alice.address, INITIAL);

    // Long idle period for a holder who then mints again — the new tokens must
    // not be retroactively over-decayed, but a full interval after the last
    // mint should still produce exactly one period of decay.
    await time.increase(DECAY_INTERVAL);
    await token.connect(executor).mint(alice.address, INITIAL); // applies decay first

    // First tranche decayed once (9000), second tranche fresh (10000) -> 19000.
    const balanceAfterSecondMint = await token.balanceOf(alice.address);
    expect(balanceAfterSecondMint).to.be.closeTo(
      (INITIAL * 9000n) / 10000n + INITIAL,
      1n,
    );

    await time.increase(DECAY_INTERVAL);
    // One more period on the combined balance.
    const expected = (balanceAfterSecondMint * 9000n) / 10000n;
    expect(await token.balanceOf(alice.address)).to.be.closeTo(expected, 1n);
  });

  // ==========================================================================
  // Decay accuracy
  // ==========================================================================
  describe('decay accuracy', function () {
    it('compounds correctly over many periods (1% over 5 periods)', async function () {
      const token = await deployToken(100); // 1%
      await token.connect(executor).mint(alice.address, INITIAL);

      await time.increase(DECAY_INTERVAL * 5);

      let expected = INITIAL;
      for (let i = 0; i < 5; i++) {
        expected = (expected * 9900n) / 10000n;
      }
      expect(await token.balanceOf(alice.address)).to.be.closeTo(expected, 1n);
    });

    for (const bp of [100, 500, 1000, 2500, 5000]) {
      it(`applies ${bp / 100}% decay after one period`, async function () {
        const token = await deployToken(bp);
        await token.connect(executor).mint(alice.address, INITIAL);

        await time.increase(DECAY_INTERVAL);

        const expected = (INITIAL * BigInt(10000 - bp)) / 10000n;
        expect(await token.balanceOf(alice.address)).to.equal(expected);
      });
    }

    it('wipes the balance to zero with 100% decay', async function () {
      const token = await deployToken(10000); // 100%
      await token.connect(executor).mint(alice.address, INITIAL);

      await time.increase(DECAY_INTERVAL);
      expect(await token.balanceOf(alice.address)).to.equal(0n);

      await token.applyDecay(alice.address);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
      expect(await token.totalSupply()).to.equal(0n);
    });

    it('does not decay when decayPercentage is zero', async function () {
      const token = await deployToken(0); // 0% -> decay disabled by value
      await token.connect(executor).mint(alice.address, INITIAL);

      await time.increase(DECAY_INTERVAL * 10);
      expect(await token.balanceOf(alice.address)).to.equal(INITIAL);

      await token.applyDecay(alice.address);
      expect(await token.balanceOf(alice.address)).to.equal(INITIAL);
      expect(await token.totalSupply()).to.equal(INITIAL);
    });

    it('decays monotonically over successive periods', async function () {
      const token = await deployToken(1000);
      await token.connect(executor).mint(alice.address, INITIAL);

      let previous = await token.balanceOf(alice.address);
      for (let i = 0; i < 4; i++) {
        await time.increase(DECAY_INTERVAL);
        const current = await token.balanceOf(alice.address);
        expect(current).to.be.lessThan(previous);
        previous = current;
      }
    });
  });

  // ==========================================================================
  // View / materialize consistency and idempotency
  // ==========================================================================
  describe('consistency', function () {
    it('view balanceOf matches the materialized balance', async function () {
      const token = await deployToken(1000);
      await token.connect(executor).mint(alice.address, INITIAL);

      await time.increase(DECAY_INTERVAL * 3);

      const viewBalance = await token.balanceOf(alice.address);
      await token.applyDecay(alice.address);
      const materialized = await token.balanceOf(alice.address);

      expect(materialized).to.equal(viewBalance);
      expect(await token.totalSupply()).to.equal(viewBalance);
    });

    it('is idempotent: a second applyDecay within the same period is a no-op', async function () {
      const token = await deployToken(1000);
      await token.connect(executor).mint(alice.address, INITIAL);

      await time.increase(DECAY_INTERVAL);
      await token.applyDecay(alice.address);

      const balanceAfterFirst = await token.balanceOf(alice.address);
      const burnedAfterFirst = await token.totalBurnedFromDecay();

      // No time advance — applying again must not decay further.
      await token.applyDecay(alice.address);

      expect(await token.balanceOf(alice.address)).to.equal(balanceAfterFirst);
      expect(await token.totalBurnedFromDecay()).to.equal(burnedAfterFirst);
    });
  });

  // ==========================================================================
  // Multiple holders
  // ==========================================================================
  describe('multiple holders', function () {
    it('decays each holder independently from their own clock', async function () {
      const token = await deployToken(1000);

      // Alice minted now; Bob minted one interval later.
      await token.connect(executor).mint(alice.address, INITIAL);
      await time.increase(DECAY_INTERVAL);
      await token.connect(executor).mint(bob.address, INITIAL);

      // Another interval passes.
      await time.increase(DECAY_INTERVAL);

      // Alice: 2 periods, Bob: 1 period.
      expect(await token.balanceOf(alice.address)).to.be.closeTo(
        (INITIAL * 9000n * 9000n) / (10000n * 10000n),
        1n,
      );
      expect(await token.balanceOf(bob.address)).to.be.closeTo(
        (INITIAL * 9000n) / 10000n,
        1n,
      );
    });

    it('reflects decay across all holders in getDecayedTotalSupply', async function () {
      const token = await deployToken(1000);
      await token.connect(executor).mint(alice.address, INITIAL);
      await token.connect(executor).mint(bob.address, INITIAL);

      await time.increase(DECAY_INTERVAL);

      const perHolder = (INITIAL * 9000n) / 10000n;
      // Raw ERC20 totalSupply is unchanged until decay is materialized...
      expect(await token.totalSupply()).to.equal(INITIAL * 2n);
      // ...but the decay-aware total reflects both holders' pending decay.
      expect(await token.getDecayedTotalSupply()).to.be.closeTo(
        perHolder * 2n,
        2n,
      );
    });
  });

  // ==========================================================================
  // Decay on transfer (voting power moving between holders)
  // ==========================================================================
  describe('transfers', function () {
    it('materializes sender decay and gives the recipient a fresh clock', async function () {
      const token = await deployToken(1000, DECAY_INTERVAL, true); // transferable
      await token.connect(executor).mint(alice.address, INITIAL);

      await time.increase(DECAY_INTERVAL);

      const sendAmount = 1000n;
      await token.connect(alice).transfer(bob.address, sendAmount);

      // Alice's balance decayed by one period, then `sendAmount` left.
      const aliceDecayed = (INITIAL * 9000n) / 10000n;
      expect(await token.balanceOf(alice.address)).to.equal(
        aliceDecayed - sendAmount,
      );
      // Bob receives the exact amount and starts fresh (no immediate decay).
      expect(await token.balanceOf(bob.address)).to.equal(sendAmount);

      // After another interval both balances decay by one more period.
      await time.increase(DECAY_INTERVAL);
      expect(await token.balanceOf(bob.address)).to.equal(
        (sendAmount * 9000n) / 10000n,
      );
      expect(await token.balanceOf(alice.address)).to.be.closeTo(
        ((aliceDecayed - sendAmount) * 9000n) / 10000n,
        1n,
      );
    });
  });

  // ==========================================================================
  // Archiving pauses decay
  // ==========================================================================
  describe('archiving', function () {
    it('pauses decay while archived and does not decay retroactively on unarchive', async function () {
      const token = await deployToken(1000);
      await token.connect(executor).mint(alice.address, INITIAL);

      // Archive, then let two intervals pass: no decay while archived.
      await token.connect(executor).setArchived(true);
      await time.increase(DECAY_INTERVAL * 2);
      expect(await token.balanceOf(alice.address)).to.equal(INITIAL);

      // Unarchive resets the clock so the archived period is not charged.
      await token.connect(executor).setArchived(false);
      expect(await token.balanceOf(alice.address)).to.equal(INITIAL);

      // Exactly one interval after unarchiving -> exactly one period of decay.
      await time.increase(DECAY_INTERVAL);
      expect(await token.balanceOf(alice.address)).to.equal(
        (INITIAL * 9000n) / 10000n,
      );
    });
  });

  // ==========================================================================
  // Changing decay parameters mid-flight
  // ==========================================================================
  describe('parameter updates', function () {
    it('applies the new rate to subsequent periods after setDecayPercentage', async function () {
      const token = await deployToken(1000); // start at 10%
      await token.connect(executor).mint(alice.address, INITIAL);

      // One period at 10%.
      await time.increase(DECAY_INTERVAL);
      await token.applyDecay(alice.address);
      const afterFirst = (INITIAL * 9000n) / 10000n;
      expect(await token.balanceOf(alice.address)).to.equal(afterFirst);

      // Bump to 20% and run another period.
      await token.connect(executor).setDecayPercentage(2000);
      await time.increase(DECAY_INTERVAL);
      await token.applyDecay(alice.address);

      expect(await token.balanceOf(alice.address)).to.be.closeTo(
        (afterFirst * 8000n) / 10000n,
        1n,
      );
    });
  });
});
