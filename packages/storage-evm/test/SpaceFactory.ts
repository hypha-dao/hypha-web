import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SpaceFactory", function() {
  async function deploySpaceFactoryFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const SpaceFactory = await ethers.getContractFactory("SpaceFactory");
    const spaceFactory = await SpaceFactory.deploy();
    return { spaceFactory, owner, otherAccount };
  }

  describe("Space Creation", function() {
    it("Should create a new space", async function() {
      const { spaceFactory, owner } = await loadFixture(deploySpaceFactoryFixture);

      const currentTime = await time.latest();

      await expect(spaceFactory.createSpace(
        "Test Space",
        "Test Description",
        "test-space"
      )).to.emit(spaceFactory, "SpaceCreated")
        .withArgs(
          "test-space",
          "Test Space",
          await owner.getAddress(),
          currentTime + 1
        );

      const space = await spaceFactory.getSpace("test-space");
      expect(space.title).to.equal("Test Space");
      expect(space.description).to.equal("Test Description");
      expect(space.owner).to.equal(await owner.getAddress());
    });

    it("Should not allow duplicate slugs", async function() {
      const { spaceFactory } = await loadFixture(deploySpaceFactoryFixture);

      await spaceFactory.createSpace("Space 1", "Desc 1", "slug-1");

      await expect(
        spaceFactory.createSpace("Space 2", "Desc 2", "slug-1")
      ).to.be.revertedWith("Slug already exists");
    });
  });
});
