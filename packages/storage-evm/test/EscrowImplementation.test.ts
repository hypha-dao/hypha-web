import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('EscrowImplementation', function () {
  async function deployFixture() {
    const [owner, partyA, partyB, creator, stranger] =
      await ethers.getSigners();

    // Deploy EscrowImplementation via UUPS proxy
    const EscrowFactory =
      await ethers.getContractFactory('EscrowImplementation');
    const escrow = await upgrades.deployProxy(
      EscrowFactory,
      [owner.address],
      { initializer: 'initialize', kind: 'uups' },
    );

    // Deploy two mock ERC20 tokens
    const TokenFactory = await ethers.getContractFactory('MockERC20');
    const tokenA = await TokenFactory.deploy('Token A', 'TKA', 18);
    const tokenB = await TokenFactory.deploy('Token B', 'TKB', 18);

    const AMOUNT_A = ethers.parseEther('100');
    const AMOUNT_B = ethers.parseEther('200');

    // Mint tokens to the respective parties
    await tokenA.mint(partyA.address, ethers.parseEther('10000'));
    await tokenB.mint(partyB.address, ethers.parseEther('10000'));

    return {
      escrow,
      tokenA,
      tokenB,
      owner,
      partyA,
      partyB,
      creator,
      stranger,
      AMOUNT_A,
      AMOUNT_B,
    };
  }

  // ──────────────────────────────────────────────
  //  Deployment & Initialization
  // ──────────────────────────────────────────────
  describe('Deployment', function () {
    it('sets the correct owner', async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it('starts with escrowCounter = 0', async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.escrowCounter()).to.equal(0);
    });
  });

  // ──────────────────────────────────────────────
  //  createEscrow – third-party creator
  // ──────────────────────────────────────────────
  describe('createEscrow', function () {
    it('allows a third-party to create an escrow for two other parties', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      const tx = await escrow
        .connect(creator)
        .createEscrow(
          partyA.address,
          partyB.address,
          tokenA.target,
          tokenB.target,
          AMOUNT_A,
          AMOUNT_B,
          false,
        );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      const data = await escrow.getEscrow(1);
      expect(data.creator).to.equal(creator.address);
      expect(data.partyA).to.equal(partyA.address);
      expect(data.partyB).to.equal(partyB.address);
      expect(data.tokenA).to.equal(tokenA.target);
      expect(data.tokenB).to.equal(tokenB.target);
      expect(data.amountA).to.equal(AMOUNT_A);
      expect(data.amountB).to.equal(AMOUNT_B);
    });

    it('emits EscrowCreated with correct creator, partyA, partyB', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(creator)
          .createEscrow(
            partyA.address,
            partyB.address,
            tokenA.target,
            tokenB.target,
            AMOUNT_A,
            AMOUNT_B,
            false,
          ),
      )
        .to.emit(escrow, 'EscrowCreated')
        .withArgs(
          1,
          creator.address,
          partyA.address,
          partyB.address,
          tokenA.target,
          tokenB.target,
          AMOUNT_A,
          AMOUNT_B,
        );
    });

    it('allows partyA to also be the creator', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await escrow
        .connect(partyA)
        .createEscrow(
          partyA.address,
          partyB.address,
          tokenA.target,
          tokenB.target,
          AMOUNT_A,
          AMOUNT_B,
          false,
        );

      const data = await escrow.getEscrow(1);
      expect(data.creator).to.equal(partyA.address);
      expect(data.partyA).to.equal(partyA.address);
    });

    it('reverts if partyA == partyB', async function () {
      const { escrow, tokenA, tokenB, partyA, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(creator)
          .createEscrow(
            partyA.address,
            partyA.address,
            tokenA.target,
            tokenB.target,
            AMOUNT_A,
            AMOUNT_B,
            false,
          ),
      ).to.be.revertedWith('Parties must be different');
    });

    it('reverts if partyA is zero address', async function () {
      const { escrow, tokenA, tokenB, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(creator)
          .createEscrow(
            ethers.ZeroAddress,
            partyB.address,
            tokenA.target,
            tokenB.target,
            AMOUNT_A,
            AMOUNT_B,
            false,
          ),
      ).to.be.revertedWith('Invalid party A address');
    });

    it('reverts if partyB is zero address', async function () {
      const { escrow, tokenA, tokenB, partyA, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(creator)
          .createEscrow(
            partyA.address,
            ethers.ZeroAddress,
            tokenA.target,
            tokenB.target,
            AMOUNT_A,
            AMOUNT_B,
            false,
          ),
      ).to.be.revertedWith('Invalid party B address');
    });

    it('reverts if amountA is 0', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_B } =
        await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(creator)
          .createEscrow(
            partyA.address,
            partyB.address,
            tokenA.target,
            tokenB.target,
            0,
            AMOUNT_B,
            false,
          ),
      ).to.be.revertedWith('Amount A must be greater than 0');
    });

    it('increments escrowCounter for each new escrow', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);
      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);

      expect(await escrow.escrowCounter()).to.equal(2);
    });

    it('sendFundsNow=true funds partyA side when creator is partyA', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await tokenA.connect(partyA).approve(escrow.target, AMOUNT_A);

      await escrow
        .connect(partyA)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, true);

      const data = await escrow.getEscrow(1);
      expect(data.isPartyAFunded).to.be.true;
      expect(data.isPartyBFunded).to.be.false;
    });

    it('sendFundsNow=true funds partyB side when creator is partyB', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await tokenB.connect(partyB).approve(escrow.target, AMOUNT_B);

      await escrow
        .connect(partyB)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, true);

      const data = await escrow.getEscrow(1);
      expect(data.isPartyAFunded).to.be.false;
      expect(data.isPartyBFunded).to.be.true;
    });

    it('sendFundsNow=true reverts when creator is neither party', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await expect(
        escrow
          .connect(creator)
          .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, true),
      ).to.be.revertedWith('Sender not part of this escrow');
    });
  });

  // ──────────────────────────────────────────────
  //  receiveFunds
  // ──────────────────────────────────────────────
  describe('receiveFunds', function () {
    async function createdEscrowFixture() {
      const base = await deployFixture();
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } = base;

      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);

      // Approve escrow contract
      await tokenA.connect(partyA).approve(escrow.target, AMOUNT_A);
      await tokenB.connect(partyB).approve(escrow.target, AMOUNT_B);

      return base;
    }

    it('allows partyA to fund', async function () {
      const { escrow, partyA } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(partyA).receiveFunds(1)).to.emit(escrow, 'FundsReceived');
    });

    it('allows partyB to fund', async function () {
      const { escrow, partyB } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(partyB).receiveFunds(1)).to.emit(escrow, 'FundsReceived');
    });

    it('creator who is not a party cannot fund', async function () {
      const { escrow, creator } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(creator).receiveFunds(1)).to.be.revertedWith(
        'Sender not part of this escrow',
      );
    });

    it('auto-completes when both parties fund', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, AMOUNT_A, AMOUNT_B } =
        await loadFixture(createdEscrowFixture);

      await escrow.connect(partyA).receiveFunds(1);
      await expect(escrow.connect(partyB).receiveFunds(1))
        .to.emit(escrow, 'EscrowCompleted')
        .withArgs(1, partyA.address, partyB.address);

      // partyB should have received tokenA, partyA should have received tokenB
      expect(await tokenA.balanceOf(partyB.address)).to.equal(AMOUNT_A);
      expect(await tokenB.balanceOf(partyA.address)).to.equal(AMOUNT_B);
    });

    it('reverts on double-funding by same party', async function () {
      const { escrow, partyA } = await loadFixture(createdEscrowFixture);
      await escrow.connect(partyA).receiveFunds(1);
      await expect(escrow.connect(partyA).receiveFunds(1)).to.be.revertedWith(
        'Party already funded or invalid state',
      );
    });

    it('reverts for non-existent escrow', async function () {
      const { escrow, partyA } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(partyA).receiveFunds(99)).to.be.revertedWith(
        'Escrow does not exist',
      );
    });
  });

  // ──────────────────────────────────────────────
  //  cancelEscrow
  // ──────────────────────────────────────────────
  describe('cancelEscrow', function () {
    async function createdEscrowFixture() {
      const base = await deployFixture();
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } = base;

      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);

      return base;
    }

    it('creator can cancel', async function () {
      const { escrow, creator } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(creator).cancelEscrow(1))
        .to.emit(escrow, 'EscrowCancelled')
        .withArgs(1, creator.address);
    });

    it('partyA can cancel', async function () {
      const { escrow, partyA } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(partyA).cancelEscrow(1))
        .to.emit(escrow, 'EscrowCancelled')
        .withArgs(1, partyA.address);
    });

    it('partyB can cancel', async function () {
      const { escrow, partyB } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(partyB).cancelEscrow(1))
        .to.emit(escrow, 'EscrowCancelled')
        .withArgs(1, partyB.address);
    });

    it('stranger cannot cancel', async function () {
      const { escrow, stranger } = await loadFixture(createdEscrowFixture);
      await expect(escrow.connect(stranger).cancelEscrow(1)).to.be.revertedWith(
        'Not authorized',
      );
    });

    it('cannot cancel an already-completed escrow', async function () {
      const base = await loadFixture(createdEscrowFixture);
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } = base;

      await tokenA.connect(partyA).approve(escrow.target, AMOUNT_A);
      await tokenB.connect(partyB).approve(escrow.target, AMOUNT_B);
      await escrow.connect(partyA).receiveFunds(1);
      await escrow.connect(partyB).receiveFunds(1);

      await expect(escrow.connect(creator).cancelEscrow(1)).to.be.revertedWith(
        'Escrow already completed',
      );
    });

    it('cannot cancel twice', async function () {
      const { escrow, creator } = await loadFixture(createdEscrowFixture);
      await escrow.connect(creator).cancelEscrow(1);
      await expect(escrow.connect(creator).cancelEscrow(1)).to.be.revertedWith(
        'Escrow already cancelled',
      );
    });
  });

  // ──────────────────────────────────────────────
  //  withdrawFromCancelled
  // ──────────────────────────────────────────────
  describe('withdrawFromCancelled', function () {
    async function fundedAndCancelledFixture() {
      const base = await deployFixture();
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } = base;

      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);

      // partyA funds, partyB does not
      await tokenA.connect(partyA).approve(escrow.target, AMOUNT_A);
      await escrow.connect(partyA).receiveFunds(1);

      // creator cancels
      await escrow.connect(creator).cancelEscrow(1);

      return base;
    }

    it('funded party can withdraw after cancellation', async function () {
      const { escrow, tokenA, partyA, AMOUNT_A } = await loadFixture(fundedAndCancelledFixture);

      const balBefore = await tokenA.balanceOf(partyA.address);
      await escrow.connect(partyA).withdrawFromCancelled(1);
      const balAfter = await tokenA.balanceOf(partyA.address);

      expect(balAfter - balBefore).to.equal(AMOUNT_A);
    });

    it('unfunded party cannot withdraw', async function () {
      const { escrow, partyB } = await loadFixture(fundedAndCancelledFixture);
      await expect(
        escrow.connect(partyB).withdrawFromCancelled(1),
      ).to.be.revertedWith('No funds to withdraw');
    });

    it('creator (non-party) cannot withdraw', async function () {
      const { escrow, creator } = await loadFixture(fundedAndCancelledFixture);
      await expect(
        escrow.connect(creator).withdrawFromCancelled(1),
      ).to.be.revertedWith('Not authorized');
    });
  });

  // ──────────────────────────────────────────────
  //  getEscrow / getEscrowCreator / escrowExists
  // ──────────────────────────────────────────────
  describe('View functions', function () {
    it('escrowExists returns false for non-existent id', async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.escrowExists(42)).to.equal(false);
    });

    it('getEscrowCreator returns the third-party creator', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);

      expect(await escrow.getEscrowCreator(1)).to.equal(creator.address);
    });
  });

  // ──────────────────────────────────────────────
  //  Full end-to-end with third-party creator
  // ──────────────────────────────────────────────
  describe('End-to-end: third-party creates, parties fund, swap completes', function () {
    it('completes the full lifecycle', async function () {
      const { escrow, tokenA, tokenB, partyA, partyB, creator, AMOUNT_A, AMOUNT_B } =
        await loadFixture(deployFixture);

      // 1. Third-party creator creates the escrow
      await escrow
        .connect(creator)
        .createEscrow(partyA.address, partyB.address, tokenA.target, tokenB.target, AMOUNT_A, AMOUNT_B, false);

      expect(await escrow.escrowExists(1)).to.be.true;

      const data = await escrow.getEscrow(1);
      expect(data.creator).to.equal(creator.address);
      expect(data.partyA).to.equal(partyA.address);
      expect(data.partyB).to.equal(partyB.address);

      // 2. Both parties approve and fund
      await tokenA.connect(partyA).approve(escrow.target, AMOUNT_A);
      await tokenB.connect(partyB).approve(escrow.target, AMOUNT_B);

      await escrow.connect(partyA).receiveFunds(1);
      await escrow.connect(partyB).receiveFunds(1);

      // 3. Verify swap completed
      const completed = await escrow.getEscrow(1);
      expect(completed.isCompleted).to.be.true;

      // partyB received tokenA, partyA received tokenB
      expect(await tokenA.balanceOf(partyB.address)).to.equal(AMOUNT_A);
      expect(await tokenB.balanceOf(partyA.address)).to.equal(AMOUNT_B);
    });
  });
});
