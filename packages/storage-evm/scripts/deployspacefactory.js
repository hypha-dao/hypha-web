const { ethers, upgrades } = require("hardhat");

async function main() {
  const Counter = await ethers.getContractFactory("DAOSpaceFactoryImplementation");
  console.log("Deploying SpaceFactory...");
  const counter = await upgrades.deployProxy(Counter, {
    initializer: "initialize",
    kind: "uups",
  });
  await counter.waitForDeployment(); // Use waitForDeployment instead of deployed
  console.log("Counter deployed to:", await counter.getAddress()); // Use getAddress to get the contract address
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
