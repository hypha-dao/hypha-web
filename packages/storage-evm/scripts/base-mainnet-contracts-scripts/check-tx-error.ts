import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const TX_HASH = '0x515a0388c951946a25943e79e9df9c76dfb9043054f1c57c6e9b96885d7b563c';

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  console.log('Fetching transaction:', TX_HASH);
  console.log();
  
  const tx = await provider.getTransaction(TX_HASH);
  if (!tx) {
    console.log('Transaction not found');
    return;
  }
  
  console.log('Transaction details:');
  console.log('From:', tx.from);
  console.log('To:', tx.to);
  console.log('Data:', tx.data);
  console.log();
  
  console.log('Decoding function call:');
  const selector = tx.data.slice(0, 10);
  console.log('Function selector:', selector);
  
  // vote(uint256,bool) = 0xc9d27afe
  if (selector === '0xc9d27afe') {
    const proposalId = parseInt(tx.data.slice(10, 74), 16);
    const support = parseInt(tx.data.slice(74, 138), 16) === 1;
    console.log('Function: vote(uint256,bool)');
    console.log('Proposal ID:', proposalId);
    console.log('Support:', support ? 'YES' : 'NO');
  }
}

main().catch(console.error);
