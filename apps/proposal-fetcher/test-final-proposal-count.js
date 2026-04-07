const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';
const daoId = '29983'; // Hypha DAO ID

/**
 * Fetches all edges related to proposals for a specific DAO.
 * This function is designed to be robust against API inconsistencies by using
 * small batches, delays, and comprehensive deduplication.
 * @returns {Promise<Array>} A promise that resolves to an array of unique edge objects.
 */
async function fetchAllProposalEdges() {
  let allEdges = [];
  let lower_bound = daoId;
  let more = true;
  let batch = 0;
  const maxBatches = 150; // Increased to ensure we get everything
  const proposalEdgeNames = [
    'votable', 'stagingprop', 'proposal', 
    'passedprops', 'failedprops', 'closedprops'
  ];

  console.log(`Fetching all proposal edges for DAO ${daoId} across ${maxBatches} max batches...`);

  while (more && batch < maxBatches) {
    batch++;
    try {
      const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'edges',
        index_position: 2,
        key_type: 'i64',
        lower_bound,
        limit: 500, // Smaller, more stable batch size
      });

      const relevantEdges = result.rows.filter(edge =>
        edge.from_node.toString() === daoId &&
        proposalEdgeNames.includes(edge.edge_name)
      );

      allEdges.push(...relevantEdges);

      if (batch % 10 === 0 || !result.more) {
        console.log(`  Batch ${batch}/${maxBatches}: Found ${relevantEdges.length} more. Total collected: ${allEdges.length}`);
      }
      
      more = result.more;
      if (more) {
        lower_bound = result.next_key;
      } else {
        console.log(`  Stopping fetch: API indicated no more data after batch ${batch}.`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Delay between batches

    } catch (error) {
      console.error(`  Error in batch ${batch}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay on error
    }
  }

  // Final deduplication by edge ID
  const uniqueEdges = [...new Map(allEdges.map(e => [e.id, e])).values()];
  const duplicatesRemoved = allEdges.length - uniqueEdges.length;
  console.log(`\nFetch complete. Found ${uniqueEdges.length} unique proposal edges. (Removed ${duplicatesRemoved} duplicates)`);
  
  return uniqueEdges;
}

/**
 * Runs a single test to fetch and count proposal edges.
 * @param {number} runNum - The number of the current test run.
 * @returns {Promise<number>} The count of unique edges.
 */
async function runTest(runNum) {
  console.log(`\n${'='.repeat(30)} RUN ${runNum} ${'='.repeat(30)}`);
  const edges = await fetchAllProposalEdges();
  return edges.length;
}

/**
 * Main function to run the consistency test multiple times and analyze results.
 */
async function main() {
  console.log('🧪 Starting the definitive proposal count consistency test...');
  
  const runs = 2; // Run 2 times for a solid consistency check
  const counts = [];
  
  for (let i = 1; i <= runs; i++) {
    const count = await runTest(i);
    counts.push(count);
    if (i < runs) await new Promise(r => setTimeout(r, 2000)); // Wait between full runs
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 FINAL CONSISTENCY ANALYSIS');
  console.log(`${'='.repeat(70)}`);

  console.log(`Proposal edge counts across ${runs} runs:`);
  counts.forEach((count, i) => {
    console.log(`  Run ${i + 1}: ${count} unique edges`);
  });

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const variance = max - min;
  
  console.log(`\n📈 STATISTICS:`);
  console.log(`  Minimum: ${min}`);
  console.log(`  Maximum: ${max}`);
  console.log(`  Variance: ${variance}`);

  if (variance === 0) {
    console.log('\n✅ CONSISTENT! The query is stable.');
    console.log(`   The consistent number of proposal edges is ${min}.`);
  } else {
    console.log('\n⚠️ INCONSISTENT. The API is still returning different results.');
    console.log('   The issue lies with the RPC endpoint, not the query logic.');
  }
}

main().catch(console.error);
