import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

const getProposalsForDaoCorrect = async (daoId) => {
  try {
    console.log(`Fetching all proposals for DAO ${daoId} with CORRECT pagination...`);
    
    let allDaoEdges = [];
    let lower_bound = null;
    let batchCount = 0;
    
    while (true) {
      batchCount++;
      console.log(`  Fetching batch ${batchCount}...`);
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'edges',
        index_position: 2, // byfrom index
        key_type: 'i64',
        lower_bound: lower_bound,
        limit: 1000,
      });
      
      if (result.rows.length === 0) {
        console.log(`    No more rows, stopping`);
        break;
      }
      
      // Filter to only edges FROM our DAO
      const daoEdges = result.rows.filter(edge => edge.from_node.toString() === daoId);
      
      console.log(`    Total rows: ${result.rows.length}, DAO edges: ${daoEdges.length}`);
      
      // If we find no edges from our DAO, we've moved past it
      if (daoEdges.length === 0) {
        console.log(`    No edges from DAO ${daoId} in this batch, stopping`);
        break;
      }
      
      allDaoEdges = allDaoEdges.concat(daoEdges);
      
      if (result.more && result.next_key) {
        lower_bound = result.next_key;
        console.log(`    Next key: ${result.next_key}`);
      } else {
        console.log(`    No more data available, stopping`);
        break;
      }
      
      // Safety break
      if (batchCount > 20) {
        console.log('⚠️  Safety break at 20 batches for testing');
        break;
      }
    }

    console.log(`✅ Total unique DAO edges collected: ${allDaoEdges.length}`);
    
    // Check for duplicates
    const edgeIds = allDaoEdges.map(edge => edge.id);
    const uniqueEdgeIds = new Set(edgeIds);
    console.log(`Duplicates found: ${edgeIds.length - uniqueEdgeIds.size}`);
    
    // Remove duplicates if any
    const uniqueEdges = allDaoEdges.filter((edge, index, self) => 
      index === self.findIndex(e => e.id === edge.id)
    );
    
    console.log(`After deduplication: ${uniqueEdges.length} edges`);

    // Show edge type breakdown
    const edgeTypes = uniqueEdges.reduce((acc, edge) => {
      acc[edge.edge_name] = (acc[edge.edge_name] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📋 ALL EDGE TYPES:');
    Object.entries(edgeTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

    // Filter for proposal-related edges
    const proposalEdges = uniqueEdges.filter(
      (edge) =>
        edge.edge_name === 'stagingprop' ||
        edge.edge_name === 'closedprops' ||
        edge.edge_name === 'passedprops' ||
        edge.edge_name === 'failedprops' ||
        edge.edge_name === 'votable'
    );

    console.log(`\n🎯 PROPOSAL EDGES: ${proposalEdges.length}`);
    
    const proposalBreakdown = proposalEdges.reduce((acc, edge) => {
      acc[edge.edge_name] = (acc[edge.edge_name] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(proposalBreakdown).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    return {
      totalEdges: uniqueEdges.length,
      proposalEdges: proposalEdges.length,
      breakdown: proposalBreakdown
    };
    
  } catch (error) {
    console.error(`Error:`, error);
    return null;
  }
};

const main = async () => {
  const result = await getProposalsForDaoCorrect("29983");
  
  if (result) {
    console.log('\n' + '=' * 50);
    console.log('🎯 CORRECTED RESULTS');
    console.log('=' * 50);
    console.log(`Total edges for Hypha DAO: ${result.totalEdges}`);
    console.log(`Total proposal edges: ${result.proposalEdges}`);
    console.log('\nThis should be much more reasonable!');
  }
};

main();
