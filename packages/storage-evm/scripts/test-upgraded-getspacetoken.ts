import { ethers } from 'hardhat';

const PROXY_ADDRESS = '0x299f4D2327933c1f363301dbd2a28379ccD5539b';

async function main(): Promise<void> {
  const DecayingTokenFactory = await ethers.getContractFactory('DecayingTokenFactory');
  const contract = DecayingTokenFactory.attach(PROXY_ADDRESS);

  console.log('🧪 Testing getSpaceToken with real space IDs...');

  // Test with space ID 121 (from your successful deployment)
  try {
    const result = await contract.getSpaceToken(121);
    console.log('✅ Space ID 121 token address:', result);
    
    if (result !== ethers.ZeroAddress) {
      console.log('🎉 SUCCESS! Token found for space 121');
    } else {
      console.log('ℹ️ No token deployed for space 121 (returns zero address)');
    }
  } catch (error: any) {
    console.error('❌ Space ID 121 failed:', error.message);
  }

  // Test with space ID 1 (should return zero address, not revert)
  try {
    const result = await contract.getSpaceToken(1);
    console.log('✅ Space ID 1 token address:', result);
  } catch (error: any) {
    console.error('❌ Space ID 1 still failing:', error.message);
    
    // This suggests there might be an interface issue
    console.log('🔍 This might indicate an interface or override issue');
  }

  // Test with space ID 0
  try {
    const result = await contract.getSpaceToken(0);
    console.log('✅ Space ID 0 token address:', result);
  } catch (error: any) {
    console.error('❌ Space ID 0 failed:', error.message);
  }
}

main().catch(console.error); 