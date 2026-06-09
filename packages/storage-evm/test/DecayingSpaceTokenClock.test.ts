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

  async function deployToken(
    decayPercentage: number,
    decayInterval: number = DECAY_INTERVAL,
  ) {
    const signers = await ethers.getSigners();
    executor = signers[0];
    alice = signers[1];

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
        false, // _transferable
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
});
