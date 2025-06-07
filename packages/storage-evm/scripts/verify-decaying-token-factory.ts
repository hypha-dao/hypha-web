import { ethers } from 'hardhat';

const PROXY_ADDRESS = '0x299f4D2327933c1f363301dbd2a28379ccD5539b';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log('🔍 Verifying DecayingTokenFactory at:', PROXY_ADDRESS);
  console.log('Network:', await ethers.provider.getNetwork());
  console.log('Checking with address:', await deployer.getAddress());

  // Get the contract with full ABI
  const DecayingTokenFactory = await ethers.getContractFactory(
    'DecayingTokenFactory',
  );
  const contract = DecayingTokenFactory.attach(PROXY_ADDRESS);

  // Check basic functions
  try {
    const owner = await contract.owner();
    console.log('✅ Owner:', owner);
  } catch (error) {
    console.error('❌ Error reading owner:', error);
  }

  try {
    const spacesContract = await contract.spacesContract();
    console.log('✅ Spaces contract:', spacesContract);
  } catch (error) {
    console.error('❌ Error reading spacesContract:', error);
  }

  // Test the problematic function
  try {
    const result = await contract.getSpaceToken(1);
    console.log('✅ getSpaceToken works! Result:', result);
  } catch (error: any) {
    console.error('❌ getSpaceToken failed:', error.message);

    // Try low-level call
    const functionSelector = '0x1080fa43';
    const spaceIdParam = ethers.zeroPadValue(ethers.toBeHex(1), 32);
    const calldata = functionSelector + spaceIdParam.slice(2);

    try {
      const lowLevelResult = await ethers.provider.call({
        to: PROXY_ADDRESS,
        data: calldata,
      });
      console.log('Low-level call result:', lowLevelResult);
    } catch (lowLevelError) {
      console.log('Low-level call also failed - function definitely missing');
    }
  }
}

main().catch(console.error);
