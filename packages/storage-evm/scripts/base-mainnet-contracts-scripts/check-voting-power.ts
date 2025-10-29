import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const SPACE_FACTORY = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
const SPACE_ID = 488;
const VOTER = '0xE27F33cA8037A2B0F4D3d4F9B8CcD896c2674484';

const factoryAbi = [
  'function getSpaceDetails(uint256) view returns (uint256,uint256,uint256,address[],address[],uint256,uint256,uint256,address,address)',
];

// Voting power source 2 is typically member-based (1 member = 1 vote)
const memberVotingPowerAbi = [
  'function getVotingPower(address,uint256) view returns (uint256)',
  'function getTotalVotingPower(uint256) view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const factory = new ethers.Contract(SPACE_FACTORY, factoryAbi, provider);
  
  const details = await factory.getSpaceDetails(SPACE_ID);
  const votingPowerSourceId = details[2];
  
  console.log('Space 488 voting power source ID:', votingPowerSourceId.toString());
  
  // For voting power source 2 (member voting power)
  if (votingPowerSourceId == 2n) {
    const MEMBER_VOTING_POWER = '0xb10eb6Ad1Ee3fe12736c217a8ce761d15B79c97F';
    const votingPowerContract = new ethers.Contract(MEMBER_VOTING_POWER, memberVotingPowerAbi, provider);
    
    const voterPower = await votingPowerContract.getVotingPower(VOTER, SPACE_ID);
    const totalPower = await votingPowerContract.getTotalVotingPower(SPACE_ID);
    
    console.log('\nVoter:', VOTER);
    console.log('Your voting power:', voterPower.toString());
    console.log('Total voting power:', totalPower.toString());
    
    if (voterPower == 0n) {
      console.log('\n❌ YOU HAVE ZERO VOTING POWER - This is why voting fails!');
      console.log('The contract will revert with NoPower() error.');
    } else {
      console.log('\n✓ You have voting power');
    }
  }
}

main().catch(console.error);
