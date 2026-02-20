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
            await weth.getAddress(),
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
          await usdc.getAddress(),
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
          await weth.getAddress(),
        );

      expect(await weth.balanceOf(alice.address)).to.equal(
        ethers.parseEther('0.4'),
      );
    });

    it('Should redeemMulti across USDC + WETH', async function () {
      const f = await setupVault();
      const { vault, communityToken, usdc, weth, alice, SPACE_ID } = f;

      await vault
        .connect(alice)
        .redeemMulti(
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
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
            await usdc.getAddress(),
            1000,
          ),
      ).to.be.revertedWith('Not authorized: only executor or owner');
    });
  });
});
