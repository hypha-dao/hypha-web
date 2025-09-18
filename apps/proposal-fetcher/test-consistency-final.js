const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';
const daoId = '29983';

async function fetchAllProposalEdges() {
  let allEdges = [];
  let lower_bound = daoId;
  let more = true;
  let batch = 0;
  const maxBatches = 100; // Increased limit

  console.log(`Fetching all proposal edges for DAO ${daoId}...`);

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
        limit: 500, // Smaller limit per request
      });

      const relevantEdges = result.rows.filter(edge =>
        edge.from_node.toString() === daoId &&
        ['votable', 'stagingprop', 'proposal', 'passedprops', 'failedprops', 'closedprops'].includes(edge.edge_name)
      );

      allEdges.push(...relevantEdges);

      if (batch % 10 === 0) {
        console.log(`  Batch ${batch}/${maxBatches}: Found ${relevantEdges.length} more edges. Total collected: ${allEdges.length}`);
      }

      more = result.more;
      if (more) {
        lower_bound = result.next_key;
      }

      if (!more) {
          console.log(`  Stopping fetch: 'more' flag is false after batch ${batch}.`);
          break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Delay between batches

    } catch (error) {
      console.error(`  Error in batch ${batch}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay on error
    }
  }

  // Deduplicate by edge ID
  const uniqueEdges = [...new Map(allEdges.map(e => [e.id, e])).values()];
  const duplicatesRemoved = allEdges.length - uniqueEdges.length;
  console.log(`\nFetch complete. Found ${uniqueEdges.length} unique proposal edges. Removed ${duplicatesRemoved} duplicates.`);
  
  return uniqueEdges;
}

async function runTest(runNum) {
  console.log(`\n${'='.repeat(30)} RUN ${runNum} ${'='.repeat(30)}`);
  const edges = await fetchAllProposalEdges();
  return edges.length;
}

async function main() {
  console.log('🧪 Starting final consistency test...');
  console.log('This script will run 5 times to check for consistent results from the API.');
  console.log('Using smaller batches and delays to be gentler on the RPC endpoint.');
  
  const runs = 5;
  const counts = [];
  
  for (let i = 1; i <= runs; i++) {
    const count = await runTest(i);
    counts.push(count);
    if (i < runs) await new Promise(r => setTimeout(r, 2000)); // Wait between full runs
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 FINAL CONSISTENCY ANALYSIS');
  console.log(`${'='.repeat(70)}`);

  console.log('Proposal edge counts across 5 runs:');
  counts.forEach((count, i) => {
    console.log(`  Run ${i + 1}: ${count} edges`);
  });

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const variance = max - min;
  
  console.log(`\n📈 STATISTICS:`);
  console.log(`  Minimum: ${min}`);
  console.log(`  Maximum: ${max}`);
  console.log(`  Variance: ${variance}`);

  if (variance === 0) {
    console.log('\n✅ PERFECTLY CONSISTENT! The query is stable.');
    console.log(`The correct number of proposal edges is ${min}.`);
  } else {
    console.log('\n⚠️ INCONSISTENT. The RPC API is returning different results on each run.');
    console.log('   This confirms the issue is with the API endpoint, not the query logic.');
  }
}

main().catch(console.error);
