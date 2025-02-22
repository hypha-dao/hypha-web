const { ethers } = require("hardhat");

async function main() {
  const Counter = await ethers.getContractFactory("Counter");
  const counter = Counter.attach("0x25FCC031A63D4589e30FCDd59D72fBf708eB3d4B"); // Replace with the actual proxy address
  const tx = await counter.increment();
  await tx.wait();
  const count = await counter.getCount();
  console.log("Counter value:", count.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });