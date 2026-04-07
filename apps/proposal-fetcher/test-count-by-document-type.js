const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';
const daoId = 29983; // Hypha DAO ID as a number

// Definitive list of proposal types from proposal_factory.cpp and common.hpp
const proposalTypes = new Set([
  'badge', 'assignbadge', 'role', 'assignment', 'payout', 'attestation',
  'suspend', 'edit', 'queststart', 'questcompl', 'policy', 'poll',
  'circle', 'budget', 'extension'
]);

/**
 * Scans the 'documents' table to count all documents that belong to a specific DAO
 * and are of a known proposal type. This is a slow but direct method.
 */
async function countProposalsByDocumentType() {
  let proposalCount = 0;
  const proposalCountsByType = {};
  let lower_bound = null;
  let more = true;
  let batch = 0;
  const maxBatches = 500; // High limit to scan the whole table if needed

  console.log(`Starting direct scan of 'documents' table for DAO ID: ${daoId}`);
  console.log('This will be slow as it iterates through a very large table...');

  while (more && batch < maxBatches) {
    batch++;
    try {
      const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'documents',
        lower_bound,
        limit: 500, // Process in manageable chunks
      });

      let batchProposalCount = 0;
      for (const doc of result.rows) {
        if (!doc.content_groups) continue;

        let docDaoId = null;
        let docType = null;

        // Extract dao and type from content groups
        for (const group of doc.content_groups) {
          for (const content of group) {
            if (content.label === 'dao') {
              docDaoId = content.value[1]; // value is ['int64', 29983]
            } else if (content.label === 'type') {
              docType = content.value[1]; // value is ['name', 'payout']
            }
          }
        }

        // Check if it's a proposal for our DAO
        if (docDaoId === daoId && proposalTypes.has(docType)) {
          proposalCount++;
          batchProposalCount++;
          proposalCountsByType[docType] = (proposalCountsByType[docType] || 0) + 1;
        }
      }

      if (batch % 5 === 0) {
        console.log(`  Batch ${batch}: Found ${batchProposalCount} more proposals. Total so far: ${proposalCount}`);
      }

      more = result.more;
      if (more) {
        lower_bound = result.next_key;
      } else {
        console.log(`  Stopping scan: API indicated no more data after batch ${batch}.`);
        break;
      }
    
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between batches

    } catch (error) {
      console.error(`  Error in batch ${batch}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay on error
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 DIRECT SCAN RESULTS');
  console.log(`${'='.repeat(70)}`);
  
  console.log(`\n✅ Final Proposal Count for Hypha DAO: ${proposalCount}`);
  
  console.log('\nBreakdown by Proposal Type:');
  const sortedTypes = Object.entries(proposalCountsByType).sort(([,a],[,b]) => b-a);
  for (const [type, count] of sortedTypes) {
    console.log(`  - ${type}: ${count}`);
  }

  return proposalCount;
}

async function main() {
  await countProposalsByDocumentType();
}

main().catch(console.error);
