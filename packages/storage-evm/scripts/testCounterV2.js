const { ethers } = require("hardhat");

async function main() {
  const CounterV2 = await ethers.getContractFactory("CounterV2");
  const proxyAddress = "0x25FCC031A63D4589e30FCDd59D72fBf708eB3d4B"; // Replace with the actual proxy address
  const counterV2 = await CounterV2.attach(proxyAddress);
  console.log("Testing CounterV2 contract...");

  console.log("Incrementing counter...");
  const incrementTx = await counterV2.increment();
  await incrementTx.wait();
  let count = await counterV2.getCount();
  console.log("CounterV2 current value:", count.toString());

  console.log("Resetting counter...");
  const resetTx = await counterV2.reset();
  await resetTx.wait();
  count = await counterV2.getCount();
  console.log("CounterV2 value after reset:", count.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

