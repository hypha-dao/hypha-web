/**
 * Frontend Integration Example for TransferHelper
 *
 * This file demonstrates how to integrate the TransferHelper contract
 * into your React/Next.js frontend with wagmi or ethers.js
 */

// ============================================================================
// 1. TransferHelper ABI (minimal - add to your constants/config)
// ============================================================================

export const TRANSFER_HELPER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transferToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address[]', name: 'recipients', type: 'address[]' },
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    name: 'batchTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address[]', name: 'recipients', type: 'address[]' },
      { internalType: 'uint256', name: 'amountEach', type: 'uint256' },
    ],
    name: 'batchTransferEqual',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
    name: 'isTokenSupported',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ERC20 Approve ABI
export const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============================================================================
// 2. Config (add to your environment variables)
// ============================================================================

export const TRANSFER_HELPER_ADDRESS = '0x...'; // Your deployed TransferHelper address

// ============================================================================
// 3. React Hook using wagmi (Recommended for Next.js/React)
// ============================================================================

/*
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';

export function useTransferHelper() {
  const { writeContractAsync } = useWriteContract();

  // Check if token is supported
  const checkTokenSupport = async (tokenAddress: string) => {
    // Use useReadContract or publicClient.readContract
    // Implementation depends on your setup
  };

  // Approve token spending
  const approveToken = async (
    tokenAddress: string,
    amount: bigint
  ) => {
    const hash = await writeContractAsync({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [TRANSFER_HELPER_ADDRESS as `0x${string}`, amount],
    });
    return hash;
  };

  // Single transfer
  const transferToken = async (
    tokenAddress: string,
    recipientAddress: string,
    amount: bigint
  ) => {
    const hash = await writeContractAsync({
      address: TRANSFER_HELPER_ADDRESS as `0x${string}`,
      abi: TRANSFER_HELPER_ABI,
      functionName: 'transferToken',
      args: [
        tokenAddress as `0x${string}`,
        recipientAddress as `0x${string}`,
        amount,
      ],
    });
    return hash;
  };

  // Batch transfer
  const batchTransfer = async (
    tokenAddress: string,
    recipients: string[],
    amounts: bigint[]
  ) => {
    const hash = await writeContractAsync({
      address: TRANSFER_HELPER_ADDRESS as `0x${string}`,
      abi: TRANSFER_HELPER_ABI,
      functionName: 'batchTransfer',
      args: [
        tokenAddress as `0x${string}`,
        recipients as `0x${string}`[],
        amounts,
      ],
    });
    return hash;
  };

  // Combined approve and transfer (better UX)
  const approveAndTransfer = async (
    tokenAddress: string,
    recipientAddress: string,
    amount: bigint
  ) => {
    // First approve
    const approveHash = await approveToken(tokenAddress, amount);
    // Wait for approval to be mined
    // Then execute transfer
    const transferHash = await transferToken(tokenAddress, recipientAddress, amount);
    return { approveHash, transferHash };
  };

  return {
    approveToken,
    transferToken,
    batchTransfer,
    approveAndTransfer,
    checkTokenSupport,
  };
}
*/

// ============================================================================
// 4. Alternative: Using ethers.js v6
// ============================================================================

/*
import { ethers } from 'ethers';

export class TransferHelperService {
  private provider: ethers.BrowserProvider;
  private transferHelperAddress: string;

  constructor(provider: ethers.BrowserProvider, transferHelperAddress: string) {
    this.provider = provider;
    this.transferHelperAddress = transferHelperAddress;
  }

  async approveToken(
    tokenAddress: string,
    amount: bigint
  ): Promise<ethers.ContractTransactionResponse> {
    const signer = await this.provider.getSigner();
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_APPROVE_ABI,
      signer
    );

    const tx = await tokenContract.approve(this.transferHelperAddress, amount);
    return tx;
  }

  async checkAllowance(
    tokenAddress: string,
    ownerAddress: string
  ): Promise<bigint> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_APPROVE_ABI,
      this.provider
    );

    const allowance = await tokenContract.allowance(
      ownerAddress,
      this.transferHelperAddress
    );
    return allowance;
  }

  async transferToken(
    tokenAddress: string,
    recipientAddress: string,
    amount: bigint
  ): Promise<ethers.ContractTransactionResponse> {
    const signer = await this.provider.getSigner();
    const transferHelper = new ethers.Contract(
      this.transferHelperAddress,
      TRANSFER_HELPER_ABI,
      signer
    );

    const tx = await transferHelper.transferToken(
      tokenAddress,
      recipientAddress,
      amount
    );
    return tx;
  }

  async batchTransfer(
    tokenAddress: string,
    recipients: string[],
    amounts: bigint[]
  ): Promise<ethers.ContractTransactionResponse> {
    const signer = await this.provider.getSigner();
    const transferHelper = new ethers.Contract(
      this.transferHelperAddress,
      TRANSFER_HELPER_ABI,
      signer
    );

    const tx = await transferHelper.batchTransfer(tokenAddress, recipients, amounts);
    return tx;
  }

  async approveAndTransfer(
    tokenAddress: string,
    recipientAddress: string,
    amount: bigint
  ): Promise<{
    approveTx: ethers.ContractTransactionResponse;
    transferTx: ethers.ContractTransactionResponse;
  }> {
    // Check current allowance
    const signer = await this.provider.getSigner();
    const currentAllowance = await this.checkAllowance(
      tokenAddress,
      await signer.getAddress()
    );

    let approveTx;
    // Only approve if needed
    if (currentAllowance < amount) {
      approveTx = await this.approveToken(tokenAddress, amount);
      await approveTx.wait(); // Wait for approval to be mined
    }

    // Execute transfer
    const transferTx = await this.transferToken(
      tokenAddress,
      recipientAddress,
      amount
    );

    return { approveTx, transferTx };
  }

  async isTokenSupported(tokenAddress: string): Promise<boolean> {
    const transferHelper = new ethers.Contract(
      this.transferHelperAddress,
      TRANSFER_HELPER_ABI,
      this.provider
    );

    return await transferHelper.isTokenSupported(tokenAddress);
  }
}
*/

// ============================================================================
// 5. Example React Component
// ============================================================================

/*
import { useState } from 'react';
import { parseEther } from 'viem';

export function TransferTokenForm() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { approveAndTransfer } = useTransferHelper();

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const amountWei = parseEther(amount);
      const { approveHash, transferHash } = await approveAndTransfer(
        tokenAddress,
        recipientAddress,
        amountWei
      );

      console.log('Approval TX:', approveHash);
      console.log('Transfer TX:', transferHash);

      alert('Transfer successful!');
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleTransfer}>
      <input
        type="text"
        placeholder="Token Address"
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Recipient Address"
        value={recipientAddress}
        onChange={(e) => setRecipientAddress(e.target.value)}
        required
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        step="0.000000000000000001"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Transfer'}
      </button>
    </form>
  );
}
*/

// ============================================================================
// 6. Coinbase Paymaster Configuration (Smart Wallet)
// ============================================================================

/*
For Coinbase Smart Wallet integration:

1. Deploy the TransferHelper contract
2. In Coinbase Developer Portal:
   - Navigate to your app settings
   - Go to Paymaster section
   - Add the TransferHelper contract address to the whitelist
   - Configure gas sponsorship policies (e.g., max gas per transaction)

3. In your frontend, configure the Smart Wallet to use the paymaster:

import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'Your App Name',
      preference: 'smartWalletOnly', // Only use Smart Wallet
    }),
  ],
  // ... other config
});

4. All transactions through the TransferHelper will now be sponsored!
*/

// ============================================================================
// 7. Testing Your Integration
// ============================================================================

/*
const testTransferHelper = async () => {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const service = new TransferHelperService(
    provider,
    '0x...' // Your TransferHelper address
  );

  // Test token address (use your deployed token)
  const tokenAddress = '0x...';
  const recipientAddress = '0x...';
  const amount = parseEther('10');

  // Check if token is supported
  const isSupported = await service.isTokenSupported(tokenAddress);
  console.log('Token supported:', isSupported);

  // Execute transfer
  const result = await service.approveAndTransfer(
    tokenAddress,
    recipientAddress,
    amount
  );

  console.log('Transfer completed:', result);
};
*/

export {};
