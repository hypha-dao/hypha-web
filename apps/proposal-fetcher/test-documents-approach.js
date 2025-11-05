const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch');

const rpc = new JsonRpc('https://mainnet.telos.net', { fetch });
const contract = 'dao.hypha';

async function testDocumentsApproach() {
    console.log('🎯 TESTING DOCUMENTS TABLE APPROACH');
    console.log('Instead of querying edges, let\'s query documents directly');
    console.log('and filter for proposal types...');
    
    const daoId = 29983; // Hypha DAO as number
    
    try {
        // Method 1: Query documents table directly
        console.log('\n=== METHOD 1: Query documents table ===');
        
        const docsResult = await rpc.get_table_rows({
            json: true,
            code: contract,
            scope: contract,
            table: 'documents',
            limit: 5000,
        });
        
        console.log(`Total documents sampled: ${docsResult.rows.length}`);
        console.log(`Has more: ${docsResult.more}`);
        
        // Filter documents that belong to Hypha DAO
        const hyphaProposals = docsResult.rows.filter(doc => {
            if (!doc.content_groups) return false;
            
            // Check if document belongs to our DAO
            for (const group of doc.content_groups) {
                for (const content of group) {
                    if (content.label === 'dao' && content.value[1] === daoId) {
                        return true;
                    }
                }
            }
            return false;
        });
        
        console.log(`Documents belonging to Hypha DAO: ${hyphaProposals.length}`);
        
        // Analyze document types
        const docTypes = {};
        hyphaProposals.forEach(doc => {
            if (doc.content_groups) {
                for (const group of doc.content_groups) {
                    for (const content of group) {
                        if (content.label === 'type') {
                            const type = content.value[1];
                            docTypes[type] = (docTypes[type] || 0) + 1;
                        }
                    }
                }
            }
        });
        
        console.log('\nDocument types found:');
        Object.entries(docTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });
        
        // Method 2: Try different table query approaches
        console.log('\n=== METHOD 2: Different edge query approaches ===');
        
        // Try querying edges without index_position
        const edgeResult1 = await rpc.get_table_rows({
            json: true,
            code: contract,
            scope: contract,
            table: 'edges',
            limit: 10000,
        });
        
        const hyphaEdges1 = edgeResult1.rows.filter(edge => edge.from_node === daoId);
        console.log(`Approach 2a (no index): ${hyphaEdges1.length} edges from Hypha DAO`);
        
        // Try with index_position 1
        try {
            const edgeResult2 = await rpc.get_table_rows({
                json: true,
                code: contract,
                scope: contract,
                table: 'edges',
                index_position: 1,
                key_type: 'i64',
                lower_bound: daoId,
                upper_bound: daoId,
                limit: 10000,
            });
            
            console.log(`Approach 2b (index 1): ${edgeResult2.rows.length} edges, more: ${edgeResult2.more}`);
        } catch (error) {
            console.log(`Approach 2b (index 1): Error - ${error.message}`);
        }
        
        // Method 3: Try to get ALL edges for the DAO with different approaches
        console.log('\n=== METHOD 3: Alternative edge queries ===');
        
        // Try without upper_bound
        const edgeResult3 = await rpc.get_table_rows({
            json: true,
            code: contract,
            scope: contract,
            table: 'edges',
            index_position: 2,
            key_type: 'i64',
            lower_bound: daoId.toString(),
            limit: 20000,
        });
        
        const hyphaEdges3 = edgeResult3.rows.filter(edge => edge.from_node === daoId);
        console.log(`Approach 3a (no upper_bound): ${hyphaEdges3.length} edges from Hypha DAO`);
        
        // Count proposal-related edges
        const proposalEdges3 = hyphaEdges3.filter(edge => 
            edge.edge_name === 'votable' ||
            edge.edge_name === 'passedprops' ||
            edge.edge_name === 'failedprops' ||
            edge.edge_name === 'closedprops' ||
            edge.edge_name === 'stagingprop' ||
            edge.edge_name === 'proposal'
        );
        
        console.log(`Proposal-related edges: ${proposalEdges3.length}`);
        
        const edgeBreakdown3 = {};
        proposalEdges3.forEach(edge => {
            edgeBreakdown3[edge.edge_name] = (edgeBreakdown3[edge.edge_name] || 0) + 1;
        });
        
        console.log('Breakdown:');
        Object.entries(edgeBreakdown3).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
        console.log(`\n🏆 RESULTS SUMMARY:`);
        console.log(`Method 1 (documents): ${hyphaProposals.length} DAO documents`);
        console.log(`Method 3 (no upper_bound): ${proposalEdges3.length} proposal edges`);
        console.log(`Target: 1200 proposals`);
        
        return {
            documentsCount: hyphaProposals.length,
            edgesCount: proposalEdges3.length,
            docTypes,
            edgeBreakdown: edgeBreakdown3
        };
        
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

testDocumentsApproach();
