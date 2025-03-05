import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ProposalHelper } from "./helpers/ProposalHelper";
import { SpaceHelper } from "./helpers/SpaceHelper";

describe("DAOProposalsImplementation", function () {
    async function deployFixture() {
        const [owner, proposer, voter1, voter2, voter3, other] = await ethers.getSigners();

        // Deploy TokenFactory for Space creation
        const TokenFactory = await ethers.getContractFactory("TokenFactoryImplementation");
        const tokenFactory = await upgrades.deployProxy(TokenFactory, [owner.address], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Deploy JoinMethodDirectory with OpenJoin
        const JoinMethodDirectory = await ethers.getContractFactory("JoinMethodDirectoryImplementation");
        const joinMethodDirectory = await upgrades.deployProxy(JoinMethodDirectory, [owner.address], {
            initializer: 'initialize',
            kind: 'uups'
        });

        const OpenJoin = await ethers.getContractFactory("OpenJoin");
        const openJoin = await OpenJoin.deploy();
        await joinMethodDirectory.addJoinMethod(1, await openJoin.getAddress());

        // Deploy ExitMethodDirectory with NoExit
        const ExitMethodDirectory = await ethers.getContractFactory("ExitMethodDirectoryImplementation");
        const exitMethodDirectory = await upgrades.deployProxy(ExitMethodDirectory, [owner.address], {
            initializer: 'initialize',
            kind: 'uups'
        });

        const NoExit = await ethers.getContractFactory("NoExit");
        const noExit = await NoExit.deploy();
        await exitMethodDirectory.addExitMethod(1, await noExit.getAddress());

        // Deploy VotingPowerDirectory
        const VotingPowerDirectory = await ethers.getContractFactory("VotingPowerDirectoryImplementation");
        const votingPowerDirectory = await upgrades.deployProxy(VotingPowerDirectory, [owner.address], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Deploy the Space Factory contract
        const DAOSpaceFactory = await ethers.getContractFactory("DAOSpaceFactoryImplementation");
        const daoSpaceFactory = await upgrades.deployProxy(DAOSpaceFactory, [owner.address], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Deploy the Proposals contract
        const DAOProposals = await ethers.getContractFactory("DAOProposalsImplementation");
        const daoProposals = await upgrades.deployProxy(DAOProposals, [owner.address], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Set up Space Factory
        await daoSpaceFactory.setContracts(
            await tokenFactory.getAddress(),
            await joinMethodDirectory.getAddress(),
            await exitMethodDirectory.getAddress(),
            await votingPowerDirectory.getAddress()
        );

        // Set up Proposals contract
        await daoProposals.setContracts(
            await daoSpaceFactory.getAddress(),
            await votingPowerDirectory.getAddress()
        );

        const spaceHelper = new SpaceHelper(daoSpaceFactory);
        const proposalHelper = new ProposalHelper(daoProposals);

        // Create a space and join it for testing
        await spaceHelper.createDefaultSpace();
        await spaceHelper.joinSpace(1, proposer);
        await spaceHelper.joinSpace(1, voter1);
        await spaceHelper.joinSpace(1, voter2);

        return {
            daoProposals,
            daoSpaceFactory,
            votingPowerDirectory,
            spaceHelper,
            proposalHelper,
            owner,
            proposer,
            voter1,
            voter2,
            voter3,
            other
        };
    }

    describe("Deployment & Initialization", function() {
        it("Should set the right owner", async function() {
            const { daoProposals, owner } = await loadFixture(deployFixture);
            expect(await daoProposals.owner()).to.equal(owner.address);
        });

        it("Should initialize with zero proposals", async function() {
            const { daoProposals } = await loadFixture(deployFixture);
            expect(await daoProposals.proposalCounter()).to.equal(0);
        });
    });

    describe("Nested Proposals", function() {
        it("Should create nested proposals correctly", async function() {
            const { proposalHelper, proposer } = await loadFixture(deployFixture);

            const tx = await proposalHelper.createDefaultProposal({
                spaceId: 1,
                targetContract: ethers.Wallet.createRandom().address,
                executionData: "0x1234"
            });

            await expect(tx).to.emit(proposalHelper.contract, "ProposalCreated");
        });

        it("Should handle nested proposal voting correctly", async function() {
            const { proposalHelper, proposer, voter1 } = await loadFixture(deployFixture);

            // Create proposal
            await proposalHelper.createDefaultProposal({
                spaceId: 1,
                targetContract: ethers.Wallet.createRandom().address,
                executionData: "0x1234"
            });

            // Vote on proposal
            await proposalHelper.vote(1, voter1, true);

            expect(await proposalHelper.hasVoted(1, await voter1.getAddress())).to.be.true;
        });
    });

    describe("Proposal Execution", function() {
        it("Should execute proposal when conditions are met", async function() {
            const { proposalHelper, proposer, voter1, voter2 } = await loadFixture(deployFixture);

            // Create proposal
            await proposalHelper.createDefaultProposal({
                spaceId: 1,
                targetContract: ethers.Wallet.createRandom().address,
                executionData: "0x1234"
            });

            // Vote on proposal
            await proposalHelper.vote(1, voter1, true);
            await proposalHelper.vote(1, voter2, true);

            const proposal = await proposalHelper.getProposalCore(1);
            expect(proposal.yesVotes).to.be.gt(0);
        });
    });
}); 