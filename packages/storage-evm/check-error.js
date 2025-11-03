const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://api.developer.coinbase.com/rpc/v1/base/c722jjhaAIFXo1GB3AR0iQc9yK0yjoGO');

async function checkError() {
  try {
    const proposalId = 2062; // 0x80e from the callData
    const support = true;
    const daoProposalsAddress = '0x001ba7a00a259fb12d7936455e292a60fc2bef14';
    const voterAddress = '0x8D0E07Cb0C966dCA466FbA84a49327C2996cDFAD';
    
    const iface = new ethers.Interface(['function vote(uint256 _proposalId, bool _support)']);
    const data = iface.encodeFunctionData('vote', [proposalId, support]);
    
    await provider.call({
      from: voterAddress,
      to: daoProposalsAddress,
      data: data
    });
    
  } catch (error) {
    if (error.data) {
      const errorSig = error.data.slice(0, 10);
      
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
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('ERROR DECODED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Error Data:      ', error.data);
      console.log('Error Signature: ', errorSig);
      console.log('Error Name:      ', knownErrors[errorSig] || 'Unknown');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\nTransaction Details:');
      console.log('  Proposal ID:', proposalId);
      console.log('  Voter:      ', voterAddress);
      console.log('  Support:     YES');
      console.log('  Contract:   ', daoProposalsAddress);
    }
  }
}

checkError();
