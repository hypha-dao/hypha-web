import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

async function main() {
  const CounterV2 = await ethers.getContractFactory('CounterV2');
  console.log('Upgrading Counter...');
  const proxyAddress = PROXY_ADDRESS; // Replace with the actual proxy address
  await upgrades.upgradeProxy(proxyAddress, CounterV2);
  console.log('Counter upgraded');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
