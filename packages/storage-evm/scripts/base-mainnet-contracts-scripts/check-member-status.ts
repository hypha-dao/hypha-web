import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SPACE_FACTORY = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
const SPACE_ID = 488;
const ADDRESS_TO_CHECK = '0xEB45724f1eFC5495222208b9A4666F7f177815F2';

const abi = [
  'function isMember(uint256, address) view returns (bool)',
  'function isSpaceMember(uint256, address) view returns (bool)',
  'function getSpaceMembers(uint256) view returns (address[])',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(SPACE_FACTORY, abi, provider);

  console.log('Checking address:', ADDRESS_TO_CHECK);
  console.log('In space:', SPACE_ID);
  console.log();

  const isMember = await contract.isMember(SPACE_ID, ADDRESS_TO_CHECK);
  console.log('Is regular member:', isMember);

  const isSpaceMember = await contract.isSpaceMember(
    SPACE_ID,
    ADDRESS_TO_CHECK,
  );
  console.log('Is space member:', isSpaceMember);

  const members = await contract.getSpaceMembers(SPACE_ID);
  console.log('\nAll members in space 488:');
  members.forEach((m: string, i: number) => {
    const highlight =
      m.toLowerCase() === ADDRESS_TO_CHECK.toLowerCase() ? ' <<< TARGET' : '';
    console.log(`  ${i + 1}. ${m}${highlight}`);
  });
}

main().catch(console.error);
