import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// 1 EUR = 1.08 USD (8 decimals, Chainlink FX convention)
const EUR_USD = 1_0800_0000n;
// Official CFP franc parity: 1000 XPF = 8.38 EUR
const XPF_USD = (EUR_USD * 838n) / 100000n; // 905040 → $0.0090504

describe('XpfUsdOracle', function () {
  async function deployFixture() {
    const Feed = await ethers.getContractFactory('MockChainlinkFeed');
    const eurUsdFeed = await Feed.deploy(EUR_USD, 8);

    const Oracle = await ethers.getContractFactory('XpfUsdOracle');
    const oracle = await Oracle.deploy(await eurUsdFeed.getAddress());

    return { eurUsdFeed, oracle };
  }

  describe('Metadata', function () {
    it('Should mirror the decimals of the underlying EUR/USD feed', async function () {
      const { oracle } = await loadFixture(deployFixture);
      expect(await oracle.decimals()).to.equal(8);
    });

    it('Should describe itself as XPF / USD', async function () {
      const { oracle } = await loadFixture(deployFixture);
      expect(await oracle.description()).to.equal('XPF / USD');
      expect(await oracle.version()).to.equal(1);
    });

    it('Should expose the underlying feed and the peg constants', async function () {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);
      expect(await oracle.EUR_USD_FEED()).to.equal(
        await eurUsdFeed.getAddress(),
      );
      expect(await oracle.PEG_EUR_NUMERATOR()).to.equal(838);
      expect(await oracle.PEG_EUR_DENOMINATOR()).to.equal(100000);
    });

    it('Should reject a zero-address feed', async function () {
      const Oracle = await ethers.getContractFactory('XpfUsdOracle');
      await expect(Oracle.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        'Invalid EUR/USD feed',
      );
    });
  });

  describe('Price conversion', function () {
    it('Should convert EUR/USD to XPF/USD at the fixed peg', async function () {
      const { oracle } = await loadFixture(deployFixture);
      const [, answer] = await oracle.latestRoundData();
      // 1.08 USD/EUR × 8.38 EUR/1000 XPF = 0.0090504 USD/XPF
      expect(answer).to.equal(905040n);
      expect(answer).to.equal(XPF_USD);
    });

    it('Should track EUR/USD movements', async function () {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);

      await eurUsdFeed.setPrice(1_2000_0000); // 1 EUR = 1.20 USD
      const [, answer] = await oracle.latestRoundData();
      expect(answer).to.equal((1_2000_0000n * 838n) / 100000n); // 1005600
    });

    it('Should round trip: 119.3317 XPF ≈ 1 EUR', async function () {
      const { oracle } = await loadFixture(deployFixture);
      const [, answer] = await oracle.latestRoundData();

      // 119.3317 XPF valued in USD should be within a cent of 1 EUR in USD
      const xpfPerEur = 119.3317;
      const usdForOneEurWorthOfXpf = (Number(answer) / 1e8) * xpfPerEur;
      expect(usdForOneEurWorthOfXpf).to.be.closeTo(1.08, 0.0001);
    });

    it('Should revert when the EUR/USD feed reports a non-positive price', async function () {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);

      await eurUsdFeed.setPrice(0);
      await expect(oracle.latestRoundData()).to.be.revertedWith(
        'Invalid EUR/USD price',
      );

      await eurUsdFeed.setPrice(-1_0800_0000);
      await expect(oracle.latestRoundData()).to.be.revertedWith(
        'Invalid EUR/USD price',
      );
    });

    it('Should revert rather than return a zero answer when EUR/USD is dust', async function () {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);

      // Anything below 100000/838 ≈ 120 truncates to zero XPF/USD
      await eurUsdFeed.setPrice(100);
      await expect(oracle.latestRoundData()).to.be.revertedWith(
        'XPF/USD price underflow',
      );
    });

    it('Should convert historical rounds via getRoundData', async function () {
      const { oracle } = await loadFixture(deployFixture);
      const [roundId, answer] = await oracle.getRoundData(42);
      expect(roundId).to.equal(42);
      expect(answer).to.equal(905040n);
    });
  });

  describe('Round metadata forwarding', function () {
    it('Should forward updatedAt from the EUR/USD feed', async function () {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);

      const staleTimestamp = 1_600_000_000;
      await eurUsdFeed.setUpdatedAt(staleTimestamp);

      const [, , , updatedAt] = await oracle.latestRoundData();
      expect(updatedAt).to.equal(staleTimestamp);
    });

    it('Should forward roundId and answeredInRound', async function () {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);

      const [oracleRound, , , , oracleAnsweredIn] =
        await oracle.latestRoundData();
      const [feedRound, , , , feedAnsweredIn] =
        await eurUsdFeed.latestRoundData();

      expect(oracleRound).to.equal(feedRound);
      expect(oracleAnsweredIn).to.equal(feedAnsweredIn);
    });
  });

  describe('TokenBackingVault integration', function () {
    async function deployVaultFixture() {
      const { oracle, eurUsdFeed } = await loadFixture(deployFixture);
      const [owner, executor, alice] = await ethers.getSigners();

      const MockFactory = await ethers.getContractFactory(
        'MockDAOSpaceFactory',
      );
      const mockFactory = await MockFactory.deploy();

      const SPACE_ID = 1;
      await mockFactory.setExecutor(SPACE_ID, executor.address);
      await mockFactory.setMember(SPACE_ID, alice.address, true);

      const Vault = await ethers.getContractFactory(
        'TokenBackingVaultImplementation',
      );
      const vault = await upgrades.deployProxy(
        Vault,
        [owner.address, await mockFactory.getAddress()],
        { initializer: 'initialize', kind: 'uups' },
      );

      const Community = await ethers.getContractFactory('MockSpaceToken');
      const communityToken = await Community.deploy('Community', 'COM', 0);

      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const usdc = await MockERC20.deploy('USDC', 'USDC', 6);

      const Feed = await ethers.getContractFactory('MockChainlinkFeed');
      const usdcFeed = await Feed.deploy(1_0000_0000, 8); // $1.00

      return {
        vault,
        communityToken,
        usdc,
        usdcFeed,
        oracle,
        eurUsdFeed,
        executor,
        alice,
        SPACE_ID,
      };
    }

    it('Should price an XPF-denominated token through the adapter', async function () {
      const {
        vault,
        communityToken,
        usdc,
        usdcFeed,
        oracle,
        executor,
        SPACE_ID,
      } = await loadFixture(deployVaultFixture);

      // 1 token = 1000 XPF = 8.38 EUR = $9.0504 at EUR/USD 1.08
      await communityToken.setPriceWithCurrency(
        1000_000_000, // 1000 XPF, 6 decimals
        await oracle.getAddress(),
      );

      await usdc.mint(executor.address, 1_000_000e6);
      await usdc
        .connect(executor)
        .approve(await vault.getAddress(), 1_000_000e6);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [1_000_000e6],
          0,
          0,
          ethers.ZeroAddress,
          0,
          0,
        );

      // 100 tokens × $9.0504 = $905.04 → 905.04 USDC
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(905_040_000n);
    });

    it('Should reject redemption when the underlying EUR/USD feed goes stale', async function () {
      const {
        vault,
        communityToken,
        usdc,
        usdcFeed,
        oracle,
        eurUsdFeed,
        executor,
        SPACE_ID,
      } = await loadFixture(deployVaultFixture);

      await communityToken.setPriceWithCurrency(
        1000_000_000,
        await oracle.getAddress(),
      );

      await usdc.mint(executor.address, 1_000_000e6);
      await usdc
        .connect(executor)
        .approve(await vault.getAddress(), 1_000_000e6);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [1_000_000e6],
          0,
          0,
          ethers.ZeroAddress,
          0,
          0,
        );

      // Push the EUR/USD round beyond the vault's 24h staleness window
      const now = (await ethers.provider.getBlock('latest'))!.timestamp;
      await eurUsdFeed.setUpdatedAt(now - 25 * 60 * 60);

      await expect(
        vault.calculateBackingOut(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('100'),
          await usdc.getAddress(),
        ),
      ).to.be.revertedWith('Stale oracle price');
    });
  });
});
