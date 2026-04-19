import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SPACE_FACTORY = ethers.getAddress(
  '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
);
const DIRECTORY = ethers.getAddress(
  '0xeCb4D4538E863f00b987D6FE4a0432Cc2ba8C5b3',
);
const SPACE_ID = 488;
const VOTER = ethers.getAddress('0xE27F33cA8037A2B0F4D3d4F9B8CcD896c2674484');

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
      'This explains the voting error - the contract reverts with NoPower()',
    );
  } else {
    console.log('\n✓ You have voting power - not a voting power issue');
  }
}

main().catch(console.error);
