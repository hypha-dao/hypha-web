import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('TokenBackingVault', function () {
  // ── Fixture ──
  async function deployFixture() {
    const [owner, executor, alice, bob, carol, nonMember] =
      await ethers.getSigners();

    // Mock DAOSpaceFactory
    const MockFactory = await ethers.getContractFactory('MockDAOSpaceFactory');
    const mockFactory = await MockFactory.deploy();

    const SPACE_ID = 1;
    await mockFactory.setExecutor(SPACE_ID, executor.address);
    await mockFactory.setMember(SPACE_ID, alice.address, true);
    await mockFactory.setMember(SPACE_ID, bob.address, true);
    await mockFactory.setMember(SPACE_ID, carol.address, true);

    // Deploy Token Backing Vault (UUPS proxy)
    const Vault = await ethers.getContractFactory(
      'TokenBackingVaultImplementation',
    );
    const vault = await upgrades.deployProxy(
      Vault,
      [owner.address, await mockFactory.getAddress()],
      { initializer: 'initialize', kind: 'uups' },
    );

    // ── Community token (the token being backed) — price set to $2 USD ──
    const Community = await ethers.getContractFactory('MockSpaceToken');
    const communityToken = await Community.deploy(
      'Community',
      'COM',
      2_000_000,
    ); // $2

    // ── Oracle-priced backing tokens ──
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const usdc = await MockERC20.deploy('USDC', 'USDC', 6);
    const weth = await MockERC20.deploy('WETH', 'WETH', 18);
    const wbtc = await MockERC20.deploy('WBTC', 'WBTC', 8);

    // ── Hypha backing token (price from token.priceInUSD()) ──
    const HyphaToken = await ethers.getContractFactory('MockSpaceToken');
    const hyphaToken = await HyphaToken.deploy('HYPHA', 'HYP', 500_000); // $0.50

    // ── Chainlink mock feeds (8 decimals, standard) ──
    const Feed = await ethers.getContractFactory('MockChainlinkFeed');
    const usdcFeed = await Feed.deploy(1_0000_0000, 8); // $1.00
    const ethFeed = await Feed.deploy(2500_0000_0000, 8); // $2,500
    const btcFeed = await Feed.deploy(60000_0000_0000, 8); // $60,000
    const eurUsdFeed = await Feed.deploy(1_0800_0000, 8); // 1 EUR = 1.08 USD

    return {
      vault,
      mockFactory,
      communityToken,
      usdc,
      weth,
      wbtc,
      hyphaToken,
      usdcFeed,
      ethFeed,
      btcFeed,
      eurUsdFeed,
      owner,
      executor,
      alice,
      bob,
      carol,
      nonMember,
      SPACE_ID,
    };
  }

  // ── Helper: create vault with USDC + WETH, community token at $2 USD, 20% min backing ──
  async function setupVault() {
    const f = await loadFixture(deployFixture);
    const {
      vault,
      communityToken,
      usdc,
      weth,
      usdcFeed,
      ethFeed,
      executor,
      alice,
      SPACE_ID,
    } = f;

    // Community token already has price = $2 USD (set in constructor)

    // Mint backing tokens to executor so they can fund the vault
    await usdc.mint(executor.address, 100_000e6);
    await weth.mint(executor.address, ethers.parseEther('40'));

    // Approve
    await usdc.connect(executor).approve(await vault.getAddress(), 100_000e6);
    await weth
      .connect(executor)
      .approve(await vault.getAddress(), ethers.parseEther('40'));

    // Create vault with 20% min backing
    await vault.connect(executor).addBackingToken(
      SPACE_ID,
      await communityToken.getAddress(),
      [await usdc.getAddress(), await weth.getAddress()],
      [await usdcFeed.getAddress(), await ethFeed.getAddress()],
      [6, 18],
      [100_000e6, ethers.parseEther('40')],
      2000, // 20% min backing
      0,
      ethers.ZeroAddress,
    );

    // Mint community tokens to alice (she will redeem)
    await communityToken.mint(alice.address, ethers.parseEther('10000'));
    await communityToken
      .connect(alice)
      .approve(await vault.getAddress(), ethers.MaxUint256);

    return f;
  }

  // ================================================================
  //                      VAULT CREATION
  // ================================================================

  describe('Vault Creation', function () {
    it('Should create a vault with oracle-priced tokens', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await usdc.mint(executor.address, 50_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 50_000e6);

      await expect(
        vault.connect(executor).addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [50_000e6],
          0, // no min backing
          0,
          ethers.ZeroAddress,
        ),
      ).to.emit(vault, 'VaultCreated');

      expect(
        await vault.vaultExists(SPACE_ID, await communityToken.getAddress()),
      ).to.be.true;

      const balance = await vault.getBackingBalance(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );
      expect(balance).to.equal(50_000e6);
    });

    it('Should create a vault with a Hypha backing token (no oracle)', async function () {
      const { vault, communityToken, hyphaToken, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await hyphaToken.mint(executor.address, ethers.parseEther('10000'));
      await hyphaToken
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('10000'));

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaToken.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('10000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      const config = await vault.getBackingTokenConfig(
        SPACE_ID,
        await communityToken.getAddress(),
        await hyphaToken.getAddress(),
      );
      expect(config.priceFeed).to.equal(ethers.ZeroAddress);
      expect(config.enabled).to.be.true;
    });

    it('Should reject if space token has no price set', async function () {
      const { vault, usdc, usdcFeed, executor, SPACE_ID } = await loadFixture(
        deployFixture,
      );

      // Deploy a community token with price = 0
      const Community = await ethers.getContractFactory('MockSpaceToken');
      const zeroPriceToken = await Community.deploy('Zero', 'ZERO', 0);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await zeroPriceToken.getAddress(),
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Space token price must be > 0');
    });
  });

  // ================================================================
  //            ORACLE PRICING — CORE CALCULATION TESTS
  // ================================================================

  describe('Oracle Pricing', function () {
    it('Should calculate correct USDC output (100 tokens × $2 = $200 → 200 USDC)', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, SPACE_ID } = f;

      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(200_000_000);
    });

    it('Should calculate correct WETH output (100 tokens × $2 = $200 → 0.08 ETH)', async function () {
      const f = await setupVault();
      const { vault, communityToken, weth, SPACE_ID } = f;

      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await weth.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('0.08'));
    });

    it('Should adjust output when oracle price changes', async function () {
      const f = await setupVault();
      const { vault, communityToken, weth, ethFeed, SPACE_ID } = f;

      let out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await weth.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('0.08'));

      // ETH pumps to $5,000
      await ethFeed.setPrice(5000_0000_0000);
      out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await weth.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('0.04'));

      // ETH dumps to $1,000
      await ethFeed.setPrice(1000_0000_0000);
      out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await weth.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('0.2'));
    });

    it('Should reject stale oracle prices (>24 h old)', async function () {
      const f = await setupVault();
      const { vault, communityToken, weth, ethFeed, alice, SPACE_ID } = f;

      const now = await time.latest();
      await ethFeed.setUpdatedAt(now - 25 * 3600);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await weth.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Stale oracle price');
    });

    it('Should price Hypha tokens from on-chain priceInUSD()', async function () {
      const { vault, communityToken, hyphaToken, executor, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await hyphaToken.mint(executor.address, ethers.parseEther('100000'));
      await hyphaToken
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('100000'));

      // Community token is $2 USD (set in fixture)
      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaToken.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('100000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // 100 tokens × $2 = $200; HYPHA = $0.50 → 400 HYPHA
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await hyphaToken.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('400'));
    });

    it('Should update output when space token price changes', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, SPACE_ID } = f;

      // Initial: community token = $2 → 100 tokens = $200 → 200 USDC
      let out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(200_000_000);

      // Change community token price to $5
      await communityToken.setPriceInUSD(5_000_000);

      out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      // 100 tokens × $5 = $500 → 500 USDC
      expect(out).to.equal(500_000_000);
    });

    it('Should update Hypha token output when priceInUSD changes', async function () {
      const { vault, communityToken, hyphaToken, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      // Set community token to $1
      await communityToken.setPriceInUSD(1_000_000);

      await hyphaToken.mint(executor.address, ethers.parseEther('100000'));
      await hyphaToken
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('100000'));

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaToken.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('100000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      // HYPHA = $0.50 → 100 tokens ($100) = 200 HYPHA
      let out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await hyphaToken.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('200'));

      // HYPHA price rises to $2.00
      await hyphaToken.setPriceInUSD(2_000_000);
      out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await hyphaToken.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('50'));
    });

    it('Should work with non-USD peg (EUR community token via priceCurrencyFeed)', async function () {
      const {
        vault,
        communityToken,
        usdc,
        usdcFeed,
        eurUsdFeed,
        executor,
        SPACE_ID,
      } = await loadFixture(deployFixture);

      // Set community token to 1 EUR (using setPriceWithCurrency)
      await communityToken.setPriceWithCurrency(
        1_000_000, // 1.00 EUR
        await eurUsdFeed.getAddress(), // EUR/USD feed
      );

      await usdc.mint(executor.address, 500_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 500_000e6);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [500_000e6],
          0,
          0,
          ethers.ZeroAddress,
        );

      // 100 tokens × 1 EUR × $1.08/EUR = $108; USDC = $1 → 108 USDC
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(108_000_000);
    });
  });

  // ================================================================
  //                      REDEMPTION FLOW
  // ================================================================

  describe('Redemption', function () {
    it('Should redeem for USDC and burn community tokens', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      const before = await communityToken.totalSupply();

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('100'),
          [await usdc.getAddress()],
          [10000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(200_000_000);
      expect(await communityToken.totalSupply()).to.equal(
        before - ethers.parseEther('100'),
      );
    });

    it('Should redeem for WETH at oracle price', async function () {
      const f = await setupVault();
      const { vault, communityToken, weth, alice, SPACE_ID } = f;

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('500'),
          [await weth.getAddress()],
          [10000],
        );

      expect(await weth.balanceOf(alice.address)).to.equal(
        ethers.parseEther('0.4'),
      );
    });

    it('Should redeem across USDC + WETH', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('1000'),
          [await usdc.getAddress(), await weth.getAddress()],
          [6000, 4000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(1_200_000_000);
      expect(await weth.balanceOf(alice.address)).to.equal(
        ethers.parseEther('0.32'),
      );
    });

    it('Should revert if reserve is insufficient', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await communityToken.mint(alice.address, ethers.parseEther('60000'));

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('60000'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Insufficient backing in reserve');
    });
  });

  // ================================================================
  //                   MINIMUM BACKING THRESHOLD
  // ================================================================

  describe('Minimum Backing Threshold', function () {
    it('Should block redemption that breaches the 20 % floor', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await communityToken.mint(alice.address, ethers.parseEther('500000'));

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('1000'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Redemption would breach minimum backing threshold');
    });

    it('Should allow redemption when above the minimum', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;
    });
  });

  // ================================================================
  //              ACCESS CONTROL — WHITELIST & MEMBERSHIP
  // ================================================================

  describe('Access Control', function () {
    it('Should block non-member when membersOnly is on', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, nonMember, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setMembersOnly(SPACE_ID, await communityToken.getAddress(), true);

      await communityToken.mint(nonMember.address, ethers.parseEther('100'));
      await communityToken
        .connect(nonMember)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Not authorized to redeem');
    });

    it('Should allow whitelisted non-member when both flags are on (OR logic)', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, nonMember, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setMembersOnly(SPACE_ID, await communityToken.getAddress(), true);
      await vault
        .connect(executor)
        .setWhitelistEnabled(SPACE_ID, await communityToken.getAddress(), true);
      await vault
        .connect(executor)
        .addToWhitelist(SPACE_ID, await communityToken.getAddress(), [
          nonMember.address,
        ]);

      await communityToken.mint(nonMember.address, ethers.parseEther('100'));
      await communityToken
        .connect(nonMember)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;
    });

    it('Should allow member who is NOT whitelisted when both flags are on (OR logic)', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setMembersOnly(SPACE_ID, await communityToken.getAddress(), true);
      await vault
        .connect(executor)
        .setWhitelistEnabled(SPACE_ID, await communityToken.getAddress(), true);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;
    });
  });

  // ================================================================
  //                  REDEMPTION START DATE
  // ================================================================

  describe('Redemption Start Date', function () {
    it('Should block redemptions before the start date', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      const futureDate = (await time.latest()) + 7 * 24 * 3600;
      await vault
        .connect(executor)
        .setRedemptionStartDate(
          SPACE_ID,
          await communityToken.getAddress(),
          futureDate,
        );

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Redemptions not yet active');
    });

    it('Should allow redemptions after the start date', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      const futureDate = (await time.latest()) + 60;
      await vault
        .connect(executor)
        .setRedemptionStartDate(
          SPACE_ID,
          await communityToken.getAddress(),
          futureDate,
        );

      await time.increase(61);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;
    });
  });

  // ================================================================
  //          PEG VALUE — READ FROM SPACE TOKEN
  // ================================================================

  describe('Peg Value (from space token)', function () {
    it('Should change redemption output when space token price is updated', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, SPACE_ID } = f;

      // Initial: community token = $2 → 100 tokens = $200 → 200 USDC
      let out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(200_000_000);

      // Space updates token price to $5 (via setPriceInUSD on the token contract)
      await communityToken.setPriceInUSD(5_000_000);

      out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(500_000_000);
    });
  });

  // ================================================================
  //                 PRICE FEED UPDATES
  // ================================================================

  describe('Price Feed Management', function () {
    it('Should allow executor to update a Chainlink feed', async function () {
      const f = await setupVault();
      const { vault, communityToken, weth, executor, SPACE_ID } = f;

      const Feed = await ethers.getContractFactory('MockChainlinkFeed');
      const newFeed = await Feed.deploy(3000_0000_0000, 8);

      await expect(
        vault
          .connect(executor)
          .updatePriceFeed(
            SPACE_ID,
            await communityToken.getAddress(),
            await weth.getAddress(),
            await newFeed.getAddress(),
          ),
      ).to.emit(vault, 'PriceFeedUpdated');

      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await weth.getAddress(),
      );
      // 200 / 3000 * 1e18 = 66666666666666666
      expect(out).to.equal(66666666666666666n);
    });

    it('Should reject setting a feed on a Hypha token', async function () {
      const {
        vault,
        communityToken,
        hyphaToken,
        usdcFeed,
        executor,
        SPACE_ID,
      } = await loadFixture(deployFixture);

      await hyphaToken.mint(executor.address, ethers.parseEther('1000'));
      await hyphaToken
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('1000'));

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaToken.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('1000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      await expect(
        vault
          .connect(executor)
          .updatePriceFeed(
            SPACE_ID,
            await communityToken.getAddress(),
            await hyphaToken.getAddress(),
            await usdcFeed.getAddress(),
          ),
      ).to.be.revertedWith('Cannot set feed for Hypha token');
    });
  });

  // ================================================================
  //              AUTHORIZATION — EXECUTOR ONLY
  // ================================================================

  describe('Authorization', function () {
    it('Should reject addBackingToken from non-executor', async function () {
      const { vault, communityToken, usdc, usdcFeed, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(alice)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject addBacking from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .addBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [1000],
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject removeBackingToken from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .removeBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject updatePriceFeed from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, weth, usdcFeed, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .updatePriceFeed(
            SPACE_ID,
            await communityToken.getAddress(),
            await weth.getAddress(),
            await usdcFeed.getAddress(),
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject setRedeemEnabled from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .setRedeemEnabled(SPACE_ID, await communityToken.getAddress(), false),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject setMembersOnly from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .setMembersOnly(SPACE_ID, await communityToken.getAddress(), true),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject setWhitelistEnabled from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .setWhitelistEnabled(
            SPACE_ID,
            await communityToken.getAddress(),
            true,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject setMinimumBacking from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .setMinimumBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            5000,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject setRedemptionStartDate from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .setRedemptionStartDate(
            SPACE_ID,
            await communityToken.getAddress(),
            9999999999,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject addToWhitelist from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .addToWhitelist(SPACE_ID, await communityToken.getAddress(), [
            alice.address,
          ]),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject removeFromWhitelist from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .removeFromWhitelist(SPACE_ID, await communityToken.getAddress(), [
            alice.address,
          ]),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should reject withdrawBacking from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .withdrawBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
            1000,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should allow contract owner to call executor-only functions', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, owner, SPACE_ID } = f;

      await expect(
        vault
          .connect(owner)
          .setRedeemEnabled(SPACE_ID, await communityToken.getAddress(), false),
      ).to.not.be.reverted;

      await expect(
        vault
          .connect(owner)
          .setRedeemEnabled(SPACE_ID, await communityToken.getAddress(), true),
      ).to.not.be.reverted;
    });
  });

  // ================================================================
  //              VAULT CREATION — EDGE CASES
  // ================================================================

  describe('Vault Creation — Edge Cases', function () {
    it('Should reject zero-address space token', async function () {
      const { vault, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            ethers.ZeroAddress,
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Invalid space token');
    });

    it('Should reject empty backing tokens array', async function () {
      const { vault, communityToken, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [],
            [],
            [],
            [],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('No backing tokens specified');
    });

    it('Should reject mismatched array lengths', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6, 18],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Array lengths must match');
    });

    it('Should reject minimumBackingBps > 1000%', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            100001,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Min backing cannot exceed 1000%');
    });

    it('Should allow minimumBackingBps up to 1000% (overcollateralization)', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            50000,
            0,
            ethers.ZeroAddress,
          ),
      ).to.not.be.reverted;
    });

    it('Should reject backing token == space token', async function () {
      const { vault, communityToken, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [await communityToken.getAddress()],
            [await usdcFeed.getAddress()],
            [18],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Backing token cannot be the space token');
    });

    it('Should reject zero-address backing token', async function () {
      const { vault, communityToken, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [ethers.ZeroAddress],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Invalid backing token');
    });

    it('Should reject adding duplicate backing token', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .addBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [await usdcFeed.getAddress()],
            [6],
            [0],
            0,
            0,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Backing token already added');
    });

    it('Should create vault without funding (zero amounts)', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [0],
          0,
          0,
          ethers.ZeroAddress,
        );

      expect(
        await vault.vaultExists(SPACE_ID, await communityToken.getAddress()),
      ).to.be.true;
      expect(
        await vault.getBackingBalance(
          SPACE_ID,
          await communityToken.getAddress(),
          await usdc.getAddress(),
        ),
      ).to.equal(0);
    });

    it('Should add more backing tokens to an existing vault', async function () {
      const f = await setupVault();
      const { vault, communityToken, wbtc, btcFeed, executor, SPACE_ID } = f;

      await wbtc.mint(executor.address, 2_0000_0000); // 2 BTC (8 decimals)
      await wbtc
        .connect(executor)
        .approve(await vault.getAddress(), 2_0000_0000);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await wbtc.getAddress()],
          [await btcFeed.getAddress()],
          [8],
          [2_0000_0000],
          0,
          0,
          ethers.ZeroAddress,
        );

      const tokens = await vault.getBackingTokens(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(tokens.length).to.equal(3);
    });

    it('Should re-use existing vault when calling addBackingToken again', async function () {
      const f = await setupVault();
      const { vault, communityToken, wbtc, btcFeed, executor, SPACE_ID } = f;

      await wbtc.mint(executor.address, 1_0000_0000);
      await wbtc
        .connect(executor)
        .approve(await vault.getAddress(), 1_0000_0000);

      const tx = vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await wbtc.getAddress()],
          [await btcFeed.getAddress()],
          [8],
          [1_0000_0000],
          0,
          0,
          ethers.ZeroAddress,
        );

      await expect(tx).to.not.emit(vault, 'VaultCreated');
      await expect(tx).to.emit(vault, 'BackingTokenAdded');
    });
  });

  // ================================================================
  //              REDEMPTION — EDGE CASES
  // ================================================================

  describe('Redemption — Edge Cases', function () {
    it('Should reject redeeming zero amount', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            0,
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Amount must be > 0');
    });

    it('Should reject redemption when disabled', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setRedeemEnabled(SPACE_ID, await communityToken.getAddress(), false);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Redemptions are disabled');
    });

    it('Should reject redemption for disabled backing token', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      await vault
        .connect(executor)
        .removeBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          await usdc.getAddress(),
        );

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Backing token not active');
    });

    it('Should reject redemption for a non-existent vault', async function () {
      const { vault, communityToken, usdc, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Vault does not exist');
    });

    it('Should emit Redeemed event with correct parameters', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress()],
            [10000],
          ),
      )
        .to.emit(vault, 'Redeemed')
        .withArgs(
          1,
          alice.address,
          ethers.parseEther('100'),
          [await usdc.getAddress()],
          [200_000_000],
        );
    });

    it('Should handle sequential redemptions correctly', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('50'),
          [await usdc.getAddress()],
          [10000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(100_000_000);

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('50'),
          [await usdc.getAddress()],
          [10000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(200_000_000);

      const remaining = await vault.getBackingBalance(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );
      expect(remaining).to.equal(100_000e6 - 200_000_000);
    });

    it('Should allow full supply burn even with min backing (remaining supply = 0)', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await usdc.mint(executor.address, 100_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 100_000e6);

      await vault.connect(executor).addBackingToken(
        SPACE_ID,
        await communityToken.getAddress(),
        [await usdc.getAddress()],
        [await usdcFeed.getAddress()],
        [6],
        [100_000e6],
        5000, // 50% min backing
        0,
        ethers.ZeroAddress,
      );

      const mintAmount = ethers.parseEther('1000');
      await communityToken.mint(alice.address, mintAmount);
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            mintAmount,
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;

      expect(await communityToken.totalSupply()).to.equal(0);
    });

    it('Should allow multiple users to redeem from the same vault', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, bob, SPACE_ID } = f;

      await communityToken.mint(bob.address, ethers.parseEther('5000'));
      await communityToken
        .connect(bob)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('100'),
          [await usdc.getAddress()],
          [10000],
        );
      await vault
        .connect(bob)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('200'),
          [await usdc.getAddress()],
          [10000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(200_000_000);
      expect(await usdc.balanceOf(bob.address)).to.equal(400_000_000);
    });
  });

  // ================================================================
  //              REDEEM MULTI — EDGE CASES
  // ================================================================

  describe('Redeem — Edge Cases', function () {
    it('Should reject proportions that do not sum to 10000', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress(), await weth.getAddress()],
            [5000, 3000],
          ),
      ).to.be.revertedWith('Proportions must sum to 10000');
    });

    it('Should reject proportions exceeding 10000', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress(), await weth.getAddress()],
            [7000, 5000],
          ),
      ).to.be.revertedWith('Proportions must sum to 10000');
    });

    it('Should reject zero proportion', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress(), await weth.getAddress()],
            [0, 10000],
          ),
      ).to.be.revertedWith('Proportion must be > 0');
    });

    it('Should reject empty backing tokens in redeem', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [],
            [],
          ),
      ).to.be.revertedWith('No backing tokens specified');
    });

    it('Should reject mismatched arrays in redeem', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress(), await weth.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Array lengths must match');
    });

    it('Should reject zero amount in redeem', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            0,
            [await usdc.getAddress(), await weth.getAddress()],
            [5000, 5000],
          ),
      ).to.be.revertedWith('Amount must be > 0');
    });

    it('Should emit RedeemedMulti event', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('100'),
            [await usdc.getAddress(), await weth.getAddress()],
            [5000, 5000],
          ),
      ).to.emit(vault, 'Redeemed');
    });

    it('Should redeem with 100% to a single token', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, alice, SPACE_ID } = f;

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('100'),
          [await usdc.getAddress()],
          [10000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(200_000_000);
    });
  });

  // ================================================================
  //          MINIMUM BACKING — ADVANCED TESTS
  // ================================================================

  describe('Minimum Backing — Advanced', function () {
    it('Should allow any redemption when minimumBacking is 0', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await usdc.mint(executor.address, 10_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 10_000e6);

      await vault.connect(executor).addBackingToken(
        SPACE_ID,
        await communityToken.getAddress(),
        [await usdc.getAddress()],
        [await usdcFeed.getAddress()],
        [6],
        [10_000e6],
        0, // no min backing
        0,
        ethers.ZeroAddress,
      );

      await communityToken.mint(alice.address, ethers.parseEther('5000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('5000'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;
    });

    it('Should allow executor to update minimumBacking', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setMinimumBacking(SPACE_ID, await communityToken.getAddress(), 5000),
      )
        .to.emit(vault, 'MinimumBackingUpdated')
        .withArgs(1, 5000);

      const config = await vault.getVaultConfig(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(config.minimumBackingBps).to.equal(5000);
    });

    it('Should reject setMinimumBacking > 1000%', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setMinimumBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            100001,
          ),
      ).to.be.revertedWith('Min backing cannot exceed 1000%');
    });

    it('Should enforce min backing on redeem', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await communityToken.mint(alice.address, ethers.parseEther('500000'));

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('1000'),
            [await usdc.getAddress(), await weth.getAddress()],
            [5000, 5000],
          ),
      ).to.be.revertedWith('Redemption would breach minimum backing threshold');
    });
  });

  // ================================================================
  //          ACCESS CONTROL — EXTENDED
  // ================================================================

  describe('Access Control — Extended', function () {
    it('Should block non-whitelisted when only whitelist is on (no membersOnly)', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, nonMember, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setWhitelistEnabled(
          SPACE_ID,
          await communityToken.getAddress(),
          true,
        );

      await communityToken.mint(nonMember.address, ethers.parseEther('100'));
      await communityToken
        .connect(nonMember)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Not authorized to redeem');
    });

    it('Should block after removing from whitelist', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, nonMember, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setWhitelistEnabled(
          SPACE_ID,
          await communityToken.getAddress(),
          true,
        );
      await vault
        .connect(executor)
        .addToWhitelist(SPACE_ID, await communityToken.getAddress(), [
          nonMember.address,
        ]);

      await communityToken.mint(nonMember.address, ethers.parseEther('100'));
      await communityToken
        .connect(nonMember)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('5'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;

      await vault
        .connect(executor)
        .removeFromWhitelist(SPACE_ID, await communityToken.getAddress(), [
          nonMember.address,
        ]);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('5'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Not authorized to redeem');
    });

    it('Should allow anyone when neither membersOnly nor whitelist is active', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, nonMember, SPACE_ID } = f;

      await communityToken.mint(nonMember.address, ethers.parseEther('100'));
      await communityToken
        .connect(nonMember)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;
    });

    it('Should block non-member, non-whitelisted user when both flags on', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, nonMember, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setMembersOnly(SPACE_ID, await communityToken.getAddress(), true);
      await vault
        .connect(executor)
        .setWhitelistEnabled(
          SPACE_ID,
          await communityToken.getAddress(),
          true,
        );

      await communityToken.mint(nonMember.address, ethers.parseEther('100'));
      await communityToken
        .connect(nonMember)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(
        vault
          .connect(nonMember)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Not authorized to redeem');
    });
  });

  // ================================================================
  //              FUNDING & WITHDRAWALS
  // ================================================================

  describe('Funding & Withdrawals', function () {
    it('Should add backing and increase vault balance', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      const before = await vault.getBackingBalance(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );

      await usdc.mint(executor.address, 10_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 10_000e6);

      await expect(
        vault
          .connect(executor)
          .addBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [10_000e6],
          ),
      )
        .to.emit(vault, 'BackingDeposited')
        .withArgs(1, executor.address, await usdc.getAddress(), 10_000e6);

      const after = await vault.getBackingBalance(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );
      expect(after - before).to.equal(10_000e6);
    });

    it('Should reject addBacking with zero amount', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .addBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            [await usdc.getAddress()],
            [0],
          ),
      ).to.be.revertedWith('Amount must be > 0');
    });

    it('Should reject addBacking for inactive backing token', async function () {
      const f = await setupVault();
      const { vault, communityToken, wbtc, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .addBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            [await wbtc.getAddress()],
            [1000],
          ),
      ).to.be.revertedWith('Backing token not active');
    });

    it('Should withdraw backing and decrease vault balance', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      const before = await vault.getBackingBalance(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );

      await expect(
        vault
          .connect(executor)
          .withdrawBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
            10_000e6,
          ),
      )
        .to.emit(vault, 'BackingWithdrawn')
        .withArgs(1, await usdc.getAddress(), 10_000e6);

      const after = await vault.getBackingBalance(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );
      expect(before - after).to.equal(10_000e6);

      expect(await usdc.balanceOf(executor.address)).to.equal(10_000e6);
    });

    it('Should reject withdraw with zero amount', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .withdrawBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
            0,
          ),
      ).to.be.revertedWith('Amount must be > 0');
    });

    it('Should reject withdraw exceeding balance', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .withdrawBacking(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
            200_000e6,
          ),
      ).to.be.revertedWith('Insufficient backing balance');
    });
  });

  // ================================================================
  //              REMOVE BACKING TOKEN
  // ================================================================

  describe('Remove Backing Token', function () {
    it('Should remove a backing token and update the list', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .removeBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
          ),
      )
        .to.emit(vault, 'BackingTokenRemoved')
        .withArgs(1, await usdc.getAddress());

      const tokens = await vault.getBackingTokens(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(tokens.length).to.equal(1);

      const config = await vault.getBackingTokenConfig(
        SPACE_ID,
        await communityToken.getAddress(),
        await usdc.getAddress(),
      );
      expect(config.enabled).to.be.false;
    });

    it('Should reject removing an already removed token', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      await vault
        .connect(executor)
        .removeBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          await usdc.getAddress(),
        );

      await expect(
        vault
          .connect(executor)
          .removeBackingToken(
            SPACE_ID,
            await communityToken.getAddress(),
            await usdc.getAddress(),
          ),
      ).to.be.revertedWith('Backing token not active');
    });

    it('Should block redemption for removed backing token', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      await vault
        .connect(executor)
        .removeBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          await usdc.getAddress(),
        );

      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('10'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Backing token not active');
    });
  });

  // ================================================================
  //       VIEW FUNCTIONS, MULTI-VAULT, OWNER & EDGE CASES
  // ================================================================

  describe('View Functions & Multi-vault', function () {
    it('Should return correct vault config', async function () {
      const f = await setupVault();
      const { vault, communityToken, SPACE_ID } = f;

      const config = await vault.getVaultConfig(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(config.spaceId).to.equal(SPACE_ID);
      expect(config.spaceToken).to.equal(await communityToken.getAddress());
      expect(config.redeemEnabled).to.be.true;
      expect(config.membersOnly).to.be.false;
      expect(config.whitelistEnabled).to.be.false;
      expect(config.minimumBackingBps).to.equal(2000);
      expect(config.redemptionStartDate).to.equal(0);
    });

    it('Should return false for non-existent vault', async function () {
      const { vault, SPACE_ID } = await loadFixture(deployFixture);

      expect(
        await vault.vaultExists(SPACE_ID, ethers.ZeroAddress),
      ).to.be.false;
    });

    it('Should track vaults per space via getSpaceVaults', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      expect((await vault.getSpaceVaults(SPACE_ID)).length).to.equal(0);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [0],
          0,
          0,
          ethers.ZeroAddress,
        );

      const vaultIds = await vault.getSpaceVaults(SPACE_ID);
      expect(vaultIds.length).to.equal(1);
    });

    it('Should create separate vaults for different space tokens in the same space', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      const Community2 = await ethers.getContractFactory('MockSpaceToken');
      const communityToken2 = await Community2.deploy('Token2', 'TK2', 3_000_000);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [0],
          0,
          0,
          ethers.ZeroAddress,
        );

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken2.getAddress(),
          [await usdc.getAddress()],
          [await usdcFeed.getAddress()],
          [6],
          [0],
          0,
          0,
          ethers.ZeroAddress,
        );

      const vaultIds = await vault.getSpaceVaults(SPACE_ID);
      expect(vaultIds.length).to.equal(2);

      expect(
        await vault.vaultExists(SPACE_ID, await communityToken.getAddress()),
      ).to.be.true;
      expect(
        await vault.vaultExists(SPACE_ID, await communityToken2.getAddress()),
      ).to.be.true;
    });

    it('Should report whitelist status correctly', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, alice, nonMember, SPACE_ID } = f;

      expect(
        await vault.isWhitelisted(
          SPACE_ID,
          await communityToken.getAddress(),
          alice.address,
        ),
      ).to.be.false;

      await vault
        .connect(executor)
        .addToWhitelist(SPACE_ID, await communityToken.getAddress(), [
          alice.address,
        ]);

      expect(
        await vault.isWhitelisted(
          SPACE_ID,
          await communityToken.getAddress(),
          alice.address,
        ),
      ).to.be.true;

      expect(
        await vault.isWhitelisted(
          SPACE_ID,
          await communityToken.getAddress(),
          nonMember.address,
        ),
      ).to.be.false;
    });
  });

  // ================================================================
  //           BTC (8 decimals) & CROSS-DECIMAL PRECISION
  // ================================================================

  describe('Cross-Decimal Precision (BTC 8 decimals)', function () {
    it('Should calculate correct BTC output (100 tokens × $2 = $200 → BTC at $60k)', async function () {
      const { vault, communityToken, wbtc, btcFeed, usdcFeed, usdc, executor, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await wbtc.mint(executor.address, 10_0000_0000); // 10 BTC
      await wbtc
        .connect(executor)
        .approve(await vault.getAddress(), 10_0000_0000);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await wbtc.getAddress()],
          [await btcFeed.getAddress()],
          [8],
          [10_0000_0000],
          0,
          0,
          ethers.ZeroAddress,
        );

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // 100 tokens × $2 = $200; BTC = $60,000 → 200/60000 = 0.00333333 BTC
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await wbtc.getAddress(),
      );
      // 200 / 60000 * 1e8 = 333333
      expect(out).to.equal(333333n);
    });

    it('Should redeem BTC correctly', async function () {
      const { vault, communityToken, wbtc, btcFeed, executor, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await wbtc.mint(executor.address, 10_0000_0000);
      await wbtc
        .connect(executor)
        .approve(await vault.getAddress(), 10_0000_0000);

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await wbtc.getAddress()],
          [await btcFeed.getAddress()],
          [8],
          [10_0000_0000],
          0,
          0,
          ethers.ZeroAddress,
        );

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('100'),
          [await wbtc.getAddress()],
          [10000],
        );

      expect(await wbtc.balanceOf(alice.address)).to.equal(333333n);
    });
  });

  // ================================================================
  //           OWNER-LEVEL OPERATIONS
  // ================================================================

  describe('Owner Operations', function () {
    it('Should allow owner to set spaces contract', async function () {
      const { vault, owner } = await loadFixture(deployFixture);

      const MockFactory = await ethers.getContractFactory('MockDAOSpaceFactory');
      const newFactory = await MockFactory.deploy();

      await vault.connect(owner).setSpacesContract(await newFactory.getAddress());
    });

    it('Should reject setSpacesContract with zero address', async function () {
      const { vault, owner } = await loadFixture(deployFixture);

      await expect(
        vault.connect(owner).setSpacesContract(ethers.ZeroAddress),
      ).to.be.revertedWith('Invalid spaces contract');
    });

    it('Should reject setSpacesContract from non-owner', async function () {
      const { vault, alice } = await loadFixture(deployFixture);

      const MockFactory = await ethers.getContractFactory('MockDAOSpaceFactory');
      const newFactory = await MockFactory.deploy();

      await expect(
        vault.connect(alice).setSpacesContract(await newFactory.getAddress()),
      ).to.be.reverted;
    });
  });

  // ================================================================
  //           NON-USD PEG — EUR COMMUNITY TOKEN WITH HYPHA BACKING
  // ================================================================

  describe('Non-USD Peg — Complex Cross-Currency', function () {
    it('Should correctly calculate EUR-priced community → USD-priced Hypha backing', async function () {
      const {
        vault,
        communityToken,
        hyphaToken,
        eurUsdFeed,
        executor,
        alice,
        SPACE_ID,
      } = await loadFixture(deployFixture);

      // Community token = 2 EUR; EUR/USD = 1.08 → $2.16 per token
      await communityToken.setPriceWithCurrency(
        2_000_000,
        await eurUsdFeed.getAddress(),
      );

      // Hypha backing token = $0.50 USD
      await hyphaToken.mint(executor.address, ethers.parseEther('100000'));
      await hyphaToken
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('100000'));

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaToken.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('100000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // 100 tokens × $2.16 = $216; HYPHA = $0.50 → 432 HYPHA
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await hyphaToken.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('432'));
    });

    it('Should handle EUR community with EUR-denominated Hypha backing', async function () {
      const {
        vault,
        communityToken,
        eurUsdFeed,
        executor,
        alice,
        SPACE_ID,
      } = await loadFixture(deployFixture);

      // Community token = 5 EUR
      await communityToken.setPriceWithCurrency(
        5_000_000,
        await eurUsdFeed.getAddress(),
      );

      // EUR-denominated Hypha backing token = 2 EUR
      const HyphaEur = await ethers.getContractFactory('MockSpaceToken');
      const hyphaEur = await HyphaEur.deploy('HYPHA_EUR', 'HEUR', 2_000_000);
      await hyphaEur.setPriceWithCurrency(
        2_000_000,
        await eurUsdFeed.getAddress(),
      );

      await hyphaEur.mint(executor.address, ethers.parseEther('100000'));
      await hyphaEur
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('100000'));

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaEur.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('100000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // 100 tokens × 5 EUR × $1.08 = $540
      // HYPHA_EUR = 2 EUR × $1.08 = $2.16
      // $540 / $2.16 = 250 HYPHA_EUR
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await hyphaEur.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('250'));
    });
  });

  // ================================================================
  //           EVENT EMISSION — CONFIGURATION CHANGES
  // ================================================================

  describe('Configuration Events', function () {
    it('Should emit RedeemEnabledUpdated', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setRedeemEnabled(SPACE_ID, await communityToken.getAddress(), false),
      )
        .to.emit(vault, 'RedeemEnabledUpdated')
        .withArgs(1, false);
    });

    it('Should emit MembersOnlyUpdated', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setMembersOnly(SPACE_ID, await communityToken.getAddress(), true),
      )
        .to.emit(vault, 'MembersOnlyUpdated')
        .withArgs(1, true);
    });

    it('Should emit WhitelistEnabledUpdated', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setWhitelistEnabled(
            SPACE_ID,
            await communityToken.getAddress(),
            true,
          ),
      )
        .to.emit(vault, 'WhitelistEnabledUpdated')
        .withArgs(1, true);
    });

    it('Should emit RedemptionStartDateUpdated', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setRedemptionStartDate(
            SPACE_ID,
            await communityToken.getAddress(),
            1700000000,
          ),
      )
        .to.emit(vault, 'RedemptionStartDateUpdated')
        .withArgs(1, 1700000000);
    });

    it('Should emit WhitelistUpdated on add and remove', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, alice, bob, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .addToWhitelist(SPACE_ID, await communityToken.getAddress(), [
            alice.address,
            bob.address,
          ]),
      )
        .to.emit(vault, 'WhitelistUpdated')
        .withArgs(1, [alice.address, bob.address], true);

      await expect(
        vault
          .connect(executor)
          .removeFromWhitelist(SPACE_ID, await communityToken.getAddress(), [
            alice.address,
          ]),
      )
        .to.emit(vault, 'WhitelistUpdated')
        .withArgs(1, [alice.address], false);
    });

    it('Should emit RedemptionPriceUpdated', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await expect(
        vault
          .connect(executor)
          .setRedemptionPrice(
            SPACE_ID,
            await communityToken.getAddress(),
            1_500_000,
            ethers.ZeroAddress,
          ),
      )
        .to.emit(vault, 'RedemptionPriceUpdated')
        .withArgs(1, 1_500_000, ethers.ZeroAddress);
    });
  });

  // ================================================================
  //           REDEMPTION PRICE — SEPARATE FROM OFFICIAL PRICE
  // ================================================================

  describe('Redemption Price', function () {
    it('Should default to 0 (use official price)', async function () {
      const f = await setupVault();
      const { vault, communityToken, SPACE_ID } = f;

      const [price, feed] = await vault.getRedemptionPrice(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(price).to.equal(0);
      expect(feed).to.equal(ethers.ZeroAddress);
    });

    it('Should allow executor to set a redemption price (USD)', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          1_500_000,
          ethers.ZeroAddress,
        );

      const [price, feed] = await vault.getRedemptionPrice(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(price).to.equal(1_500_000);
      expect(feed).to.equal(ethers.ZeroAddress);
    });

    it('Should reject setRedemptionPrice from non-executor', async function () {
      const f = await setupVault();
      const { vault, communityToken, alice, SPACE_ID } = f;

      await expect(
        vault
          .connect(alice)
          .setRedemptionPrice(
            SPACE_ID,
            await communityToken.getAddress(),
            1_000_000,
            ethers.ZeroAddress,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });

    it('Should redeem at discount when redemption price < official (Berkshares model)', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      // Official price = $2, set redemption price = $1.50
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          1_500_000,
          ethers.ZeroAddress,
        );

      // 100 tokens × $1.50 = $150 → 150 USDC (not $200)
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(150_000_000);

      await vault
        .connect(alice)
        .redeem(
          SPACE_ID,
          await communityToken.getAddress(),
          ethers.parseEther('100'),
          [await usdc.getAddress()],
          [10000],
        );

      expect(await usdc.balanceOf(alice.address)).to.equal(150_000_000);
    });

    it('Should redeem at premium when redemption price > official', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, alice, SPACE_ID } = f;

      // Official price = $2, set redemption price = $3
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          3_000_000,
          ethers.ZeroAddress,
        );

      // 100 tokens × $3 = $300 → 300 USDC
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(300_000_000);
    });

    it('Should revert to official price when redemption price is reset to 0', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, executor, SPACE_ID } = f;

      // Set redemption price to $1.50
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          1_500_000,
          ethers.ZeroAddress,
        );

      let out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(150_000_000);

      // Reset to 0 → falls back to official price ($2)
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          0,
          ethers.ZeroAddress,
        );

      out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(200_000_000);
    });

    it('Should support non-USD redemption price via currency feed', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, eurUsdFeed, executor, SPACE_ID } = f;

      // Set redemption price = 1 EUR (EUR/USD = 1.08 → $1.08)
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          1_000_000,
          await eurUsdFeed.getAddress(),
        );

      // 100 tokens × 1 EUR × $1.08/EUR = $108 → 108 USDC
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(108_000_000);
    });

    it('Should use redemption price for minimum backing liability calculation', async function () {
      const {
        vault,
        communityToken,
        usdc,
        usdcFeed,
        executor,
        alice,
        SPACE_ID,
      } = await loadFixture(deployFixture);

      await usdc.mint(executor.address, 100_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 100_000e6);

      // Create vault with 50% min backing, community token = $2
      await vault.connect(executor).addBackingToken(
        SPACE_ID,
        await communityToken.getAddress(),
        [await usdc.getAddress()],
        [await usdcFeed.getAddress()],
        [6],
        [100_000e6],
        5000, // 50% min backing
        0,
        ethers.ZeroAddress,
      );

      await communityToken.mint(alice.address, ethers.parseEther('100000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // With official price $2: liability = 100k tokens × $2 = $200k
      // 50% min backing = $100k coverage needed
      // Vault has $100k USDC → borderline
      // Redeeming 1000 tokens ($2k) would remove $2k coverage and $2k liability
      // Remaining: $98k coverage, $198k liability → 98k/198k = 49.5% < 50% → blocked
      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('1000'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.be.revertedWith('Redemption would breach minimum backing threshold');

      // Now set redemption price to $0.50 (4x lower)
      // Liability = 100k tokens × $0.50 = $50k
      // 50% min = $25k coverage needed (vault has $100k → plenty of room)
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          500_000,
          ethers.ZeroAddress,
        );

      // Same redemption should now succeed
      await expect(
        vault
          .connect(alice)
          .redeem(
            SPACE_ID,
            await communityToken.getAddress(),
            ethers.parseEther('1000'),
            [await usdc.getAddress()],
            [10000],
          ),
      ).to.not.be.reverted;

      // Alice gets 1000 × $0.50 = $500 → 500 USDC
      expect(await usdc.balanceOf(alice.address)).to.equal(500_000_000);
    });

    it('Should allow owner to set redemption price', async function () {
      const f = await setupVault();
      const { vault, communityToken, owner, SPACE_ID } = f;

      await expect(
        vault
          .connect(owner)
          .setRedemptionPrice(
            SPACE_ID,
            await communityToken.getAddress(),
            1_000_000,
            ethers.ZeroAddress,
          ),
      ).to.not.be.reverted;
    });

    it('Should work with Hypha backing token and redemption price', async function () {
      const {
        vault,
        communityToken,
        hyphaToken,
        executor,
        alice,
        SPACE_ID,
      } = await loadFixture(deployFixture);

      await hyphaToken.mint(executor.address, ethers.parseEther('100000'));
      await hyphaToken
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('100000'));

      await vault
        .connect(executor)
        .addBackingToken(
          SPACE_ID,
          await communityToken.getAddress(),
          [await hyphaToken.getAddress()],
          [ethers.ZeroAddress],
          [18],
          [ethers.parseEther('100000')],
          0,
          0,
          ethers.ZeroAddress,
        );

      // Set redemption price = $1 (official = $2)
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          1_000_000,
          ethers.ZeroAddress,
        );

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // 100 tokens × $1 = $100; HYPHA = $0.50 → 200 HYPHA (not 400)
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await hyphaToken.getAddress(),
      );
      expect(out).to.equal(ethers.parseEther('200'));
    });

    it('Should set redemption price during addBackingToken (vault creation)', async function () {
      const { vault, communityToken, usdc, usdcFeed, executor, alice, SPACE_ID } =
        await loadFixture(deployFixture);

      await usdc.mint(executor.address, 100_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 100_000e6);

      // Create vault with redemption price = $1.50 (official = $2)
      await vault.connect(executor).addBackingToken(
        SPACE_ID,
        await communityToken.getAddress(),
        [await usdc.getAddress()],
        [await usdcFeed.getAddress()],
        [6],
        [100_000e6],
        0,
        1_500_000,
        ethers.ZeroAddress,
      );

      const [price, feed] = await vault.getRedemptionPrice(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(price).to.equal(1_500_000);
      expect(feed).to.equal(ethers.ZeroAddress);

      await communityToken.mint(alice.address, ethers.parseEther('1000'));
      await communityToken
        .connect(alice)
        .approve(await vault.getAddress(), ethers.MaxUint256);

      // 100 tokens × $1.50 = $150 → 150 USDC
      const out = await vault.calculateBackingOut(
        SPACE_ID,
        await communityToken.getAddress(),
        ethers.parseEther('100'),
        await usdc.getAddress(),
      );
      expect(out).to.equal(150_000_000);
    });

    it('Should ignore redemption price on subsequent addBackingToken calls (vault already exists)', async function () {
      const { vault, communityToken, usdc, usdcFeed, weth, ethFeed, executor, SPACE_ID } =
        await loadFixture(deployFixture);

      await usdc.mint(executor.address, 100_000e6);
      await usdc.connect(executor).approve(await vault.getAddress(), 100_000e6);

      // Create vault with redemption price = $1.50
      await vault.connect(executor).addBackingToken(
        SPACE_ID,
        await communityToken.getAddress(),
        [await usdc.getAddress()],
        [await usdcFeed.getAddress()],
        [6],
        [100_000e6],
        0,
        1_500_000,
        ethers.ZeroAddress,
      );

      // Add another backing token — passing a different redemption price should be ignored
      await weth.mint(executor.address, ethers.parseEther('10'));
      await weth
        .connect(executor)
        .approve(await vault.getAddress(), ethers.parseEther('10'));

      await vault.connect(executor).addBackingToken(
        SPACE_ID,
        await communityToken.getAddress(),
        [await weth.getAddress()],
        [await ethFeed.getAddress()],
        [18],
        [ethers.parseEther('10')],
        0,
        3_000_000,
        ethers.ZeroAddress,
      );

      // Redemption price should still be $1.50, not $3
      const [price] = await vault.getRedemptionPrice(
        SPACE_ID,
        await communityToken.getAddress(),
      );
      expect(price).to.equal(1_500_000);
    });

    it('Should not affect official price when redemption price is set', async function () {
      const f = await setupVault();
      const { vault, communityToken, executor, SPACE_ID } = f;

      // Set redemption price = $1.50
      await vault
        .connect(executor)
        .setRedemptionPrice(
          SPACE_ID,
          await communityToken.getAddress(),
          1_500_000,
          ethers.ZeroAddress,
        );

      // Official price should still be $2 (unchanged on the token)
      const MockSpaceToken = await ethers.getContractFactory('MockSpaceToken');
      const token = MockSpaceToken.attach(await communityToken.getAddress());
      expect(await token.tokenPrice()).to.equal(2_000_000);
    });
  });
});
