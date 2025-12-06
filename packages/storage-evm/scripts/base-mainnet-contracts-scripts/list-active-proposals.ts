import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PROPOSALS = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
const SPACE_ID = 558;

const abi = [
  'function proposalCounter() view returns (uint256)',
  'function getProposalCore(uint256) view returns (uint256,uint256,uint256,bool,bool,uint256,uint256,uint256,address,tuple(address,uint256,bytes)[])',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(PROPOSALS, abi, provider);

  const counter = await contract.proposalCounter();
  console.log('Total proposals:', counter.toString());
  console.log(`\nAll proposals in space ${SPACE_ID}:\n`);

  const now = Math.floor(Date.now() / 1000);
  const spaceProposals: number[] = [];

  for (let i = Number(counter); i >= Math.max(1, Number(counter) - 999); i--) {
    try {
      const proposal = await contract.getProposalCore(i);
      const spaceId = proposal[0];
      const startTime = Number(proposal[1]);
      const endTime = Number(proposal[2]);
      const executed = proposal[3];
      const expired = proposal[4];

      if (Number(spaceId) === SPACE_ID) {
        spaceProposals.push(i);

        let status = 'Pending';
        if (executed) status = 'Executed';
        else if (expired) status = 'Expired';
        else if (now >= endTime) status = 'Ended';
        else if (now >= startTime) status = 'Active';

        console.log(`Proposal ${i}:`);
        console.log(`  Status: ${status}`);
        console.log(`  Start: ${new Date(startTime * 1000).toLocaleString()}`);
        console.log(`  End: ${new Date(endTime * 1000).toLocaleString()}`);
        console.log();
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(
    `\nFound ${spaceProposals.length} proposals for space ${SPACE_ID}`,
  );
}

main().catch(console.error);
