import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SPACE_FACTORY = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
const EXECUTOR_ADDRESS = '0xEB45724f1eFC5495222208b9A4666F7f177815F2';

const abi = [
  'function executorToSpaceId(address) view returns (uint256)',
  'function getSpaceDetails(uint256) view returns (uint256,uint256,uint256,address[],address[],uint256,uint256,uint256,address,address)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(SPACE_FACTORY, abi, provider);

  console.log('Checking if address is a space executor:', EXECUTOR_ADDRESS);
  console.log();

  const spaceId = await contract.executorToSpaceId(EXECUTOR_ADDRESS);
  console.log('Space ID for this executor:', spaceId.toString());

  if (spaceId > 0) {
    console.log('\n✓ This IS a valid space executor');
    const details = await contract.getSpaceDetails(spaceId);
    console.log('Space ID:', spaceId.toString());
    console.log('Unity:', details[0].toString(), '%');
    console.log('Quorum:', details[1].toString(), '%');
  } else {
    console.log('\n✗ This is NOT a space executor');
  }
}

main().catch(console.error);
