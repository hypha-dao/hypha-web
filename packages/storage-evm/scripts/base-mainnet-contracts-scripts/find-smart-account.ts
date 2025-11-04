import { ethers } from 'ethers';

// From your error, this is the sender in the UserOperation
const EOA = '0xE27F33cA8037A2B0F4D3d4F9B8CcD896c2674484';

console.log('Your EOA (owner):', EOA);
console.log('\nYour smart account address should be different.');
console.log(
  'Check your Coinbase Smart Wallet UI or look for "Smart Wallet Address"',
);
console.log(
  '\nOr check the "from" field in a successful transaction you made.',
);
console.log(
  '\nThe smart account address is what the contract sees as msg.sender.',
);
