const { ethers, upgrades } = require("hardhat");

async function main() {
  const CounterV2 = await ethers.getContractFactory("CounterV2");
  console.log("Upgrading Counter...");
  const proxyAddress = "0x25FCC031A63D4589e30FCDd59D72fBf708eB3d4B"; // Replace with the actual proxy address
  await upgrades.upgradeProxy(proxyAddress, CounterV2);
  console.log("Counter upgraded");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });