import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SPACE_FACTORY = '0xc8b8454d2f9192fecabc2c6f5d88f6434a2a9cd9';
const DIRECTORY = '0xecb4d4538e863f00b987d6fe4a0432cc2ba8c5b3';
const SPACE_ID = 488;
const VOTER = '0xe27f33ca8037a2b0f4d3d4f9b8ccd896c2674484';

const factoryAbi = [
  'function getSpaceDetails(uint256) view returns (uint256,uint256,uint256,address[],address[],uint256,uint256,uint256,address,address)',
];

const directoryAbi = [
  'function getVotingPowerSourceContract(uint256) view returns (address)',
];

const votingPowerAbi = [
  'function getVotingPower(address,uint256) view returns (uint256)',
  'function getTotalVotingPower(uint256) view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(SPACE_FACTORY, factoryAbi, provider);
  const directory = new ethers.Contract(DIRECTORY, directoryAbi, provider);

  const details = await factory.getSpaceDetails(SPACE_ID);
  const votingPowerSourceId = details[2];

  console.log(
    'Space 488 voting power source ID:',
    votingPowerSourceId.toString(),
  );

  const votingPowerAddress = await directory.getVotingPowerSourceContract(
    votingPowerSourceId,
  );
  console.log('Voting power contract:', votingPowerAddress);
  console.log();

  const votingPowerContract = new ethers.Contract(
    votingPowerAddress,
    votingPowerAbi,
    provider,
  );

  const voterPower = await votingPowerContract.getVotingPower(VOTER, SPACE_ID);
  const totalPower = await votingPowerContract.getTotalVotingPower(SPACE_ID);

  console.log('Voter:', VOTER);
  console.log('Your voting power:', voterPower.toString());
  console.log('Total voting power:', totalPower.toString());

  if (voterPower == 0n) {
    console.log('\n❌ YOU HAVE ZERO VOTING POWER!');
    console.log(
      'This is the bug - the contract will revert with NoPower() error',
    );
  } else {
    console.log('\n✓ You have voting power');
  }
}

main().catch(console.error);
