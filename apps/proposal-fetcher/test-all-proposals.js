const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';
const daoId = '29983'; // Hypha DAO as string
const proposalTypes = new Set([
  'badge', 'assignbadge', 'role', 'assignment', 'payout', 'attestation',
  'suspend', 'edit', 'queststart', 'questcompl', 'policy', 'poll',
  'circle', 'budget', 'extension'
]);

const MAX_DOCS_FOR_TEST = 200; // Limit for quick testing; set to 0 for all

async function fetchAllVotableEdges() {
  let allEdges = [];
  let lower_bound = daoId;
  let more = true;
  let batch = 0;

  while (more && batch < 20) { // Safety limit
    batch++;
    console.log(`Fetching batch ${batch}...`);
    const result = await rpc.get_table_rows({
      json: true,
      code: contract,
      scope: contract,
      table: 'edges',
      index_position: 2,
      key_type: 'i64',
      lower_bound,
      limit: 2000 // Balanced batch size
    });

    const relevantEdges = result.rows.filter(edge => 
      edge.from_node.toString() === daoId && 
      ['votable', 'stagingprop', 'proposal', 'passedprops', 'failedprops', 'closedprops'].includes(edge.edge_name)
    );

    allEdges = allEdges.concat(relevantEdges);
    more = result.more;
    if (more) lower_bound = result.next_key;

    console.log(`  Got ${relevantEdges.length} relevant edges (total: ${allEdges.length})`);
  }

  // Deduplicate by edge ID
  const uniqueEdges = [...new Map(allEdges.map(e => [e.id, e])).values()];
  console.log(`Unique votable edges: ${uniqueEdges.length} (removed ${allEdges.length - uniqueEdges.length} duplicates)`);

  return uniqueEdges;
}

// Remove the analyzeProposals function as it's not needed for this test
// async function analyzeProposals(edges) {
//   const proposalIds = edges.map(edge => edge.to_node);
//   const allDocs = [];
//   let lower_bound = null;
//   let more = true;
//   let batch = 0;

//   console.log('Batch-fetching all documents...');
//   while (more && batch < 100) { // Safety limit
//     batch++;
//     const result = await rpc.get_table_rows({
//       json: true,
//       code: contract,
//       scope: contract,
//       table: 'documents',
//       lower_bound,
//       limit: 1000
//     });
//     allDocs.push(...result.rows);
//     more = result.more;
//     if (more) lower_bound = result.next_key;
//   }
  
//   console.log(`Fetched ${allDocs.length} total documents. Filtering...`);

//   const proposals = allDocs.filter(doc => proposalIds.includes(doc.id));
  
//   const byType = {};
//   const byState = {};
//   const byEdgeName = {};

//   for (let i = 0; i < proposals.length; i++) {
//     if (i % 50 === 0) console.log(`Processing doc ${i}/${proposals.length}`);
//     const doc = proposals[i];
//     const contentGroups = doc.content_groups;
//     let type = null;
//     let state = null;

//     for (const group of contentGroups) {
//       for (const content of group) {
//         if (content.label === 'type' && proposalTypes.has(content.value[1])) {
//           type = content.value[1];
//         } else if (content.label === 'state') {
//           state = content.value[1];
//         }
//       }
//     }

//     if (type) {
//       byType[type] = (byType[type] || 0) + 1;
//       byState[state || 'unknown'] = (byState[state || 'unknown'] || 0) + 1;
//       byEdgeName[doc.edge_name] = (byEdgeName[doc.edge_name] || 0) + 1;
//     }
//     await new Promise(r => setTimeout(r, 10)); // Reduced delay
//   }

//   return { count: proposals.length, byType, byState, byEdgeName };
// }

async function runTest(runNum) {
  console.log(`\n--- RUN ${runNum} ---`);
  const edges = await fetchAllVotableEdges();
  // const analysis = await analyzeProposals(edges);
  console.log(`Total unique proposal edges found: ${edges.length}`);
  // console.log('By type:', analysis.byType);
  // console.log('By state:', analysis.byState);
  // console.log('By edge name:', analysis.byEdgeName);
  return edges.length;
}

async function main() {
  try {
    const runs = 3;
    const counts = [];
    for (let i = 1; i <= runs; i++) {
      const count = await runTest(i);
      counts.push(count);
      if (i < runs) await new Promise(r => setTimeout(r, 2000));
    }

    const min = Math.min(...counts);
    const max = Math.max(...counts);
    console.log(`\nConsistency: Min ${min}, Max ${max}, Variance ${max - min}`);
    if (max - min === 0) console.log('✅ Consistent!');
  } catch (error) {
    console.error('Script interrupted or error:', error);
  }
}

main();