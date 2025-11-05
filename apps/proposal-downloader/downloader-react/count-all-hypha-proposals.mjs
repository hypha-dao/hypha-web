import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch';

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

const getDocument = async (docId) => {
  try {
    const result = await rpc.get_table_rows({
      json: true,
      code: contract,
      scope: contract,
      table: 'documents',
      lower_bound: docId,
      upper_bound: docId,
      limit: 1,
    });

    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching document ${docId}:`, error);
    return null;
  }
};

const isProposalDocument = (doc) => {
  if (!doc || !doc.content_groups) return false;
  
  // Check if document has proposal-like characteristics
  for (const group of doc.content_groups) {
    for (const content of group) {
      if (content.label === 'type') {
        const type = content.value[1];
        // These are proposal/governance types
        if (['payout', 'assignment', 'assignbadge', 'role', 'circle', 'proposal', 'quest', 'contribution'].includes(type)) {
          return true;
        }
      }
    }
  }
  return false;
};

const getAllEdgesForDao = async (daoId) => {
  console.log(`🔍 Getting ALL edges for DAO ${daoId} with proper pagination...`);
  
  let allEdges = [];
  let lower_bound = null;
  let batchCount = 0;
  
  try {
    while (true) {
      batchCount++;
      console.log(`  Batch ${batchCount}...`);
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contract,
        scope: contract,
        table: 'edges',
        index_position: 2, // byfrom index
        key_type: 'i64',
        lower_bound: lower_bound || daoId,
        upper_bound: daoId,
        limit: 1000,
      });
      
      // Filter to only edges FROM our DAO
      const daoEdges = result.rows.filter(edge => edge.from_node.toString() === daoId);
      allEdges = allEdges.concat(daoEdges);
      
      console.log(`    Found ${result.rows.length} total edges, ${daoEdges.length} from our DAO (total: ${allEdges.length})`);
      
      if (result.more && result.next_key) {
        // Check if next_key is still for our DAO
        if (result.next_key.toString() === daoId || result.next_key < parseInt(daoId) + 1) {
          lower_bound = result.next_key;
        } else {
          console.log(`    Next key ${result.next_key} is beyond our DAO, stopping`);
          break;
        }
      } else {
        console.log(`    No more edges`);
        break;
      }
      
      // Safety break
      if (batchCount > 50) {
        console.log('⚠️  Safety break at 50 batches');
        break;
      }
    }
    
    return allEdges;
  } catch (error) {
    console.error('Error fetching edges:', error);
    return [];
  }
};

const main = async () => {
  console.log('📊 ACCURATELY COUNTING ALL HYPHA DAO PROPOSALS');
  console.log('=' * 60);
  
  const daoId = "29983"; // Hypha DAO
  
  // Step 1: Get ALL edges
  const allEdges = await getAllEdgesForDao(daoId);
  console.log(`\n✅ Total edges found: ${allEdges.length}`);
  
  // Step 2: Analyze all edge types
  const edgeTypes = allEdges.reduce((acc, edge) => {
    acc[edge.edge_name] = (acc[edge.edge_name] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📋 ALL EDGE TYPES:');
  Object.entries(edgeTypes)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  
  // Step 3: Get proposal-related edges
  const proposalEdgeTypes = [
    'stagingprop', 'closedprops', 'passedprops', 'failedprops', 'votable'
  ];
  
  const proposalEdges = allEdges.filter(edge => 
    proposalEdgeTypes.includes(edge.edge_name)
  );
  
  console.log(`\n📊 PROPOSAL EDGES BY TYPE:`);
  const proposalBreakdown = proposalEdges.reduce((acc, edge) => {
    acc[edge.edge_name] = (acc[edge.edge_name] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(proposalBreakdown).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log(`\nTotal proposal edges: ${proposalEdges.length}`);
  
  // Step 4: Sample some documents to verify they're actual proposals
  console.log(`\n🔍 VERIFYING DOCUMENT TYPES (sampling 10 from each edge type):`);
  
  const verificationResults = {};
  
  for (const edgeType of proposalEdgeTypes) {
    const edgesOfType = proposalEdges.filter(e => e.edge_name === edgeType);
    if (edgesOfType.length === 0) continue;
    
    console.log(`\n  Checking ${edgeType} (${edgesOfType.length} edges):`);
    
    const sampleSize = Math.min(10, edgesOfType.length);
    let proposalCount = 0;
    let otherCount = 0;
    const documentTypes = {};
    
    for (let i = 0; i < sampleSize; i++) {
      const edge = edgesOfType[i];
      const doc = await getDocument(edge.to_node);
      
      if (doc && doc.content_groups) {
        const typeField = doc.content_groups
          .flat()
          .find(content => content.label === 'type');
        
        if (typeField) {
          const docType = typeField.value[1];
          documentTypes[docType] = (documentTypes[docType] || 0) + 1;
          
          if (isProposalDocument(doc)) {
            proposalCount++;
          } else {
            otherCount++;
          }
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`    Document types found: ${Object.entries(documentTypes).map(([type, count]) => `${type}(${count})`).join(', ')}`);
    console.log(`    Proposals: ${proposalCount}/${sampleSize}, Other: ${otherCount}/${sampleSize}`);
    
    verificationResults[edgeType] = {
      total: edgesOfType.length,
      proposalPercentage: (proposalCount / sampleSize) * 100,
      documentTypes
    };
  }
  
  // Step 5: Calculate final estimate
  console.log(`\n🎯 FINAL ESTIMATE:`);
  
  let totalEstimatedProposals = 0;
  Object.entries(verificationResults).forEach(([edgeType, data]) => {
    const estimated = Math.round(data.total * (data.proposalPercentage / 100));
    totalEstimatedProposals += estimated;
    console.log(`  ${edgeType}: ${estimated} proposals (${data.proposalPercentage.toFixed(1)}% of ${data.total} edges)`);
  });
  
  console.log(`\n🏆 TOTAL ESTIMATED HYPHA DAO PROPOSALS: ${totalEstimatedProposals}`);
  console.log(`📥 Currently downloaded: 296 proposals`);
  console.log(`📊 Coverage: ${((296 / totalEstimatedProposals) * 100).toFixed(1)}%`);
  
  if (totalEstimatedProposals > 296) {
    const missing = totalEstimatedProposals - 296;
    console.log(`❌ Still missing: ~${missing} proposals`);
    
    if (allEdges.length >= 5000) {
      console.log(`\n💡 LIKELY CAUSE: Hit the 5000 edge limit`);
      console.log(`   Recommendation: Implement proper pagination in the React app`);
    }
  } else {
    console.log(`✅ Download appears complete!`);
  }
};

main();
