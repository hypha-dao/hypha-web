import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface ProposalData {
  spaceId: bigint;
  startTime: bigint;
  endTime: bigint;
  executed: boolean;
  expired: boolean;
  yesVotes: bigint;
  noVotes: bigint;
  totalVotingPowerAtSnapshot: bigint;
  creator: string;
  transactions: any[];
}

const daoProposalsAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'getProposalCore',
    outputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'bool', name: 'executed', type: 'bool' },
      { internalType: 'bool', name: 'expired', type: 'bool' },
      { internalType: 'uint256', name: 'yesVotes', type: 'uint256' },
      { internalType: 'uint256', name: 'noVotes', type: 'uint256' },
      {
        internalType: 'uint256',
        name: 'totalVotingPowerAtSnapshot',
        type: 'uint256',
      },
      { internalType: 'address', name: 'creator', type: 'address' },
      {
        internalType: 'tuple[]',
        name: 'transactions',
        type: 'tuple[]',
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'checkProposalExpiration',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
      { internalType: 'bool', name: '_support', type: 'bool' },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'triggerExecutionCheck',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const daoSpaceFactoryAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceDetails',
    outputs: [
      { internalType: 'uint256', name: 'unity', type: 'uint256' },
      { internalType: 'uint256', name: 'quorum', type: 'uint256' },
      { internalType: 'uint256', name: 'votingPowerSource', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { internalType: 'address[]', name: 'members', type: 'address[]' },
      { internalType: 'uint256', name: 'exitMethod', type: 'uint256' },
      { internalType: 'uint256', name: 'joinMethod', type: 'uint256' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'address', name: 'creator', type: 'address' },
      { internalType: 'address', name: 'executor', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_user', type: 'address' },
    ],
    name: 'isMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main(): Promise<void> {
  console.log('🚀 Checking and executing tokenomics proposals...\n');

  // Contract addresses
  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoSpaceFactoryAddress = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

  // RPC setup
  const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Wallet setup
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Using RPC: ${rpcUrl}\n`);

  // Contract instances
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );
  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    provider,
  );

  // Tokenomics proposal IDs from our earlier investigation
  const proposalIds = [841];

  for (const proposalId of proposalIds) {
    console.log(`\n=== CHECKING PROPOSAL ${proposalId} ===`);

    try {
      // Get proposal details
      const proposalData: ProposalData = await daoProposals.getProposalCore(
        proposalId,
      );

      // Get space details for unity/quorum thresholds
      const spaceDetails = await daoSpaceFactory.getSpaceDetails(
        proposalData.spaceId,
      );
      const unityThreshold = Number(spaceDetails[0]); // unity
      const quorumThreshold = Number(spaceDetails[1]); // quorum

      // Calculate current status
      const totalVotesCast = proposalData.yesVotes + proposalData.noVotes;
      const participationRate = Number(
        (totalVotesCast * 100n) / proposalData.totalVotingPowerAtSnapshot,
      );
      const unityRate =
        totalVotesCast > 0n
          ? Number((proposalData.yesVotes * 100n) / totalVotesCast)
          : 0;

      console.log(`Space ID: ${proposalData.spaceId}`);
      console.log(`Creator: ${proposalData.creator}`);
      console.log(
        `Status: ${
          proposalData.executed
            ? 'EXECUTED'
            : proposalData.expired
            ? 'EXPIRED'
            : 'ACTIVE'
        }`,
      );
      console.log(`\n--- Voting Results ---`);
      console.log(
        `Yes Votes: ${ethers.formatEther(proposalData.yesVotes)} HYPHA`,
      );
      console.log(
        `No Votes: ${ethers.formatEther(proposalData.noVotes)} HYPHA`,
      );
      console.log(
        `Total Votes Cast: ${ethers.formatEther(totalVotesCast)} HYPHA`,
      );
      console.log(
        `Total Voting Power: ${ethers.formatEther(
          proposalData.totalVotingPowerAtSnapshot,
        )} HYPHA`,
      );
      console.log(`\n--- Thresholds ---`);
      console.log(`Unity Required: ${unityThreshold}%`);
      console.log(`Quorum Required: ${quorumThreshold}%`);
      console.log(`\n--- Current Rates ---`);
      console.log(`Participation: ${participationRate.toFixed(2)}%`);
      console.log(`Unity (of votes cast): ${unityRate.toFixed(2)}%`);

      // Check if already executed or expired
      if (proposalData.executed) {
        console.log('✅ Proposal is already executed!');
        continue;
      }

      if (proposalData.expired) {
        console.log('❌ Proposal has expired and cannot be executed');
        continue;
      }

      // Note: With the new triggerExecutionCheck function, we don't need to be a member

      // Check if proposal meets new execution criteria
      const meetsQuorum = participationRate >= quorumThreshold;
      const meetsUnity = unityRate >= unityThreshold;

      console.log(`\n--- Execution Check (New Logic) ---`);
      console.log(
        `Quorum met: ${meetsQuorum ? '✅' : '❌'} (${participationRate.toFixed(
          2,
        )}% >= ${quorumThreshold}%)`,
      );
      console.log(
        `Unity met: ${meetsUnity ? '✅' : '❌'} (${unityRate.toFixed(
          2,
        )}% >= ${unityThreshold}%)`,
      );

      if (meetsQuorum && meetsUnity) {
        console.log('\n🎯 Proposal should be executable with new logic!');
        console.log('Attempting to trigger execution check...');

        try {
          // Use the new public triggerExecutionCheck function
          const tx = await daoProposals.triggerExecutionCheck(proposalId);
          console.log(`Execution check transaction sent: ${tx.hash}`);
          console.log('Waiting for confirmation...');

          const receipt = await tx.wait();
          console.log(
            `✅ Transaction confirmed in block: ${receipt.blockNumber}`,
          );

          // Check if proposal is now executed
          const updatedProposal: ProposalData =
            await daoProposals.getProposalCore(proposalId);
          if (updatedProposal.executed) {
            console.log('🎉 PROPOSAL EXECUTED SUCCESSFULLY!');
          } else {
            console.log(
              '⚠️  Execution check completed but proposal not executed yet',
            );
          }
        } catch (error: any) {
          console.log(`❌ Error triggering execution check: ${error.message}`);
        }
      } else {
        console.log('\n❌ Proposal does not meet execution criteria');
        if (!meetsQuorum) {
          console.log(
            `   Need ${quorumThreshold}% participation, have ${participationRate.toFixed(
              2,
            )}%`,
          );
        }
        if (!meetsUnity) {
          console.log(
            `   Need ${unityThreshold}% unity, have ${unityRate.toFixed(2)}%`,
          );
        }
      }
    } catch (error: any) {
      console.log(
        `❌ Error processing proposal ${proposalId}: ${error.message}`,
      );
    }
  }

  console.log('\n🏁 Finished checking all tokenomics proposals!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
