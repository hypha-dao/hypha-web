import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PROPOSALS = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
const SPACE_ID = 488;

const abi = [
  'function proposalCounter() view returns (uint256)',
  'function getProposalCore(uint256) view returns (uint256,uint256,uint256,bool,bool,uint256,uint256,uint256,address,tuple(address,uint256,bytes)[])',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(PROPOSALS, abi, provider);

  const counter = await contract.proposalCounter();
  console.log('Total proposals:', counter.toString());
  console.log('\nActive proposals in space 488:\n');

  const now = Math.floor(Date.now() / 1000);

  for (let i = Number(counter); i >= Math.max(1, Number(counter) - 50); i--) {
    try {
      const proposal = await contract.getProposalCore(i);
      const spaceId = proposal[0];
      const startTime = Number(proposal[1]);
      const endTime = Number(proposal[2]);
      const executed = proposal[3];
      const expired = proposal[4];

      if (spaceId == SPACE_ID && !executed && !expired && now < endTime) {
        console.log(`Proposal ${i}:`);
        console.log(`  Status: Active`);
        console.log(`  Ends: ${new Date(endTime * 1000).toLocaleString()}`);
        console.log();
      }
    } catch (e) {
      // Skip
    }
  }
}

main().catch(console.error);
