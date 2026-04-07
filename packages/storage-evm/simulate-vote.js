const { ethers } = require('ethers');

// Connect to Base network
const provider = new ethers.JsonRpcProvider('https://api.developer.coinbase.com/rpc/v1/base/c722jjhaAIFXo1GB3AR0iQc9yK0yjoGO');

async function simulateVote() {
  try {
    // The inner call data
    const proposalId = 2062; // 0x80e
    const support = true;
    
    // DAOProposals contract address (from the callData)
    const daoProposalsAddress = '0x001ba7a00a259fb12d7936455e292a60fc2bef14';
    
    // Voter address
    const voterAddress = '0x8D0E07Cb0C966dCA466FbA84a49327C2996cDFAD';
    
    // Create interface for vote function
    const iface = new ethers.Interface([
      'function vote(uint256 _proposalId, bool _support)'
    ]);
    
    const data = iface.encodeFunctionData('vote', [proposalId, support]);
    
    console.log('Simulating vote transaction...');
    console.log('Proposal ID:', proposalId);
    console.log('Support:', support);
    console.log('Voter:', voterAddress);
    console.log('Contract:', daoProposalsAddress);
    console.log('');
    
    // Try to call the contract
    const result = await provider.call({
      from: voterAddress,
      to: daoProposalsAddress,
      data: data
    });
    
    console.log('Success! Result:', result);
    
  } catch (error) {
    console.log('Transaction reverted with error:');
    console.log('');
    
    if (error.data) {
      console.log('Error data:', error.data);
      
      // Try to decode the error
      const errorData = error.data;
      const errorSig = errorData.slice(0, 10);
      
      console.log('Error signature:', errorSig);
      console.log('');
      
      // Match against known errors
      const knownErrors = {
        '0x87138d5c': 'NotInitialized()',
        '0x291fc442': 'NotMember()',
        '0x6f312cbd': 'NotStarted()',
        '0x203d82d8': 'Expired()',
        '0x68f46c45': 'Executed()',
        '0x650d798f': 'Voted()',
        '0x93ca83fe': 'SubscriptionInactive()',
        '0xab68ecfc': 'NoPower()'
      };
      
      if (knownErrors[errorSig]) {
        console.log('✓ MATCHED ERROR:', knownErrors[errorSig]);
      } else {
        console.log('✗ Unknown error signature');
      }
    } else {
      console.log('Full error:', error);
    }
  }
}

simulateVote();
