import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PROPOSALS = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';

const abi = [
  'function directoryContract() view returns (address)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(PROPOSALS, abi, provider);
  
  const directory = await contract.directoryContract();
  console.log('Directory contract:', directory);
}

main().catch(console.error);
